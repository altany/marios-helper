import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect, useRef, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, BackHandler, ScrollView, useColorScheme } from 'react-native';
import 'react-native-reanimated';
import { usePushNotifications, registerForPushNotificationsAsync } from './services/notifications';
import { getColors } from './theme';

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
  const scheme = useColorScheme() ?? 'dark';
  const c = getColors(scheme);
  const [loaded] = useFonts({ SpaceMono: require('../assets/fonts/SpaceMono-Regular.ttf') });
  const { notificationModal, handleModalAction } = usePushNotifications();
  const [snoozePickerOpen, setSnoozePickerOpen] = useState(false);
  const [selectedMinutes, setSelectedMinutes] = useState(10);
  const pickerRef = useRef<ScrollView>(null);

  useEffect(() => { registerForPushNotificationsAsync(); }, []);
  useEffect(() => { if (loaded) SplashScreen.hideAsync(); }, [loaded]);

  useEffect(() => {
    if (!notificationModal.visible) {
      setSnoozePickerOpen(false);
      setSelectedMinutes(10);
    }
  }, [notificationModal.visible]);

  useEffect(() => {
    if (snoozePickerOpen) {
      const idx = SNOOZE_OPTIONS.indexOf(selectedMinutes);
      setTimeout(() => {
        pickerRef.current?.scrollTo({ y: idx * ITEM_HEIGHT, animated: false });
      }, 50);
    }
  }, [snoozePickerOpen]);

  useEffect(() => {
    if (!notificationModal.visible) return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (snoozePickerOpen) { setSnoozePickerOpen(false); return true; }
      return true;
    });
    return () => sub.remove();
  }, [notificationModal.visible, snoozePickerOpen]);

  if (!loaded) return null;

  return (
    <ThemeProvider value={scheme === 'dark' ? DarkTheme : DefaultTheme}>
      <Stack>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      </Stack>
      {notificationModal.visible && (
        <View style={[m.overlay, { backgroundColor: c.overlay }]}>
          <View style={[m.dialog, { backgroundColor: c.card, borderColor: c.cardBorder }]}>
            {snoozePickerOpen ? (
              <>
                <Text style={[m.title, { color: c.text }]}>Αργότερα σε...</Text>
                <View style={[m.pickerContainer, { backgroundColor: c.inputBg }]}>
                  <View style={[m.pickerHighlight, { backgroundColor: c.accent }]} pointerEvents="none" />
                  <ScrollView
                    ref={pickerRef}
                    style={{ height: PICKER_HEIGHT }}
                    contentContainerStyle={{ paddingVertical: ITEM_HEIGHT }}
                    snapToInterval={ITEM_HEIGHT}
                    decelerationRate="fast"
                    showsVerticalScrollIndicator={false}
                    onMomentumScrollEnd={e => {
                      const idx = Math.round(e.nativeEvent.contentOffset.y / ITEM_HEIGHT);
                      setSelectedMinutes(SNOOZE_OPTIONS[Math.max(0, Math.min(idx, SNOOZE_OPTIONS.length - 1))]);
                    }}
                  >
                    {SNOOZE_OPTIONS.map(min => (
                      <View key={min} style={m.pickerItem}>
                        <Text style={[
                          m.pickerItemText,
                          { color: c.textSecondary },
                          selectedMinutes === min && { color: '#fff', fontWeight: '700', fontSize: 19 },
                        ]}>
                          {formatMinutes(min)}
                        </Text>
                      </View>
                    ))}
                  </ScrollView>
                </View>
                <View style={m.row}>
                  <TouchableOpacity
                    style={[m.btn, m.half, { backgroundColor: c.inputBg }]}
                    onPress={() => setSnoozePickerOpen(false)}
                  >
                    <Text style={[m.btnText, { color: c.text }]}>Πίσω</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[m.btn, m.half, { backgroundColor: c.accent }]}
                    onPress={() => handleModalAction(`SNOOZE_${selectedMinutes}`)}
                  >
                    <Text style={[m.btnText, { color: '#fff' }]}>Επιβεβαίωση</Text>
                  </TouchableOpacity>
                </View>
              </>
            ) : (
              <>
                <Text style={[m.label, { color: c.accent }]}>Φάρμακο Μάριο</Text>
                <Text style={[m.body, { color: c.text }]}>{notificationModal.body}</Text>
                <TouchableOpacity
                  style={[m.btn, { backgroundColor: c.inputBg }]}
                  onPress={() => setSnoozePickerOpen(true)}
                >
                  <Text style={[m.btnText, { color: c.textSecondary }]}>Αργότερα...</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[m.btn, { backgroundColor: c.accent }]}
                  onPress={() => handleModalAction(notificationModal.hasChain ? 'NEXT' : 'COMPLETE')}
                >
                  <Text style={[m.btnText, { color: '#fff' }]}>
                    {notificationModal.hasChain ? 'Το έδωσα' : 'Τέλος'}
                  </Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        </View>
      )}
    </ThemeProvider>
  );
};

const m = StyleSheet.create({
  overlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, justifyContent: 'center', alignItems: 'center', zIndex: 999 },
  dialog: { borderRadius: 16, padding: 24, width: '85%', gap: 12, borderWidth: 1 },
  label: { fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.8 },
  title: { fontSize: 18, fontWeight: '700' },
  body: { fontSize: 17, lineHeight: 24, marginBottom: 4 },
  pickerContainer: { borderRadius: 12, overflow: 'hidden' },
  pickerHighlight: { position: 'absolute', top: ITEM_HEIGHT, left: 0, right: 0, height: ITEM_HEIGHT, borderRadius: 8, opacity: 0.35, zIndex: 1 },
  pickerItem: { height: ITEM_HEIGHT, justifyContent: 'center', alignItems: 'center' },
  pickerItemText: { fontSize: 17 },
  row: { flexDirection: 'row', gap: 10 },
  btn: { borderRadius: 12, padding: 15, alignItems: 'center' },
  half: { flex: 1 },
  btnText: { fontSize: 15, fontWeight: '600' },
});

export default RootLayout;
