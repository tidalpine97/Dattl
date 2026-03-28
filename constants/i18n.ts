import type { Lang } from '@/context/language';

// Per-mode translated strings (shared shape between item and subscription)
type ModeStrings = {
  openedOnLabel: string;
  expiryLabel: string;
  addButton: string;
  newTitle: string;
  editTitle: string;
  placeholder: string;
  cardDateLabel: string;
  emptyTitle: string;
  emptySubtitle: string;
  statusLabel: (daysLeft: number) => string;
};

export type Strings = {
  // Tab bar
  tabItems: string;
  tabSubscriptions: string;
  tabSettings: string;

  // Mode-specific strings
  item: ModeStrings;
  subscription: ModeStrings;

  // Common actions
  delete: string;
  done: string;
  save: string;
  cancel: string;
  close: string;
  saved: string;

  // Expiry recalc prompt
  expiryPrompt: string;
  yesUpdate: string;
  noKeep: string;

  // Quick Add label
  quickAdd: string;

  // Onboarding
  onboardingSkip:         string;
  onboardingNext:         string;
  onboardingGetStarted:   string;
  onboardingAllowNotifs:  string;
  onboardingSkipNotifs:   string;
  onboardingSlides: ReadonlyArray<{ title: string; subtitle: string }>;

  // Health overview card
  overviewAllClear:       string;
  overviewNeedsAttention: (n: number) => string;
  overviewExpiredLabel:   string;
  overviewSoonLabel:      string;

  // Settings
  languageLabel: string;

  // Date locale used for toLocaleDateString
  locale: string;
};

