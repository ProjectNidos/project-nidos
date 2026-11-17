/**
 * Texts the owner can edit in the admin panel. Defaults live in
 * messages/{lv,en}.json; edits are rows in public.site_texts that override them.
 * Only keys listed here can be overridden.
 */
export const EDITABLE: ReadonlyArray<{ key: string; label: string; long?: boolean }> = [
  { key: 'hero.title', label: 'Sākums: virsraksts' },
  { key: 'hero.lead', label: 'Sākums: teksts zem virsraksta', long: true },
  { key: 'hero.cta', label: 'Sākums: pogas teksts' },
  { key: 'services.heading', label: 'Pakalpojumi: virsraksts' },
  { key: 'services.items.google_shop.title', label: '1. pakalpojums: nosaukums' },
  { key: 'services.items.google_shop.text', label: '1. pakalpojums: apraksts', long: true },
  { key: 'services.items.ai.title', label: '2. pakalpojums: nosaukums' },
  { key: 'services.items.ai.text', label: '2. pakalpojums: apraksts', long: true },
  { key: 'services.items.digitalization.title', label: '3. pakalpojums: nosaukums' },
  { key: 'services.items.digitalization.text', label: '3. pakalpojums: apraksts', long: true },
  { key: 'services.items.support.title', label: '4. pakalpojums: nosaukums' },
  { key: 'services.items.support.text', label: '4. pakalpojums: apraksts', long: true },
  { key: 'platforms.heading', label: 'Tehnoloģijas: virsraksts' },
  { key: 'about.heading', label: 'Par mums: virsraksts' },
  { key: 'about.text', label: 'Par mums: teksts', long: true },
  { key: 'contact.heading', label: 'Kontakti: virsraksts' },
  { key: 'contact.intro', label: 'Kontakti: teksts', long: true },
  { key: 'contact.success', label: 'Kontakti: paldies pēc nosūtīšanas', long: true },
];

export const EDITABLE_KEYS = EDITABLE.map((e) => e.key);
const EDITABLE_SET = new Set(EDITABLE_KEYS);
export const MAX_TEXT = 2000;
/** next-intl reads { } as placeholders and < > as tags; plain site text never needs them. */
export const FORBIDDEN_CHARS = /[{}<>]/;

type Tree = { [k: string]: unknown };

export function getText(tree: Tree, key: string): string | undefined {
  const v = key.split('.').reduce<unknown>((node, p) => (node as Tree | undefined)?.[p], tree);
  return typeof v === 'string' ? v : undefined;
}

/** Returns a copy of `defaults` with each editable, existing key replaced by its override. */
export function applyOverrides<T extends Tree>(defaults: T, rows: ReadonlyArray<{ key: string; value: string }>): T {
  const out = structuredClone(defaults);
  for (const { key, value } of rows) {
    if (!EDITABLE_SET.has(key) || !value || FORBIDDEN_CHARS.test(value)) continue;
    const parts = key.split('.');
    const last = parts.pop()!;
    const parent = parts.reduce<unknown>((node, p) => (node as Tree | undefined)?.[p], out) as Tree | undefined;
    if (parent && typeof parent[last] === 'string') parent[last] = value;
  }
  return out;
}
