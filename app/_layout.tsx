import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect, useRef, useState } from 'react';
import { Modal, View, Text, TouchableOpacity, StyleSheet, BackHandler, ScrollView } from 'react-native';
import 'react-native-reanimated';
import { useColorScheme } from '@/hooks/useColorScheme';
import { usePushNotifications, registerForPushNotificationsAsync } from './services/notifications';

SplashScreen.preventAutoHideAsync();

const SNOOZE_OPTIONS = [5, 10, 15, 20, 30, 45, 60, 90, 120];
const ITEM_HEIGHT = 52;
const VISIBLE_ITEMS = 3;
const PICKER_HEIGHT = ITEM_HEIGHT * VISIBLE_ITEMS;

const formatMinutes = (min: number) => {
  if (min < 60) return `${min} λεπτά`;
  if (min === 60) return '1 ώρα';
  if (min === 90) return '1½ ώρα';
  return `${min / 60} ώρες`;
};

const RootLayout = () => {
  const colorScheme = useColorScheme();
  const [loaded] = useFonts({
    SpaceMono: require('../assets/fonts/SpaceMono-Regular.ttf'),
  });

  const { notificationModal, handleModalAction } = usePushNotifications();
  const [snoozePickerOpen, setSnoozePickerOpen] = useState(false);
  const [selectedMinutes, setSelectedMinutes] = useState(10);
  const pickerRef = useRef<ScrollView>(null);

  useEffect(() => {
    registerForPushNotificationsAsync();
  }, []);

  useEffect(() => {
    if (loaded) {
      SplashScreen.hideAsync();
    }
  }, [loaded]);

  // Reset picker state when modal closes
  useEffect(() => {
    if (!notificationModal.visible) {
      setSnoozePickerOpen(false);
      setSelectedMinutes(10);
    }
  }, [notificationModal.visible]);

  // Scroll wheel to current selection when picker opens
  useEffect(() => {
    if (snoozePickerOpen) {
      const idx = SNOOZE_OPTIONS.indexOf(selectedMinutes);
      setTimeout(() => {
        pickerRef.current?.scrollTo({ y: idx * ITEM_HEIGHT, animated: false });
      }, 50);
    }
  }, [snoozePickerOpen]);

  // Prevent Android back button from dismissing the modal without an action
  useEffect(() => {
    if (!notificationModal.visible) return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (snoozePickerOpen) {
        setSnoozePickerOpen(false);
        return true;
      }
      return true; // block dismiss
    });
    return () => sub.remove();
  }, [notificationModal.visible, snoozePickerOpen]);

  if (!loaded) return null;

  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <Stack>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      </Stack>
      <Modal
        visible={notificationModal.visible}
        transparent
        animationType="fade"
        onRequestClose={() => { /* blocked intentionally */ }}
      >
        <View style={modalStyles.overlay}>
          <View style={modalStyles.dialog}>
            {snoozePickerOpen ? (
              <>
                <Text style={modalStyles.title}>Αργότερα σε...</Text>

                <View style={modalStyles.pickerContainer}>
                  {/* Selection highlight band */}
                  <View style={modalStyles.pickerHighlight} pointerEvents="none" />

                  <ScrollView
                    ref={pickerRef}
                    style={{ height: PICKER_HEIGHT }}
                    contentContainerStyle={{ paddingVertical: ITEM_HEIGHT }}
                    snapToInterval={ITEM_HEIGHT}
                    decelerationRate="fast"
                    showsVerticalScrollIndicator={false}
                    onMomentumScrollEnd={(e) => {
                      const idx = Math.round(e.nativeEvent.contentOffset.y / ITEM_HEIGHT);
                      const clamped = Math.max(0, Math.min(idx, SNOOZE_OPTIONS.length - 1));
                      setSelectedMinutes(SNOOZE_OPTIONS[clamped]);
                    }}
                  >
                    {SNOOZE_OPTIONS.map((min) => (
                      <View key={min} style={modalStyles.pickerItem}>
                        <Text style={[
                          modalStyles.pickerItemText,
                          selectedMinutes === min && modalStyles.pickerItemTextSelected,
                        ]}>
                          {formatMinutes(min)}
                        </Text>
                      </View>
                    ))}
                  </ScrollView>
                </View>

                <View style={modalStyles.row}>
                  <TouchableOpacity
                    style={[modalStyles.button, modalStyles.halfButton]}
                    onPress={() => setSnoozePickerOpen(false)}
                  >
                    <Text style={modalStyles.buttonText}>Πίσω</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[modalStyles.button, modalStyles.primaryButton, modalStyles.halfButton]}
                    onPress={() => handleModalAction(`SNOOZE_${selectedMinutes}`)}
                  >
                    <Text style={modalStyles.buttonText}>Επιβεβαίωση</Text>
                  </TouchableOpacity>
                </View>
              </>
            ) : (
              <>
                <Text style={modalStyles.title}>Φάρμακο Μάριο</Text>
                <Text style={modalStyles.body}>{notificationModal.body}</Text>

                <TouchableOpacity
                  style={modalStyles.button}
                  onPress={() => setSnoozePickerOpen(true)}
                >
                  <Text style={modalStyles.buttonText}>Αργότερα...</Text>
                </TouchableOpacity>

                {notificationModal.hasChain ? (
                  <TouchableOpacity
                    style={[modalStyles.button, modalStyles.primaryButton]}
                    onPress={() => handleModalAction('NEXT')}
                  >
                    <Text style={modalStyles.buttonText}>Το έδωσα</Text>
                  </TouchableOpacity>
                ) : (
                  <TouchableOpacity
                    style={[modalStyles.button, modalStyles.primaryButton]}
                    onPress={() => handleModalAction('COMPLETE')}
                  >
                    <Text style={modalStyles.buttonText}>Τέλος</Text>
                  </TouchableOpacity>
                )}
              </>
            )}
          </View>
        </View>
      </Modal>
    </ThemeProvider>
  );
};

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
  pickerContainer: {
    borderRadius: 10,
    overflow: 'hidden',
    backgroundColor: '#2a2a3e',
  },
  pickerHighlight: {
    position: 'absolute',
    top: ITEM_HEIGHT,
    left: 0,
    right: 0,
    height: ITEM_HEIGHT,
    backgroundColor: '#317181',
    borderRadius: 8,
    opacity: 0.4,
    zIndex: 1,
  },
  pickerItem: {
    height: ITEM_HEIGHT,
    justifyContent: 'center',
    alignItems: 'center',
  },
  pickerItemText: {
    color: '#a6adc8',
    fontSize: 17,
  },
  pickerItemTextSelected: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 19,
  },
  row: {
    flexDirection: 'row',
    gap: 8,
  },
  button: {
    backgroundColor: '#317181',
    borderRadius: 8,
    padding: 14,
    alignItems: 'center',
  },
  halfButton: {
    flex: 1,
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

export default RootLayout;
