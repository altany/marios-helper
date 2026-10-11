import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useRef, useState } from 'react';
import { Animated, StyleSheet, Text } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

// Small message at the bottom of the screen, e.g. "Αποθηκεύτηκε".

const listeners = new Set<(msg: string) => void>();
export const toast = (msg: string) => listeners.forEach(l => l(msg));

export const ToastHost = () => {
  const [msg, setMsg] = useState<string | null>(null);
  const opacity = useRef(new Animated.Value(0)).current;
  const insets = useSafeAreaInsets();

  useEffect(() => {
    const show = (m: string) => {
      setMsg(m);
      opacity.stopAnimation();
      Animated.sequence([
        Animated.timing(opacity, { toValue: 1, duration: 150, useNativeDriver: true }),
        Animated.delay(1800),
        Animated.timing(opacity, { toValue: 0, duration: 250, useNativeDriver: true }),
      ]).start(({ finished }) => finished && setMsg(null));
    };
    listeners.add(show);
    return () => {
      listeners.delete(show);
    };
  }, [opacity]);

  if (!msg) return null;
  return (
    <Animated.View pointerEvents="none" style={[st.toast, { opacity, bottom: insets.bottom + 72 }]}>
      <Ionicons name="paw" size={15} color="#f0a97a" />
      <Text style={st.text}>{msg}</Text>
    </Animated.View>
  );
};

const st = StyleSheet.create({
  toast: {
    position: 'absolute',
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    maxWidth: '90%',
    backgroundColor: 'rgba(42,30,21,0.95)',
    borderRadius: 999,
    paddingHorizontal: 18,
    paddingVertical: 10,
  },
  text: { color: '#fff', fontSize: 15, fontWeight: '600', flexShrink: 1 },
});
