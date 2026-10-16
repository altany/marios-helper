import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import React, { ReactNode, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleProp,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TextInputProps,
  View,
  ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { t } from '../i18n';
import { caps } from '../lib/text';
import { kindInfo } from '../model/defaults';
import { MedKind } from '../model/types';
import { radius, rounded, useColors } from './theme';

export type IconName = keyof typeof Ionicons.glyphMap;
export type MciName = keyof typeof MaterialCommunityIcons.glyphMap;

/** Re-renders every `ms` so "σε 5′" texts stay current. */
export const useNow = (ms = 30_000) => {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), ms);
    return () => clearInterval(id);
  }, [ms]);
  return now;
};

export const Screen = ({
  title,
  subtitle,
  right,
  children,
  scroll = true,
}: {
  title?: string;
  subtitle?: string;
  right?: ReactNode;
  children: ReactNode;
  scroll?: boolean;
}) => {
  const c = useColors();
  const insets = useSafeAreaInsets();
  // A big faint paw print behind the title.
  const paw = title ? (
    <View pointerEvents="none" style={[s.watermark, { top: insets.top - 34 }]}>
      <Ionicons name="paw" size={150} color={c.accent} />
    </View>
  ) : null;
  const header = title ? (
    <View style={s.header}>
      <View style={{ flex: 1 }}>
        <Text style={[s.title, { color: c.text }]}>{title}</Text>
        {!!subtitle && <Text style={[s.subtitle, { color: c.textSoft }]}>{subtitle}</Text>}
      </View>
      {right}
    </View>
  ) : null;
  if (!scroll) {
    return (
      <View style={[s.fill, { backgroundColor: c.bg, paddingTop: insets.top }]}>
        {paw}
        {header}
        {children}
      </View>
    );
  }
  return (
    <ScrollView
      style={[s.fill, { backgroundColor: c.bg }]}
      contentContainerStyle={[s.content, { paddingTop: insets.top + 8 }]}
      keyboardShouldPersistTaps="handled"
    >
      {paw}
      {header}
      {children}
    </ScrollView>
  );
};

export const Loading = () => {
  const c = useColors();
  return (
    <View style={[s.fill, s.center, { backgroundColor: c.bg }]}>
      <ActivityIndicator color={c.accent} size="large" />
    </View>
  );
};

export const Card = ({
  children,
  style,
  onPress,
}: {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  onPress?: () => void;
}) => {
  const c = useColors();
  const base = [s.card, { backgroundColor: c.card, borderColor: c.border }, style];
  if (!onPress) return <View style={base}>{children}</View>;
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [base, pressed && { opacity: 0.85 }]}>
      {children}
    </Pressable>
  );
};

export const SectionTitle = ({ children, right }: { children: ReactNode; right?: ReactNode }) => {
  const c = useColors();
  const parts = React.Children.toArray(children);
  const text = parts.every(p => typeof p === 'string' || typeof p === 'number') ? caps(parts.join('')) : children;
  return (
    <View style={s.sectionRow}>
      <View style={s.sectionLeft}>
        <Ionicons name="paw" size={12} color={c.accentText} style={{ opacity: 0.6 }} />
        <Text style={[s.section, { color: c.textSoft }]}>{text}</Text>
      </View>
      {right}
    </View>
  );
};

type ButtonKind = 'primary' | 'secondary' | 'ghost' | 'danger' | 'success';

export const Button = ({
  label,
  onPress,
  kind = 'secondary',
  icon,
  small,
  disabled,
  style,
}: {
  label: string;
  onPress: () => void;
  kind?: ButtonKind;
  icon?: IconName;
  small?: boolean;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
}) => {
  const c = useColors();
  const bg = {
    primary: c.accent,
    success: c.successStrong,
    secondary: c.input,
    ghost: 'transparent',
    danger: c.dangerSoft,
  }[kind];
  const fg = {
    primary: c.onAccent,
    success: '#fff',
    secondary: c.text,
    ghost: c.accentText,
    danger: c.danger,
  }[kind];
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      style={({ pressed }) => [
        s.btn,
        small && s.btnSmall,
        { backgroundColor: bg, opacity: disabled ? 0.4 : pressed ? 0.75 : 1 },
        style,
      ]}
    >
      {icon && <Ionicons name={icon} size={small ? 16 : 19} color={fg} />}
      <Text style={[s.btnText, small && s.btnTextSmall, { color: fg }]} numberOfLines={1}>
        {label}
      </Text>
    </Pressable>
  );
};

