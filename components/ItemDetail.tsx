import { Alert, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';

import { type Item } from '@/utils/storage';
import { DATE_FORMAT, formatDate, getDaysUntilExpiry } from '@/utils/dates';
import { DATTL_ITEMS } from '@/constants/dattlItems';
import type { Lang } from '@/context/language';
import { type Strings, type ModeStrings } from '@/constants/i18n';
import { colors, fonts, radii, weights } from '@/constants/theme';

type Props = {
  item: Item;
  lang: Lang;
  t: Strings;
  tcfg: ModeStrings;
  showLookup: boolean;
  onClose: () => void;
  onEdit: () => void;
  onDelete: () => void;
};

export function ItemDetail({ item, lang, t, tcfg, showLookup, onClose, onEdit, onDelete }: Props) {
  const insets = useSafeAreaInsets();
  const daysLeft = getDaysUntilExpiry(item.expiryDate);
  const isExpired = daysLeft < 0;
  const isSoon    = !isExpired && daysLeft <= 7;

  const dattlMatch = showLookup
    ? DATTL_ITEMS.find(d => d.de.toLowerCase() === item.name.toLowerCase())
    : undefined;

  const longerHint = lang === 'de'
    ? item.longerUsableHint
    : (item.longerUsableHintEn ?? item.longerUsableHint);

  function handleDelete() {
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
            onDelete();
            onClose();
          },
        },
      ],
    );
  }

  return (
    <Modal animationType="slide" visible transparent={false}>
      <View style={[styles.root, { paddingTop: insets.top }]}>

        {/* Top bar */}
        <View style={styles.topBar}>
          <Pressable
            onPress={() => { Haptics.selectionAsync(); onClose(); }}
            style={styles.backBtn}
            hitSlop={12}
          >
            <Ionicons name="chevron-back" size={22} color={colors.muted} />
            <Text style={styles.backText}>{lang === 'de' ? 'Zurück' : 'Back'}</Text>
          </Pressable>
        </View>

        <ScrollView contentContainerStyle={[styles.body, { paddingBottom: insets.bottom + 24 }]}>

          {/* Item name */}
          <Text style={styles.itemName}>{item.name}</Text>

          {/* Status chip — only when urgent */}
          {(isExpired || isSoon) && (
            <View style={[styles.statusChip, isExpired ? styles.chipExpired : styles.chipSoon]}>
              <Text style={[styles.statusChipText, isExpired ? styles.chipTextExpired : styles.chipTextSoon]}>
                {tcfg.statusLabel(daysLeft)}
              </Text>
            </View>
          )}

          {/* Dates card */}
          <View style={styles.datesCard}>
            {item.dateAdded && (
              <View style={styles.dateRow}>
                <Text style={styles.dateLabel}>{tcfg.openedOnLabel}</Text>
                <Text style={styles.dateValue}>{formatDate(item.dateAdded, t.locale)}</Text>
              </View>
            )}
            <View style={[styles.dateRow, item.dateAdded ? styles.dateRowBorder : undefined]}>
              <Text style={styles.dateLabel}>{tcfg.expiryLabel}</Text>
              <Text style={[styles.dateValue, isExpired ? styles.dateExpired : isSoon ? styles.dateSoon : undefined]}>
                {formatDate(item.expiryDate, t.locale)}
              </Text>
            </View>
          </View>

          {/* Lookup info card */}
          {(dattlMatch || longerHint) && (
            <View style={styles.infoCard}>
              {dattlMatch && (
                <Text style={styles.infoTypical}>{t.detailTypical(dattlMatch.daysAfterOpening)}</Text>
              )}
              {dattlMatch?.hint && (
                <Text style={styles.infoHint}>{dattlMatch.hint}</Text>
              )}
              {longerHint && (
                <Text style={styles.infoLonger}>ⓘ {longerHint}</Text>
              )}
            </View>
          )}

        </ScrollView>

        {/* Action buttons */}
        <View style={[styles.actions, { paddingBottom: insets.bottom + 12 }]}>
          <Pressable
            onPress={() => { Haptics.selectionAsync(); onEdit(); }}
            style={styles.editBtn}
          >
            <Text style={styles.editBtnText}>{t.detailEdit}</Text>
          </Pressable>
          <Pressable onPress={handleDelete} style={styles.deleteBtn}>
            <Text style={styles.deleteBtnText}>{t.delete}</Text>
          </Pressable>
        </View>

      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  backBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  backText: {
    fontSize: 16,
    color: colors.muted,
  },
  body: {
    padding: 24,
    gap: 18,
  },
  itemName: {
    fontFamily: fonts.brand,
    fontSize: 32,
    color: colors.text,
    lineHeight: 40,
  },
  statusChip: {
    alignSelf: 'flex-start',
    borderRadius: radii.xl,
    paddingVertical: 4,
    paddingHorizontal: 12,
    borderWidth: 1,
  },
  chipExpired: { backgroundColor: 'rgba(224,82,82,0.12)', borderColor: colors.expired },
  chipSoon:    { backgroundColor: 'rgba(245,197,66,0.12)', borderColor: colors.warning },
  statusChipText: { fontSize: 13, fontWeight: weights.medium },
  chipTextExpired: { color: colors.expired },
  chipTextSoon:    { color: colors.warning },
  datesCard: {
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    overflow: 'hidden',
  },
  dateRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 16,
  },
  dateRowBorder: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  dateLabel: { fontSize: 14, color: colors.muted },
  dateValue: { fontSize: 15, color: colors.text, fontWeight: weights.medium },
  dateExpired: { color: colors.expired },
  dateSoon:    { color: colors.warning },
  infoCard: {
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    padding: 18,
    gap: 8,
  },
  infoTypical: { fontSize: 14, color: colors.text, fontWeight: weights.medium },
  infoHint:    { fontSize: 13, color: colors.muted },
  infoLonger:  { fontSize: 13, color: colors.muted },
  actions: {
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 24,
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  editBtn: {
    flex: 1,
    backgroundColor: colors.accent,
    borderRadius: radii.lg,
    paddingVertical: 16,
    alignItems: 'center',
  },
  editBtnText: { fontSize: 16, fontWeight: weights.bold, color: colors.onAccent },
  deleteBtn: {
    flex: 1,
    backgroundColor: 'rgba(224,82,82,0.12)',
    borderRadius: radii.lg,
    paddingVertical: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.expired,
  },
  deleteBtnText: { fontSize: 16, fontWeight: weights.medium, color: colors.expired },
});
