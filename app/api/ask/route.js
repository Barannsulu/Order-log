import { admin, anthropic, MODEL, getUser, textOf, bad } from '@/lib/server';

export const maxDuration = 60;

export async function POST(req) {
  const user = await getUser(req);
  if (!user) return bad('Sign in again.', 401);
  const { messages } = await req.json().catch(() => ({}));
  const turns = (Array.isArray(messages) ? messages : [])
    .filter(m => (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string' && m.content.trim())
    .slice(-12).map(m => ({ role: m.role, content: m.content.slice(0, 4000) }));
  while (turns.length && turns[0].role !== 'user') turns.shift();
  if (!turns.length || turns[turns.length - 1].role !== 'user') return bad('Ask a question.');

  const { data: rows, error } = await admin.from('item_log')
    .select('receipt_date, restaurant, vendor, buyer, canonical, name, qty, unit, unit_price, line_total')
    .order('receipt_date', { ascending: false }).limit(1500);
  if (error) return bad('Could not load the purchase log.', 500);

  const lines = (rows || []).map(r => [r.receipt_date, r.restaurant, r.vendor, r.buyer, r.canonical, r.name, r.qty ?? '', r.unit ?? '', r.unit_price ?? '', r.line_total ?? ''].join(' | '));
  const today = new Date().toLocaleDateString('en-CA', { timeZone: 'America/New_York' });

  const system = `You help managers of a group of seafood restaurants decide what to order and from whom, using their purchase log. Today is ${today}.

Purchase log, newest first, one line per item:
date | restaurant | vendor | bought by | item | as printed | qty | unit | unit price | line total
${lines.join('\n') || '(empty: no receipts have been added yet)'}

How to answer:
- Use only this log. If it has nothing on the item, say so plainly.
- Name who bought it, where, from which vendor, when, and the unit price. Point out the cheapest option and the most recent one, and flag price changes.
- Treat different units (CS vs LB) as different prices; don't compare them directly.
- Be brief. Plain text, no markdown tables or headings. Reply in the language the manager writes in.`;

  try {
    const msg = await anthropic.messages.create({ model: MODEL, max_tokens: 1500, system, messages: turns });
    return Response.json({ text: textOf(msg) });
  } catch (e) {
    console.error('ask failed', e);
    return bad('Could not get an answer right now. Try again in a minute.', 502);
  }
}
