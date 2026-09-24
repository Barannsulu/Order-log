import { admin, anthropic, MODEL, getUser, textOf, parseJson, bad } from '@/lib/server';

export const maxDuration = 60;

export async function POST(req) {
  const user = await getUser(req);
  if (!user) return bad('Sign in again.', 401);
  const { paths } = await req.json().catch(() => ({}));
  if (!Array.isArray(paths) || !paths.length || paths.length > 6) return bad('Send 1 to 6 photos.');

  const images = [];
  for (const p of paths) {
    const { data, error } = await admin.storage.from('receipts').download(String(p));
    if (error) return bad('A photo could not be found. Upload it again.');
    images.push({ type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: Buffer.from(await data.arrayBuffer()).toString('base64') } });
  }

  // Existing names help the model reuse the same product names across vendors.
  const { data: names } = await admin.from('receipt_items').select('canonical').limit(3000);
  const { data: vendors } = await admin.from('receipts').select('vendor').limit(3000);
  const canon = [...new Set((names || []).map(r => r.canonical))].slice(0, 400).join('; ');
  const vend = [...new Set((vendors || []).map(r => r.vendor))].join('; ');

  const prompt = `These ${paths.length} photo(s) show one supplier receipt or invoice for a restaurant, in page order. Read every product line.

Product names already in our system (reuse the exact name when a line is the same product): ${canon || 'none yet'}
Vendors already in our system: ${vend || 'none yet'}

Reply with only JSON in this shape:
{"vendor":"US Foods","receiptDate":"2026-09-12","invoiceNo":"123456","total":512.40,"items":[{"name":"SHRIMP COCONUT BRD 21/25","canonical":"Coconut Shrimp 21/25","sku":"1234567","qty":2,"unit":"CS","unitPrice":48.20,"lineTotal":96.40}]}

Rules:
- "name" is the line as printed. "canonical" is a short, plain English product name in Title Case that a manager would search for, keeping size/count/grade when it tells products apart, without brand codes.
- Numbers are plain numbers without $ signs. Use null for anything you cannot read. Never guess a price.
- unitPrice is the price for one unit as billed (per case, per lb, per each). If only a line total and quantity are shown, divide.
- Skip tax, fuel surcharge, delivery fees, deposits and credits unless they are products.
- receiptDate is YYYY-MM-DD, the invoice or delivery date printed on the document.
- vendor is the supplier's common name (for example "US Foods", "Sysco", "Restaurant Depot"), not an address.`;

  try {
    const msg = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 8000,
      messages: [{ role: 'user', content: [...images, { type: 'text', text: prompt }] }],
    });
    return Response.json(parseJson(textOf(msg)));
  } catch (e) {
    console.error('scan failed', e);
    return bad('The receipt could not be read. Try again, or enter it by hand.', 502);
  }
}
