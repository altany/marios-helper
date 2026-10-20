import React, { createContext, ReactNode, useContext } from 'react';
import { Linking, Modal, Platform, StyleSheet, Text, useColorScheme, useWindowDimensions, View } from 'react-native';
import { t } from '../i18n';
import { useColors } from './theme';

// Browser preview on a wide screen: the app shows inside a phone-sized frame in
// the middle of the page, instead of stretched across it. On a phone browser,
// and in the phone app, nothing changes.

const FRAME_FROM_WIDTH = 700;
const SCREEN_WIDTH = 390;
const BEZEL = 10;

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

export const DeviceFrame = ({ children }: { children: ReactNode }) => {
  const { width, height } = useWindowDimensions();
  const c = useColors();
  const dark = useColorScheme() === 'dark';
  if (Platform.OS !== 'web' || width < FRAME_FROM_WIDTH) return <>{children}</>;

  const screenHeight = Math.min(844, height - 110);
  return (
    <View style={[st.page, { backgroundColor: dark ? '#0e0a07' : '#efe4d3' }]}>
      <View style={[st.phone, { width: SCREEN_WIDTH + 2 * BEZEL, height: screenHeight + 2 * BEZEL, backgroundColor: c.bg }]}>
        <InFrame.Provider value>{children}</InFrame.Provider>
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
  page: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 18 },
  phone: {
    borderRadius: 52,
    borderWidth: BEZEL,
    borderColor: '#2a1e15',
    overflow: 'hidden',
    shadowColor: '#5a3719',
    shadowOpacity: 0.3,
    shadowRadius: 30,
    shadowOffset: { width: 0, height: 16 },
  },
  caption: { fontSize: 14 },
  link: { fontWeight: '700', textDecorationLine: 'underline' },
});
