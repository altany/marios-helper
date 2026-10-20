import React, { createContext, ReactNode, useContext, useEffect, useState } from 'react';
import { Linking, Modal, Platform, StyleSheet, Text, useColorScheme, useWindowDimensions, View } from 'react-native';
import { t } from '../i18n';
import { toHHMM } from '../lib/time';
import { useColors } from './theme';

// Browser preview on a wide screen: the app shows inside a phone in the middle
// of the page, instead of stretched across it. The app is laid out at a real
// phone's size (390 × 844) and the whole phone is scaled down to fit the window.
// On a phone browser, and in the phone app, nothing changes.

const FRAME_FROM_WIDTH = 700;
const SCREEN_W = 390;
const SCREEN_H = 844;
const STATUS_BAR = 30;
/** The strip with the home line at the bottom, so the rounded corners don't cut the tab bar. */
const NAV_BAR = 22;
const BEZEL = 12;
const PHONE_W = SCREEN_W + 2 * BEZEL;
const PHONE_H = SCREEN_H + 2 * BEZEL;
/** Room around the phone: margins and the line under it. */
const PAGE_MARGIN = 84;

const InFrame = createContext(false);

/** A `Modal` on the phone; inside the frame, a layer over the app that stays within the phone. */
export const Layer = ({
  visible,
  onClose,
  animationType,
  statusBarTranslucent,
  children,
}: {
  visible: boolean;
  onClose: () => void;
  animationType: 'slide' | 'fade';
  statusBarTranslucent?: boolean;
  children: ReactNode;
}) => {
  const inFrame = useContext(InFrame);
  if (inFrame) return visible ? <View style={[StyleSheet.absoluteFill, { zIndex: 100 }]}>{children}</View> : null;
  return (
    <Modal
      visible={visible}
      transparent
      animationType={animationType}
      onRequestClose={onClose}
      statusBarTranslucent={statusBarTranslucent}
    >
      {children}
    </Modal>
  );
};

/** Time, signal and battery, like the top of an Android phone. */
const PhoneStatusBar = () => {
  const c = useColors();
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 15_000);
    return () => clearInterval(id);
  }, []);
  return (
    <View style={[st.bar, { backgroundColor: c.bg }]}>
      <Text style={[st.time, { color: c.text }]}>{toHHMM(now)}</Text>
      <View style={st.camera} />
      <View style={st.icons}>
        {[6, 9, 12, 15].map(h => (
          <View key={h} style={[st.signal, { height: h, backgroundColor: c.text }]} />
        ))}
        <View style={[st.battery, { borderColor: c.text }]}>
          <View style={[st.charge, { backgroundColor: c.text }]} />
        </View>
      </View>
    </View>
  );
};

export const DeviceFrame = ({ children }: { children: ReactNode }) => {
  const { width, height } = useWindowDimensions();
  const c = useColors();
  const dark = useColorScheme() === 'dark';
  const framed = Platform.OS === 'web' && width >= FRAME_FROM_WIDTH;

  // Scroll bars belong to the page, not to a phone screen.
  useEffect(() => {
    if (!framed || typeof document === 'undefined') return;
    const style = document.createElement('style');
    style.textContent = '* { scrollbar-width: none; } *::-webkit-scrollbar { display: none; }';
    document.head.appendChild(style);
    return () => style.remove();
  }, [framed]);

  if (!framed) return <>{children}</>;

  const scale = Math.max(0.6, Math.min(1, (height - PAGE_MARGIN) / PHONE_H));
  return (
    <View style={[st.page, { backgroundColor: dark ? '#0e0a07' : '#efe4d3' }]}>
      <View style={{ width: PHONE_W * scale, height: PHONE_H * scale }}>
        <View
          style={[
            st.phone,
            {
              left: (PHONE_W * scale - PHONE_W) / 2,
              top: (PHONE_H * scale - PHONE_H) / 2,
              backgroundColor: c.bg,
              transform: [{ scale }],
            },
          ]}
        >
          <PhoneStatusBar />
          <View style={{ flex: 1 }}>
            <InFrame.Provider value>{children}</InFrame.Provider>
          </View>
          <View style={[st.nav, { backgroundColor: c.tabBar }]}>
            <View style={[st.homeLine, { backgroundColor: c.textMuted }]} />
          </View>
        </View>
      </View>
      <Text style={[st.caption, { color: c.textSoft }]}>
        {t("Mario's Helper · δοκιμαστική έκδοση με φανταστικά δεδομένα · ", "Mario's Helper · a demo with made-up data · ")}
        <Text style={[st.link, { color: c.accentText }]} onPress={() => Linking.openURL('https://github.com/altany/marios-helper')}>
          {t('Ο κώδικας στο GitHub', 'Code on GitHub')}
        </Text>
      </Text>
    </View>
  );
};

const st = StyleSheet.create({
  page: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16 },
  phone: {
    position: 'absolute',
    width: PHONE_W,
    height: PHONE_H,
    borderRadius: 58,
    borderWidth: BEZEL,
    borderColor: '#2a1e15',
    overflow: 'hidden',
    shadowColor: '#5a3719',
    shadowOpacity: 0.3,
    shadowRadius: 30,
    shadowOffset: { width: 0, height: 16 },
  },
  bar: { height: STATUS_BAR, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 26 },
  time: { fontSize: 14, fontWeight: '600', width: 60 },
  camera: { width: 12, height: 12, borderRadius: 6, backgroundColor: '#14100c' },
  icons: { width: 60, flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'flex-end', gap: 2 },
  signal: { width: 3, borderRadius: 1 },
  battery: { width: 22, height: 11, borderRadius: 3, borderWidth: 1.5, padding: 1.5, marginLeft: 6, alignSelf: 'center' },
  charge: { flex: 1, width: '80%', borderRadius: 1 },
  nav: { height: NAV_BAR, alignItems: 'center', justifyContent: 'center' },
  homeLine: { width: 110, height: 4, borderRadius: 2, opacity: 0.6 },
  caption: { fontSize: 13 },
  link: { fontWeight: '700', textDecorationLine: 'underline' },
});
