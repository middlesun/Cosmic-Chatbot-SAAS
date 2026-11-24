export type TarotSuit = 'Major' | 'Wands' | 'Cups' | 'Swords' | 'Pentacles';
export type TarotElement = 'Spirit' | 'Fire' | 'Water' | 'Air' | 'Earth';

export interface DrawnTarotCard {
  position: string;
  card: string;
  orientation: 'Upright' | 'Reversed';
  arcana: 'Major' | 'Minor';
}

export interface DrawnTarotSpread {
  spreadName: string;
  cards: DrawnTarotCard[];
}

export interface TarotCardMetadata {
  /** Exact canonical string used by divinationEngines FULL_TAROT_DECK */
  canonicalName: string;
  /** URL-safe filename slug */
  slug: string;
  /** Clean display title without Roman numeral prefix */
  title: string;
  /** Header numeral or court rank shown at the top of the cardstock frame */
  topLabel: string;
  arcana: 'Major' | 'Minor';
  suit: TarotSuit;
  element: TarotElement;
  imageUrl: string;
  sheetIndex: number;
  row: 0 | 1;
  col: 0 | 1 | 2;
}

const TAROT_DECK_BASE_URL =
  'https://grvgdkzdtcoqwqwkjcxf.supabase.co/storage/v1/object/public/cosmic%20council/tarot/deck';

export const TAROT_BACK_IMAGE_URL = `${TAROT_DECK_BASE_URL}/back.webp`;

const MAJOR_DEFS: Array<{ roman: string; title: string; slug: string }> = [
  { roman: '0', title: 'The Fool', slug: 'major-00-fool' },
  { roman: 'I', title: 'The Magician', slug: 'major-01-magician' },
  { roman: 'II', title: 'The High Priestess', slug: 'major-02-high-priestess' },
  { roman: 'III', title: 'The Empress', slug: 'major-03-empress' },
  { roman: 'IV', title: 'The Emperor', slug: 'major-04-emperor' },
  { roman: 'V', title: 'The Hierophant', slug: 'major-05-hierophant' },
  { roman: 'VI', title: 'The Lovers', slug: 'major-06-lovers' },
  { roman: 'VII', title: 'The Chariot', slug: 'major-07-chariot' },
  { roman: 'VIII', title: 'Strength', slug: 'major-08-strength' },
  { roman: 'IX', title: 'The Hermit', slug: 'major-09-hermit' },
  { roman: 'X', title: 'Wheel of Fortune', slug: 'major-10-wheel-of-fortune' },
  { roman: 'XI', title: 'Justice', slug: 'major-11-justice' },
  { roman: 'XII', title: 'The Hanged Man', slug: 'major-12-hanged-man' },
  { roman: 'XIII', title: 'Death', slug: 'major-13-death' },
  { roman: 'XIV', title: 'Temperance', slug: 'major-14-temperance' },
  { roman: 'XV', title: 'The Devil', slug: 'major-15-devil' },
  { roman: 'XVI', title: 'The Tower', slug: 'major-16-tower' },
  { roman: 'XVII', title: 'The Star', slug: 'major-17-star' },
  { roman: 'XVIII', title: 'The Moon', slug: 'major-18-moon' },
  { roman: 'XIX', title: 'The Sun', slug: 'major-19-sun' },
  { roman: 'XX', title: 'Judgement', slug: 'major-20-judgement' },
  { roman: 'XXI', title: 'The World', slug: 'major-21-world' },
];

const SUIT_META: Array<{
  suit: Exclude<TarotSuit, 'Major'>;
  element: Exclude<TarotElement, 'Spirit'>;
}> = [
  { suit: 'Wands', element: 'Fire' },
  { suit: 'Cups', element: 'Water' },
  { suit: 'Swords', element: 'Air' },
  { suit: 'Pentacles', element: 'Earth' },
];

