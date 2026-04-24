import type { ItemCategory } from '@/utils/storage';

export type DattlItem = {
  de: string;
  en: string;
  category: ItemCategory;
  daysAfterOpening: number;
  hint?: string;
  longerUsable?: boolean;
  longerUsableHint?: string;
  longerUsableHintEn?: string;
};

export const DATTL_ITEMS: DattlItem[] = [

  // ─── FRIDGE ─────────────────────────────────────────────────

  { de: 'Milch', en: 'Milk', category: 'fridge', daysAfterOpening: 4,
    longerUsable: true, longerUsableHint: 'oft 1–2 Tage länger gut', longerUsableHintEn: 'often good 1–2 days longer' },

  { de: 'H-Milch', en: 'UHT Milk', category: 'fridge', daysAfterOpening: 7, hint: 'nach Öffnen' },

  { de: 'Butter', en: 'Butter', category: 'fridge', daysAfterOpening: 30,
    longerUsable: true, longerUsableHint: 'oft noch Wochen haltbar', longerUsableHintEn: 'often lasts weeks longer' },

  { de: 'Joghurt', en: 'Yogurt', category: 'fridge', daysAfterOpening: 7,
    longerUsable: true, longerUsableHint: 'ungeöffnet oft 1–2 Wochen länger', longerUsableHintEn: 'if unopened, often 1–2 weeks longer' },

  { de: 'Topfen', en: 'Quark', category: 'fridge', daysAfterOpening: 5 },

  { de: 'Sauerrahm', en: 'Sour Cream', category: 'fridge', daysAfterOpening: 7 },

  { de: 'Schlagobers', en: 'Heavy Cream', category: 'fridge', daysAfterOpening: 5 },

  { de: 'Frischkäse', en: 'Cream Cheese', category: 'fridge', daysAfterOpening: 7 },

  { de: 'Mozzarella', en: 'Mozzarella', category: 'fridge', daysAfterOpening: 3 },

  { de: 'Käse (Scheiben)', en: 'Sliced Cheese', category: 'fridge', daysAfterOpening: 7 },

  { de: 'Käse (Stück)', en: 'Block Cheese', category: 'fridge', daysAfterOpening: 21,
    longerUsable: true, longerUsableHint: 'Schimmelstelle abschneiden, Rest ok', longerUsableHintEn: 'cut off mould spot, rest is fine' },

  { de: 'Parmesan', en: 'Parmesan', category: 'fridge', daysAfterOpening: 30,
    longerUsable: true, longerUsableHint: 'oft noch Monate haltbar', longerUsableHintEn: 'often lasts months longer' },

  { de: 'Eier', en: 'Eggs', category: 'fridge', daysAfterOpening: 28,
    longerUsable: true, longerUsableHint: 'Schwimmtest: sinkt = noch gut', longerUsableHintEn: 'float test: sinks = still good' },

  { de: 'Schinken', en: 'Ham', category: 'fridge', daysAfterOpening: 5 },

  { de: 'Salami', en: 'Salami', category: 'fridge', daysAfterOpening: 14,
    longerUsable: true, longerUsableHint: 'oft noch 1–2 Wochen länger', longerUsableHintEn: 'often good 1–2 weeks longer' },

  { de: 'Wurst', en: 'Cold Cuts', category: 'fridge', daysAfterOpening: 4 },

  { de: 'Aufschnitt', en: 'Deli Meat', category: 'fridge', daysAfterOpening: 4 },

  { de: 'Hackfleisch', en: 'Minced Meat', category: 'fridge', daysAfterOpening: 2 },

  { de: 'Hühnerbrust', en: 'Chicken Breast', category: 'fridge', daysAfterOpening: 2 },

  { de: 'Lachs', en: 'Salmon', category: 'fridge', daysAfterOpening: 2 },

  { de: 'Margarine', en: 'Margarine', category: 'fridge', daysAfterOpening: 45 },

  { de: 'Mayonnaise', en: 'Mayonnaise', category: 'fridge', daysAfterOpening: 60 },

  { de: 'Orangensaft', en: 'Orange Juice', category: 'fridge', daysAfterOpening: 5 },

  { de: 'Erdbeeren', en: 'Strawberries', category: 'fridge', daysAfterOpening: 4 },

  { de: 'Himbeeren', en: 'Raspberries', category: 'fridge', daysAfterOpening: 3 },

  { de: 'Heidelbeeren', en: 'Blueberries', category: 'fridge', daysAfterOpening: 5 },

  { de: 'Tomaten', en: 'Tomatoes', category: 'fridge', daysAfterOpening: 7 },

  { de: 'Paprika', en: 'Bell Pepper', category: 'fridge', daysAfterOpening: 7 },

  { de: 'Gurke', en: 'Cucumber', category: 'fridge', daysAfterOpening: 5 },

  { de: 'Salat', en: 'Lettuce', category: 'fridge', daysAfterOpening: 4 },

  { de: 'Spinat', en: 'Spinach', category: 'fridge', daysAfterOpening: 3 },

  { de: 'Karotten', en: 'Carrots', category: 'fridge', daysAfterOpening: 14 },

  { de: 'Äpfel', en: 'Apples', category: 'fridge', daysAfterOpening: 21 },

  // ─── FREEZER ────────────────────────────────────────────────

  { de: 'Fischstäbchen', en: 'Fish Fingers', category: 'freezer', daysAfterOpening: 1 },

  { de: 'Tiefkühlpizza', en: 'Frozen Pizza', category: 'freezer', daysAfterOpening: 1 },

  { de: 'Tiefkühlgemüse', en: 'Frozen Vegetables', category: 'freezer', daysAfterOpening: 3 },

  // ─── PANTRY ─────────────────────────────────────────────────

  { de: 'Brot', en: 'Bread', category: 'pantry', daysAfterOpening: 5 },

  { de: 'Toastbrot', en: 'Toast Bread', category: 'pantry', daysAfterOpening: 7 },

  { de: 'Ketchup', en: 'Ketchup', category: 'pantry', daysAfterOpening: 60,
    longerUsable: true, longerUsableHint: 'oft noch Monate haltbar', longerUsableHintEn: 'often lasts months longer' },

  { de: 'Senf', en: 'Mustard', category: 'pantry', daysAfterOpening: 90,
    longerUsable: true, longerUsableHint: 'oft noch Monate haltbar', longerUsableHintEn: 'often lasts months longer' },

  { de: 'Marmelade', en: 'Jam', category: 'pantry', daysAfterOpening: 90,
    longerUsable: true, longerUsableHint: 'oft noch Wochen–Monate länger', longerUsableHintEn: 'often lasts weeks to months longer' },

  { de: 'Honig', en: 'Honey', category: 'pantry', daysAfterOpening: 365,
    longerUsable: true, longerUsableHint: 'verdirbt praktisch nie', longerUsableHintEn: 'practically never spoils' },

  { de: 'Olivenöl', en: 'Olive Oil', category: 'pantry', daysAfterOpening: 90 },

  { de: 'Sonnenblumenöl', en: 'Sunflower Oil', category: 'pantry', daysAfterOpening: 90 },

  { de: 'Kartoffeln', en: 'Potatoes', category: 'pantry', daysAfterOpening: 30,
    longerUsable: true, longerUsableHint: 'nicht gekeimt/weich = noch gut', longerUsableHintEn: 'not sprouted/soft = still good' },

  { de: 'Zwiebeln', en: 'Onions', category: 'pantry', daysAfterOpening: 30,
    longerUsable: true, longerUsableHint: 'oft noch Wochen länger haltbar', longerUsableHintEn: 'often lasts weeks longer' },

  { de: 'Knoblauch', en: 'Garlic', category: 'pantry', daysAfterOpening: 14 },

  { de: 'Bananen', en: 'Bananas', category: 'pantry', daysAfterOpening: 5 },

  { de: 'Orangen', en: 'Oranges', category: 'pantry', daysAfterOpening: 14 },

  { de: 'Zitronen', en: 'Lemons', category: 'pantry', daysAfterOpening: 14 },

  // ─── MEDICINE ───────────────────────────────────────────────

  { de: 'Augentropfen', en: 'Eye Drops', category: 'medicine', daysAfterOpening: 30, hint: 'nach Öffnen' },

  { de: 'Wundcreme', en: 'Wound Cream', category: 'medicine', daysAfterOpening: 180 },

  { de: 'Ibuprofen', en: 'Ibuprofen', category: 'medicine', daysAfterOpening: 180 },

  { de: 'Paracetamol', en: 'Paracetamol', category: 'medicine', daysAfterOpening: 180 },

  { de: 'Nasenspray', en: 'Nasal Spray', category: 'medicine', daysAfterOpening: 30, hint: 'nach Öffnen' },

  { de: 'Hustensaft', en: 'Cough Syrup', category: 'medicine', daysAfterOpening: 30 },

  { de: 'Wunddesinfektionsmittel', en: 'Wound Disinfectant', category: 'medicine', daysAfterOpening: 180 },

  { de: 'Pflaster', en: 'Bandages', category: 'medicine', daysAfterOpening: 730 },

  { de: 'Fieberthermometer', en: 'Thermometer', category: 'medicine', daysAfterOpening: 1825 },

  // ─── COSMETICS ──────────────────────────────────────────────

  { de: 'Mascara', en: 'Mascara', category: 'cosmetics', daysAfterOpening: 90, hint: '3 Monate nach Öffnen' },

  { de: 'Foundation', en: 'Foundation', category: 'cosmetics', daysAfterOpening: 365 },

  { de: 'Lippenstift', en: 'Lipstick', category: 'cosmetics', daysAfterOpening: 730,
    longerUsable: true, longerUsableHint: 'oft 3–4 Jahre haltbar', longerUsableHintEn: 'often lasts 3–4 years' },

  { de: 'Lippenpflege', en: 'Lip Balm', category: 'cosmetics', daysAfterOpening: 365 },

  { de: 'Concealer', en: 'Concealer', category: 'cosmetics', daysAfterOpening: 365 },

  { de: 'Lidschatten', en: 'Eyeshadow', category: 'cosmetics', daysAfterOpening: 730,
    longerUsable: true, longerUsableHint: 'Puder hält oft 3–4 Jahre', longerUsableHintEn: 'powder often lasts 3–4 years' },

  { de: 'Eyeliner', en: 'Eyeliner', category: 'cosmetics', daysAfterOpening: 180 },

  { de: 'Gesichtscreme', en: 'Face Cream', category: 'cosmetics', daysAfterOpening: 180 },

  { de: 'Körperlotion', en: 'Body Lotion', category: 'cosmetics', daysAfterOpening: 365 },

  { de: 'Sonnencreme', en: 'Sunscreen', category: 'cosmetics', daysAfterOpening: 365, hint: 'jährlich erneuern' },

  { de: 'Duschgel', en: 'Shower Gel', category: 'cosmetics', daysAfterOpening: 365 },

  { de: 'Shampoo', en: 'Shampoo', category: 'cosmetics', daysAfterOpening: 365 },

  { de: 'Conditioner', en: 'Conditioner', category: 'cosmetics', daysAfterOpening: 365 },

  { de: 'Haarkur', en: 'Hair Mask', category: 'cosmetics', daysAfterOpening: 365 },

  { de: 'Haaröl', en: 'Hair Oil', category: 'cosmetics', daysAfterOpening: 365 },

  { de: 'Haarspray', en: 'Hair Spray', category: 'cosmetics', daysAfterOpening: 730,
    longerUsable: true, longerUsableHint: 'oft 2–3 Jahre haltbar', longerUsableHintEn: 'often lasts 2–3 years' },

  { de: 'Haargel', en: 'Hair Gel', category: 'cosmetics', daysAfterOpening: 730,
    longerUsable: true, longerUsableHint: 'oft 2–3 Jahre haltbar', longerUsableHintEn: 'often lasts 2–3 years' },

  { de: 'Deodorant', en: 'Deodorant', category: 'cosmetics', daysAfterOpening: 365 },

  { de: 'Parfüm', en: 'Perfume', category: 'cosmetics', daysAfterOpening: 1095,
    longerUsable: true, longerUsableHint: 'oft 5–10 Jahre haltbar', longerUsableHintEn: 'often lasts 5–10 years' },

  { de: 'Rasierschaum', en: 'Shaving Foam', category: 'cosmetics', daysAfterOpening: 365 },

  { de: 'Aftershave', en: 'Aftershave', category: 'cosmetics', daysAfterOpening: 1095 },

  { de: 'Rasierklinge', en: 'Razor Blade', category: 'cosmetics', daysAfterOpening: 30, hint: 'ab erster Nutzung' },

  { de: 'Zahnpasta', en: 'Toothpaste', category: 'cosmetics', daysAfterOpening: 365 },

  { de: 'Mundwasser', en: 'Mouthwash', category: 'cosmetics', daysAfterOpening: 365 },

  { de: 'Zahnbürste', en: 'Toothbrush', category: 'cosmetics', daysAfterOpening: 90, hint: 'alle 3 Monate wechseln' },

  { de: 'Flüssigseife', en: 'Liquid Soap', category: 'cosmetics', daysAfterOpening: 365 },

  { de: 'Handcreme', en: 'Hand Cream', category: 'cosmetics', daysAfterOpening: 365 },

  { de: 'Nagellack', en: 'Nail Polish', category: 'cosmetics', daysAfterOpening: 730,
    longerUsable: true, longerUsableHint: 'nutzbar solange nicht eingetrocknet', longerUsableHintEn: 'usable as long as not dried out' },

  { de: 'Mizellenwasser', en: 'Micellar Water', category: 'cosmetics', daysAfterOpening: 180 },

  { de: 'Gesichtsmaske', en: 'Face Mask', category: 'cosmetics', daysAfterOpening: 365 },

  { de: 'Peeling', en: 'Scrub', category: 'cosmetics', daysAfterOpening: 180 },

  { de: 'Toner', en: 'Toner', category: 'cosmetics', daysAfterOpening: 365 },

  { de: 'Serum', en: 'Serum', category: 'cosmetics', daysAfterOpening: 180 },

  { de: 'Puder', en: 'Powder', category: 'cosmetics', daysAfterOpening: 730,
    longerUsable: true, longerUsableHint: 'Puder hält oft 3–4 Jahre', longerUsableHintEn: 'powder often lasts 3–4 years' },

  { de: 'Rouge', en: 'Blush', category: 'cosmetics', daysAfterOpening: 730,
    longerUsable: true, longerUsableHint: 'Puder hält oft 3–4 Jahre', longerUsableHintEn: 'powder often lasts 3–4 years' },

  { de: 'Primer', en: 'Primer', category: 'cosmetics', daysAfterOpening: 365 },

  { de: 'BB Cream', en: 'BB Cream', category: 'cosmetics', daysAfterOpening: 365 },

  { de: 'Make-up Entferner', en: 'Makeup Remover', category: 'cosmetics', daysAfterOpening: 180 },

  { de: 'Kontaktlinsen (monatlich)', en: 'Monthly Contact Lenses', category: 'cosmetics', daysAfterOpening: 30 },

  { de: 'Kontaktlinsen (täglich)', en: 'Daily Contact Lenses', category: 'cosmetics', daysAfterOpening: 1 },

  { de: 'Luffa', en: 'Loofah', category: 'cosmetics', daysAfterOpening: 30 },

  { de: 'Sonnenbrand Gel', en: 'After Sun Gel', category: 'cosmetics', daysAfterOpening: 365 },
];

// Helper: fuzzy ranked search across German and English names.
// Priority order (highest first):
//   4 — German name starts with query
//   3 — English name starts with query
//   2 — German name contains query anywhere
//   1 — English name contains query anywhere
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
