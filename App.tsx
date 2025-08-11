import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  Alert,
  ActivityIndicator,
  SafeAreaView,
  ToastAndroid,
  PermissionsAndroid,
  Platform,
  Vibration,
} from 'react-native';
import notifee, { AndroidImportance, AndroidStyle } from '@notifee/react-native';

// Suppress Firebase deprecation warnings in development
if (__DEV__) {
  const originalWarn = console.warn;
  console.warn = (...args) => {
    if (args[0] && typeof args[0] === 'string' && args[0].includes('deprecated') && args[0].includes('React Native Firebase')) {
      return; // Suppress Firebase deprecation warnings
    }
    originalWarn.apply(console, args);
  };
}

// Modern Firebase modular imports with better error handling
let firestore: any = null;
let messaging: any = null;
let functions: any = null;
let getApp: any = null;

try {
  const firebaseApp = require('@react-native-firebase/app');
  getApp = firebaseApp.getApp;
} catch (error) {
  console.log('Firebase App not available:', error);
}

try {
  const firebaseFirestore = require('@react-native-firebase/firestore');
  firestore = firebaseFirestore.default;
} catch (error) {
  console.log('Firebase Firestore not available:', error);
}

try {
  const firebaseMessaging = require('@react-native-firebase/messaging');
  messaging = firebaseMessaging.default;
} catch (error) {
  console.log('Firebase Messaging not available:', error);
}

try {
  const firebaseFunctions = require('@react-native-firebase/functions');
  functions = firebaseFunctions.default;
} catch (error) {
  console.log('Firebase Functions not available:', error);
}

interface User {
  id: string;
  name: string;
  email: string;
  age: string;
  createdAt?: any;
  fcmToken?: string;
}

interface ValidationErrors {
  name?: string;
  email?: string;
  age?: string;
}

interface InAppNotification {
  id: string;
  message: string;
  type: 'success' | 'info' | 'warning';
  timestamp: number;
}

// Enhanced Notification Service with Notifee
class NotificationService {
  private messagingAvailable = false;
  private permissionsGranted = false;
  private notificationChannelCreated = false;

  async initialize() {
    await this.createNotificationChannels();
    await this.requestPermissions();
    await this.setupFirebaseMessaging();
  }

  async createNotificationChannels() {
    try {
      if (Platform.OS === 'android') {
        // Create default notification channel
        await notifee.createChannel({
          id: 'default',
          name: 'Default Notifications',
          importance: AndroidImportance.DEFAULT,
          sound: 'default',
          vibration: true,
        });

        // Create high priority channel for important notifications
        await notifee.createChannel({
          id: 'high_priority',
          name: 'High Priority Notifications',
          importance: AndroidImportance.HIGH,
          sound: 'default',
          vibration: true,
        });

        // Create CRUD operations channel
        await notifee.createChannel({
          id: 'crud_operations',
          name: 'CRUD Operations',
          importance: AndroidImportance.HIGH,
          sound: 'default',
          vibration: true,
        });

        this.notificationChannelCreated = true;
        console.log('Notification channels created successfully');
      }
    } catch (error) {
      console.error('Error creating notification channels:', error);
    }
  }