const RANK_DEFS: Array<{ rank: string; slugPart: string; topLabel: string }> = [
  { rank: 'Ace', slugPart: '01-ace', topLabel: 'I' },
  { rank: 'Two', slugPart: '02-two', topLabel: 'II' },
  { rank: 'Three', slugPart: '03-three', topLabel: 'III' },
  { rank: 'Four', slugPart: '04-four', topLabel: 'IV' },
  { rank: 'Five', slugPart: '05-five', topLabel: 'V' },
  { rank: 'Six', slugPart: '06-six', topLabel: 'VI' },
  { rank: 'Seven', slugPart: '07-seven', topLabel: 'VII' },
  { rank: 'Eight', slugPart: '08-eight', topLabel: 'VIII' },
  { rank: 'Nine', slugPart: '09-nine', topLabel: 'IX' },
  { rank: 'Ten', slugPart: '10-ten', topLabel: 'X' },
  { rank: 'Page', slugPart: '11-page', topLabel: 'PAGE' },
  { rank: 'Knight', slugPart: '12-knight', topLabel: 'KNIGHT' },
  { rank: 'Queen', slugPart: '13-queen', topLabel: 'QUEEN' },
  { rank: 'King', slugPart: '14-king', topLabel: 'KING' },
];

export const TAROT_DECK_CATALOG: TarotCardMetadata[] = (() => {
  const all: TarotCardMetadata[] = [];
  let globalIdx = 0;

  for (const m of MAJOR_DEFS) {
    const slotInSheet = globalIdx % 6;
    all.push({
      canonicalName: `${m.roman} · ${m.title}`,
      slug: m.slug,
      title: m.title,
      topLabel: m.roman,
      arcana: 'Major',
      suit: 'Major',
      element: 'Spirit',
      imageUrl: `${TAROT_DECK_BASE_URL}/${m.slug}.webp`,
      sheetIndex: Math.floor(globalIdx / 6) + 1,
      row: (slotInSheet < 3 ? 0 : 1) as 0 | 1,
      col: (slotInSheet % 3) as 0 | 1 | 2,
    });
    globalIdx += 1;
  }

  for (const s of SUIT_META) {
    for (const r of RANK_DEFS) {
      const slotInSheet = globalIdx % 6;
      const slug = `${s.suit.toLowerCase()}-${r.slugPart}`;
      const title = `${r.rank} of ${s.suit}`;
      all.push({
        canonicalName: title,
        slug,
        title,
        topLabel: `${r.topLabel} · ${s.suit.toUpperCase()}`,
        arcana: 'Minor',
        suit: s.suit,
        element: s.element,
        imageUrl: `${TAROT_DECK_BASE_URL}/${slug}.webp`,
        sheetIndex: Math.floor(globalIdx / 6) + 1,
        row: (slotInSheet < 3 ? 0 : 1) as 0 | 1,
        col: (slotInSheet % 3) as 0 | 1 | 2,
      });
      globalIdx += 1;
    }
  }

  return all;
})();

const TAROT_LOOKUP = new Map<string, TarotCardMetadata>();
for (const card of TAROT_DECK_CATALOG) {
  TAROT_LOOKUP.set(card.canonicalName.toLowerCase(), card);
  TAROT_LOOKUP.set(card.title.toLowerCase(), card);
  TAROT_LOOKUP.set(card.slug.toLowerCase(), card);
}

export function getTarotCardMetadata(rawCardName: string): TarotCardMetadata {
  const normalized = String(rawCardName || '')
    .trim()
    .replace(/\s*\((upright|reversed)\)\s*$/i, '')
    .toLowerCase();

  const direct = TAROT_LOOKUP.get(normalized);
  if (direct) return direct;

  // Strip optional Roman prefix e.g. "XVII - The Star" or "XVII The Star"
  const stripped = normalized.replace(/^[ivx0]+\s*[·\-:.]?\s*/i, '').trim();
  const byTitle = TAROT_LOOKUP.get(stripped);
  if (byTitle) return byTitle;

  return TAROT_DECK_CATALOG[17]; // Safe deterministic fallback (The Star)
}