export const STRINGS: Record<Lang, Strings> = {
  en: {
    tabItems:         'Items',
    tabSubscriptions: 'Subscriptions',
    tabSettings:      'Settings',

    item: {
      openedOnLabel: 'Opened on',
      expiryLabel:   'Expires',
      addButton:     '+ Add Item',
      newTitle:      'New Item',
      editTitle:     'Edit Item',
      placeholder:   'Name (e.g. Mascara)',
      cardDateLabel: 'Opened on',
      emptyTitle:    'Nothing expires soon. Nice.',
      emptySubtitle: 'Tap the button below to add your first item.',
      statusLabel: d => {
        if (d === 0)  return 'expires today';
        if (d === 1)  return 'expires tomorrow';
        if (d > 1)    return `expires in ${d} days`;
        if (d === -1) return 'expired yesterday';
        return `expired ${Math.abs(d)} days ago`;
      },
    },

    subscription: {
      openedOnLabel: 'Started on',
      expiryLabel:   'Cancel by',
      addButton:     '+ Add Subscription',
      newTitle:      'New Subscription',
      editTitle:     'Edit Subscription',
      placeholder:   'Name (e.g. Netflix)',
      cardDateLabel: 'Started on',
      emptyTitle:    'No subscriptions yet.',
      emptySubtitle: 'Tap the button below to add your first subscription.',
      statusLabel: d => {
        if (d === 0)  return 'cancel today';
        if (d === 1)  return 'cancel tomorrow';
        if (d > 1)    return `cancel in ${d} days`;
        if (d === -1) return 'overdue by 1 day';
        return `overdue by ${Math.abs(d)} days`;
      },
    },

    delete:    'Delete',
    done:      'Done',
    save:      'Save',
    cancel:    'Cancel',
    close:     'Close',
    saved:     '✓  Saved',

    expiryPrompt: 'Opened on changed — update expiry too?',
    yesUpdate:    'Yes, update',
    noKeep:       'No, keep',

    quickAdd: 'Quick Add',

    onboardingSkip:        'Skip',
    onboardingNext:        'Next',
    onboardingGetStarted:  'Get Started',
    onboardingAllowNotifs: 'Allow Notifications',
    onboardingSkipNotifs:  'Skip for now',
    onboardingSlides: [
      {
        title:    'Know before it goes',
        subtitle: 'Track expiry dates for your groceries, cosmetics, and subscriptions — all in one place.',
      },
      {
        title:    'Add in seconds',
        subtitle: 'Type a name and Dattl suggests the right expiry automatically. Tap to fill it in.',
      },
      {
        title:    'Never miss a date',
        subtitle: 'Allow notifications and Dattl will remind you before things expire so you can act in time.',
      },
    ],

    overviewAllClear:       'All clear',
    overviewNeedsAttention: n => n === 1 ? '1 needs attention' : `${n} need attention`,
    overviewExpiredLabel:   'expired',
    overviewSoonLabel:      'expiring soon',

    languageLabel: 'Language',
    locale:        'en-US',
  },

  de: {
    tabItems:         'Produkte',
    tabSubscriptions: 'Abos',
    tabSettings:      'Einstellungen',

    item: {
      openedOnLabel: 'Geöffnet am',
      expiryLabel:   'Läuft ab',
      addButton:     '+ Produkt hinzufügen',
      newTitle:      'Neues Produkt',
      editTitle:     'Produkt bearbeiten',
      placeholder:   'Name (z.B. Mascara)',
      cardDateLabel: 'Geöffnet am',
      emptyTitle:    'Nichts läuft bald ab. Gut so.',
      emptySubtitle: 'Tippe unten, um dein erstes Produkt hinzuzufügen.',
      statusLabel: d => {
        if (d === 0)  return 'läuft heute ab';
        if (d === 1)  return 'läuft morgen ab';
        if (d > 1)    return `läuft in ${d} Tagen ab`;
        if (d === -1) return 'gestern abgelaufen';
        return `vor ${Math.abs(d)} Tagen abgelaufen`;
      },
    },

    subscription: {
      openedOnLabel: 'Begonnen am',
      expiryLabel:   'Kündigen bis',
      addButton:     '+ Abo hinzufügen',
      newTitle:      'Neues Abo',
      editTitle:     'Abo bearbeiten',
      placeholder:   'Name (z.B. Netflix)',
      cardDateLabel: 'Begonnen am',
      emptyTitle:    'Noch keine Abos.',
      emptySubtitle: 'Tippe unten, um dein erstes Abo hinzuzufügen.',
      statusLabel: d => {
        if (d === 0)  return 'heute kündigen';
        if (d === 1)  return 'morgen kündigen';
        if (d > 1)    return `in ${d} Tagen kündigen`;
        if (d === -1) return '1 Tag überfällig';
        return `${Math.abs(d)} Tage überfällig`;
      },
    },

    delete:    'Löschen',
    done:      'Fertig',
    save:      'Speichern',
    cancel:    'Abbrechen',
    close:     'Schließen',
    saved:     '✓  Gespeichert',

    expiryPrompt: 'Öffnungsdatum geändert — Ablaufdatum auch anpassen?',
    yesUpdate:    'Ja, anpassen',
    noKeep:       'Nein, behalten',

    quickAdd: 'Schnell hinzufügen',

    onboardingSkip:        'Überspringen',
    onboardingNext:        'Weiter',
    onboardingGetStarted:  'Loslegen',
    onboardingAllowNotifs: 'Benachrichtigungen erlauben',
    onboardingSkipNotifs:  'Jetzt überspringen',
    onboardingSlides: [
      {
        title:    'Behalte den Überblick',
        subtitle: 'Verfolge Ablaufdaten für Lebensmittel, Kosmetik und Abos — alles an einem Ort.',
      },
      {
        title:    'In Sekunden hinzufügen',
        subtitle: 'Gib einen Namen ein und Dattl schlägt das Ablaufdatum automatisch vor. Tippe zum Ausfüllen.',
      },
      {
        title:    'Nie wieder verpassen',
        subtitle: 'Erlaube Benachrichtigungen und Dattl erinnert dich rechtzeitig bevor etwas abläuft.',
      },
    ],

    overviewAllClear:       'Alles ok',
    overviewNeedsAttention: n => n === 1 ? '1 braucht Aufmerksamkeit' : `${n} brauchen Aufmerksamkeit`,
    overviewExpiredLabel:   'abgelaufen',
    overviewSoonLabel:      'läuft bald ab',

    languageLabel: 'Sprache',
    locale:        'de-AT',
  },
};
