// dattlItems.ts
// Lookup table for Dattl app
// Usage: import this file, use for autocomplete + expiry prefill
// daysAfterOpening = suggested tracking duration in days after opening/purchase

export type DattlItem = {
  de: string;        // German name (display name in app)
  en: string;        // English name
  category: 'grocery' | 'bath';
  daysAfterOpening: number;
  hint?: string;     // optional context shown under suggestion
};

export const DATTL_ITEMS: DattlItem[] = [

  // ─── GROCERY ────────────────────────────────────────────────

  { de: 'Milch', en: 'Milk', category: 'grocery', daysAfterOpening: 4 },
  { de: 'H-Milch', en: 'UHT Milk', category: 'grocery', daysAfterOpening: 7, hint: 'nach Öffnen' },
  { de: 'Butter', en: 'Butter', category: 'grocery', daysAfterOpening: 30 },
  { de: 'Joghurt', en: 'Yogurt', category: 'grocery', daysAfterOpening: 7 },
  { de: 'Topfen', en: 'Quark', category: 'grocery', daysAfterOpening: 5 },
  { de: 'Sauerrahm', en: 'Sour Cream', category: 'grocery', daysAfterOpening: 7 },
  { de: 'Schlagobers', en: 'Heavy Cream', category: 'grocery', daysAfterOpening: 5 },
  { de: 'Frischkäse', en: 'Cream Cheese', category: 'grocery', daysAfterOpening: 7 },
  { de: 'Mozzarella', en: 'Mozzarella', category: 'grocery', daysAfterOpening: 3 },
  { de: 'Käse (Scheiben)', en: 'Sliced Cheese', category: 'grocery', daysAfterOpening: 7 },
  { de: 'Käse (Stück)', en: 'Block Cheese', category: 'grocery', daysAfterOpening: 21 },
  { de: 'Parmesan', en: 'Parmesan', category: 'grocery', daysAfterOpening: 30 },
  { de: 'Eier', en: 'Eggs', category: 'grocery', daysAfterOpening: 28 },
  { de: 'Schinken', en: 'Ham', category: 'grocery', daysAfterOpening: 5 },
  { de: 'Salami', en: 'Salami', category: 'grocery', daysAfterOpening: 14 },
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
  { de: 'Ketchup', en: 'Ketchup', category: 'grocery', daysAfterOpening: 60 },
  { de: 'Senf', en: 'Mustard', category: 'grocery', daysAfterOpening: 90 },
  { de: 'Marmelade', en: 'Jam', category: 'grocery', daysAfterOpening: 90 },
  { de: 'Honig', en: 'Honey', category: 'grocery', daysAfterOpening: 365 },
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
  { de: 'Kartoffeln', en: 'Potatoes', category: 'grocery', daysAfterOpening: 30 },
  { de: 'Zwiebeln', en: 'Onions', category: 'grocery', daysAfterOpening: 30 },
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
  { de: 'Lippenstift', en: 'Lipstick', category: 'bath', daysAfterOpening: 730 },
  { de: 'Lippenpflege', en: 'Lip Balm', category: 'bath', daysAfterOpening: 365 },
  { de: 'Concealer', en: 'Concealer', category: 'bath', daysAfterOpening: 365 },
  { de: 'Lidschatten', en: 'Eyeshadow', category: 'bath', daysAfterOpening: 730 },
  { de: 'Eyeliner', en: 'Eyeliner', category: 'bath', daysAfterOpening: 180 },
  { de: 'Gesichtscreme', en: 'Face Cream', category: 'bath', daysAfterOpening: 180 },
  { de: 'Körperlotion', en: 'Body Lotion', category: 'bath', daysAfterOpening: 365 },
  { de: 'Sonnencreme', en: 'Sunscreen', category: 'bath', daysAfterOpening: 365, hint: 'jährlich erneuern' },
  { de: 'Duschgel', en: 'Shower Gel', category: 'bath', daysAfterOpening: 365 },
  { de: 'Shampoo', en: 'Shampoo', category: 'bath', daysAfterOpening: 365 },
  { de: 'Conditioner', en: 'Conditioner', category: 'bath', daysAfterOpening: 365 },
  { de: 'Haarkur', en: 'Hair Mask', category: 'bath', daysAfterOpening: 365 },
  { de: 'Haaröl', en: 'Hair Oil', category: 'bath', daysAfterOpening: 365 },
  { de: 'Haarspray', en: 'Hair Spray', category: 'bath', daysAfterOpening: 730 },
  { de: 'Haargel', en: 'Hair Gel', category: 'bath', daysAfterOpening: 730 },
  { de: 'Deodorant', en: 'Deodorant', category: 'bath', daysAfterOpening: 365 },
  { de: 'Parfüm', en: 'Perfume', category: 'bath', daysAfterOpening: 1095 },
  { de: 'Rasierschaum', en: 'Shaving Foam', category: 'bath', daysAfterOpening: 365 },
  { de: 'Aftershave', en: 'Aftershave', category: 'bath', daysAfterOpening: 1095 },
  { de: 'Rasierklinge', en: 'Razor Blade', category: 'bath', daysAfterOpening: 30, hint: 'nach erster Nutzung' },
  { de: 'Zahnpasta', en: 'Toothpaste', category: 'bath', daysAfterOpening: 365 },
  { de: 'Mundwasser', en: 'Mouthwash', category: 'bath', daysAfterOpening: 365 },
  { de: 'Zahnbürste', en: 'Toothbrush', category: 'bath', daysAfterOpening: 90, hint: 'alle 3 Monate wechseln' },
  { de: 'Flüssigseife', en: 'Liquid Soap', category: 'bath', daysAfterOpening: 365 },
  { de: 'Handcreme', en: 'Hand Cream', category: 'bath', daysAfterOpening: 365 },
  { de: 'Nagellack', en: 'Nail Polish', category: 'bath', daysAfterOpening: 730 },
  { de: 'Mizellenwasser', en: 'Micellar Water', category: 'bath', daysAfterOpening: 180 },
  { de: 'Gesichtsmaske', en: 'Face Mask', category: 'bath', daysAfterOpening: 365 },
  { de: 'Peeling', en: 'Scrub', category: 'bath', daysAfterOpening: 180 },
  { de: 'Toner', en: 'Toner', category: 'bath', daysAfterOpening: 365 },
  { de: 'Serum', en: 'Serum', category: 'bath', daysAfterOpening: 180 },
  { de: 'Puder', en: 'Powder', category: 'bath', daysAfterOpening: 730 },
  { de: 'Rouge', en: 'Blush', category: 'bath', daysAfterOpening: 730 },
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

// Helper: get item by German name (case-insensitive)
export function findItem(query: string): DattlItem[] {
  const q = query.toLowerCase();
  return DATTL_ITEMS.filter(
    item => item.de.toLowerCase().includes(q) || item.en.toLowerCase().includes(q)
  );
}

// Helper: calculate suggested expiry date from openedOn (defaults to today).
export function suggestedExpiryDate(item: DattlItem, openedOn: Date = new Date()): Date {
  const date = new Date(openedOn);
  date.setDate(date.getDate() + item.daysAfterOpening);
  return date;
}
