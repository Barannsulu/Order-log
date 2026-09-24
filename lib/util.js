export const money = v => (v == null || v === '' || isNaN(v)) ? '—' : '$' + Number(v).toFixed(2);
export const norm = s => String(s || '').toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g, '');
export const num = v => { if (v === '' || v == null) return null; const n = Number(String(v).replace(/[$,]/g, '')); return isFinite(n) ? n : null; };
export function localISO(d = new Date()) { const p = n => String(n).padStart(2, '0'); return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`; }
export function daysAgo(n) { const d = new Date(); d.setDate(d.getDate() - n); return localISO(d); }
export function fmtDate(s) {
  if (!s) return 'No date';
  const [y, m, d] = String(s).slice(0, 10).split('-').map(Number);
  if (!y) return s;
  return new Date(y, m - 1, d || 1).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}
/** Resize a photo in the browser so uploads stay small and fast. */
export async function shrink(file, max = 2000, q = 0.85) {
  try {
    const bmp = await createImageBitmap(file, { imageOrientation: 'from-image' });
    const s = Math.min(1, max / Math.max(bmp.width, bmp.height));
    const c = document.createElement('canvas');
    c.width = Math.round(bmp.width * s); c.height = Math.round(bmp.height * s);
    c.getContext('2d').drawImage(bmp, 0, 0, c.width, c.height);
    return await new Promise(res => c.toBlob(b => res(b || file), 'image/jpeg', q));
  } catch { return file; }
}
