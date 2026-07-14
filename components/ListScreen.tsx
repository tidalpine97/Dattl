import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  Alert,
  Image,
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  SectionList,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Swipeable } from 'react-native-gesture-handler';
import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import * as Haptics from 'expo-haptics';

import { type Item, type ItemCategory, loadItems, saveItems } from '@/utils/storage';
import { clampDate, DATE_FORMAT, endOfToday, formatDate, getDaysUntilExpiry, getExpiryLabel, getSubscriptionLabel } from '@/utils/dates';
import { useFavorites } from '@/hooks/use-favorites';
import { type DattlItem, DATTL_ITEMS, findItem, suggestedExpiryDate } from '@/constants/dattlItems';
import { useLanguage } from '@/context/language';
import { STRINGS } from '@/constants/i18n';
import { syncWidgetItems } from '@/utils/sharedStorage';
import { colors, fonts, radii, weights } from '@/constants/theme';
import {
  cancelNotification,
  cancelSubscriptionNotifications,
  requestNotificationPermission,
  rescheduleAllItemNotifications,
  scheduleSubscriptionNotifications,
} from '@/utils/notifications';

// ─── Constants ────────────────────────────────────────────────────────────────

const PICKER_INLINE = Platform.OS === 'ios';
const PICKER_MIN_DATE = new Date(2000, 0, 1);

// ─── Category config ───────────────────────────────────────────────────────────

const CATEGORY_ORDER: ItemCategory[] = [
  'fridge', 'freezer', 'pantry', 'medicine', 'cosmetics', 'household', 'other',
];

const CATEGORY_EMOJI: Record<ItemCategory, string> = {
  fridge:    '🧊',
  freezer:   '❄️',
  pantry:    '🥫',
  medicine:  '💊',
  cosmetics: '💄',
  household: '🧹',
  other:     '📦',
};

const CATEGORY_LABEL: Record<ItemCategory, { de: string; en: string }> = {
  fridge:    { de: 'Kühlschrank', en: 'Fridge' },
  freezer:   { de: 'Tiefkühler',  en: 'Freezer' },
  pantry:    { de: 'Vorrat',      en: 'Pantry' },
  medicine:  { de: 'Medizin',     en: 'Medicine' },
  cosmetics: { de: 'Kosmetik',    en: 'Cosmetics' },
  household: { de: 'Haushalt',    en: 'Household' },
  other:     { de: 'Sonstiges',   en: 'Other' },
};

// Food categories use the food-style lookup hint; others use the non-perishable hint.
const FOOD_CATEGORIES = new Set<ItemCategory>(['fridge', 'freezer', 'pantry']);

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
  originalOpenedOn: string;
  activePicker: ActivePicker;
  expirySource: 'lookup' | 'manual';
  lookupItem?: DattlItem;
  lookupOpenedOn?: string;
  longerUsableHint?: string;
  longerUsableHintEn?: string;
  category: ItemCategory;
  categoryManuallySet: boolean;
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
    category: 'other',
    categoryManuallySet: false,
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

