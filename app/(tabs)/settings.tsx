import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Constants from 'expo-constants';
import * as Haptics from 'expo-haptics';
import { useLanguage, type Lang } from '@/context/language';
import { STRINGS } from '@/constants/i18n';

const COLORS = {
  bg:        '#0f0f0f',
  surface:   '#1a1a1a',
  border:    '#2a2a2a',
  text:      '#ffffff',
  textMuted: '#888888',
  accent:    '#D97706',
} as const;

export default function SettingsTab() {
  const insets = useSafeAreaInsets();
  const version = Constants.expoConfig?.version ?? '1.0.0';
  const { lang, setLang } = useLanguage();
  const t = STRINGS[lang];

  function handleLang(l: Lang) {
    Haptics.selectionAsync();
    setLang(l);
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top + 32 }]}>
      {/* Logo + version */}
      <Text style={styles.logo}>Dattl</Text>
      <Text style={styles.version}>Version {version}</Text>

      {/* Language toggle */}
      <View style={styles.section}>
        <Text style={styles.sectionLabel}>{t.languageLabel}</Text>
        <View style={styles.toggle}>
          {(['en', 'de'] as Lang[]).map(l => (
            <Pressable
              key={l}
              onPress={() => handleLang(l)}
              style={[styles.toggleBtn, lang === l && styles.toggleBtnActive]}
            >
              <Text style={[styles.toggleText, lang === l && styles.toggleTextActive]}>
                {l.toUpperCase()}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.bg,
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  logo: {
    fontFamily: 'Poppins_800ExtraBold',
    fontSize: 56,
    color: COLORS.accent,
    letterSpacing: -1,
  },
  version: {
    fontSize: 14,
    color: COLORS.textMuted,
    marginTop: 4,
    marginBottom: 48,
  },
  section: {
    width: '100%',
    alignItems: 'center',
    gap: 14,
  },
  sectionLabel: {
    fontSize: 13,
    color: COLORS.textMuted,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  toggle: {
    flexDirection: 'row',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    overflow: 'hidden',
  },
  toggleBtn: {
    paddingVertical: 12,
    paddingHorizontal: 32,
    backgroundColor: COLORS.surface,
  },
  toggleBtnActive: {
    backgroundColor: COLORS.accent,
  },
  toggleText: {
    fontSize: 15,
    fontWeight: '700',
    color: COLORS.textMuted,
    letterSpacing: 1,
  },
  toggleTextActive: {
    color: '#000000',
  },
});
