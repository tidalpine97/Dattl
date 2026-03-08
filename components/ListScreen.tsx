import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  FlatList,
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

import { type Item, loadItems, saveItems } from '@/utils/storage';
import { DATE_FORMAT, LOCALE, formatDate, getDaysUntilExpiry, getExpiryLabel, getSubscriptionLabel } from '@/utils/dates';
import { useFavorites } from '@/hooks/use-favorites';
import { type DattlItem, findItem, suggestedExpiryDate } from '@/constants/dattlItems';
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
  warning:   '#F5C542',
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
  activePicker: ActivePicker;
  expirySource: 'lookup' | 'manual';
  lookupItem?: DattlItem;
  lookupOpenedOn?: string;
};

function freshForm(): FormState {
  return {
    name: '',
    date: new Date(),
    openedOn: new Date(),
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

// ─── Component ────────────────────────────────────────────────────────────────

export function ListScreen({ mode }: { mode: Mode }) {
  const cfg = MODE_CONFIG[mode];
  const insets = useSafeAreaInsets();
  const [items, setItems] = useState<Item[]>([]);
  const [modalVisible, setModalVisible] = useState(false);
  const [form, setForm] = useState<FormState>(freshForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const hasLoaded = useRef(false);

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
  }, [items, cfg.storageKey]);

  useEffect(() => {
    if (Platform.OS !== 'ios') return;
    const sub = Keyboard.addListener('keyboardWillShow', () => {
      setForm(prev => ({ ...prev, activePicker: false }));
    });
    return () => sub.remove();
  }, []);

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
      const parsedExpiry = item.expiryDate ? new Date(item.expiryDate) : new Date();
      const parsedOpened = item.dateAdded  ? new Date(item.dateAdded)  : new Date();
      setForm({
        name: item.name,
        date:     isNaN(parsedExpiry.getTime()) ? new Date() : parsedExpiry,
        openedOn: isNaN(parsedOpened.getTime()) ? new Date() : parsedOpened,
        activePicker: false,
        expirySource: 'manual',
      });
    } else {
      setEditingId(null);
      setForm(freshForm());
    }
    setModalVisible(true);
  }, []);

  async function saveItem() {
    if (!form.name.trim()) return;

    const raw  = form.name.trim();
    const name = raw.charAt(0).toUpperCase() + raw.slice(1);
    const expiryDate = form.date.toISOString();
    const dateAdded  = form.openedOn.toISOString();

    if (editingId) {
      const existing = items.find(i => i.id === editingId);
      if (existing) {
        await cancelItemNotifs(existing).catch(e => console.error('Failed to cancel notification on edit:', e));
      }

      const notifFields = await scheduleItemNotifs({ id: editingId, name, expiryDate })
        .catch(() => ({}));

      setItems(prev => prev.map(item =>
        item.id === editingId
          ? { ...item, name, expiryDate, dateAdded, ...notifFields }
          : item
      ));
    } else {
      const id = Date.now().toString();
      const notifFields = await scheduleItemNotifs({ id, name, expiryDate })
        .catch(() => ({}));

      setItems(prev => [...prev, { id, name, expiryDate, dateAdded, ...notifFields }]);
    }

    setModalVisible(false);
  }

  // ── Lookup & suggestion helpers ────────────────────────────────────────────

  const lookupMatches = useMemo(
    () => (cfg.showLookup ? findItem(form.name) : []),
    [form.name, cfg.showLookup]
  );

  const applyLookup = useCallback((lookupItem: DattlItem) => {
    setForm(prev => ({
      ...prev,
      name: lookupItem.de,
      date: suggestedExpiryDate(lookupItem, prev.openedOn),
      expirySource: 'lookup',
      lookupItem,
      lookupOpenedOn: prev.openedOn.toISOString(),
    }));
  }, []);

  // ── Derived data ───────────────────────────────────────────────────────────

  const sortedItems = useMemo(() => sortItems(items), [items]);

  const showExpiryPrompt =
    form.expirySource === 'lookup' &&
    !!form.lookupOpenedOn &&
    form.openedOn.toDateString() !== new Date(form.lookupOpenedOn).toDateString();

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
              <Text style={styles.swipeDeleteText}>Delete</Text>
            </Pressable>
          )}
        >
          <Pressable onPress={() => openModal(item)} style={[styles.row, getRowStyle(daysLeft)]}>
            <View style={styles.info}>
              <Text style={styles.name}>{item.name}</Text>
              {item.dateAdded && (
                <Text style={styles.openedOn}>{cfg.cardDateLabel} {formatDate(item.dateAdded)}</Text>
              )}
            </View>
            <View style={styles.rightSide}>
              <Text style={[styles.statusLabel, getStatusLabelStyle(daysLeft)]}>
                {cfg.statusLabel(daysLeft)}
              </Text>
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
  }, [deleteItem, openModal, toggleFavorite, favorites, cfg]);

  // ── Render ─────────────────────────────────────────────────────────────────

  const isTyping = form.name.trim().length > 0;

  return (
    <View style={styles.container}>
      <Text style={styles.header}>Dattl</Text>

      <FlatList
        data={sortedItems}
        keyExtractor={item => item.id}
        renderItem={renderItem}
      />

      <View style={[styles.bottomSection, { paddingBottom: insets.bottom + 8 }]}>
        <Pressable onPress={() => openModal()} style={styles.addButton}>
          <Text style={styles.addButtonText}>{cfg.addButtonText}</Text>
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
              {editingId ? cfg.editTitle : cfg.newTitle}
            </Text>

            {/* ── Name field ──────────────────────────────────────────────── */}
            <TextInput
              style={styles.input}
              placeholder={cfg.namePlaceholder}
              placeholderTextColor={COLORS.textMuted}
              value={form.name}
              onChangeText={text => setForm(prev => ({
                ...prev,
                name: text,
                expirySource: 'manual',
                lookupItem: undefined,
                lookupOpenedOn: undefined,
              }))}
              autoFocus={editingId === null}
              returnKeyType="done"
              onSubmitEditing={() => {
                Keyboard.dismiss();
                setForm(prev => ({ ...prev, activePicker: 'expiry' }));
              }}
            />

            {/* ── Lookup hint ─────────────────────────────────────────────── */}
            {form.lookupItem?.hint && form.activePicker === false && (
              <Text style={styles.lookupHint}>{form.lookupItem.hint}</Text>
            )}

            {/* ── Suggestions (items mode only) ────────────────────────────
                When typing → lookup matches.
                When empty  → favorites / recent Quick Add pills.
                Hidden once a calendar is visible.                       */}
            {cfg.showLookup && form.activePicker === false && (
              isTyping ? (
                lookupMatches.length > 0 && (
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.pillRow}
                  >
                    {lookupMatches.map(item => (
                      <Pressable
                        key={item.de}
                        onPress={() => applyLookup(item)}
                        style={styles.lookupPill}
                      >
                        <Text style={styles.lookupPillName}>{item.de}</Text>
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
                    <Text style={styles.quickAddLabel}>Quick Add</Text>
                    <ScrollView
                      horizontal
                      showsHorizontalScrollIndicator={false}
                      contentContainerStyle={styles.pillRow}
                    >
                      {modalSuggestions.map(({ name, isFav }) => (
                        <Pressable
                          key={name}
                          onPress={() => setForm(prev => ({ ...prev, name }))}
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
                  <Text style={styles.dateRowLabel}>{cfg.openedOnLabel}</Text>
                  <Text style={styles.dateRowValue}>
                    {form.openedOn.toLocaleDateString(LOCALE, DATE_FORMAT)}
                  </Text>
                  <Text style={styles.dateRowChevron}>›</Text>
                </Pressable>

                {/* Expiry recalculation prompt (items mode only) */}
                {showExpiryPrompt && (
                  <View style={styles.expiryPrompt}>
                    <Text style={styles.expiryPromptText}>
                      Opened on changed — update expiry too?
                    </Text>
                    <View style={styles.expiryPromptBtns}>
                      <Pressable
                        onPress={() => setForm(prev => ({
                          ...prev,
                          date: suggestedExpiryDate(prev.lookupItem!, prev.openedOn),
                          lookupOpenedOn: prev.openedOn.toISOString(),
                        }))}
                        style={styles.promptYes}
                      >
                        <Text style={styles.promptYesText}>Yes</Text>
                      </Pressable>
                      <Pressable
                        onPress={() => setForm(prev => ({ ...prev, expirySource: 'manual' }))}
                        style={styles.promptNo}
                      >
                        <Text style={styles.promptNoText}>No</Text>
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
                    }));
                  }}
                  style={styles.dateRow}
                >
                  <Text style={styles.dateRowLabel}>{cfg.expiryLabel}</Text>
                  <Text style={styles.dateRowValue}>
                    {form.date.toLocaleDateString(LOCALE, DATE_FORMAT)}
                  </Text>
                  <Text style={styles.dateRowChevron}>›</Text>
                </Pressable>
              </>
            )}

            {/* ── Calendar phase ───────────────────────────────────────────── */}
            {form.activePicker === 'openedOn' && (
              <DateTimePicker
                value={form.openedOn}
                mode="date"
                display={PICKER_INLINE ? 'inline' : 'default'}
                themeVariant="dark"
                accentColor="#C96A00"
                minimumDate={PICKER_MIN_DATE}
                maximumDate={new Date()}
                onChange={(_, selectedDate) => {
                  if (!PICKER_INLINE) setForm(prev => ({ ...prev, activePicker: false }));
                  if (selectedDate) setForm(prev => ({ ...prev, openedOn: selectedDate }));
                }}
                style={styles.datePicker}
              />
            )}

            {form.activePicker === 'expiry' && (
              <DateTimePicker
                value={form.date}
                mode="date"
                display={PICKER_INLINE ? 'inline' : 'default'}
                themeVariant="dark"
                accentColor="#C96A00"
                minimumDate={PICKER_MIN_DATE}
                onChange={(_, selectedDate) => {
                  if (!PICKER_INLINE) setForm(prev => ({ ...prev, activePicker: false }));
                  if (selectedDate) setForm(prev => ({ ...prev, date: selectedDate }));
                }}
                style={styles.datePicker}
              />
            )}

            {/* ── Cancel / Save ─────────────────────────────────────────────── */}
            <View style={styles.modalButtons}>
              <Pressable onPress={() => setModalVisible(false)} style={styles.cancelBtn}>
                <Text style={styles.cancelText}>Cancel</Text>
              </Pressable>
              <Pressable onPress={saveItem} style={styles.saveBtn}>
                <Text style={styles.saveText}>Save</Text>
              </Pressable>
            </View>
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

  // ── Modal action buttons ───────────────────────────────────────────────────
  modalButtons: { flexDirection: 'row', gap: 12, paddingBottom: 8 },
  cancelBtn: { ...btnBase, borderWidth: 1, borderColor: COLORS.border },
  cancelText: { fontSize: 16, color: COLORS.textMuted },
  saveBtn: { ...btnBase, backgroundColor: COLORS.accent },
  saveText: { fontSize: 16, color: '#000000', fontWeight: '700' },
});
