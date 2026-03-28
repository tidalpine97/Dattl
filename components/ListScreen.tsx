import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  Alert,
  FlatList,
  Image,
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Swipeable } from 'react-native-gesture-handler';
import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import * as Haptics from 'expo-haptics';

import { type Item, loadItems, saveItems } from '@/utils/storage';
import { DATE_FORMAT, formatDate, getDaysUntilExpiry, getExpiryLabel, getSubscriptionLabel } from '@/utils/dates';
import { useFavorites } from '@/hooks/use-favorites';
import { type DattlItem, DATTL_ITEMS, findItem, suggestedExpiryDate } from '@/constants/dattlItems';
import { useLanguage } from '@/context/language';
import { STRINGS } from '@/constants/i18n';
import { syncWidgetItems } from '@/utils/sharedStorage';
import {
  cancelNotification,
  cancelSubscriptionNotifications,
  requestNotificationPermission,
  scheduleDebugNotification,
  scheduleExpiryNotification,
  scheduleSubscriptionNotifications,
} from '@/utils/notifications';

// ─── Constants ────────────────────────────────────────────────────────────────

const COLORS = {
  bg:        '#0f0f0f',
  surface:   '#1a1a1a',
  border:    '#2a2a2a',
  text:      '#ffffff',
  textMuted: '#888888',
  accent:    '#D97706',
  warning:   '#f5c542',
  expired:   '#E05252',
  overlay:   'rgba(0,0,0,0.7)',
} as const;

const PICKER_INLINE = Platform.OS === 'ios';
const PICKER_MIN_DATE = new Date(2000, 0, 1);

// ─── Mode config ──────────────────────────────────────────────────────────────

type Mode = 'item' | 'subscription';

type ModeConfig = {
  storageKey: string;
  favoritesKey: string;
  openedOnLabel: string;
  expiryLabel: string;
  addButtonText: string;
  newTitle: string;
  editTitle: string;
  namePlaceholder: string;
  cardDateLabel: string;
  statusLabel: (daysLeft: number) => string;
  showLookup: boolean;
};

const MODE_CONFIG: Record<Mode, ModeConfig> = {
  item: {
    storageKey:      'dattl_items',
    favoritesKey:    'dattl_favorites_items',
    openedOnLabel:   'Opened on',
    expiryLabel:     'Expires',
    addButtonText:   '+ Add Item',
    newTitle:        'New Item',
    editTitle:       'Edit Item',
    namePlaceholder: 'Name (e.g. Mascara)',
    cardDateLabel:   'Opened on',
    statusLabel:     getExpiryLabel,
    showLookup:      true,
  },
  subscription: {
    storageKey:      'dattl_subscriptions',
    favoritesKey:    'dattl_favorites_subscriptions',
    openedOnLabel:   'Started on',
    expiryLabel:     'Cancel by',
    addButtonText:   '+ Add Subscription',
    newTitle:        'New Subscription',
    editTitle:       'Edit Subscription',
    namePlaceholder: 'Name (e.g. Netflix)',
    cardDateLabel:   'Started on',
    statusLabel:     getSubscriptionLabel,
    showLookup:      false,
  },
};

// ─── Form state ───────────────────────────────────────────────────────────────

type ActivePicker = 'expiry' | 'openedOn' | false;

type FormState = {
  name: string;
  date: Date;
  openedOn: Date;
  originalOpenedOn: string; // ISO — openedOn when the modal was opened; used for the save intercept
  activePicker: ActivePicker;
  expirySource: 'lookup' | 'manual';
  lookupItem?: DattlItem;
  lookupOpenedOn?: string;
  longerUsableHint?: string;   // persisted from lookup; cleared on manual name change
  longerUsableHintEn?: string;
};

