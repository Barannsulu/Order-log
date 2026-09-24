import { createClient } from '@supabase/supabase-js';
import Anthropic from '@anthropic-ai/sdk';

export const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
);

export const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
export const MODEL = process.env.ANTHROPIC_MODEL || 'claude-sonnet-5';

/** Returns the signed-in user, or null. Only team members invited in Supabase can sign in. */
export async function getUser(req) {
  const token = (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '');
  if (!token) return null;
  const { data, error } = await admin.auth.getUser(token);
  return error ? null : data.user;
}

export function textOf(msg) {
  return (msg.content || []).filter(b => b.type === 'text').map(b => b.text).join('\n').trim();
}

/** Pull one JSON object out of a model reply, tolerating code fences or a stray sentence. */
export function parseJson(text) {
  const t = text.replace(/```(?:json)?/g, '').trim();
  try { return JSON.parse(t); } catch {}
  const a = t.indexOf('{'), b = t.lastIndexOf('}');
  if (a >= 0 && b > a) return JSON.parse(t.slice(a, b + 1));
  throw new Error('No JSON in reply');
}

export const bad = (msg, status = 400) => Response.json({ error: msg }, { status });