  async requestPermissions() {
    try {
      if (Platform.OS === 'android') {
        // Check if permission is already granted
        const hasPermission = await PermissionsAndroid.check(
          PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS
        );
        
        console.log('Current notification permission status:', hasPermission);
        
        if (hasPermission) {
          this.permissionsGranted = true;
          console.log('Android notification permission already granted');
          return;
        }

        // Request permission with better explanation
        console.log('Requesting notification permission...');
        const granted = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS,
          {
            title: 'Notification Permission Required',
            message: 'This app needs notification permission to send you updates about user changes, reminders, and important alerts. Please enable notifications to get the best experience.',
            buttonNeutral: 'Ask Me Later',
            buttonNegative: 'Cancel',
            buttonPositive: 'Enable Notifications',
          }
        );
        
        this.permissionsGranted = granted === PermissionsAndroid.RESULTS.GRANTED;
        console.log('Android notification permission result:', granted);
        console.log('Android notification permission:', this.permissionsGranted ? 'granted' : 'denied');
        
        if (!this.permissionsGranted) {
          console.log('User denied notification permission. App will work with limited notification features.');
          // Show an alert to guide user to settings
          Alert.alert(
            'Notification Permission Required',
            'To receive notifications, please go to Settings > Apps > curdfirebasedemo > Notifications and enable them.',
            [
              { text: 'Cancel', style: 'cancel' },
              { text: 'Open Settings', onPress: () => {
                // This would ideally open app settings, but we'll just show a message
                Alert.alert('Settings', 'Please manually go to Settings > Apps > curdfirebasedemo > Notifications and enable them.');
              }}
            ]
          );
        }
      } else {
        // iOS permission handling
        this.permissionsGranted = true; // iOS handles this differently
      }
    } catch (error) {
      console.error('Error requesting notification permission:', error);
      this.permissionsGranted = false;
    }
  }

  async setupFirebaseMessaging() {
    if (!messaging) {
      console.log('Firebase Messaging not available - skipping setup');
      return;
    }

    try {
      const messagingInstance = getApp ? messaging(getApp()) : messaging();
      this.messagingAvailable = true;
      console.log('Firebase Messaging setup successful');
    } catch (error) {
      console.log('Firebase Messaging setup failed - using local notifications only:', (error as Error).message);
      this.messagingAvailable = false;
    }
  }

  // Show system notification using Notifee
  async showSystemNotification(title: string, message: string, type: 'success' | 'info' | 'warning' = 'info') {
    console.log(`Showing system notification: ${title} - ${message} (Permission: ${this.permissionsGranted})`);
    
    if (!this.permissionsGranted) {
      console.log('Notification permission not granted, falling back to toast');
      this.showFallbackNotification(title, message);
      return;
    }

    try {
      // Vibration feedback
      if (Platform.OS === 'android') {
        try {
          Vibration.vibrate(type === 'success' ? 100 : type === 'warning' ? 200 : 50);
          console.log('Vibration triggered');
        } catch (error) {
          console.log('Vibration not available:', (error as Error).message);
        }
      }

      // Display system notification
      await notifee.displayNotification({
        id: `notification_${Date.now()}`,
        title: title,
        body: message,
        android: {
          channelId: 'crud_operations',
          importance: AndroidImportance.HIGH,
          pressAction: {
            id: 'default',
          },
          actions: [
            {
              title: 'View',
              pressAction: {
                id: 'view',
              },
            },
            {
              title: 'Dismiss',
              pressAction: {
                id: 'dismiss',
              },
            },
          ],
          smallIcon: 'ic_launcher',
          color: type === 'success' ? '#28a745' : type === 'warning' ? '#ffc107' : '#17a2b8',
        },
      });

      console.log('System notification displayed successfully');
    } catch (error) {
      console.error('Error showing system notification:', error);
      // Fallback to toast
      this.showFallbackNotification(title, message);
    }
  }

  // Fallback notification methods
  showFallbackNotification(title: string, message: string) {
    // Toast notification (Android)
    if (Platform.OS === 'android') {
      try {
        ToastAndroid.show(`${title}: ${message}`, ToastAndroid.LONG);
        console.log('Toast notification shown');
      } catch (error) {
        console.log('Toast not available:', (error as Error).message);
      }
    }

    // Alert as fallback
    try {
      Alert.alert(title, message);
      console.log('Alert notification shown');
    } catch (error) {
      console.log('Alert not available:', (error as Error).message);
    }
  }

  // Cross-device push notification
  async sendPushNotification(action: string, userData: any, senderToken?: string) {
    if (!functions || !this.messagingAvailable) {
      console.log('Push notifications not available - skipping');
      return;
    }

    try {
      const functionsInstance = getApp ? functions(getApp()) : functions();
      const sendNotification = functionsInstance.httpsCallable('sendNotificationToAllUsers');
      
      await sendNotification({
        action,
        userData,
        senderToken,
        timestamp: new Date().toISOString(),
      });
      
      console.log('Push notification sent successfully');
    } catch (error) {
      console.log('Error sending push notification - continuing with local notifications:', (error as Error).message);
    }
  }

  // Email notification
  async sendEmailNotification(action: string, userData: any) {
    if (!functions) {
      console.log('Email notifications not available - skipping');
      return;
    }

    try {
      const functionsInstance = getApp ? functions(getApp()) : functions();
      const sendEmail = functionsInstance.httpsCallable('sendEmailNotification');
      
      await sendEmail({
        action,
        userData,
        timestamp: new Date().toISOString(),
      });
      
      console.log('Email notification sent successfully');
    } catch (error) {
      console.log('Error sending email notification - continuing with local notifications:', (error as Error).message);
    }
  }

  // Comprehensive notification for CRUD operations
  async notifyCRUDOperation(operation: 'CREATE' | 'UPDATE' | 'DELETE', userData: any, isLocalAction: boolean = false) {
    const operationMessages = {
      CREATE: {
        local: `✅ ${userData.name} has been added successfully!`,
        push: `📱 New user "${userData.name}" added to the system`,
        email: `New user registration: ${userData.name}`,
        system: `New user "${userData.name}" added to the system`,
      },
      UPDATE: {
        local: `✅ ${userData.name} has been updated successfully!`,
        push: `📱 User "${userData.name}" information has been updated`,
        email: `User information updated: ${userData.name}`,
        system: `User "${userData.name}" information has been updated`,
      },
      DELETE: {
        local: `🗑️ ${userData.name} has been deleted successfully!`,
        push: `📱 User "${userData.name}" has been removed from the system`,
        email: `User removed from system: ${userData.name}`,
        system: `User "${userData.name}" has been removed from the system`,
      },
    };

    const messages = operationMessages[operation];

    // Show system notification
    await this.showSystemNotification(
      operation === 'CREATE' ? 'User Added' : operation === 'UPDATE' ? 'User Updated' : 'User Deleted',
      messages.system,
      'success'
    );

    // Send cross-device notifications (only if not local action and messaging is available)
    if (!isLocalAction && this.messagingAvailable) {
      await this.sendPushNotification(operation, userData);
      await this.sendEmailNotification(operation, userData);
    }
  }

  // Test system notification function
  async testSystemNotification() {
    console.log('Testing system notification...');
    await this.showSystemNotification(
      'Test Notification',
      'This is a test system notification to verify the notification system is working!',
      'info'
    );
  }

  getStatus() {
    return {
      permissionsGranted: this.permissionsGranted,
      messagingAvailable: this.messagingAvailable,
      notificationChannelCreated: this.notificationChannelCreated,
      canSendPushNotifications: this.permissionsGranted && this.messagingAvailable,
    };
  }
}

