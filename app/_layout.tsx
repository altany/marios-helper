import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import { Modal, View, Text, TouchableOpacity, StyleSheet, BackHandler } from 'react-native';
import 'react-native-reanimated';
import { useColorScheme } from '@/hooks/useColorScheme';
import { usePushNotifications, registerForPushNotificationsAsync } from './services/notifications';
// Prevent the splash screen from auto-hiding before asset loading is complete.
SplashScreen.preventAutoHideAsync();

const  RootLayout = ()=> {
  const colorScheme = useColorScheme();
  const [loaded] = useFonts({
    SpaceMono: require('../assets/fonts/SpaceMono-Regular.ttf'),
  });

  const { notificationModal, handleModalAction } = usePushNotifications();

  useEffect(() => {
    registerForPushNotificationsAsync()
  }, []);

  useEffect(() => {
    if (loaded) {
      SplashScreen.hideAsync();
    }
  }, [loaded]);

  // Prevent Android back button from dismissing the modal without an action
  useEffect(() => {
    if (!notificationModal.visible) return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => true);
    return () => sub.remove();
  }, [notificationModal.visible]);

  if (!loaded) {
    return null;
  }

  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <Stack>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="details" />
      </Stack>
      <Modal
        visible={notificationModal.visible}
        transparent
        animationType="fade"
        onRequestClose={() => { /* blocked intentionally */ }}
      >
        <View style={modalStyles.overlay}>
          <View style={modalStyles.dialog}>
            <Text style={modalStyles.title}>Φάρμακο Μάριο</Text>
            <Text style={modalStyles.body}>{notificationModal.body}</Text>
            <TouchableOpacity style={modalStyles.button} onPress={() => handleModalAction('SNOOZE')}>
              <Text style={modalStyles.buttonText}>Θυμησε το μου ξανα (10')</Text>
            </TouchableOpacity>
            {notificationModal.hour === 15 ? (
              <TouchableOpacity style={[modalStyles.button, modalStyles.primaryButton]} onPress={() => handleModalAction('COMPLETE')}>
                <Text style={modalStyles.buttonText}>Τέλος</Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity style={[modalStyles.button, modalStyles.primaryButton]} onPress={() => handleModalAction('NEXT')}>
                <Text style={modalStyles.buttonText}>Το έδωσα → Lacrimmune σε 20'</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </Modal>
    </ThemeProvider>
  );
}

const modalStyles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  dialog: {
    backgroundColor: '#1e1e2e',
    borderRadius: 12,
    padding: 24,
    width: '85%',
    gap: 12,
  },
  title: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 4,
  },
  body: {
    color: '#cdd6f4',
    fontSize: 15,
    marginBottom: 8,
  },
  button: {
    backgroundColor: '#317181',
    borderRadius: 8,
    padding: 14,
    alignItems: 'center',
  },
  primaryButton: {
    backgroundColor: '#89b4fa',
  },
  buttonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },
});

export default RootLayout