export const IconButton = ({
  icon,
  onPress,
  color,
  size = 22,
  label,
}: {
  icon: IconName;
  onPress: () => void;
  color?: string;
  size?: number;
  label: string;
}) => {
  const c = useColors();
  return (
    <Pressable
      onPress={onPress}
      accessibilityLabel={label}
      hitSlop={10}
      style={({ pressed }) => [s.iconBtn, { backgroundColor: c.input, opacity: pressed ? 0.6 : 1 }]}
    >
      <Ionicons name={icon} size={size} color={color ?? c.textSoft} />
    </Pressable>
  );
};

export const Chip = ({
  label,
  selected,
  onPress,
  onRemove,
  color,
}: {
  label: string;
  selected?: boolean;
  onPress?: () => void;
  onRemove?: () => void;
  color?: string;
}) => {
  const c = useColors();
  const tint = color ?? c.accent;
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        s.chip,
        selected
          ? { backgroundColor: tint, borderColor: tint }
          : { backgroundColor: 'transparent', borderColor: c.border },
        pressed && { opacity: 0.7 },
      ]}
    >
      <Text style={[s.chipText, { color: selected ? '#fff' : c.text }]}>{label}</Text>
      {onRemove && (
        <Pressable onPress={onRemove} hitSlop={10} accessibilityLabel={t(`Αφαίρεση ${label}`, `Remove ${label}`)}>
          <Ionicons name="close" size={16} color={selected ? '#fff' : c.textSoft} />
        </Pressable>
      )}
    </Pressable>
  );
};

export const Choice = <T extends string | number>({
  options,
  value,
  onChange,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
}) => (
  <View style={s.wrap}>
    {options.map(o => (
      <Chip key={String(o.value)} label={o.label} selected={o.value === value} onPress={() => onChange(o.value)} />
    ))}
  </View>
);

export const MedIcon = ({ kind, color, size = 40 }: { kind?: MedKind; color?: string; size?: number }) => {
  const c = useColors();
  const tint = color ?? c.accent;
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: tint + '22',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <MaterialCommunityIcons name={kindInfo(kind ?? 'other').icon} size={size * 0.52} color={tint} />
    </View>
  );
};

export const Field = ({ label, hint, ...props }: TextInputProps & { label: string; hint?: string }) => {
  const c = useColors();
  return (
    <View style={{ gap: 6 }}>
      <Text style={[s.label, { color: c.textSoft }]}>{label}</Text>
      <TextInput
        placeholderTextColor={c.textMuted}
        {...props}
        style={[
          s.input,
          { backgroundColor: c.input, color: c.text },
          props.multiline && { minHeight: 72, textAlignVertical: 'top' },
          props.style,
        ]}
      />
      {!!hint && <Text style={[s.hint, { color: c.textMuted }]}>{hint}</Text>}
    </View>
  );
};

export const SwitchRow = ({
  label,
  hint,
  value,
  onChange,
}: {
  label: string;
  hint?: string;
  value: boolean;
  onChange: (v: boolean) => void;
}) => {
  const c = useColors();
  return (
    <View style={s.switchRow}>
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={[s.rowLabel, { color: c.text }]}>{label}</Text>
        {!!hint && <Text style={[s.hint, { color: c.textMuted }]}>{hint}</Text>}
      </View>
      <Switch
        value={value}
        onValueChange={onChange}
        trackColor={{ false: c.input, true: c.accent }}
        thumbColor="#fff"
      />
    </View>
  );
};

