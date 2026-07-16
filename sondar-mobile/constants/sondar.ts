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

export const musicGenres = ['pop', 'rock', 'edm', 'jazz', 'blues', 'cumbia', 'trap', 'metal', 'folklore', 'otros'];
export const genres = ['todos', ...musicGenres];

export function formatGenre(genre?: string | null) {
  const value = String(genre || '').trim().toLowerCase();
  if (!value) return '';
  return value === 'edm' ? 'EDM' : value.charAt(0).toUpperCase() + value.slice(1);
}
