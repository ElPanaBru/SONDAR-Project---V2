export type AudioFragment = { start: number; end: number };

export function audioFragment(total: number, start = 0, end = 30): AudioFragment {
  const limit = Number.isFinite(total) && total > 0 ? total : 0;
  const safeStart = Math.min(Math.max(0, Number.isFinite(start) ? start : 0), Math.max(0, limit - 0.1));
  const safeEnd = Math.min(limit, safeStart + 30, Math.max(safeStart + 0.1, Number.isFinite(end) ? end : safeStart + 30));
  return { start: safeStart, end: safeEnd };
}

export function fragmentTime(seconds: number) {
  const value = Math.max(0, Math.round(seconds * 100) / 100);
  const minutes = Math.floor(value / 60);
  return minutes + ':' + (value % 60).toFixed(2).padStart(5, '0');
}
