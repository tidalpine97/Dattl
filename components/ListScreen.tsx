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

// Returns d if it is a valid Date, otherwise falls back to today.
// Prevents DateTimePicker from receiving null/undefined/NaN.
function safeDate(d: Date | null | undefined): Date {
  return d instanceof Date && !isNaN(d.getTime()) ? d : new Date();
}

// ─── Component ────────────────────────────────────────────────────────────────

export function ListScreen({ mode }: { mode: Mode }) {
  const cfg = MODE_CONFIG[mode];
  const insets = useSafeAreaInsets();
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
  }, [items, cfg.storageKey]);

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
      setItems(prev => prev.map(item =>
        item.id === editingId ? { ...item, name, expiryDate, dateAdded, ...notifFields } : item
      ));
      syncForm(form.openedOn);
      showBanner();
    } else {
      const id = Date.now().toString();
      const notifFields = await scheduleItemNotifs({ id, name, expiryDate }).catch(() => ({}));
      setItems(prev => [...prev, { id, name, expiryDate, dateAdded, ...notifFields }]);

      if (fromPrompt) {
        // Prompt was answered for a new item: stay open (switch to edit mode so a
        // second Save updates rather than duplicating).
        setEditingId(id);
        syncForm(form.openedOn);
        showBanner();
      } else {
        // Normal new-item save: close immediately.
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

  const lookupMatches = useMemo(
    () => (cfg.showLookup ? findItem(form.name) : []),
    [form.name, cfg.showLookup]
  );

  const applyLookup = useCallback((lookupItem: DattlItem) => {
    setIsDirty(true);
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
              onChangeText={text => {
                setIsDirty(true);
                setForm(prev => ({
                  ...prev,
                  name: text,
                  expirySource: 'manual',
                  lookupItem: undefined,
                  lookupOpenedOn: undefined,
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
                    keyboardShouldPersistTaps="handled"
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
                      keyboardShouldPersistTaps="handled"
                      contentContainerStyle={styles.pillRow}
                    >
                      {modalSuggestions.map(({ name, isFav }) => (
                        <Pressable
                          key={name}
                          onPress={() => { setIsDirty(true); setForm(prev => ({ ...prev, name })); }}
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
                      <Pressable onPress={handlePromptYes} style={styles.promptYes}>
                        <Text style={styles.promptYesText}>Yes, update</Text>
                      </Pressable>
                      <Pressable onPress={handlePromptNo} style={styles.promptNo}>
                        <Text style={styles.promptNoText}>No, keep</Text>
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
                  <Text style={styles.dateRowLabel}>{cfg.expiryLabel}</Text>
                  <Text style={styles.dateRowValue}>
                    {form.date.toLocaleDateString(LOCALE, DATE_FORMAT)}
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
                New item:        [Cancel]  [Save]  → closes on save
                Edit, not dirty: [Close]           → closes immediately
                Edit, dirty:     [Cancel]  [Save]  → shows banner, resets to Close
                Success:         ✓ Saved banner (replaces buttons for 1.5 s)   */}
            {showSuccess ? (
              <View style={styles.successBanner}>
                <Text style={styles.successText}>✓  Saved</Text>
              </View>
            ) : editingId && !isDirty ? (
              <Pressable onPress={() => setModalVisible(false)} style={styles.closeOnlyBtn}>
                <Text style={styles.cancelText}>Close</Text>
              </Pressable>
            ) : (
              <View style={styles.modalButtons}>
                <Pressable onPress={() => setModalVisible(false)} style={styles.cancelBtn}>
                  <Text style={styles.cancelText}>Cancel</Text>
                </Pressable>
                <Pressable onPress={saveItem} style={styles.saveBtn}>
                  <Text style={styles.saveText}>Save</Text>
                </Pressable>
              </View>
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
  modalButtons: { flexDirection: 'row', gap: 12, paddingBottom: 8 },
  closeOnlyBtn: { borderRadius: 12, padding: 16, alignItems: 'center' as const, borderWidth: 1, borderColor: COLORS.border, marginBottom: 8 },
  cancelBtn: { ...btnBase, borderWidth: 1, borderColor: COLORS.border },
  cancelText: { fontSize: 16, color: COLORS.textMuted },
  saveBtn: { ...btnBase, backgroundColor: COLORS.accent },
  saveText: { fontSize: 16, color: '#000000', fontWeight: '700' },

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