const notificationService = new NotificationService();

// Utility function to generate unique IDs
const generateUniqueId = (): string => {
  return `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
};

function App() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [age, setAge] = useState('');
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [errors, setErrors] = useState<ValidationErrors>({});
  const [inAppNotifications, setInAppNotifications] = useState<InAppNotification[]>([]);
  const [fcmToken, setFcmToken] = useState<string>('');
  const [notificationStatus, setNotificationStatus] = useState<any>(null);
  const [db, setDb] = useState<any>(null);

  // Initialize Firebase with modern API
  useEffect(() => {
    if (firestore && getApp) {
      try {
        const app = getApp();
        const firestoreInstance = firestore(app);
        setDb(firestoreInstance);
        console.log('Firebase Firestore initialized successfully with modern API');
      } catch (error) {
        console.error('Error initializing Firestore:', error);
      }
    } else if (firestore) {
      // Fallback to legacy API if modern not available
      try {
        const firestoreInstance = firestore();
        setDb(firestoreInstance);
        console.log('Firebase Firestore initialized successfully with legacy API');
      } catch (error) {
        console.error('Error initializing Firestore:', error);
      }
    }
  }, []);

  // Initialize notification service
  useEffect(() => {
    const initializeNotifications = async () => {
      await notificationService.initialize();
      const status = notificationService.getStatus();
      setNotificationStatus(status);
      
      addInAppNotification('🔔 Enhanced notification system initialized', 'info');
      
      if (status.canSendPushNotifications) {
        addInAppNotification('📱 Push notifications enabled for cross-device alerts', 'success');
      } else {
        addInAppNotification('📱 Local notifications enabled - push notifications not available', 'info');
      }
    };

    initializeNotifications();
  }, []);

  // Get FCM token for cross-device notifications
  const getFCMToken = async () => {
    if (!messaging) {
      console.log('Firebase Messaging not available - skipping FCM token');
      return;
    }

    try {
      const messagingInstance = getApp ? messaging(getApp()) : messaging();
      const token = await messagingInstance.getToken();
      setFcmToken(token);
      console.log('FCM Token obtained successfully');
      return token;
    } catch (error) {
      console.log('FCM token not available - using local notifications only:', (error as Error).message);
    }
  };

  // Add in-app notification
  const addInAppNotification = (message: string, type: 'success' | 'info' | 'warning' = 'info') => {
    const notification: InAppNotification = {
      id: generateUniqueId(),
      message,
      type,
      timestamp: Date.now(),
    };
    
    setInAppNotifications(prev => [notification, ...prev.slice(0, 4)]);
    
    // Auto-remove after 5 seconds
    setTimeout(() => {
      setInAppNotifications(prev => prev.filter(n => n.id !== notification.id));
    }, 5000);
  };

  // Remove in-app notification
  const removeInAppNotification = (id: string) => {
    setInAppNotifications(prev => prev.filter(n => n.id !== id));
  };

  // Validation functions
  const validateName = (name: string): string | undefined => {
    if (!name.trim()) return 'Name is required';
    if (name.trim().length < 2) return 'Name must be at least 2 characters';
    if (name.trim().length > 50) return 'Name must be less than 50 characters';
    if (!/^[a-zA-Z\s]+$/.test(name.trim())) return 'Name can only contain letters and spaces';
    return undefined;
  };

  const validateEmail = (email: string): string | undefined => {
    if (!email.trim()) return 'Email is required';
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email.trim())) return 'Please enter a valid email address';
    return undefined;
  };

  const validateAge = (age: string): string | undefined => {
    if (!age.trim()) return 'Age is required';
    const ageNum = parseInt(age.trim());
    if (isNaN(ageNum)) return 'Age must be a number';
    if (ageNum < 1 || ageNum > 120) return 'Age must be between 1 and 120';
    return undefined;
  };

  // Validate all fields
  const validateForm = (): boolean => {
    const nameError = validateName(name);
    const emailError = validateEmail(email);
    const ageError = validateAge(age);

    const newErrors: ValidationErrors = {};
    if (nameError) newErrors.name = nameError;
    if (emailError) newErrors.email = emailError;
    if (ageError) newErrors.age = ageError;

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Clear errors when user starts typing
  const clearError = (field: keyof ValidationErrors) => {
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: undefined }));
    }
  };

  // CREATE - Add new user
  const addUser = async () => {
    if (!validateForm()) {
      notificationService.showFallbackNotification('Validation Error', 'Please fix the validation errors');
      addInAppNotification('Please fix the validation errors', 'warning');
      return;
    }

    setSubmitting(true);
    try {
      const userData = {
        name: name.trim(),
        email: email.trim(),
        age: age.trim(),
        fcmToken: fcmToken,
        createdAt: db ? firestore.FieldValue.serverTimestamp() : new Date(),
      };

      let newUser: User;

      if (db) {
        // Use Firebase
        const docRef = await db.collection('users').add(userData);
        newUser = {
          id: docRef.id,
          ...userData,
        };

        // Send cross-device notifications
        await notificationService.notifyCRUDOperation('CREATE', { ...userData, id: docRef.id });
      } else {
        // Use local state
        newUser = {
          id: generateUniqueId(),
          ...userData,
        };

        // Local notification only
        await notificationService.notifyCRUDOperation('CREATE', newUser, true);
      }

      setUsers(prev => [newUser, ...prev]);
      setName('');
      setEmail('');
      setAge('');
      setErrors({});
      
      // Add notification for other users
      if (users.length > 0) {
        addInAppNotification(`📢 Notification: New user "${userData.name}" added to the system`, 'info');
      }
    } catch (error) {
      console.error('Error adding user:', error);
      notificationService.showFallbackNotification('Error', 'Failed to add user. Please try again.');
      addInAppNotification('❌ Failed to add user. Please try again.', 'warning');
    } finally {
      setSubmitting(false);
    }
  };

  // READ - Fetch all users
  const fetchUsers = async () => {
    try {
      if (db) {
        // Use Firebase
        const snapshot = await db.collection('users').orderBy('createdAt', 'desc').get();
        const userList: User[] = [];
        snapshot.forEach((doc: any) => {
          userList.push({
            id: doc.id,
            ...doc.data(),
          } as User);
        });
        setUsers(userList);
      } else {
        // Use local state (already loaded)
        setUsers([]);
      }
    } catch (error) {
      console.error('Error fetching users:', error);
      notificationService.showFallbackNotification('Error', 'Failed to fetch users');
      addInAppNotification('❌ Failed to fetch users', 'warning');
    } finally {
      setLoading(false);
    }
  };

  // UPDATE - Update user
  const updateUser = async () => {
    if (!editingUser) return;

    if (!validateForm()) {
      notificationService.showFallbackNotification('Validation Error', 'Please fix the validation errors');
      addInAppNotification('Please fix the validation errors', 'warning');
      return;
    }

    setSubmitting(true);
    try {
      const updatedData = {
        name: name.trim(),
        email: email.trim(),
        age: age.trim(),
        fcmToken: fcmToken,
      };

      if (db) {
        // Use Firebase
        await db.collection('users').doc(editingUser.id).update(updatedData);
        
        // Send cross-device notifications
        await notificationService.notifyCRUDOperation('UPDATE', { ...updatedData, id: editingUser.id, oldData: editingUser });
      } else {
        // Use local state
        setUsers(prev => prev.map(user => 
          user.id === editingUser.id ? { ...user, ...updatedData } : user
        ));

        // Local notification only
        await notificationService.notifyCRUDOperation('UPDATE', { ...updatedData, id: editingUser.id }, true);
      }

      setEditingUser(null);
      setName('');
      setEmail('');
      setAge('');
      setErrors({});
      
      // Add notification for other users
      if (users.length > 1) {
        addInAppNotification(`📢 Notification: User "${updatedData.name}" information has been updated`, 'info');
      }
    } catch (error) {
      console.error('Error updating user:', error);
      notificationService.showFallbackNotification('Error', 'Failed to update user. Please try again.');
      addInAppNotification('❌ Failed to update user. Please try again.', 'warning');
    } finally {
      setSubmitting(false);
    }
  };

  // DELETE - Delete user
  const deleteUser = async (userId: string) => {
    Alert.alert(
      'Confirm Delete',
      'Are you sure you want to delete this user?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              const userToDelete = users.find(user => user.id === userId);

              if (db) {
                // Use Firebase
                await db.collection('users').doc(userId).delete();
                
                // Send cross-device notifications
                if (userToDelete) {
                  await notificationService.notifyCRUDOperation('DELETE', { id: userId, deletedUser: userToDelete });
                }
              } else {
                // Use local state
                setUsers(prev => prev.filter(user => user.id !== userId));

                // Local notification only
                if (userToDelete) {
                  await notificationService.notifyCRUDOperation('DELETE', { id: userId, deletedUser: userToDelete }, true);
                }
              }
              
              // Add notification for other users
              if (users.length > 1) {
                addInAppNotification(`📢 Notification: User "${userToDelete?.name || 'User'}" has been removed from the system`, 'info');
              }
            } catch (error) {
              console.error('Error deleting user:', error);
              notificationService.showFallbackNotification('Error', 'Failed to delete user. Please try again.');
              addInAppNotification('❌ Failed to delete user. Please try again.', 'warning');
            }
          },
        },
      ]
    );
  };

  // Start editing user
  const startEditing = (user: User) => {
    setEditingUser(user);
    setName(user.name);
    setEmail(user.email);
    setAge(user.age);
    setErrors({});
    addInAppNotification(`✏️ Editing user: ${user.name}`, 'info');
  };

  // Cancel editing
  const cancelEditing = () => {
    setEditingUser(null);
    setName('');
    setEmail('');
    setAge('');
    setErrors({});
    addInAppNotification('❌ Edit cancelled', 'info');
  };

  // Initialize app
  useEffect(() => {
    const initializeApp = async () => {
      await getFCMToken();
      await fetchUsers();
    };

    initializeApp();
  }, [db]);

  // Handle foreground messages
  useEffect(() => {
    if (!messaging) {
      console.log('Firebase Messaging not available - skipping foreground handler');
      return;
    }

    try {
      const messagingInstance = getApp ? messaging(getApp()) : messaging();
      const unsubscribe = messagingInstance.onMessage(async (remoteMessage: any) => {
        console.log('Received foreground message:', remoteMessage);
        notificationService.showSystemNotification(
          remoteMessage.notification?.title || 'New notification',
          remoteMessage.notification?.body || 'You have a new notification'
        );
        addInAppNotification(`📱 ${remoteMessage.notification?.title || 'New notification received'}`, 'info');
      });

      return unsubscribe;
    } catch (error) {
      console.log('Foreground message handler not available - using local notifications only:', (error as Error).message);
    }
  }, []);

  // Handle background messages
  useEffect(() => {
    if (!messaging) {
      console.log('Firebase Messaging not available - skipping background handler');
      return;
    }

    try {
      const messagingInstance = getApp ? messaging(getApp()) : messaging();
      messagingInstance.setBackgroundMessageHandler(async (remoteMessage: any) => {
        console.log('Received background message:', remoteMessage);
      });
    } catch (error) {
      console.log('Background message handler not available - using local notifications only:', (error as Error).message);
    }
  }, []);

  // Listen for real-time updates (Firebase only)
  useEffect(() => {
    if (!db) return;

    try {
      const unsubscribe = db.collection('users')
        .orderBy('createdAt', 'desc')
        .onSnapshot((snapshot: any) => {
          const userList: User[] = [];
          snapshot.forEach((doc: any) => {
            userList.push({
              id: doc.id,
              ...doc.data(),
            } as User);
          });
          setUsers(userList);
          setLoading(false);
        }, (error: any) => {
          console.error('Error listening to users:', error);
          setLoading(false);
        });

      return () => unsubscribe();
    } catch (error) {
      console.error('Error setting up real-time listener:', error);
      setLoading(false);
    }
  }, [db]);

  const renderUser = ({ item }: { item: User }) => (
    <View style={styles.userCard}>
      <View style={styles.userInfo}>
        <Text style={styles.userName}>{item.name}</Text>
        <Text style={styles.userEmail}>{item.email}</Text>
        <Text style={styles.userAge}>Age: {item.age}</Text>
      </View>
      <View style={styles.userActions}>
        <TouchableOpacity
          style={[styles.button, styles.editButton]}
          onPress={() => startEditing(item)}
        >
          <Text style={styles.buttonText}>Edit</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.button, styles.deleteButton]}
          onPress={() => deleteUser(item.id)}
        >
          <Text style={styles.buttonText}>Delete</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  const renderNotification = ({ item }: { item: InAppNotification }) => (
    <TouchableOpacity
      style={[
        styles.notificationItem,
        item.type === 'success' && styles.notificationSuccess,
        item.type === 'warning' && styles.notificationWarning,
        item.type === 'info' && styles.notificationInfo,
      ]}
      onPress={() => removeInAppNotification(item.id)}
    >
      <Text style={styles.notificationText}>{item.message}</Text>
      <TouchableOpacity
        style={styles.notificationClose}
        onPress={() => removeInAppNotification(item.id)}
      >
        <Text style={styles.notificationCloseText}>×</Text>
      </TouchableOpacity>
    </TouchableOpacity>
  );

  // Loading state
  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#007AFF" />
          <Text style={styles.loadingText}>Loading users...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Enhanced CRUD Demo</Text>
        <Text style={styles.subtitle}>Create, Read, Update, Delete Users</Text>
        <Text style={styles.notificationStatus}>
          {notificationStatus?.notificationChannelCreated ? 
            (notificationStatus?.permissionsGranted ? 
              '🔔 System Notifications Enabled' : 
              '📱 System Notifications Ready (Permission Needed)') : 
            '📱 Setting up notifications...'
          }
        </Text>
        <Text style={styles.infoText}>
          {db ? 'Real-time updates across all devices' : 'Local storage with enhanced notifications'}
        </Text>
        
        {/* Test Notification Button */}
        <TouchableOpacity
          style={styles.testButton}
          onPress={() => notificationService.testSystemNotification()}
        >
          <Text style={styles.testButtonText}>🔔 Test Notifications</Text>
        </TouchableOpacity>
      </View>

      {/* In-App Notifications */}
      {inAppNotifications.length > 0 && (
        <View style={styles.notificationsContainer}>
          <FlatList
            data={inAppNotifications}
            renderItem={renderNotification}
            keyExtractor={(item) => item.id}
            horizontal={false}
            showsVerticalScrollIndicator={false}
          />
        </View>
      )}

      <View style={styles.form}>
        <Text style={styles.formTitle}>
          {editingUser ? 'Edit User' : 'Add New User'}
        </Text>
        
        <View style={styles.inputContainer}>
          <TextInput
            style={[styles.input, errors.name && styles.inputError]}
            placeholder="Enter user name"
            placeholderTextColor="#999"
            value={name}
            onChangeText={(text) => {
              setName(text);
              clearError('name');
            }}
          />
          {errors.name && <Text style={styles.errorText}>{errors.name}</Text>}
        </View>
        
        <View style={styles.inputContainer}>
          <TextInput
            style={[styles.input, errors.email && styles.inputError]}
            placeholder="Enter email address"
            placeholderTextColor="#999"
            value={email}
            onChangeText={(text) => {
              setEmail(text);
              clearError('email');
            }}
            keyboardType="email-address"
            autoCapitalize="none"
          />
          {errors.email && <Text style={styles.errorText}>{errors.email}</Text>}
        </View>
        
        <View style={styles.inputContainer}>
          <TextInput
            style={[styles.input, errors.age && styles.inputError]}
            placeholder="Enter age"
            placeholderTextColor="#999"
            value={age}
            onChangeText={(text) => {
              setAge(text);
              clearError('age');
            }}
            keyboardType="numeric"
          />
          {errors.age && <Text style={styles.errorText}>{errors.age}</Text>}
        </View>

        <View style={styles.formButtons}>
          {editingUser ? (
            <>
              <TouchableOpacity
                style={[styles.button, styles.updateButton, submitting && styles.disabledButton]}
                onPress={updateUser}
                disabled={submitting}
              >
                {submitting ? (
                  <ActivityIndicator size="small" color="white" />
                ) : (
                  <Text style={styles.buttonText}>Update User</Text>
                )}
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.button, styles.cancelButton]}
                onPress={cancelEditing}
                disabled={submitting}
              >
                <Text style={styles.buttonText}>Cancel</Text>
              </TouchableOpacity>
            </>
          ) : (
            <TouchableOpacity
              style={[styles.button, styles.addButton, submitting && styles.disabledButton]}
              onPress={addUser}
              disabled={submitting}
            >
              {submitting ? (
                <ActivityIndicator size="small" color="white" />
              ) : (
                <Text style={styles.buttonText}>Add User</Text>
              )}
            </TouchableOpacity>
          )}
        </View>
      </View>

      <View style={styles.listContainer}>
        <Text style={styles.listTitle}>Users ({users.length})</Text>
        <FlatList
          data={users}
          renderItem={renderUser}
          keyExtractor={(item) => item.id}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>No users found</Text>
              <Text style={styles.emptySubtext}>Add a user to get started!</Text>
            </View>
          }
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    backgroundColor: '#007AFF',
    padding: 20,
    alignItems: 'center',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: 'white',
    marginBottom: 5,
  },
  subtitle: {
    fontSize: 16,
    color: 'white',
    opacity: 0.8,
    marginBottom: 5,
  },
  notificationStatus: {
    fontSize: 12,
    color: 'white',
    opacity: 0.9,
    marginBottom: 5,
  },
  infoText: {
    fontSize: 10,
    color: 'white',
    opacity: 0.7,
    textAlign: 'center',
  },
  notificationsContainer: {
    maxHeight: 200,
    paddingHorizontal: 15,
    paddingTop: 10,
  },
  notificationItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 12,
    marginBottom: 8,
    borderRadius: 8,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
  },
  notificationSuccess: {
    backgroundColor: '#d4edda',
    borderLeftWidth: 4,
    borderLeftColor: '#28a745',
  },
  notificationWarning: {
    backgroundColor: '#fff3cd',
    borderLeftWidth: 4,
    borderLeftColor: '#ffc107',
  },
  notificationInfo: {
    backgroundColor: '#d1ecf1',
    borderLeftWidth: 4,
    borderLeftColor: '#17a2b8',
  },
  notificationText: {
    flex: 1,
    fontSize: 14,
    color: '#333',
  },
  notificationClose: {
    marginLeft: 10,
    width: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  notificationCloseText: {
    fontSize: 18,
    color: '#666',
    fontWeight: 'bold',
  },
  form: {
    backgroundColor: 'white',
    margin: 15,
    padding: 20,
    borderRadius: 10,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  formTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 15,
    color: '#333',
  },
  inputContainer: {
    marginBottom: 15,
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    color: '#333',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    backgroundColor: '#fafafa',
  },
  inputError: {
    borderColor: '#dc3545',
    backgroundColor: '#fff5f5',
  },
  errorText: {
    color: '#dc3545',
    fontSize: 12,
    marginTop: 5,
    marginLeft: 5,
  },
  formButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  button: {
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
    flex: 1,
    marginHorizontal: 5,
    minHeight: 48,
    justifyContent: 'center',
  },
  disabledButton: {
    opacity: 0.6,
  },
  addButton: {
    backgroundColor: '#28a745',
  },
  updateButton: {
    backgroundColor: '#ffc107',
  },
  cancelButton: {
    backgroundColor: '#6c757d',
  },
  editButton: {
    backgroundColor: '#17a2b8',
    marginRight: 5,
  },
  deleteButton: {
    backgroundColor: '#dc3545',
  },
  buttonText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 14,
  },
  listContainer: {
    flex: 1,
    margin: 15,
  },
  listTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 10,
    color: '#333',
  },
  userCard: {
    backgroundColor: 'white',
    padding: 15,
    borderRadius: 10,
    marginBottom: 10,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  userInfo: {
    marginBottom: 10,
  },
  userName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 5,
  },
  userEmail: {
    fontSize: 14,
    color: '#666',
    marginBottom: 3,
  },
  userAge: {
    fontSize: 14,
    color: '#666',
  },
  userActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: '#666',
  },
  emptyContainer: {
    alignItems: 'center',
    padding: 40,
  },
  emptyText: {
    fontSize: 18,
    color: '#666',
    marginBottom: 5,
  },
           emptySubtext: {
           fontSize: 14,
           color: '#999',
         },
         testButton: {
           backgroundColor: '#FF6B35',
           paddingHorizontal: 20,
           paddingVertical: 10,
           borderRadius: 20,
           marginTop: 10,
           elevation: 3,
           shadowColor: '#000',
           shadowOffset: { width: 0, height: 2 },
           shadowOpacity: 0.25,
           shadowRadius: 3.84,
         },
         testButtonText: {
           color: 'white',
           fontSize: 14,
           fontWeight: 'bold',
         },
       });

export default App;
