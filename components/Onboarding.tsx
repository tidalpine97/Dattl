import { useRef, useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';

import { useLanguage } from '@/context/language';
import { STRINGS } from '@/constants/i18n';
import { requestNotificationPermission } from '@/utils/notifications';

// Icon for each slide — not translated, just visual
const SLIDE_ICONS: Array<keyof typeof Ionicons.glyphMap> = [
  'time-outline',
  'flash-outline',
  'star-outline',
  'notifications-outline',
];

const ACCENT   = '#D97706';
const BG       = '#0f0f0f';
const TEXT     = '#ffffff';
const MUTED    = '#888888';
const SURFACE  = '#1a1a1a';

type Props = { onDone: () => void };

export function Onboarding({ onDone }: Props) {
  const { width }  = useWindowDimensions();
  const insets     = useSafeAreaInsets();
  const { lang }   = useLanguage();
  const t          = STRINGS[lang];
  const scrollRef  = useRef<ScrollView>(null);
  const [page, setPage] = useState(0);
  const isLast = page === t.onboardingSlides.length - 1;

  function goTo(n: number) {
    scrollRef.current?.scrollTo({ x: width * n, animated: true });
  }

  function handleNext() {
    Haptics.selectionAsync();
    if (isLast) {
      onDone();
    } else {
      goTo(page + 1);
    }
  }

  async function handleAllow() {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    await requestNotificationPermission();
    onDone();
  }

  function handleSkip() {
    Haptics.selectionAsync();
    onDone();
  }

  return (
    <View style={[styles.root, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>

      {/* Skip button — hidden on last slide */}
      <View style={styles.topBar}>
        {!isLast ? (
          <Pressable onPress={handleSkip} style={styles.skipBtn} hitSlop={12}>
            <Text style={styles.skipText}>{t.onboardingSkip}</Text>
          </Pressable>
        ) : (
          <View /> // keep layout stable
        )}
      </View>

      {/* Slides */}
      <ScrollView
        ref={scrollRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        scrollEventThrottle={16}
        onScroll={e => {
          const p = Math.round(e.nativeEvent.contentOffset.x / width);
          setPage(p);
        }}
        style={{ flex: 1 }}
      >
        {t.onboardingSlides.map((slide, i) => (
          <View key={i} style={[styles.slide, { width }]}>
            {/* Icon ring */}
            <View style={styles.iconRing}>
              <Ionicons name={SLIDE_ICONS[i]} size={48} color={ACCENT} />
            </View>

            <Text style={styles.title}>{slide.title}</Text>
            <Text style={styles.subtitle}>{slide.subtitle}</Text>
          </View>
        ))}
      </ScrollView>

      {/* Footer: dots + CTA */}
      <View style={styles.footer}>
        {/* Page dots */}
        <View style={styles.dots}>
          {t.onboardingSlides.map((_, i) => (
            <Pressable key={i} onPress={() => goTo(i)} hitSlop={8}>
              <View style={[styles.dot, i === page && styles.dotActive]} />
            </Pressable>
          ))}
        </View>

        {/* Primary CTA */}
        {isLast ? (
          <>
            <Pressable onPress={handleAllow} style={styles.ctaBtn}>
              <Text style={styles.ctaText}>{t.onboardingAllowNotifs}</Text>
            </Pressable>
            <Pressable onPress={handleSkip} style={styles.skipNotifsBtn}>
              <Text style={styles.skipNotifsText}>{t.onboardingSkipNotifs}</Text>
            </Pressable>
          </>
        ) : (
          <Pressable onPress={handleNext} style={styles.ctaBtn}>
            <Text style={styles.ctaText}>{t.onboardingNext}</Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: BG,
    zIndex: 999,
  },

  // ── Top bar ────────────────────────────────────────────────────────────────
  topBar: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    paddingHorizontal: 24,
    paddingVertical: 12,
    minHeight: 48,
  },
  skipBtn: {
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  skipText: {
    fontSize: 15,
    color: MUTED,
  },

  // ── Slide ──────────────────────────────────────────────────────────────────
  slide: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 36,
    gap: 24,
  },
  iconRing: {
    width: 108,
    height: 108,
    borderRadius: 54,
    borderWidth: 2,
    borderColor: '#2a2a2a',
    backgroundColor: SURFACE,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  title: {
    fontFamily: 'Poppins_800ExtraBold',
    fontSize: 28,
    color: TEXT,
    textAlign: 'center',
    lineHeight: 36,
  },
  subtitle: {
    fontSize: 16,
    color: MUTED,
    textAlign: 'center',
    lineHeight: 24,
  },

  // ── Footer ─────────────────────────────────────────────────────────────────
  footer: {
    paddingHorizontal: 24,
    paddingBottom: 16,
    gap: 16,
    alignItems: 'center',
  },
  dots: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#333333',
  },
  dotActive: {
    width: 20,
    backgroundColor: ACCENT,
  },
  ctaBtn: {
    width: '100%',
    backgroundColor: ACCENT,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
  },
  ctaText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#000000',
  },
  skipNotifsBtn: {
    paddingVertical: 4,
  },
  skipNotifsText: {
    fontSize: 14,
    color: MUTED,
  },
});
