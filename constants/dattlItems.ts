// dattlItems.ts
// Lookup table for Dattl app
// daysAfterOpening = suggested tracking duration in days after opening/purchase
// longerUsable = item is often still good past the suggested expiry
// longerUsableHint / longerUsableHintEn = brief note shown to user (DE / EN)

export type DattlItem = {
  de: string;
  en: string;
  category: 'grocery' | 'bath';
  daysAfterOpening: number;
  hint?: string;
  longerUsable?: boolean;
  longerUsableHint?: string;
  longerUsableHintEn?: string;
};

export const DATTL_ITEMS: DattlItem[] = [

  // ─── GROCERY ────────────────────────────────────────────────

  { de: 'Milch', en: 'Milk', category: 'grocery', daysAfterOpening: 4,
    longerUsable: true, longerUsableHint: 'oft 1–2 Tage länger gut', longerUsableHintEn: 'often good 1–2 days longer' },

  { de: 'H-Milch', en: 'UHT Milk', category: 'grocery', daysAfterOpening: 7, hint: 'nach Öffnen' },

  { de: 'Butter', en: 'Butter', category: 'grocery', daysAfterOpening: 30,
    longerUsable: true, longerUsableHint: 'oft noch Wochen haltbar', longerUsableHintEn: 'often lasts weeks longer' },

  { de: 'Joghurt', en: 'Yogurt', category: 'grocery', daysAfterOpening: 7,
    longerUsable: true, longerUsableHint: 'ungeöffnet oft 1–2 Wochen länger', longerUsableHintEn: 'if unopened, often 1–2 weeks longer' },

  { de: 'Topfen', en: 'Quark', category: 'grocery', daysAfterOpening: 5 },

  { de: 'Sauerrahm', en: 'Sour Cream', category: 'grocery', daysAfterOpening: 7 },

  { de: 'Schlagobers', en: 'Heavy Cream', category: 'grocery', daysAfterOpening: 5 },

  { de: 'Frischkäse', en: 'Cream Cheese', category: 'grocery', daysAfterOpening: 7 },

  { de: 'Mozzarella', en: 'Mozzarella', category: 'grocery', daysAfterOpening: 3 },

  { de: 'Käse (Scheiben)', en: 'Sliced Cheese', category: 'grocery', daysAfterOpening: 7 },

  { de: 'Käse (Stück)', en: 'Block Cheese', category: 'grocery', daysAfterOpening: 21,
    longerUsable: true, longerUsableHint: 'Schimmelstelle abschneiden, Rest ok', longerUsableHintEn: 'cut off mould spot, rest is fine' },

  { de: 'Parmesan', en: 'Parmesan', category: 'grocery', daysAfterOpening: 30,
    longerUsable: true, longerUsableHint: 'oft noch Monate haltbar', longerUsableHintEn: 'often lasts months longer' },

  { de: 'Eier', en: 'Eggs', category: 'grocery', daysAfterOpening: 28,
    longerUsable: true, longerUsableHint: 'Schwimmtest: sinkt = noch gut', longerUsableHintEn: 'float test: sinks = still good' },

  { de: 'Schinken', en: 'Ham', category: 'grocery', daysAfterOpening: 5 },

  { de: 'Salami', en: 'Salami', category: 'grocery', daysAfterOpening: 14,
    longerUsable: true, longerUsableHint: 'oft noch 1–2 Wochen länger', longerUsableHintEn: 'often good 1–2 weeks longer' },

  { de: 'Wurst', en: 'Cold Cuts', category: 'grocery', daysAfterOpening: 4 },

  { de: 'Aufschnitt', en: 'Deli Meat', category: 'grocery', daysAfterOpening: 4 },

  { de: 'Hackfleisch', en: 'Minced Meat', category: 'grocery', daysAfterOpening: 2 },

  { de: 'Hühnerbrust', en: 'Chicken Breast', category: 'grocery', daysAfterOpening: 2 },

  { de: 'Lachs', en: 'Salmon', category: 'grocery', daysAfterOpening: 2 },

  { de: 'Fischstäbchen', en: 'Fish Fingers', category: 'grocery', daysAfterOpening: 1 },

  { de: 'Brot', en: 'Bread', category: 'grocery', daysAfterOpening: 5 },

  { de: 'Toastbrot', en: 'Toast Bread', category: 'grocery', daysAfterOpening: 7 },

  { de: 'Margarine', en: 'Margarine', category: 'grocery', daysAfterOpening: 45 },

  { de: 'Mayonnaise', en: 'Mayonnaise', category: 'grocery', daysAfterOpening: 60 },

  { de: 'Ketchup', en: 'Ketchup', category: 'grocery', daysAfterOpening: 60,
    longerUsable: true, longerUsableHint: 'oft noch Monate haltbar', longerUsableHintEn: 'often lasts months longer' },

  { de: 'Senf', en: 'Mustard', category: 'grocery', daysAfterOpening: 90,
    longerUsable: true, longerUsableHint: 'oft noch Monate haltbar', longerUsableHintEn: 'often lasts months longer' },

  { de: 'Marmelade', en: 'Jam', category: 'grocery', daysAfterOpening: 90,
    longerUsable: true, longerUsableHint: 'oft noch Wochen–Monate länger', longerUsableHintEn: 'often lasts weeks to months longer' },

  { de: 'Honig', en: 'Honey', category: 'grocery', daysAfterOpening: 365,
    longerUsable: true, longerUsableHint: 'verdirbt praktisch nie', longerUsableHintEn: 'practically never spoils' },

  { de: 'Olivenöl', en: 'Olive Oil', category: 'grocery', daysAfterOpening: 90 },

  { de: 'Sonnenblumenöl', en: 'Sunflower Oil', category: 'grocery', daysAfterOpening: 90 },

  { de: 'Orangensaft', en: 'Orange Juice', category: 'grocery', daysAfterOpening: 5 },

  { de: 'Erdbeeren', en: 'Strawberries', category: 'grocery', daysAfterOpening: 4 },

  { de: 'Himbeeren', en: 'Raspberries', category: 'grocery', daysAfterOpening: 3 },

  { de: 'Heidelbeeren', en: 'Blueberries', category: 'grocery', daysAfterOpening: 5 },

  { de: 'Tomaten', en: 'Tomatoes', category: 'grocery', daysAfterOpening: 7 },

  { de: 'Paprika', en: 'Bell Pepper', category: 'grocery', daysAfterOpening: 7 },

  { de: 'Gurke', en: 'Cucumber', category: 'grocery', daysAfterOpening: 5 },

  { de: 'Salat', en: 'Lettuce', category: 'grocery', daysAfterOpening: 4 },

  { de: 'Spinat', en: 'Spinach', category: 'grocery', daysAfterOpening: 3 },

  { de: 'Karotten', en: 'Carrots', category: 'grocery', daysAfterOpening: 14 },

  { de: 'Kartoffeln', en: 'Potatoes', category: 'grocery', daysAfterOpening: 30,
    longerUsable: true, longerUsableHint: 'nicht gekeimt/weich = noch gut', longerUsableHintEn: 'not sprouted/soft = still good' },

  { de: 'Zwiebeln', en: 'Onions', category: 'grocery', daysAfterOpening: 30,
    longerUsable: true, longerUsableHint: 'oft noch Wochen länger haltbar', longerUsableHintEn: 'often lasts weeks longer' },

  { de: 'Knoblauch', en: 'Garlic', category: 'grocery', daysAfterOpening: 14 },

  { de: 'Äpfel', en: 'Apples', category: 'grocery', daysAfterOpening: 21 },

  { de: 'Bananen', en: 'Bananas', category: 'grocery', daysAfterOpening: 5 },

  { de: 'Orangen', en: 'Oranges', category: 'grocery', daysAfterOpening: 14 },

  { de: 'Zitronen', en: 'Lemons', category: 'grocery', daysAfterOpening: 14 },

  { de: 'Tiefkühlpizza', en: 'Frozen Pizza', category: 'grocery', daysAfterOpening: 1 },

  { de: 'Tiefkühlgemüse', en: 'Frozen Vegetables', category: 'grocery', daysAfterOpening: 3 },

  // ─── BATH & BEAUTY ──────────────────────────────────────────

  { de: 'Mascara', en: 'Mascara', category: 'bath', daysAfterOpening: 90, hint: '3 Monate nach Öffnen' },

  { de: 'Foundation', en: 'Foundation', category: 'bath', daysAfterOpening: 365 },

  { de: 'Lippenstift', en: 'Lipstick', category: 'bath', daysAfterOpening: 730,
    longerUsable: true, longerUsableHint: 'oft 3–4 Jahre haltbar', longerUsableHintEn: 'often lasts 3–4 years' },

  { de: 'Lippenpflege', en: 'Lip Balm', category: 'bath', daysAfterOpening: 365 },

  { de: 'Concealer', en: 'Concealer', category: 'bath', daysAfterOpening: 365 },

  { de: 'Lidschatten', en: 'Eyeshadow', category: 'bath', daysAfterOpening: 730,
    longerUsable: true, longerUsableHint: 'Puder hält oft 3–4 Jahre', longerUsableHintEn: 'powder often lasts 3–4 years' },

  { de: 'Eyeliner', en: 'Eyeliner', category: 'bath', daysAfterOpening: 180 },

  { de: 'Gesichtscreme', en: 'Face Cream', category: 'bath', daysAfterOpening: 180 },

  { de: 'Körperlotion', en: 'Body Lotion', category: 'bath', daysAfterOpening: 365 },

  { de: 'Sonnencreme', en: 'Sunscreen', category: 'bath', daysAfterOpening: 365, hint: 'jährlich erneuern' },

  { de: 'Duschgel', en: 'Shower Gel', category: 'bath', daysAfterOpening: 365 },

  { de: 'Shampoo', en: 'Shampoo', category: 'bath', daysAfterOpening: 365 },

  { de: 'Conditioner', en: 'Conditioner', category: 'bath', daysAfterOpening: 365 },

  { de: 'Haarkur', en: 'Hair Mask', category: 'bath', daysAfterOpening: 365 },

  { de: 'Haaröl', en: 'Hair Oil', category: 'bath', daysAfterOpening: 365 },

  { de: 'Haarspray', en: 'Hair Spray', category: 'bath', daysAfterOpening: 730,
    longerUsable: true, longerUsableHint: 'oft 2–3 Jahre haltbar', longerUsableHintEn: 'often lasts 2–3 years' },

  { de: 'Haargel', en: 'Hair Gel', category: 'bath', daysAfterOpening: 730,
    longerUsable: true, longerUsableHint: 'oft 2–3 Jahre haltbar', longerUsableHintEn: 'often lasts 2–3 years' },

  { de: 'Deodorant', en: 'Deodorant', category: 'bath', daysAfterOpening: 365 },

  { de: 'Parfüm', en: 'Perfume', category: 'bath', daysAfterOpening: 1095,
    longerUsable: true, longerUsableHint: 'oft 5–10 Jahre haltbar', longerUsableHintEn: 'often lasts 5–10 years' },

  { de: 'Rasierschaum', en: 'Shaving Foam', category: 'bath', daysAfterOpening: 365 },

  { de: 'Aftershave', en: 'Aftershave', category: 'bath', daysAfterOpening: 1095 },

  { de: 'Rasierklinge', en: 'Razor Blade', category: 'bath', daysAfterOpening: 30, hint: 'ab erster Nutzung' },

  { de: 'Zahnpasta', en: 'Toothpaste', category: 'bath', daysAfterOpening: 365 },

  { de: 'Mundwasser', en: 'Mouthwash', category: 'bath', daysAfterOpening: 365 },

  { de: 'Zahnbürste', en: 'Toothbrush', category: 'bath', daysAfterOpening: 90, hint: 'alle 3 Monate wechseln' },

  { de: 'Flüssigseife', en: 'Liquid Soap', category: 'bath', daysAfterOpening: 365 },

  { de: 'Handcreme', en: 'Hand Cream', category: 'bath', daysAfterOpening: 365 },

  { de: 'Nagellack', en: 'Nail Polish', category: 'bath', daysAfterOpening: 730,
    longerUsable: true, longerUsableHint: 'nutzbar solange nicht eingetrocknet', longerUsableHintEn: 'usable as long as not dried out' },

  { de: 'Mizellenwasser', en: 'Micellar Water', category: 'bath', daysAfterOpening: 180 },

  { de: 'Gesichtsmaske', en: 'Face Mask', category: 'bath', daysAfterOpening: 365 },

  { de: 'Peeling', en: 'Scrub', category: 'bath', daysAfterOpening: 180 },

  { de: 'Toner', en: 'Toner', category: 'bath', daysAfterOpening: 365 },

  { de: 'Serum', en: 'Serum', category: 'bath', daysAfterOpening: 180 },

  { de: 'Puder', en: 'Powder', category: 'bath', daysAfterOpening: 730,
    longerUsable: true, longerUsableHint: 'Puder hält oft 3–4 Jahre', longerUsableHintEn: 'powder often lasts 3–4 years' },

  { de: 'Rouge', en: 'Blush', category: 'bath', daysAfterOpening: 730,
    longerUsable: true, longerUsableHint: 'Puder hält oft 3–4 Jahre', longerUsableHintEn: 'powder often lasts 3–4 years' },

  { de: 'Primer', en: 'Primer', category: 'bath', daysAfterOpening: 365 },

  { de: 'BB Cream', en: 'BB Cream', category: 'bath', daysAfterOpening: 365 },

  { de: 'Make-up Entferner', en: 'Makeup Remover', category: 'bath', daysAfterOpening: 180 },

  { de: 'Augentropfen', en: 'Eye Drops', category: 'bath', daysAfterOpening: 30, hint: 'nach Öffnen' },

  { de: 'Kontaktlinsen (monatlich)', en: 'Monthly Contact Lenses', category: 'bath', daysAfterOpening: 30 },

  { de: 'Kontaktlinsen (täglich)', en: 'Daily Contact Lenses', category: 'bath', daysAfterOpening: 1 },

  { de: 'Luffa', en: 'Loofah', category: 'bath', daysAfterOpening: 30 },

  { de: 'Wundcreme', en: 'Wound Cream', category: 'bath', daysAfterOpening: 180 },

  { de: 'Ibuprofen', en: 'Ibuprofen', category: 'bath', daysAfterOpening: 180 },

  { de: 'Paracetamol', en: 'Paracetamol', category: 'bath', daysAfterOpening: 180 },

  { de: 'Nasenspray', en: 'Nasal Spray', category: 'bath', daysAfterOpening: 30, hint: 'nach Öffnen' },

  { de: 'Hustensaft', en: 'Cough Syrup', category: 'bath', daysAfterOpening: 30 },

  { de: 'Sonnenbrand Gel', en: 'After Sun Gel', category: 'bath', daysAfterOpening: 365 },

  { de: 'Wunddesinfektionsmittel', en: 'Wound Disinfectant', category: 'bath', daysAfterOpening: 180 },

  { de: 'Pflaster', en: 'Bandages', category: 'bath', daysAfterOpening: 730 },

  { de: 'Fieberthermometer', en: 'Thermometer', category: 'bath', daysAfterOpening: 1825 },
];

// Helper: fuzzy ranked search across German and English names.
// Priority order (highest first):
//   4 — German name starts with query  (e.g. "K" → "Käse", not "Topfen/Quark")
//   3 — English name starts with query (e.g. "Milk" → Milch)
//   2 — German name contains query anywhere
//   1 — English name contains query anywhere
// Items with no match are excluded. Ties preserve the original list order.
export function findItem(query: string): DattlItem[] {
  if (!query) return [];
  const q = query.toLowerCase();
  const scored = DATTL_ITEMS.map(item => {
    const de = item.de.toLowerCase();
    const en = item.en.toLowerCase();
    let score = 0;
    if      (de.startsWith(q)) score = 4;
    else if (en.startsWith(q)) score = 3;
    else if (de.includes(q))   score = 2;
    else if (en.includes(q))   score = 1;
    return { item, score };
  }).filter(x => x.score > 0);
  scored.sort((a, b) => b.score - a.score);
  return scored.map(x => x.item);
}

// Helper: calculate suggested expiry date from openedOn (defaults to today).
export function suggestedExpiryDate(item: DattlItem, openedOn: Date = new Date()): Date {
  const date = new Date(openedOn);
  date.setDate(date.getDate() + item.daysAfterOpening);
  return date;
}