function humanDuration(days: number, lang: string, dative = false): string {
  if (days < 14) return lang === 'de' ? `${days} ${dative ? 'Tagen' : 'Tage'}` : `${days} days`;
  if (days < 60) {
    const w = Math.round(days / 7);
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

  // Upper bound for the "opened on" picker. This used to be `useRef(new Date()).current`
  // — captured once, at mount. The tab stays mounted for the whole app session, so the
  // bound aged while `form.openedOn` did not: freshForm() sets openedOn to *now*, and
  // openModal() runs whenever the user taps add. Open the app, browse for five minutes,
  // tap add, and the picker got value = now and maximumDate = now-minus-five-minutes.
  //
  // On iOS the picker renders with display="inline" (UIDatePickerStyleInline), which iOS 26
  // rebuilt on UICalendarView. It asserts when the selected date is outside its range
  // instead of clamping like older iOS did — that is REACT-NATIVE-5:
  // NSInternalInconsistencyException, "Invalid state. Unable to find a lower bounds in range."
  //
  // Re-derived on every modal open so it cannot go stale, and held in state (not recomputed
  // per render) so the native picker keeps a stable prop identity.
  const [pickerMaxDate, setPickerMaxDate] = useState<Date>(endOfToday);

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
    // Request permission on mount; for item mode, initial reschedule happens
    // in the items effect once items are loaded.
    requestNotificationPermission().catch(e => console.error('Notification permission failed:', e));
  }, []);

  useEffect(() => {
    if (!hasLoaded.current) return;
    saveItems(items, cfg.storageKey).catch(e => console.error('Failed to save items:', e));
    if (mode === 'item') {
      syncWidgetItems(items);
      rescheduleAllItemNotifications(items).catch(e => console.error('Notification reschedule failed:', e));
    }
  }, [items, cfg.storageKey, mode]);

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
    if (mode === 'subscription') {
      const ids = await scheduleSubscriptionNotifications(partial).catch(() => []);
      return { notificationIds: ids.length ? ids : undefined };
    }
    // Item mode: batch reschedule is handled by the items useEffect; no per-item ID needed.
    return {};
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
        originalOpenedOn: safeOpened.toISOString(),
        activePicker: false,
        expirySource: 'manual',
        longerUsableHint: item.longerUsableHint,
        longerUsableHintEn: item.longerUsableHintEn,
        category: item.category ?? 'other',
        categoryManuallySet: true, // treat existing category as intentional
      });
    } else {
      setEditingId(null);
      setForm(freshForm());
    }
    // Refresh the picker's upper bound for this session of the modal. Without this
    // it would still hold the bound from mount and reject a freshly-created
    // openedOn (= now) as out of range.
    setPickerMaxDate(endOfToday());
    setIsDirty(false);
    setModalVisible(true);
  }, []);

  async function doSave(overrideExpiry?: Date, fromPrompt = false) {
    const raw = form.name.trim();
    if (!raw) return;

    const name = raw.charAt(0).toUpperCase() + raw.slice(1);
    const savedExpiry = safeDate(overrideExpiry ?? form.date);
    const expiryDate  = savedExpiry.toISOString();
    const dateAdded   = form.openedOn.toISOString();

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

    const category = form.category;

    if (editingId) {
      const existing = items.find(i => i.id === editingId);
      if (existing) {
        await cancelItemNotifs(existing).catch(e => console.error('Failed to cancel notification on edit:', e));
      }
      const notifFields = await scheduleItemNotifs({ id: editingId, name, expiryDate }).catch(() => ({}));
      setItems(prev => prev.map(item =>
        item.id === editingId
          ? {
              ...item, name, expiryDate, dateAdded, category,
              longerUsableHint: form.longerUsableHint,
              longerUsableHintEn: form.longerUsableHintEn,
              ...notifFields,
            }
          : item
      ));
      syncForm(form.openedOn);
      showBanner();
    } else {
      const id = Date.now().toString();
      const notifFields = await scheduleItemNotifs({ id, name, expiryDate }).catch(() => ({}));
      setItems(prev => [
        ...prev,
        {
          id, name, expiryDate, dateAdded, category,
          longerUsableHint: form.longerUsableHint,
          longerUsableHintEn: form.longerUsableHintEn,
          ...notifFields,
        },
      ]);

      if (fromPrompt) {
        setEditingId(id);
        syncForm(form.openedOn);
        showBanner();
      } else {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        setModalVisible(false);
      }
    }
  }

  async function saveItem() {
    if (!form.name.trim()) return;

    const openedOnChanged =
      form.openedOn.toDateString() !== new Date(form.originalOpenedOn).toDateString();

    if (openedOnChanged) {
      setForm(prev => ({ ...prev, activePicker: false }));
      return;
    }

    await doSave();
  }

  async function handlePromptYes() {
    let newExpiry: Date;
    if (form.lookupItem) {
      newExpiry = suggestedExpiryDate(form.lookupItem, form.openedOn);
    } else {
      const origMs = new Date(form.originalOpenedOn).getTime();
      const durMs  = form.date.getTime() - origMs;
      newExpiry = isNaN(origMs) || isNaN(durMs)
        ? safeDate(form.date)
        : new Date(form.openedOn.getTime() + Math.max(0, durMs));
    }
    await doSave(newExpiry, true);
  }

  async function handlePromptNo() {
    await doSave(undefined, true);
  }

  // ── Lookup & suggestion helpers ────────────────────────────────────────────

  const lookupMatches = useMemo(() => {
    if (!cfg.showLookup || editingId) return [];
    const q    = form.name.toLowerCase();
    const prim = (item: DattlItem) => (lang === 'de' ? item.de : item.en).toLowerCase();
    return findItem(form.name)
      .filter(item => prim(item) !== q)
      .filter(item => {
        if (form.name.length >= 4) return true;
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
      // Auto-assign category only if user hasn't manually picked one
      category: prev.categoryManuallySet ? prev.category : lookupItem.category,
    }));
  }, [lang]);

  // ── Derived data ───────────────────────────────────────────────────────────

  const sortedItems = useMemo(() => sortItems(items), [items]);

  const sections = useMemo(() => {
    if (mode !== 'item') {
      if (sortedItems.length === 0) return [];
      return [{ key: 'all' as ItemCategory, title: '', data: sortedItems }];
    }
    return CATEGORY_ORDER
      .map(cat => ({
        key: cat,
        title: `${CATEGORY_EMOJI[cat]} ${CATEGORY_LABEL[cat][lang]}`,
        data: sortedItems.filter(i => (i.category ?? 'other') === cat),
      }))
      .filter(s => s.data.length > 0);
  }, [sortedItems, mode, lang]);

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
                  color={starred ? colors.text : colors.muted}
                />
              </Pressable>
            </View>
          </Pressable>
        </Swipeable>
      </View>
    );
  }, [deleteItem, openModal, toggleFavorite, favorites, t, tcfg, lang]);

  const renderSectionHeader = useCallback(({ section }: { section: { title: string } }) => {
    if (!section.title) return null;
    return (
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionHeaderText}>{section.title}</Text>
      </View>
    );
  }, []);

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

  // ── Health overview card ───────────────────────────────────────────────────

  const overviewCard = useMemo(() => {
    if (sortedItems.length === 0) return null;
    const { expired, soon, attention } = overview;
    const allClear = attention === 0;
    const ratio      = attention > 0 ? expired / attention : 0;
    const r = Math.round(245 + (224 - 245) * ratio);
    const g = Math.round(197 + ( 82 - 197) * ratio);
    const b = Math.round( 66 + ( 82 -  66) * ratio);
    const badgeColor = allClear ? colors.success : `rgb(${r},${g},${b})`;

    return (
      <View style={styles.overviewCard}>
        <View style={[styles.overviewBadge, { borderColor: badgeColor }]}>
          <Text style={[styles.overviewBadgeText, { color: badgeColor }]}>
            {allClear ? '✓' : attention}
          </Text>
        </View>
        <View style={styles.overviewContent}>
          <Text style={[styles.overviewTitle, { color: allClear ? colors.success : colors.text }]}>
            {allClear
              ? t.overviewAllClear
              : tcfg.overviewNeedsAttention(attention)}
          </Text>
          <View style={styles.overviewBar}>
            {expired > 0 && (
              <View style={[styles.overviewSeg, { flex: expired, backgroundColor: colors.expired }]} />
            )}
            {soon > 0 && (
              <View style={[styles.overviewSeg, { flex: soon, backgroundColor: colors.warning }]} />
            )}
            {allClear && (
              <View style={[styles.overviewSeg, { flex: 1, backgroundColor: 'rgba(74,222,128,0.19)' }]} />
            )}
          </View>
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
  }, [overview, sortedItems.length, t, tcfg]);

  // ── Render ─────────────────────────────────────────────────────────────────

  const isTyping = form.name.trim().length > 0;

  return (
    <View style={styles.container}>
      <Text style={styles.header}>Dattl</Text>

      <SectionList
        sections={sections}
        keyExtractor={item => item.id}
        renderItem={renderItem}
        renderSectionHeader={renderSectionHeader}
        ListHeaderComponent={overviewCard}
        contentContainerStyle={sections.length === 0 ? styles.emptyContainer : undefined}
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
        stickySectionHeadersEnabled={false}
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
              placeholderTextColor={colors.muted}
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

            {/* ── Category picker (items mode only) ───────────────────────── */}
            {mode === 'item' && form.activePicker === false && (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
                contentContainerStyle={styles.categoryRow}
              >
                {CATEGORY_ORDER.map(cat => {
                  const active = form.category === cat;
                  return (
                    <Pressable
                      key={cat}
                      onPress={() => {
                        Haptics.selectionAsync();
                        setIsDirty(true);
                        setForm(prev => ({ ...prev, category: cat, categoryManuallySet: true }));
                      }}
                      style={[styles.categoryPill, active && styles.categoryPillActive]}
                    >
                      <Text style={styles.categoryPillEmoji}>{CATEGORY_EMOJI[cat]}</Text>
                      <Text style={[styles.categoryPillLabel, active && styles.categoryPillLabelActive]}>
                        {CATEGORY_LABEL[cat][lang]}
                      </Text>
                    </Pressable>
                  );
                })}
              </ScrollView>
            )}

            {/* ── Item info card (edit mode only) ─────────────────────────── */}
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

            {/* ── Add-item hint ─────────────────────────────────────────────── */}
            {!editingId && form.lookupItem && form.activePicker === false && (
              <>
                <Text style={styles.lookupHint}>
                  {FOOD_CATEGORIES.has(form.lookupItem.category)
                    ? t.addItemHint(lang === 'de' ? form.lookupItem.de : form.lookupItem.en, humanDuration(form.lookupItem.daysAfterOpening, lang))
                    : t.addItemHintBath(humanDuration(form.lookupItem.daysAfterOpening, lang, lang === 'de'))}
                </Text>
                {(form.longerUsableHint || form.longerUsableHintEn) && (
                  <Text style={styles.infoLonger}>
                    ⓘ {lang === 'de' ? form.longerUsableHint : (form.longerUsableHintEn ?? form.longerUsableHint)}
                  </Text>
                )}
              </>
            )}

            {/* ── Suggestions (items mode only) ─────────────────────────────── */}
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

                <Pressable
                  onPress={() => {
                    Keyboard.dismiss();
                    setForm(prev => ({
                      ...prev,
                      activePicker: 'expiry',
                      expirySource: 'manual',
                      lookupOpenedOn: undefined,
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

            {/* ── Calendar phase ─────────────────────────────────────────────── */}
            <View
              style={form.activePicker === false ? styles.pickerContainerHidden : undefined}
              pointerEvents={form.activePicker === false ? 'none' : 'auto'}
            >
              <View
                style={form.activePicker !== 'openedOn' ? styles.pickerSlotHidden : undefined}
                pointerEvents={form.activePicker !== 'openedOn' ? 'none' : 'auto'}
              >
                {/* value MUST satisfy minimumDate <= value <= maximumDate. UICalendarView
                    asserts, it does not clamp — so clamp before it ever sees the value.
                    An item added earlier in this same session has dateAdded > pickerMaxDate
                    if the clock has since passed midnight; clampDate absorbs that too. */}
                <DateTimePicker
                  value={clampDate(form.openedOn, PICKER_MIN_DATE, pickerMaxDate)}
                  mode="date"
                  display={PICKER_INLINE ? 'inline' : 'default'}
                  themeVariant="dark"
                  accentColor={colors.accent}
                  minimumDate={PICKER_MIN_DATE}
                  maximumDate={pickerMaxDate}
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

              <View
                style={form.activePicker !== 'expiry' ? styles.pickerSlotHidden : undefined}
                pointerEvents={form.activePicker !== 'expiry' ? 'none' : 'auto'}
              >
                {/* No maximumDate here (expiry is legitimately in the future), but the
                    lower bound still has to hold: a corrupt pre-2000 expiryDate would
                    otherwise put value below minimumDate and trip the same assertion. */}
                <DateTimePicker
                  value={clampDate(form.date, PICKER_MIN_DATE)}
                  mode="date"
                  display={PICKER_INLINE ? 'inline' : 'default'}
                  themeVariant="dark"
                  accentColor={colors.accent}
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

            {/* ── Buttons / success banner ──────────────────────────────────── */}
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
  borderRadius: radii.md,
  padding: 16,
  alignItems: 'center' as const,
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
    paddingTop: 60,
    paddingHorizontal: 20,
  },
  header: {
    fontFamily: fonts.brand,
    fontSize: 42,
    color: colors.accent,
    textAlign: 'center',
    letterSpacing: -1,
    marginBottom: 28,
  },

  // ── Section headers ────────────────────────────────────────────────────────
  sectionHeader: {
    paddingVertical: 10,
    paddingHorizontal: 4,
    marginTop: 8,
  },
  sectionHeaderText: {
    fontSize: 12,
    fontWeight: weights.medium,
    color: colors.muted,
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },

  // ── List rows ──────────────────────────────────────────────────────────────
  rowContainer: { marginBottom: 10 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 18,
    paddingRight: 8,
    paddingLeft: 16,
    borderRadius: radii.md,
    backgroundColor: colors.surface,
    borderLeftWidth: 4,
    borderLeftColor: 'transparent',
  },
  rowWarning: { borderLeftColor: colors.warning },
  rowExpired: { borderLeftColor: colors.expired },
  info: { flex: 1 },
  name: { fontSize: 18, fontWeight: weights.medium, color: colors.text },
  openedOn: { fontSize: 11, color: colors.muted, marginTop: 3 },
  longerUsableHint: { fontSize: 11, color: colors.muted, marginTop: 3 },

  // ── Swipe-to-delete ────────────────────────────────────────────────────────
  swipeDeleteAction: {
    backgroundColor: colors.expired,
    justifyContent: 'center',
    alignItems: 'center',
    width: 80,
    borderRadius: radii.md,
    marginLeft: 6,
  },
  swipeDeleteText: { color: colors.text, fontSize: 14, fontWeight: weights.medium },

  // ── Right-side column ──────────────────────────────────────────────────────
  rightSide: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  statusLabel: { fontSize: 11, fontWeight: weights.medium, textAlign: 'right' },
  statusWarning: { color: colors.warning },
  statusExpired: { color: colors.expired },
  statusNeutral: { color: colors.muted },
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
    borderRadius: radii.xl,
    marginBottom: 4,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: weights.medium,
    color: colors.text,
    textAlign: 'center',
  },
  emptySubtitle: {
    fontSize: 14,
    color: colors.muted,
    textAlign: 'center',
    maxWidth: 220,
    lineHeight: 20,
  },

  // ── Health overview ────────────────────────────────────────────────────────
  overviewCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    backgroundColor: colors.surface2,
    borderRadius: radii.lg,
    padding: 16,
    marginBottom: 20,
  },
  overviewBadge: {
    width: 52,
    height: 52,
    borderRadius: 26,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  overviewBadgeText: {
    fontSize: 20,
    fontWeight: weights.bold,
  },
  overviewContent: {
    flex: 1,
    gap: 6,
  },
  overviewTitle: {
    fontSize: 14,
    fontWeight: weights.medium,
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
    color: colors.muted,
  },

  // ── Bottom action area ─────────────────────────────────────────────────────
  bottomSection: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    paddingTop: 12,
  },
  addButton: {
    backgroundColor: colors.accent,
    borderRadius: radii.lg,
    paddingVertical: 12,
    paddingHorizontal: 20,
    alignItems: 'center',
  },
  addButtonText: { color: colors.onAccent, fontSize: 16, fontWeight: weights.bold, letterSpacing: 0.2 },

  // ── Modal ──────────────────────────────────────────────────────────────────
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: colors.overlay,
  },
  modalBox: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    gap: 12,
  },
  modalTitle: { fontSize: 20, fontWeight: weights.medium, color: colors.text },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    padding: 14,
    fontSize: 16,
    color: colors.text,
    backgroundColor: colors.bg,
  },

  // ── Category picker ────────────────────────────────────────────────────────
  categoryRow: { flexDirection: 'row', gap: 8, paddingBottom: 2 },
  categoryPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.xl,
    paddingVertical: 6,
    paddingHorizontal: 12,
    backgroundColor: colors.bg,
  },
  categoryPillActive: {
    backgroundColor: colors.surface2,
    borderColor: colors.border,
  },
  categoryPillEmoji: { fontSize: 14 },
  categoryPillLabel: { fontSize: 12, color: colors.muted },
  categoryPillLabelActive: { color: colors.text, fontWeight: weights.medium },

  // ── Lookup hint ────────────────────────────────────────────────────────────
  lookupHint: {
    fontSize: 12,
    color: colors.muted,
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
    borderColor: colors.border,
    borderRadius: radii.xl,
    paddingVertical: 6,
    paddingHorizontal: 12,
    backgroundColor: colors.surface,
  },
  lookupPillName: { fontSize: 13, color: colors.text, fontWeight: weights.medium },
  lookupPillDuration: { fontSize: 11, color: colors.muted },

  // ── Quick Add pills ────────────────────────────────────────────────────────
  quickAddLabel: { fontSize: 11, color: colors.muted },
  quickAddPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.xl,
    paddingVertical: 6,
    paddingHorizontal: 12,
    backgroundColor: colors.surface,
  },
  quickAddStar: { fontSize: 10, color: colors.muted },
  quickAddPillText: { fontSize: 12, color: colors.text },

  // ── Date rows (keyboard phase) ─────────────────────────────────────────────
  dateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    paddingVertical: 14,
    paddingHorizontal: 14,
    backgroundColor: colors.bg,
  },
  dateRowLabel: { fontSize: 14, color: colors.muted, flex: 1 },
  dateRowValue: { fontSize: 15, color: colors.text, marginRight: 8 },
  dateRowChevron: { fontSize: 18, color: colors.muted },

  // ── Expiry recalculation prompt ────────────────────────────────────────────
  expiryPrompt: {
    borderWidth: 1,
    borderColor: colors.warning,
    borderRadius: radii.md,
    padding: 12,
    gap: 10,
    backgroundColor: 'rgba(245,197,66,0.07)',
  },
  expiryPromptText: { fontSize: 13, color: colors.warning },
  expiryPromptBtns: { flexDirection: 'row', gap: 8 },
  promptYes: {
    flex: 1,
    backgroundColor: colors.warning,
    borderRadius: radii.sm,
    paddingVertical: 8,
    alignItems: 'center',
  },
  promptYesText: { fontSize: 13, color: colors.onAccent, fontWeight: weights.bold },
  promptNo: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.sm,
    paddingVertical: 8,
    alignItems: 'center',
  },
  promptNoText: { fontSize: 13, color: colors.muted },

  // ── Date picker (calendar phase) ───────────────────────────────────────────
  datePicker: { width: '100%' },
  pickerContainerHidden: { height: 0, overflow: 'hidden' },
  pickerSlotHidden: { position: 'absolute', opacity: 0, width: '100%' },

  // ── Modal action buttons ───────────────────────────────────────────────────
  doneBtn: { borderRadius: radii.md, padding: 16, alignItems: 'center', backgroundColor: colors.accent, marginBottom: 8 },
  doneBtnText: { fontSize: 16, color: colors.onAccent, fontWeight: weights.bold },
  modalButtons: { flexDirection: 'row', gap: 12, paddingBottom: 8 },
  closeOnlyBtn: { borderRadius: radii.md, padding: 16, alignItems: 'center' as const, borderWidth: 1, borderColor: colors.border, marginBottom: 8 },
  cancelBtn: { ...btnBase, borderWidth: 1, borderColor: colors.border },
  cancelText: { fontSize: 16, color: colors.muted },
  saveBtn: { ...btnBase, backgroundColor: colors.accent },
  saveText: { fontSize: 16, color: colors.onAccent, fontWeight: weights.bold },

  // ── Item info card (edit mode) ─────────────────────────────────────────────
  infoCard: {
    backgroundColor: colors.bg,
    borderRadius: 10,
    padding: 12,
    gap: 4,
    borderWidth: 1,
    borderColor: colors.border,
  },
  infoTypical: { fontSize: 13, color: colors.text, fontWeight: weights.medium },
  infoHint:    { fontSize: 12, color: colors.muted },
  infoLonger:  { fontSize: 12, color: colors.muted },

  // ── Delete link ────────────────────────────────────────────────────────────
  deleteLink: { alignItems: 'center', paddingVertical: 4 },
  deleteLinkText: { fontSize: 14, color: colors.expired },

  // ── Save success confirmation ──────────────────────────────────────────────
  successBanner: {
    borderRadius: radii.md,
    paddingVertical: 14,
    paddingBottom: 22,
    alignItems: 'center',
    backgroundColor: 'rgba(74,222,128,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(74,222,128,0.25)',
  },
  successText: { fontSize: 16, fontWeight: weights.medium, color: colors.success },
});
