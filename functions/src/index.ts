import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import * as nodemailer from 'nodemailer';

admin.initializeApp();

const db = admin.firestore();

// Email configuration (you'll need to set up your email service)
const transporter = nodemailer.createTransporter({
  service: 'gmail', // or your email service
  auth: {
    user: functions.config().email?.user || 'your-email@gmail.com',
    pass: functions.config().email?.pass || 'your-app-password'
  }
});

// Send push notification to all users
export const sendNotificationToAllUsers = functions.https.onCall(async (data, context) => {
  try {
    const { action, userData, senderToken } = data;

    // Get all user FCM tokens
    const usersSnapshot = await db.collection('users').get();
    const tokens: string[] = [];

    usersSnapshot.forEach((doc) => {
      const userData = doc.data();
      if (userData.fcmToken && userData.fcmToken !== senderToken) {
        tokens.push(userData.fcmToken);
      }
    });

    if (tokens.length === 0) {
      return { success: false, message: 'No users to notify' };
    }

    // Create notification message
    let title = '';
    let body = '';

    switch (action) {
      case 'CREATE':
        title = 'New User Added';
        body = `${userData.name} has been added to the system`;
        break;
      case 'UPDATE':
        title = 'User Updated';
        body = `${userData.name}'s information has been updated`;
        break;
      case 'DELETE':
        title = 'User Deleted';
        body = `${userData.deletedUser.name} has been removed from the system`;
        break;
      default:
        title = 'System Update';
        body = 'A change has been made to the user database';
    }

    // Send notification to all users
    const message = {
      notification: {
        title,
        body,
      },
      data: {
        action,
        userId: userData.id || '',
        timestamp: Date.now().toString(),
      },
      tokens,
    };

    const response = await admin.messaging().sendMulticast(message);
    
    console.log('Successfully sent messages:', response.successCount);
    console.log('Failed to send messages:', response.failureCount);

    return {
      success: true,
      successCount: response.successCount,
      failureCount: response.failureCount,
    };
  } catch (error) {
    console.error('Error sending notification:', error);
    throw new functions.https.HttpsError('internal', 'Failed to send notification');
  }
});

// Send email notification
export const sendEmailNotification = functions.https.onCall(async (data, context) => {
  try {
    const { action, userData, userEmail } = data;

    // Get all user emails
    const usersSnapshot = await db.collection('users').get();
    const emails: string[] = [];

    usersSnapshot.forEach((doc) => {
      const userData = doc.data();
      if (userData.email && userData.email !== userEmail) {
        emails.push(userData.email);
      }
    });

    if (emails.length === 0) {
      return { success: false, message: 'No users to email' };
    }

    // Create email content
    let subject = '';
    let htmlContent = '';

    switch (action) {
      case 'CREATE':
        subject = 'New User Added - Firebase CRUD Demo';
        htmlContent = `
          <h2>New User Added</h2>
          <p>A new user has been added to the system:</p>
          <ul>
            <li><strong>Name:</strong> ${userData.name}</li>
            <li><strong>Email:</strong> ${userData.email}</li>
            <li><strong>Age:</strong> ${userData.age}</li>
          </ul>
          <p>This notification was sent automatically by the Firebase CRUD Demo app.</p>
        `;
        break;
      case 'UPDATE':
        subject = 'User Updated - Firebase CRUD Demo';
        htmlContent = `
          <h2>User Information Updated</h2>
          <p>A user's information has been updated:</p>
          <ul>
            <li><strong>Name:</strong> ${userData.name}</li>
            <li><strong>Email:</strong> ${userData.email}</li>
            <li><strong>Age:</strong> ${userData.age}</li>
          </ul>
          <p>This notification was sent automatically by the Firebase CRUD Demo app.</p>
        `;
        break;
      case 'DELETE':
        subject = 'User Deleted - Firebase CRUD Demo';
        htmlContent = `
          <h2>User Removed</h2>
          <p>A user has been removed from the system:</p>
          <ul>
            <li><strong>Name:</strong> ${userData.deletedUser.name}</li>
            <li><strong>Email:</strong> ${userData.deletedUser.email}</li>
            <li><strong>Age:</strong> ${userData.deletedUser.age}</li>
          </ul>
          <p>This notification was sent automatically by the Firebase CRUD Demo app.</p>
        `;
        break;
      default:
        subject = 'System Update - Firebase CRUD Demo';
        htmlContent = `
          <h2>System Update</h2>
          <p>A change has been made to the user database.</p>
          <p>This notification was sent automatically by the Firebase CRUD Demo app.</p>
        `;
    }

    // Send emails to all users
    const emailPromises = emails.map(email => {
      const mailOptions = {
        from: functions.config().email?.user || 'your-email@gmail.com',
        to: email,
        subject,
        html: htmlContent,
      };

      return transporter.sendMail(mailOptions);
    });

    const results = await Promise.allSettled(emailPromises);
    const successCount = results.filter(result => result.status === 'fulfilled').length;
    const failureCount = results.filter(result => result.status === 'rejected').length;

    console.log('Successfully sent emails:', successCount);
    console.log('Failed to send emails:', failureCount);

    return {
      success: true,
      successCount,
      failureCount,
    };
  } catch (error) {
    console.error('Error sending email notification:', error);
    throw new functions.https.HttpsError('internal', 'Failed to send email notification');
  }
});

// Trigger notifications on Firestore changes (alternative approach)
export const onUserChange = functions.firestore
  .document('users/{userId}')
  .onWrite(async (change, context) => {
    const userId = context.params.userId;
    
    if (!change.before.exists) {
      // New document created
      const newData = change.after.data();
      await sendNotificationToAllUsers({
        action: 'CREATE',
        userData: { ...newData, id: userId },
        senderToken: newData?.fcmToken || '',
      });
    } else if (!change.after.exists) {
      // Document deleted
      const oldData = change.before.data();
      await sendNotificationToAllUsers({
        action: 'DELETE',
        userData: { deletedUser: oldData, id: userId },
        senderToken: '',
      });
    } else {
      // Document updated
      const newData = change.after.data();
      const oldData = change.before.data();
      await sendNotificationToAllUsers({
        action: 'UPDATE',
        userData: { ...newData, id: userId, oldData },
        senderToken: newData?.fcmToken || '',
      });
    }
  });

