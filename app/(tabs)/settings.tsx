import { useEffect, useRef, useState } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Constants from 'expo-constants';
import * as Haptics from 'expo-haptics';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import { SchedulableTriggerInputTypes } from 'expo-notifications';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useLanguage, type Lang } from '@/context/language';
import { STRINGS } from '@/constants/i18n';
import { loadItems, saveItems } from '@/utils/storage';
import {
  NOTIF_TIME_MORNING,
  NOTIF_TIME_EVENING,
  NOTIF_TIME_SUBSCRIPTIONS,
  rescheduleAllItemNotifications,
  rescheduleAllSubscriptionNotifications,
} from '@/utils/notifications';

const COLORS = {
  bg:        '#0f0f0f',
  surface:   '#1a1a1a',
  border:    '#2a2a2a',
  text:      '#ffffff',
  textMuted: '#888888',
  accent:    '#D97706',
} as const;

type NotifKey = 'notif_time_morning' | 'notif_time_evening' | 'notif_time_subscriptions';
type ActiveTimePicker = NotifKey | null;

function timeToDate(timeStr: string): Date {
  const [h, m] = timeStr.split(':').map(Number);
  const d = new Date();
  d.setHours(h ?? 9, m ?? 0, 0, 0);
  return d;
}

function dateToTime(d: Date): string {
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

export default function SettingsTab() {
  const insets = useSafeAreaInsets();
  const version = Constants.expoConfig?.version ?? '1.0.0';
  const { lang, setLang } = useLanguage();
  const t = STRINGS[lang];

  const [morningTime, setMorningTime]  = useState(NOTIF_TIME_MORNING);
  const [eveningTime, setEveningTime]  = useState(NOTIF_TIME_EVENING);
  const [subsTime,    setSubsTime]     = useState(NOTIF_TIME_SUBSCRIPTIONS);
  const [activePicker, setActivePicker] = useState<ActiveTimePicker>(null);

  const [devToolsVisible, setDevToolsVisible] = useState(false);
  const tapCount = useRef(0);
  const tapResetTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [resetOnboardingConfirm, setResetOnboardingConfirm] = useState(false);
  const [testNotifConfirm, setTestNotifConfirm] = useState(false);

  useEffect(() => {
    async function load() {
      const [m, e, s, devUnlocked] = await Promise.all([
        AsyncStorage.getItem('notif_time_morning'),
        AsyncStorage.getItem('notif_time_evening'),
        AsyncStorage.getItem('notif_time_subscriptions'),
        AsyncStorage.getItem('dattl_dev_tools_unlocked'),
      ]);
      if (m) setMorningTime(m);
      if (e) setEveningTime(e);
      if (s) setSubsTime(s);
      if (devUnlocked === 'true') setDevToolsVisible(true);
    }
    load().catch(console.error);
  }, []);

  function handleVersionTap() {
    Haptics.selectionAsync();
    tapCount.current += 1;
    if (tapResetTimer.current) clearTimeout(tapResetTimer.current);
    if (tapCount.current >= 5) {
      tapCount.current = 0;
      AsyncStorage.setItem('dattl_dev_tools_unlocked', 'true').catch(() => {});
      setDevToolsVisible(true);
      return;
    }
    tapResetTimer.current = setTimeout(() => { tapCount.current = 0; }, 2000);
  }

  function hideDevTools() {
    AsyncStorage.setItem('dattl_dev_tools_unlocked', 'false').catch(() => {});
    setDevToolsVisible(false);
  }

  function handleResetOnboarding() {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    AsyncStorage.removeItem('dattl_onboarded').catch(() => {});
    setResetOnboardingConfirm(true);
    setTimeout(() => setResetOnboardingConfirm(false), 2000);
  }

  async function handleSendTestNotification() {
    Haptics.selectionAsync();
    await Notifications.scheduleNotificationAsync({
      content: { title: 'Dattl', body: 'Joghurt läuft morgen ab 🧊' },
      trigger: {
        type: SchedulableTriggerInputTypes.DATE,
        date: new Date(Date.now() + 5000),
      },
    });
    setTestNotifConfirm(true);
    setTimeout(() => setTestNotifConfirm(false), 6000);
  }

  function handleResetDevTools() {
    AsyncStorage.removeItem('dattl_dev_tools_unlocked').catch(() => {});
    setDevToolsVisible(false);
  }

  function handleLang(l: Lang) {
    Haptics.selectionAsync();
    setLang(l);
  }

  async function handleTimeChange(key: NotifKey, newTime: string) {
    await AsyncStorage.setItem(key, newTime);
    const [items, subscriptions] = await Promise.all([
      loadItems('dattl_items'),
      loadItems('dattl_subscriptions'),
    ]);
    await rescheduleAllItemNotifications(items);
    const updatedSubs = await rescheduleAllSubscriptionNotifications(subscriptions);
    await saveItems(updatedSubs, 'dattl_subscriptions');
  }

  function getTimeValue(key: NotifKey): string {
    if (key === 'notif_time_morning')       return morningTime;
    if (key === 'notif_time_evening')       return eveningTime;
    return subsTime;
  }

  function setTimeValue(key: NotifKey, value: string) {
    if (key === 'notif_time_morning')  setMorningTime(value);
    else if (key === 'notif_time_evening') setEveningTime(value);
    else setSubsTime(value);
  }

  const notifRows: { key: NotifKey; label: string }[] = [
    { key: 'notif_time_morning',       label: lang === 'de' ? 'Produkte — Morgen'  : 'Products — Morning' },
    { key: 'notif_time_evening',       label: lang === 'de' ? 'Produkte — Abend'   : 'Products — Evening' },
    { key: 'notif_time_subscriptions', label: lang === 'de' ? 'Abonnements'        : 'Subscriptions' },
  ];

  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={[styles.container, { paddingTop: insets.top + 32, paddingBottom: insets.bottom + 32 }]}
    >
      {/* Logo + version */}
      <Text style={styles.logo}>Dattl</Text>
      <Pressable onPress={handleVersionTap} hitSlop={12}>
        <Text style={styles.version}>Version {version}</Text>
      </Pressable>

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

      {/* Notifications */}
      <View style={[styles.section, { marginTop: 40 }]}>
        <Text style={styles.sectionLabel}>
          {lang === 'de' ? 'Benachrichtigungen' : 'Notifications'}
        </Text>
        <View style={styles.notifCard}>
          {notifRows.map((row, idx) => {
            const isActive = activePicker === row.key;
            const timeStr = getTimeValue(row.key);
            return (
              <View key={row.key}>
                {idx > 0 && <View style={styles.divider} />}
                <Pressable
                  onPress={() => {
                    Haptics.selectionAsync();
                    setActivePicker(isActive ? null : row.key);
                  }}
                  style={styles.notifRow}
                >
                  <Text style={styles.notifLabel}>{row.label}</Text>
                  <Text style={[styles.notifTime, isActive && styles.notifTimeActive]}>
                    {timeStr}
                  </Text>
                </Pressable>
                {isActive && (
                  <View style={styles.timePickerWrap}>
                    <DateTimePicker
                      value={timeToDate(timeStr)}
                      mode="time"
                      display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                      themeVariant="dark"
                      accentColor={COLORS.accent}
                      onChange={(_, selectedDate) => {
                        if (!selectedDate) return;
                        const newTime = dateToTime(selectedDate);
                        setTimeValue(row.key, newTime);
                        handleTimeChange(row.key, newTime).catch(console.error);
                      }}
                      style={styles.timePicker}
                    />
                  </View>
                )}
              </View>
            );
          })}
        </View>
      </View>

      {/* Developer Tools (hidden, unlocked by tapping version 5×) */}
      {devToolsVisible && (
        <View style={[styles.section, { marginTop: 40 }]}>
          <View style={styles.devHeader}>
            <Text style={styles.sectionLabel}>Developer Tools</Text>
            <Pressable onPress={hideDevTools} style={styles.lockBtn} hitSlop={8}>
              <Text style={styles.lockBtnText}>Lock</Text>
            </Pressable>
          </View>
          <View style={styles.notifCard}>
            {/* Reset Onboarding */}
            <Pressable onPress={handleResetOnboarding} style={styles.devRow}>
              <Text style={styles.devRowText}>Reset Onboarding</Text>
            </Pressable>
            {resetOnboardingConfirm && (
              <Text style={styles.devConfirm}>Will show on next launch</Text>
            )}
            <View style={styles.divider} />

            {/* Send Test Notification */}
            <Pressable onPress={handleSendTestNotification} style={styles.devRow}>
              <Text style={styles.devRowText}>Send Test Notification</Text>
            </Pressable>
            {testNotifConfirm && (
              <Text style={styles.devConfirm}>Notification in 5s...</Text>
            )}
            <View style={styles.divider} />

            {/* Reset Dev Tools */}
            <Pressable onPress={handleResetDevTools} style={styles.devRow}>
              <Text style={[styles.devRowText, { color: '#FF6B6B' }]}>Reset Dev Tools</Text>
            </Pressable>
          </View>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: {
    flex: 1,
    backgroundColor: COLORS.bg,
  },
  container: {
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

  // ── Notifications section ──────────────────────────────────────────────────
  notifCard: {
    width: '100%',
    backgroundColor: COLORS.surface,
    borderRadius: 14,
    overflow: 'hidden',
  },
  notifRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 16,
    paddingHorizontal: 16,
  },
  notifLabel: {
    fontSize: 15,
    color: COLORS.text,
  },
  notifTime: {
    fontSize: 15,
    color: COLORS.textMuted,
    fontWeight: '600',
  },
  notifTimeActive: {
    color: COLORS.accent,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: COLORS.border,
    marginHorizontal: 16,
  },
  timePickerWrap: {
    paddingBottom: 8,
  },
  timePicker: {
    width: '100%',
  },

  // ── Dev Tools section ──────────────────────────────────────────────────────
  devHeader: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  lockBtn: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  lockBtnText: {
    fontSize: 12,
    color: COLORS.textMuted,
    fontWeight: '600',
  },
  devRow: {
    paddingVertical: 16,
    paddingHorizontal: 16,
  },
  devRowText: {
    fontSize: 15,
    color: COLORS.text,
  },
  devConfirm: {
    fontSize: 12,
    color: COLORS.textMuted,
    paddingHorizontal: 16,
    paddingBottom: 10,
  },
});