export const Divider = () => {
  const c = useColors();
  return <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: c.border, marginVertical: 4 }} />;
};

/** Bottom sheet. */
export const Sheet = ({
  visible,
  onClose,
  title,
  children,
}: {
  visible: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
}) => {
  const c = useColors();
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={s.sheetWrap}>
        <Pressable style={[StyleSheet.absoluteFill, { backgroundColor: c.overlay }]} onPress={onClose} />
        <View style={[s.sheet, { backgroundColor: c.card, paddingBottom: insets.bottom + 16 }]}>
          <View style={[s.grabber, { backgroundColor: c.border }]} />
          {!!title && (
            <View style={s.sheetHeader}>
              <Text style={[s.sheetTitle, { color: c.text }]}>{title}</Text>
              <IconButton icon="close" onPress={onClose} label={t('Κλείσιμο', 'Close')} size={18} />
            </View>
          )}
          <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ gap: 12 }}>
            {children}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
};

export const EmptyState = ({ icon, dog, text }: { icon?: IconName; dog?: MciName; text: string }) => {
  const c = useColors();
  return (
    <View style={s.empty}>
      {dog ? (
        <View style={[s.emptyDog, { backgroundColor: c.accentSoft }]}>
          <MaterialCommunityIcons name={dog} size={34} color={c.accentText} />
        </View>
      ) : (
        <Ionicons name={icon ?? 'paw-outline'} size={30} color={c.textMuted} />
      )}
      <Text style={[s.emptyText, { color: c.textSoft }]}>{text}</Text>
    </View>
  );
};

export const s = StyleSheet.create({
  fill: { flex: 1 },
  center: { alignItems: 'center', justifyContent: 'center' },
  content: { padding: 16, paddingBottom: 48, gap: 12 },
  watermark: { position: 'absolute', right: -30, opacity: 0.07, transform: [{ rotate: '-20deg' }] },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 4, paddingHorizontal: 2 },
  title: { ...rounded, fontSize: 29, lineHeight: 36 },
  subtitle: { fontSize: 15, marginTop: 2 },
  card: { borderRadius: radius.lg, borderWidth: 1, padding: 16, gap: 10 },
  sectionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 10,
    paddingHorizontal: 4,
  },
  sectionLeft: { flexDirection: 'row', alignItems: 'center', gap: 6, flexShrink: 1 },
  section: { fontSize: 13, fontWeight: '700', letterSpacing: 0.6 },
  btn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: radius.md,
    paddingVertical: 14,
    paddingHorizontal: 16,
    minHeight: 50,
  },
  btnSmall: { paddingVertical: 8, paddingHorizontal: 12, minHeight: 38 },
  btnText: { fontSize: 16, fontWeight: '700' },
  btnTextSmall: { fontSize: 14 },
  iconBtn: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: radius.pill,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  chipText: { fontSize: 15, fontWeight: '600' },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  label: { fontSize: 13, fontWeight: '600' },
  hint: { fontSize: 13, lineHeight: 18 },
  input: { borderRadius: radius.md, paddingHorizontal: 14, paddingVertical: 12, fontSize: 16 },
  switchRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 4 },
  rowLabel: { fontSize: 16, fontWeight: '600' },
  sheetWrap: { flex: 1, justifyContent: 'flex-end' },
  sheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 18,
    paddingTop: 8,
    maxHeight: '90%',
  },
  grabber: { alignSelf: 'center', width: 40, height: 5, borderRadius: 3, marginBottom: 8 },
  sheetHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  sheetTitle: { ...rounded, fontSize: 20, lineHeight: 26, flex: 1 },
  empty: { alignItems: 'center', gap: 10, paddingVertical: 20 },
  emptyDog: { width: 64, height: 64, borderRadius: 32, alignItems: 'center', justifyContent: 'center' },
  emptyText: { fontSize: 15, textAlign: 'center' },
});