function freshForm(): FormState {
  const now = new Date();
  return {
    name: '',
    date: now,
    openedOn: now,
    originalOpenedOn: now.toISOString(),
    activePicker: false,
    expirySource: 'manual',
  };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getRowStyle(daysLeft: number) {
  if (daysLeft < 0)  return styles.rowExpired;
  if (daysLeft <= 7) return styles.rowWarning;
  return null;
}

function getStatusLabelStyle(daysLeft: number) {
  if (daysLeft < 0)  return styles.statusExpired;
  if (daysLeft <= 7) return styles.statusWarning;
  return styles.statusNeutral;
}

function sortItems(items: Item[]): Item[] {
  const annotated = items.map(item => ({
    item,
    expired:  getDaysUntilExpiry(item.expiryDate) < 0,
    expiryTs: new Date(item.expiryDate).getTime(),
    addedTs:  item.dateAdded ? new Date(item.dateAdded).getTime() : 0,
  }));

  annotated.sort((a, b) => {
    if (a.expired !== b.expired) return a.expired ? -1 : 1;
    if (a.expired) return a.addedTs - b.addedTs;
    if (a.expiryTs !== b.expiryTs) return a.expiryTs - b.expiryTs;
    return a.addedTs - b.addedTs;
  });

  return annotated.map(a => a.item);
}

function formatDuration(days: number): string {
  if (days < 60) return `${days}d`;
  const months = Math.round(days / 30);
  if (months < 24) return `${months}mo`;
  return `${Math.round(months / 12)}yr`;
}

// Human-readable duration for hint sentences.
// dative=true uses German dative plural forms (needed after "von": Monaten, Tagen, Jahren).
function humanDuration(days: number, lang: string, dative = false): string {
  if (days < 14) return lang === 'de' ? `${days} ${dative ? 'Tagen' : 'Tage'}` : `${days} days`;
  if (days < 60) {
    const w = Math.round(days / 7);
    // Woche / Wochen are the same in dative
    return lang === 'de'
      ? `${w} ${w === 1 ? 'Woche' : 'Wochen'}`
      : `${w} ${w === 1 ? 'week' : 'weeks'}`;
  }
  if (days < 730) {
    const m = Math.round(days / 30);
    return lang === 'de'
      ? `${m} ${m === 1 ? 'Monat' : dative ? 'Monaten' : 'Monate'}`
      : `${m} ${m === 1 ? 'month' : 'months'}`;
  }
  const y = Math.round(days / 365);
  return lang === 'de'
    ? `${y} ${y === 1 ? 'Jahr' : dative ? 'Jahren' : 'Jahre'}`
    : `${y} ${y === 1 ? 'year' : 'years'}`;
}

// Returns d if it is a valid Date, otherwise falls back to today.
// Prevents DateTimePicker from receiving null/undefined/NaN.
function safeDate(d: Date | null | undefined): Date {
  return d instanceof Date && !isNaN(d.getTime()) ? d : new Date();
}

// ─── Component ────────────────────────────────────────────────────────────────

export function ListScreen({ mode }: { mode: Mode }) {
  const cfg = MODE_CONFIG[mode];
  const insets = useSafeAreaInsets();
  const { lang } = useLanguage();
  const t = STRINGS[lang];
  const tcfg = t[mode];
  const [items, setItems] = useState<Item[]>([]);
  const [modalVisible, setModalVisible] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [isDirty,    setIsDirty]    = useState(false);
  const [form, setForm] = useState<FormState>(freshForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const hasLoaded    = useRef(false);
  const maxPickerDate = useRef(new Date()).current; // stable reference — avoids native crash from recreating Date every render

  const { favorites, toggleFavorite } = useFavorites(cfg.favoritesKey);

  // ── Effects ────────────────────────────────────────────────────────────────

  useEffect(() => {
    loadItems(cfg.storageKey)
      .then(loaded => {
        setItems(loaded);
        hasLoaded.current = true;
      })
      .catch(e => console.error('Failed to load items:', e));
  }, [cfg.storageKey]);

  useEffect(() => {
    requestNotificationPermission()
      .then(granted => {
        if (granted) return scheduleDebugNotification();
      })
      .catch(e => console.error('Notification setup failed:', e));
  }, []);

  useEffect(() => {
    if (!hasLoaded.current) return;
    saveItems(items, cfg.storageKey).catch(e => console.error('Failed to save items:', e));
    // Keep the widget in sync — only the items list drives the widget, not subscriptions.
    if (mode === 'item') syncWidgetItems(items);
  }, [items, cfg.storageKey, mode]);

  // Picker is closed via TextInput onFocus (see below) rather than a keyboardWillShow
  // listener, because the listener also fires when the iOS inline picker opens its own
  // year-entry keyboard — that would unmount the picker mid-interaction and crash.

  // Reset success banner each time the modal opens.
  useEffect(() => {
    if (modalVisible) setShowSuccess(false);
  }, [modalVisible]);

  // ── Notification helpers ───────────────────────────────────────────────────

  async function cancelItemNotifs(item: Item) {
    if (mode === 'item') {
      await cancelNotification(item.notificationId);
    } else {
      await cancelSubscriptionNotifications(item.notificationIds);
    }
  }

  async function scheduleItemNotifs(partial: Item): Promise<Partial<Item>> {
    if (mode === 'item') {
      const id = await scheduleExpiryNotification(partial).catch(() => null);
      return { notificationId: id ?? undefined };
    } else {
      const ids = await scheduleSubscriptionNotifications(partial).catch(() => []);
      return { notificationIds: ids.length ? ids : undefined };
    }
  }

  // ── Actions ────────────────────────────────────────────────────────────────

  const deleteItem = useCallback((id: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setItems(prev => {
      const target = prev.find(i => i.id === id);
      if (target) {
        cancelItemNotifs(target).catch(e => console.error('Failed to cancel notification on delete:', e));
      }
      return prev.filter(i => i.id !== id);
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode]);

  const openModal = useCallback((item?: Item) => {
    if (item) {
      setEditingId(item.id);
      const safeExpiry = safeDate(item.expiryDate ? new Date(item.expiryDate) : null);
      const safeOpened = safeDate(item.dateAdded  ? new Date(item.dateAdded)  : null);
      setForm({
        name: item.name,
        date:             safeExpiry,
        openedOn:         safeOpened,
        originalOpenedOn: safeOpened.toISOString(), // snapshot for save intercept
        activePicker: false,
        expirySource: 'manual',
        longerUsableHint: item.longerUsableHint,
        longerUsableHintEn: item.longerUsableHintEn,
      });
    } else {
      setEditingId(null);
      setForm(freshForm());
    }
    setIsDirty(false);
    setModalVisible(true);
  }, []);

  // Core save — accepts an optional expiry override (used by the Yes prompt handler).
  // fromPrompt=true means a prompt Yes/No triggered this: never close the modal.
  async function doSave(overrideExpiry?: Date, fromPrompt = false) {
    const raw = form.name.trim();
    if (!raw) return;

    const name = raw.charAt(0).toUpperCase() + raw.slice(1);
    // safeDate guard prevents RangeError from toISOString() on an invalid Date.
    const savedExpiry = safeDate(overrideExpiry ?? form.date);
    const expiryDate  = savedExpiry.toISOString();
    const dateAdded   = form.openedOn.toISOString();

    // Sync helper — clears the recalc prompt and keeps the form consistent.
    const syncForm = (currentOpenedOn: Date) =>
      setForm(prev => ({
        ...prev,
        name,
        date: savedExpiry,
        originalOpenedOn: currentOpenedOn.toISOString(),
      }));

    const showBanner = () => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setShowSuccess(true);
      setIsDirty(false);
      setTimeout(() => setShowSuccess(false), 1500);
    };

    if (editingId) {
      const existing = items.find(i => i.id === editingId);
      if (existing) {
        await cancelItemNotifs(existing).catch(e => console.error('Failed to cancel notification on edit:', e));
      }
      const notifFields = await scheduleItemNotifs({ id: editingId, name, expiryDate }).catch(() => ({}));
      const longerUsableHint = form.longerUsableHint;
      const longerUsableHintEn = form.longerUsableHintEn;
      setItems(prev => prev.map(item =>
        item.id === editingId ? { ...item, name, expiryDate, dateAdded, longerUsableHint, longerUsableHintEn, ...notifFields } : item
      ));
      syncForm(form.openedOn);
      showBanner();
    } else {
      const id = Date.now().toString();
      const notifFields = await scheduleItemNotifs({ id, name, expiryDate }).catch(() => ({}));
      const longerUsableHint = form.longerUsableHint;
      const longerUsableHintEn = form.longerUsableHintEn;
      setItems(prev => [...prev, { id, name, expiryDate, dateAdded, longerUsableHint, longerUsableHintEn, ...notifFields }]);

      if (fromPrompt) {
        // Prompt was answered for a new item: stay open (switch to edit mode so a
        // second Save updates rather than duplicating).
        setEditingId(id);
        syncForm(form.openedOn);
        showBanner();
      } else {
        // Normal new-item save: close immediately.
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        setModalVisible(false);
      }
    }
  }

  // Save button handler — intercepts when openedOn changed from its value when the modal opened.
  async function saveItem() {
    if (!form.name.trim()) return;

    const openedOnChanged =
      form.openedOn.toDateString() !== new Date(form.originalOpenedOn).toDateString();

    if (openedOnChanged) {
      // Surface the recalc prompt; don't save yet.
      setForm(prev => ({ ...prev, activePicker: false }));
      return;
    }

    await doSave();
  }

  // Prompt: Yes — recalculate expiry from new openedOn, then save immediately.
  async function handlePromptYes() {
    let newExpiry: Date;
    if (form.lookupItem) {
      newExpiry = suggestedExpiryDate(form.lookupItem, form.openedOn);
    } else {
      const origMs = new Date(form.originalOpenedOn).getTime();
      const durMs  = form.date.getTime() - origMs;
      // Guard: if either value is NaN fall back to current expiry unchanged.
      newExpiry = isNaN(origMs) || isNaN(durMs)
        ? safeDate(form.date)
        : new Date(form.openedOn.getTime() + Math.max(0, durMs));
    }
    await doSave(newExpiry, true);
  }

  // Prompt: No — keep current expiry and save immediately.
  async function handlePromptNo() {
    await doSave(undefined, true);
  }

  // ── Lookup & suggestion helpers ────────────────────────────────────────────

  const lookupMatches = useMemo(() => {
    if (!cfg.showLookup || editingId) return [];
    const q    = form.name.toLowerCase();
    const prim = (item: DattlItem) => (lang === 'de' ? item.de : item.en).toLowerCase();
    return findItem(form.name)
      .filter(item => prim(item) !== q) // exclude exact match in primary language
      .filter(item => {
        if (form.name.length >= 4) return true; // 4+ chars: allow cross-language results
        return prim(item).startsWith(q) || prim(item).includes(q);
      });
  }, [form.name, cfg.showLookup, editingId, lang]);

  const applyLookup = useCallback((lookupItem: DattlItem) => {
    setIsDirty(true);
    setForm(prev => ({
      ...prev,
      name: lang === 'de' ? lookupItem.de : lookupItem.en,
      date: suggestedExpiryDate(lookupItem, prev.openedOn),
      expirySource: 'lookup',
      lookupItem,
      lookupOpenedOn: prev.openedOn.toISOString(),
      longerUsableHint: lookupItem.longerUsableHint,
      longerUsableHintEn: lookupItem.longerUsableHintEn,
    }));
  }, [lang]);

  // ── Derived data ───────────────────────────────────────────────────────────

  const sortedItems = useMemo(() => sortItems(items), [items]);

  // ── Health overview ─────────────────────────────────────────────────────────
  const overview = useMemo(() => {
    const expired = sortedItems.filter(i => getDaysUntilExpiry(i.expiryDate) < 0).length;
    const soon    = sortedItems.filter(i => {
      const d = getDaysUntilExpiry(i.expiryDate);
      return d >= 0 && d <= 7;
    }).length;
    const ok        = sortedItems.length - expired - soon;
    const attention = expired + soon;
    return { expired, soon, ok, attention };
  }, [sortedItems]);

  const showExpiryPrompt =
    form.openedOn.toDateString() !== new Date(form.originalOpenedOn).toDateString();

  const modalSuggestions = useMemo(() => {
    const seen = new Set<string>();
    const result: { name: string; isFav: boolean }[] = [];

    for (const name of favorites) {
      const key = name.toLowerCase();
      if (!seen.has(key)) { seen.add(key); result.push({ name, isFav: true }); }
    }

    const recent = [...items]
      .filter(i => i.dateAdded)
      .sort((a, b) => new Date(b.dateAdded!).getTime() - new Date(a.dateAdded!).getTime());

    for (const item of recent) {
      if (result.length >= 8) break;
      const key = item.name.toLowerCase();
      if (!seen.has(key)) { seen.add(key); result.push({ name: item.name, isFav: false }); }
    }

    return result;
  }, [items, favorites]);

  // ── Render helpers ─────────────────────────────────────────────────────────

  const renderItem = useCallback(({ item }: { item: Item }) => {
    const daysLeft = getDaysUntilExpiry(item.expiryDate);
    const starred  = favorites.some(f => f.toLowerCase() === item.name.toLowerCase());

    return (
      <View style={styles.rowContainer}>
        <Swipeable
          renderRightActions={() => (
            <Pressable onPress={() => deleteItem(item.id)} style={styles.swipeDeleteAction}>
              <Text style={styles.swipeDeleteText}>{t.delete}</Text>
            </Pressable>
          )}
        >
          <Pressable onPress={() => openModal(item)} style={[styles.row, getRowStyle(daysLeft)]}>
            <View style={styles.info}>
              <Text style={styles.name}>{item.name}</Text>
              {item.dateAdded && (
                <Text style={styles.openedOn}>{tcfg.cardDateLabel} {formatDate(item.dateAdded, t.locale)}</Text>
              )}
              {daysLeft < 0 && (item.longerUsableHint || item.longerUsableHintEn) && (
                <Text style={styles.longerUsableHint}>
                  ⓘ {lang === 'de' ? item.longerUsableHint : (item.longerUsableHintEn ?? item.longerUsableHint)}
                </Text>
              )}
            </View>
            <View style={styles.rightSide}>
              {(daysLeft < 0 || daysLeft <= 7) && (
                <Text style={[styles.statusLabel, getStatusLabelStyle(daysLeft)]}>
                  {tcfg.statusLabel(daysLeft)}
                </Text>
              )}
              <Pressable
                onPress={() => toggleFavorite(item.name)}
                style={styles.starBtn}
                hitSlop={8}
              >
                <Ionicons
                  name={starred ? 'star' : 'star-outline'}
                  size={18}
                  color={starred ? COLORS.accent : COLORS.textMuted}
                />
              </Pressable>
            </View>
          </Pressable>
        </Swipeable>
      </View>
    );
  }, [deleteItem, openModal, toggleFavorite, favorites, t, tcfg]);

  // Lookup match for the item currently open in the sheet (edit mode only).
  const dattlInfoMatch = useMemo(() => {
    if (!editingId || !cfg.showLookup) return undefined;
    const q = form.name.toLowerCase();
    return DATTL_ITEMS.find(d => d.de.toLowerCase() === q || d.en.toLowerCase() === q);
  }, [editingId, form.name, cfg.showLookup]);

  function handleDeleteFromModal() {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    Alert.alert(
      lang === 'de' ? 'Löschen?' : 'Delete?',
      lang === 'de' ? 'Diesen Eintrag wirklich löschen?' : 'Delete this item?',
      [
        { text: t.cancel, style: 'cancel' },
        {
          text: t.delete,
          style: 'destructive',
          onPress: () => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            if (editingId) deleteItem(editingId);
            setModalVisible(false);
          },
        },
      ],
    );
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  const isTyping = form.name.trim().length > 0;

  return (
    <View style={styles.container}>
      <Text style={styles.header}>Dattl</Text>

      {/* ── Health overview card ────────────────────────────────────────────── */}
      {sortedItems.length > 0 && (() => {
        const { expired, soon, attention } = overview;
        const allClear = attention === 0;
        // Blend ring color: amber when all "soon", red when all expired, interpolated when mixed
        const ratio      = attention > 0 ? expired / attention : 0;
        const r = Math.round(245 + (224 - 245) * ratio);
        const g = Math.round(197 + ( 82 - 197) * ratio);
        const b = Math.round( 66 + ( 82 -  66) * ratio);
        const badgeColor = allClear ? '#4ade80' : `rgb(${r},${g},${b})`;

        return (
          <View style={styles.overviewCard}>
            {/* Circular badge (ring gauge) */}
            <View style={[styles.overviewBadge, { borderColor: badgeColor }]}>
              <Text style={[styles.overviewBadgeText, { color: badgeColor }]}>
                {allClear ? '✓' : attention}
              </Text>
            </View>

            {/* Right side */}
            <View style={styles.overviewContent}>
              <Text style={[styles.overviewTitle, { color: allClear ? '#4ade80' : COLORS.text }]}>
                {allClear
                  ? t.overviewAllClear
                  : tcfg.overviewNeedsAttention(attention)}
              </Text>

              {/* Segmented bar — only red/amber, no grey filler */}
              <View style={styles.overviewBar}>
                {expired > 0 && (
                  <View style={[styles.overviewSeg, { flex: expired, backgroundColor: COLORS.expired }]} />
                )}
                {soon > 0 && (
                  <View style={[styles.overviewSeg, { flex: soon, backgroundColor: COLORS.warning }]} />
                )}
                {allClear && (
                  <View style={[styles.overviewSeg, { flex: 1, backgroundColor: '#4ade8030' }]} />
                )}
              </View>

              {/* Meta label */}
              {!allClear && (
                <Text style={styles.overviewMeta}>
                  {[
                    expired > 0 ? t.overviewExpiredLabel(expired) : '',
                    soon    > 0 ? t.overviewSoonLabel(soon)       : '',
                  ].filter(Boolean).join('  ·  ')}
                </Text>
              )}
            </View>
          </View>
        );
      })()}

      <FlatList
        data={sortedItems}
        keyExtractor={item => item.id}
        renderItem={renderItem}
        contentContainerStyle={sortedItems.length === 0 ? styles.emptyContainer : undefined}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Image
              source={require('../assets/images/icon.png')}
              style={styles.emptyLogo}
            />
            <Text style={styles.emptyTitle}>{tcfg.emptyTitle}</Text>
            <Text style={styles.emptySubtitle}>{tcfg.emptySubtitle}</Text>
          </View>
        }
      />

      <View style={[styles.bottomSection, { paddingBottom: insets.bottom + 8 }]}>
        <Pressable onPress={() => openModal()} style={styles.addButton}>
          <Text style={styles.addButtonText}>{tcfg.addButton}</Text>
        </Pressable>
      </View>

      {/* ── Add / Edit Modal ──────────────────────────────────────────────── */}
      <Modal visible={modalVisible} animationType="slide" transparent>
        <KeyboardAvoidingView
          style={styles.modalOverlay}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <View style={styles.modalBox}>
            <Text style={styles.modalTitle}>
              {editingId ? tcfg.editTitle : tcfg.newTitle}
            </Text>

            {/* ── Name field ──────────────────────────────────────────────── */}
            <TextInput
              style={styles.input}
              placeholder={tcfg.placeholder}
              placeholderTextColor={COLORS.textMuted}
              value={form.name}
              onChangeText={text => {
                setIsDirty(true);
                setForm(prev => ({
                  ...prev,
                  name: text,
                  expirySource: 'manual',
                  lookupItem: undefined,
                  lookupOpenedOn: undefined,
                  longerUsableHint: undefined,
                  longerUsableHintEn: undefined,
                }));
              }}
              autoFocus={editingId === null}
              onFocus={() => setForm(prev => ({ ...prev, activePicker: false }))}
              returnKeyType="done"
              onSubmitEditing={() => {
                Keyboard.dismiss();
                setForm(prev => ({ ...prev, activePicker: 'expiry' }));
              }}
            />

            {/* ── Item info card (edit mode only) ─────────────────────────
                Shows lookup data for the open item — typical duration, hint,
                and longerUsable note. Hidden while a date picker is active.  */}
            {editingId && form.activePicker === false && (dattlInfoMatch || form.longerUsableHint || form.longerUsableHintEn) && (
              <View style={styles.infoCard}>
                {dattlInfoMatch && (
                  <Text style={styles.infoTypical}>{t.detailTypical(dattlInfoMatch.daysAfterOpening)}</Text>
                )}
                {(form.longerUsableHint || form.longerUsableHintEn) && (
                  <Text style={styles.infoLonger}>
                    ⓘ {lang === 'de' ? form.longerUsableHint : (form.longerUsableHintEn ?? form.longerUsableHint)}
                  </Text>
                )}
              </View>
            )}

            {/* ── Add-item hint ────────────────────────────────────────────
                Shown after selecting a suggestion pill. Displays a readable
                shelf-life sentence and the longerUsable note if present.    */}
            {!editingId && form.lookupItem && form.activePicker === false && (
              <>
                <Text style={styles.lookupHint}>
                  {form.lookupItem.category === 'bath'
                    ? t.addItemHintBath(humanDuration(form.lookupItem.daysAfterOpening, lang, lang === 'de'))
                    : t.addItemHint(lang === 'de' ? form.lookupItem.de : form.lookupItem.en, humanDuration(form.lookupItem.daysAfterOpening, lang))}
                </Text>
                {(form.longerUsableHint || form.longerUsableHintEn) && (
                  <Text style={styles.infoLonger}>
                    ⓘ {lang === 'de' ? form.longerUsableHint : (form.longerUsableHintEn ?? form.longerUsableHint)}
                  </Text>
                )}
              </>
            )}

            {/* ── Suggestions (items mode only) ────────────────────────────
                When typing → lookup matches.
                When empty  → favorites / recent Quick Add pills.
                Hidden once a calendar is visible.                       */}
            {cfg.showLookup && !editingId && form.activePicker === false && (
              isTyping ? (
                lookupMatches.length > 0 && (
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    keyboardShouldPersistTaps="handled"
                    contentContainerStyle={styles.pillRow}
                  >
                    {lookupMatches.map(item => (
                      <Pressable
                        key={item.de}
                        onPress={() => applyLookup(item)}
                        style={styles.lookupPill}
                      >
                        <Text style={styles.lookupPillName}>{lang === 'de' ? item.de : item.en}</Text>
                        <Text style={styles.lookupPillDuration}>
                          {formatDuration(item.daysAfterOpening)}
                        </Text>
                      </Pressable>
                    ))}
                  </ScrollView>
                )
              ) : (
                modalSuggestions.length > 0 && (
                  <View>
                    <Text style={styles.quickAddLabel}>{t.quickAdd}</Text>
                    <ScrollView
                      horizontal
                      showsHorizontalScrollIndicator={false}
                      keyboardShouldPersistTaps="handled"
                      contentContainerStyle={styles.pillRow}
                    >
                      {modalSuggestions.map(({ name, isFav }) => (
                        <Pressable
                          key={name}
                          onPress={() => {
                            const match = DATTL_ITEMS.find(d => d.de.toLowerCase() === name.toLowerCase());
                            if (match) {
                              applyLookup(match);
                            } else {
                              setIsDirty(true);
                              setForm(prev => ({ ...prev, name }));
                            }
                          }}
                          style={styles.quickAddPill}
                        >
                          {isFav && <Text style={styles.quickAddStar}>★</Text>}
                          <Text style={styles.quickAddPillText}>{name}</Text>
                        </Pressable>
                      ))}
                    </ScrollView>
                  </View>
                )
              )
            )}

            {/* ── Keyboard phase — date rows ───────────────────────────────── */}
            {form.activePicker === false && (
              <>
                {/* Opened on / Started on row */}
                <Pressable
                  onPress={() => {
                    Keyboard.dismiss();
                    setForm(prev => ({ ...prev, activePicker: 'openedOn' }));
                  }}
                  style={styles.dateRow}
                >
                  <Text style={styles.dateRowLabel}>{tcfg.openedOnLabel}</Text>
                  <Text style={styles.dateRowValue}>
                    {form.openedOn.toLocaleDateString(t.locale, DATE_FORMAT)}
                  </Text>
                  <Text style={styles.dateRowChevron}>›</Text>
                </Pressable>

                {/* Expiry recalculation prompt (items mode only) */}
                {showExpiryPrompt && (
                  <View style={styles.expiryPrompt}>
                    <Text style={styles.expiryPromptText}>{t.expiryPrompt}</Text>
                    <View style={styles.expiryPromptBtns}>
                      <Pressable onPress={handlePromptYes} style={styles.promptYes}>
                        <Text style={styles.promptYesText}>{t.yesUpdate}</Text>
                      </Pressable>
                      <Pressable onPress={handlePromptNo} style={styles.promptNo}>
                        <Text style={styles.promptNoText}>{t.noKeep}</Text>
                      </Pressable>
                    </View>
                  </View>
                )}

                {/* Expires / Cancel by row */}
                <Pressable
                  onPress={() => {
                    Keyboard.dismiss();
                    setForm(prev => ({
                      ...prev,
                      activePicker: 'expiry',
                      expirySource: 'manual',
                      lookupOpenedOn: undefined,
                      // User is manually setting the expiry — treat openedOn as "accepted"
                      // so the recalc prompt doesn't reappear after they save.
                      originalOpenedOn: prev.openedOn.toISOString(),
                    }));
                  }}
                  style={styles.dateRow}
                >
                  <Text style={styles.dateRowLabel}>{tcfg.expiryLabel}</Text>
                  <Text style={styles.dateRowValue}>
                    {form.date.toLocaleDateString(t.locale, DATE_FORMAT)}
                  </Text>
                  <Text style={styles.dateRowChevron}>›</Text>
                </Pressable>
              </>
            )}

            {/* ── Calendar phase ───────────────────────────────────────────────
                BOTH pickers are ALWAYS in the tree.
                · Conditional rendering causes rapid UIDatePicker destruction /
                  recreation → native iOS crash.
                · A single shared picker that mutates its `value` and adds /
                  removes `maximumDate` when the active type switches also
                  crashes — the native component can't handle those simultaneous
                  prop changes while hidden.
                · Two dedicated instances keep every prop stable: the openedOn
                  picker always receives form.openedOn + a fixed maximumDate;
                  the expiry picker always receives form.date with no max.      */}
            <View
              style={form.activePicker === false ? styles.pickerContainerHidden : undefined}
              pointerEvents={form.activePicker === false ? 'none' : 'auto'}
            >
              {/* Opened-on picker — always mounted, stable value + maximumDate */}
              <View
                style={form.activePicker !== 'openedOn' ? styles.pickerSlotHidden : undefined}
                pointerEvents={form.activePicker !== 'openedOn' ? 'none' : 'auto'}
              >
                <DateTimePicker
                  value={safeDate(form.openedOn)}
                  mode="date"
                  display={PICKER_INLINE ? 'inline' : 'default'}
                  themeVariant="dark"
                  accentColor="#C96A00"
                  minimumDate={PICKER_MIN_DATE}
                  maximumDate={maxPickerDate}
                  onChange={(_, selectedDate) => {
                    setForm(prev => {
                      if (prev.activePicker !== 'openedOn') return prev;
                      const dismiss = PICKER_INLINE ? {} : { activePicker: false as ActivePicker };
                      if (!selectedDate) return { ...prev, ...dismiss };
                      return { ...prev, ...dismiss, openedOn: selectedDate };
                    });
                    if (selectedDate) setIsDirty(true);
                  }}
                  style={styles.datePicker}
                />
              </View>

              {/* Expiry picker — always mounted, stable value, no maximumDate */}
              <View
                style={form.activePicker !== 'expiry' ? styles.pickerSlotHidden : undefined}
                pointerEvents={form.activePicker !== 'expiry' ? 'none' : 'auto'}
              >
                <DateTimePicker
                  value={safeDate(form.date)}
                  mode="date"
                  display={PICKER_INLINE ? 'inline' : 'default'}
                  themeVariant="dark"
                  accentColor="#C96A00"
                  minimumDate={PICKER_MIN_DATE}
                  onChange={(_, selectedDate) => {
                    setForm(prev => {
                      if (prev.activePicker !== 'expiry') return prev;
                      const dismiss = PICKER_INLINE ? {} : { activePicker: false as ActivePicker };
                      if (!selectedDate) return { ...prev, ...dismiss };
                      return { ...prev, ...dismiss, date: selectedDate };
                    });
                    if (selectedDate) setIsDirty(true);
                  }}
                  style={styles.datePicker}
                />
              </View>
            </View>

            {/* ── Buttons / success banner ──────────────────────────────────
                Picker open:     [Done]            → collapses picker, stays in modal
                New item:        [Cancel]  [Save]  → closes on save
                Edit, not dirty: [Close]           → closes immediately
                Edit, dirty:     [Cancel]  [Save]  → shows banner, resets to Close
                Success:         ✓ Saved banner (replaces buttons for 1.5 s)   */}
            {form.activePicker !== false ? (
              <Pressable
                onPress={() => {
                  Haptics.selectionAsync();
                  setForm(prev => ({ ...prev, activePicker: false }));
                }}
                style={styles.doneBtn}
              >
                <Text style={styles.doneBtnText}>{t.done}</Text>
              </Pressable>
            ) : showSuccess ? (
              <View style={styles.successBanner}>
                <Text style={styles.successText}>{t.saved}</Text>
              </View>
            ) : editingId && !isDirty ? (
              <Pressable onPress={() => setModalVisible(false)} style={styles.closeOnlyBtn}>
                <Text style={styles.cancelText}>{t.close}</Text>
              </Pressable>
            ) : (
              <View style={styles.modalButtons}>
                <Pressable onPress={() => setModalVisible(false)} style={styles.cancelBtn}>
                  <Text style={styles.cancelText}>{t.cancel}</Text>
                </Pressable>
                <Pressable onPress={saveItem} style={styles.saveBtn}>
                  <Text style={styles.saveText}>{t.save}</Text>
                </Pressable>
              </View>
            )}

            {/* Delete link — only shown for existing items, not while picker is open */}
            {editingId && form.activePicker === false && !showSuccess && (
              <Pressable onPress={handleDeleteFromModal} style={styles.deleteLink}>
                <Text style={styles.deleteLinkText}>{t.delete}</Text>
              </Pressable>
            )}
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const btnBase = {
  flex: 1,
  borderRadius: 12,
  padding: 16,
  alignItems: 'center' as const,
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.bg,
    paddingTop: 60,
    paddingHorizontal: 20,
  },
  header: {
    fontFamily: 'Poppins_800ExtraBold',
    fontSize: 42,
    color: COLORS.accent,
    textAlign: 'center',
    letterSpacing: -1,
    marginBottom: 24,
  },

  // ── List rows ──────────────────────────────────────────────────────────────
  rowContainer: { marginBottom: 8 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 16,
    paddingRight: 8,
    paddingLeft: 16,
    borderRadius: 12,
    backgroundColor: '#1C1C1C',
    borderLeftWidth: 4,
    borderLeftColor: 'transparent',
  },
  rowWarning: { borderLeftColor: COLORS.warning },
  rowExpired: { borderLeftColor: COLORS.expired },
  info: { flex: 1 },
  name: { fontSize: 18, fontWeight: '700', color: COLORS.text },
  openedOn: { fontSize: 11, color: COLORS.textMuted, marginTop: 3 },
  longerUsableHint: { fontSize: 11, color: COLORS.accent, marginTop: 3 },

  // ── Swipe-to-delete ────────────────────────────────────────────────────────
  swipeDeleteAction: {
    backgroundColor: COLORS.expired,
    justifyContent: 'center',
    alignItems: 'center',
    width: 80,
    borderRadius: 12,
    marginLeft: 6,
  },
  swipeDeleteText: { color: '#ffffff', fontSize: 14, fontWeight: '700' },

  // ── Right-side column ──────────────────────────────────────────────────────
  rightSide: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  statusLabel: { fontSize: 11, fontWeight: '500', textAlign: 'right' },
  statusWarning: { color: COLORS.warning },
  statusExpired: { color: COLORS.expired },
  statusNeutral: { color: COLORS.textMuted },
  starBtn: { paddingHorizontal: 10, paddingVertical: 6 },

  // ── Empty state ────────────────────────────────────────────────────────────
  emptyContainer: { flex: 1 },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
    paddingBottom: 60,
  },
  emptyLogo: {
    width: 90,
    height: 90,
    borderRadius: 20,
    marginBottom: 4,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: COLORS.text,
    textAlign: 'center',
  },
  emptySubtitle: {
    fontSize: 14,
    color: COLORS.textMuted,
    textAlign: 'center',
    maxWidth: 220,
    lineHeight: 20,
  },

  // ── Health overview ────────────────────────────────────────────────────────
  overviewCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    backgroundColor: COLORS.surface,
    borderRadius: 14,
    padding: 14,
    marginBottom: 16,
  },
  overviewBadge: {
    width: 52,
    height: 52,
    borderRadius: 26,
    borderWidth: 3,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  overviewBadgeText: {
    fontSize: 20,
    fontWeight: '800',
  },
  overviewContent: {
    flex: 1,
    gap: 6,
  },
  overviewTitle: {
    fontSize: 14,
    fontWeight: '700',
  },
  overviewBar: {
    flexDirection: 'row',
    height: 5,
    borderRadius: 3,
    overflow: 'hidden',
    gap: 2,
  },
  overviewSeg: {
    borderRadius: 3,
  },
  overviewMeta: {
    fontSize: 11,
    color: COLORS.textMuted,
  },

  // ── Bottom action area ─────────────────────────────────────────────────────
  bottomSection: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#272727',
    paddingTop: 12,
  },
  addButton: {
    backgroundColor: '#7A4200',
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 20,
    alignItems: 'center',
  },
  addButtonText: { color: '#ffffff', fontSize: 16, fontWeight: '700', letterSpacing: 0.2 },

  // ── Modal ──────────────────────────────────────────────────────────────────
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: COLORS.overlay,
  },
  modalBox: {
    backgroundColor: COLORS.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    gap: 12,
  },
  modalTitle: { fontSize: 20, fontWeight: '700', color: COLORS.text },
  input: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 12,
    padding: 14,
    fontSize: 16,
    color: COLORS.text,
    backgroundColor: COLORS.bg,
  },

  // ── Lookup hint ────────────────────────────────────────────────────────────
  lookupHint: {
    fontSize: 12,
    color: COLORS.textMuted,
    marginTop: -4,
  },

  // ── Shared pill row ────────────────────────────────────────────────────────
  pillRow: { flexDirection: 'row', gap: 8, paddingBottom: 2 },

  // ── Lookup suggestion pills ────────────────────────────────────────────────
  lookupPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderColor: COLORS.accent,
    borderRadius: 20,
    paddingVertical: 6,
    paddingHorizontal: 12,
    backgroundColor: '#1C1C1C',
  },
  lookupPillName: { fontSize: 13, color: COLORS.text, fontWeight: '500' },
  lookupPillDuration: { fontSize: 11, color: COLORS.accent },

  // ── Quick Add pills ────────────────────────────────────────────────────────
  quickAddLabel: { fontSize: 11, color: COLORS.textMuted },
  quickAddPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderWidth: 1,
    borderColor: '#333333',
    borderRadius: 20,
    paddingVertical: 6,
    paddingHorizontal: 12,
    backgroundColor: '#1C1C1C',
  },
  quickAddStar: { fontSize: 10, color: COLORS.accent },
  quickAddPillText: { fontSize: 12, color: COLORS.text },

  // ── Date rows (keyboard phase) ─────────────────────────────────────────────
  dateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 14,
    backgroundColor: COLORS.bg,
  },
  dateRowLabel: { fontSize: 14, color: COLORS.textMuted, flex: 1 },
  dateRowValue: { fontSize: 15, color: COLORS.text, marginRight: 8 },
  dateRowChevron: { fontSize: 18, color: COLORS.accent, fontWeight: '600' },

  // ── Expiry recalculation prompt ────────────────────────────────────────────
  expiryPrompt: {
    borderWidth: 1,
    borderColor: COLORS.warning,
    borderRadius: 12,
    padding: 12,
    gap: 10,
    backgroundColor: 'rgba(245,197,66,0.07)',
  },
  expiryPromptText: { fontSize: 13, color: COLORS.warning },
  expiryPromptBtns: { flexDirection: 'row', gap: 8 },
  promptYes: {
    flex: 1,
    backgroundColor: COLORS.warning,
    borderRadius: 8,
    paddingVertical: 8,
    alignItems: 'center',
  },
  promptYesText: { fontSize: 13, color: '#000', fontWeight: '700' },
  promptNo: {
    flex: 1,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 8,
    paddingVertical: 8,
    alignItems: 'center',
  },
  promptNoText: { fontSize: 13, color: COLORS.textMuted },

  // ── Date picker (calendar phase) ───────────────────────────────────────────
  datePicker: { width: '100%' },
  // Outer container collapses to 0 height when no picker is active.
  // overflow:hidden clips the absolutely-positioned pickers inside, but their
  // native UIDatePicker frames remain valid (non-zero) — avoiding the iOS crash
  // that occurs when a UIDatePicker's frame is zeroed while it is mounted.
  pickerContainerHidden: { height: 0, overflow: 'hidden' },
  // Inactive picker slot: pulled out of the layout flow (position:absolute) and
  // made invisible/non-interactive.  The active slot stays in-flow and drives
  // the container's natural height.
  pickerSlotHidden: { position: 'absolute', opacity: 0, width: '100%' },

  // ── Modal action buttons ───────────────────────────────────────────────────
  doneBtn: { borderRadius: 12, padding: 16, alignItems: 'center', backgroundColor: COLORS.accent, marginBottom: 8 },
  doneBtnText: { fontSize: 16, color: '#000000', fontWeight: '700' },
  modalButtons: { flexDirection: 'row', gap: 12, paddingBottom: 8 },
  closeOnlyBtn: { borderRadius: 12, padding: 16, alignItems: 'center' as const, borderWidth: 1, borderColor: COLORS.border, marginBottom: 8 },
  cancelBtn: { ...btnBase, borderWidth: 1, borderColor: COLORS.border },
  cancelText: { fontSize: 16, color: COLORS.textMuted },
  saveBtn: { ...btnBase, backgroundColor: COLORS.accent },
  saveText: { fontSize: 16, color: '#000000', fontWeight: '700' },

  // ── Item info card (edit mode) ─────────────────────────────────────────────
  infoCard: {
    backgroundColor: COLORS.bg,
    borderRadius: 10,
    padding: 12,
    gap: 4,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  infoTypical: { fontSize: 13, color: COLORS.text, fontWeight: '600' },
  infoHint:    { fontSize: 12, color: COLORS.textMuted },
  infoLonger:  { fontSize: 12, color: COLORS.accent },

  // ── Delete link ────────────────────────────────────────────────────────────
  deleteLink: { alignItems: 'center', paddingVertical: 4 },
  deleteLinkText: { fontSize: 14, color: '#E05252' },

  // ── Save success confirmation ──────────────────────────────────────────────
  successBanner: {
    borderRadius: 12,
    paddingVertical: 14,
    paddingBottom: 22,
    alignItems: 'center',
    backgroundColor: 'rgba(74,222,128,0.08)',
    borderWidth: 1,
    borderColor: '#4ade8040',
  },
  successText: { fontSize: 16, fontWeight: '700', color: '#4ade80' },
});
