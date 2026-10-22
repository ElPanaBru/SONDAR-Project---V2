export function normalizeSearch(value: unknown): string {
  return String(value ?? '').trim().normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('es').replace(/^@+/, '').replace(/\s+/g, ' ').trim();
}

// Exact names and titles come first, followed by prefixes and matches across fields.
export function searchScore(term: string, primary: unknown[], secondary: unknown[] = []): number {
  const query = normalizeSearch(term);
  if (!query) return 0;
  const titles = primary.map(normalizeSearch);
  const fields = [...titles, ...secondary.map(normalizeSearch)].join(' ');
  if (!query.split(' ').every(word => fields.includes(word))) return 0;
  if (titles.some(title => title === query)) return 4;
  if (titles.some(title => title.startsWith(query))) return 3;
  if (titles.some(title => title.includes(query))) return 2;
  return 1;
}
