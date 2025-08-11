# Firebase Cloud Functions - Notification System

This directory contains Firebase Cloud Functions that handle push notifications and email notifications for the Firebase CRUD Demo app.

## Features

- **Push Notifications**: Send notifications to all app users when CRUD operations are performed
- **Email Notifications**: Send email notifications to all users
- **Real-time Updates**: Automatic notifications triggered by Firestore changes
- **Multi-platform Support**: Works on both iOS and Android

## Setup Instructions

### 1. Install Dependencies

```bash
cd functions
npm install
```

### 2. Configure Email Service

For Gmail:
1. Enable 2-factor authentication on your Gmail account
2. Generate an App Password
3. Set Firebase Functions configuration:

```bash
firebase functions:config:set email.user="your-email@gmail.com"
firebase functions:config:set email.pass="your-app-password"
```

For other email services, update the transporter configuration in `src/index.ts`.

### 3. Deploy Functions

```bash
npm run build
firebase deploy --only functions
```

### 4. Configure Firebase Project

1. Enable Cloud Messaging in Firebase Console
2. Add your app to the project
3. Download and add the `google-services.json` file to your Android app
4. For iOS, add the `GoogleService-Info.plist` file

### 5. Configure Push Notifications

#### Android
1. Add the following to your `android/app/src/main/AndroidManifest.xml`:

```xml
<uses-permission android:name="android.permission.INTERNET" />
<uses-permission android:name="android.permission.WAKE_LOCK" />
<uses-permission android:name="android.permission.VIBRATE" />
<uses-permission android:name="android.permission.RECEIVE_BOOT_COMPLETED" />
<uses-permission android:name="android.permission.POST_NOTIFICATIONS" />
```

2. Create a notification channel in your MainActivity:

```kotlin
import android.app.NotificationChannel
import android.app.NotificationManager
import android.os.Build

class MainActivity : ReactActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(
                "default",
                "Default Channel",
                NotificationManager.IMPORTANCE_DEFAULT
            )
            val notificationManager = getSystemService(NotificationManager::class.java)
            notificationManager.createNotificationChannel(channel)
        }
    }
}
```

#### iOS
1. Add the following to your `ios/YourApp/Info.plist`:

```xml
<key>UIBackgroundModes</key>
<array>
    <string>remote-notification</string>
</array>
```

2. Add the following to your `ios/YourApp/AppDelegate.swift`:

```swift
import UserNotifications

@UIApplicationMain
class AppDelegate: UIResponder, UIApplicationDelegate, UNUserNotificationCenterDelegate {
    func application(_ application: UIApplication, didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?) -> Bool {
        UNUserNotificationCenter.current().delegate = self
        return true
    }
    
    func userNotificationCenter(_ center: UNUserNotificationCenter, willPresent notification: UNNotification, withCompletionHandler completionHandler: @escaping (UNNotificationPresentationOptions) -> Void) {
        completionHandler([.alert, .badge, .sound])
    }
}
```

## Functions Overview

### 1. sendNotificationToAllUsers
- **Purpose**: Send push notifications to all app users
- **Trigger**: Called from the app when CRUD operations are performed
- **Parameters**: 
  - `action`: 'CREATE', 'UPDATE', or 'DELETE'
  - `userData`: User information
  - `senderToken`: FCM token of the user who performed the action

### 2. sendEmailNotification
- **Purpose**: Send email notifications to all users
- **Trigger**: Called from the app when CRUD operations are performed
- **Parameters**:
  - `action`: 'CREATE', 'UPDATE', or 'DELETE'
  - `userData`: User information
  - `userEmail`: Email of the user who performed the action

### 3. onUserChange
- **Purpose**: Automatic notifications triggered by Firestore changes
- **Trigger**: Firestore document changes in the 'users' collection
- **Behavior**: Automatically sends notifications when users are added, updated, or deleted

## Notification Content

### Push Notifications
- **CREATE**: "New User Added - [Name] has been added to the system"
- **UPDATE**: "User Updated - [Name]'s information has been updated"
- **DELETE**: "User Deleted - [Name] has been removed from the system"

### Email Notifications
- **Subject**: Action-specific subject lines
- **Content**: HTML formatted emails with user details
- **Recipients**: All users except the one who performed the action

## Testing

1. **Local Testing**: Use Firebase Emulators
   ```bash
   firebase emulators:start --only functions
   ```

2. **Production Testing**: Deploy and test with real devices
   ```bash
   firebase deploy --only functions
   ```

## Troubleshooting

### Common Issues

1. **Push notifications not working**:
   - Check FCM token generation
   - Verify notification permissions
   - Check Firebase Console for errors

2. **Email notifications not working**:
   - Verify email configuration
   - Check Firebase Functions logs
   - Ensure email service credentials are correct

3. **Functions deployment fails**:
   - Check TypeScript compilation
   - Verify Firebase project configuration
   - Check billing status

### Logs

View function logs:
```bash
firebase functions:log
```

## Security Considerations

1. **Authentication**: Functions are callable by authenticated users
2. **Rate Limiting**: Consider implementing rate limiting for production
3. **Email Privacy**: Be mindful of user email privacy
4. **Data Validation**: Validate all input data in functions

## Cost Considerations

- **Push Notifications**: Free tier includes 1M messages/month
- **Email**: Consider using a dedicated email service for high volume
- **Function Calls**: Free tier includes 125K invocations/month
- **Firestore**: Free tier includes 50K reads/day

## Support

For issues and questions:
1. Check Firebase Console logs
2. Review Firebase documentation
3. Check function logs using `firebase functions:log`

