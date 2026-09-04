export const palette = {
  bg: '#000000',
  surface: '#101010',
  surface2: '#181818',
  border: 'rgba(255,255,255,0.14)',
  text: '#FFFFFF',
  muted: 'rgba(255,255,255,0.68)',
  orange: '#FF5E00',
  amber: '#FFAE00',
  accent: '#AA3BFF',
  lime: '#3CFF00',
  danger: '#FF4D61',
  success: '#38D996',
  white: '#FFFFFF',
};

export const musicGenres = ['pop', 'rock', 'edm', 'jazz', 'blues', 'cumbia', 'trap', 'metal', 'folklore', 'alternativo', 'punk', 'reggae', 'latina', 'otros'];
export const genres = ['todos', ...musicGenres];

const countFormatter = new Intl.NumberFormat('es-AR');

export function formatCount(value?: number | string | null) {
  const parsed = Number(value);
  return countFormatter.format(Number.isFinite(parsed) ? parsed : 0);
}

export function formatGenre(genre?: string | null) {
  const value = String(genre || '').trim().toLowerCase();
  if (!value) return '';
  return value.split(/\s*(?:\/|,|\|)\s*/).filter(Boolean).map(part => {
    if (part === 'edm') return 'Electrónica';
    if (part === 'trap') return 'Urbano';
    return part.charAt(0).toUpperCase() + part.slice(1);
  }).join(' / ');
}
