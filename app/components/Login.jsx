'use client';
import { useState } from 'react';
import { supabase } from '@/lib/supabase-browser';

export default function Login() {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  async function send(e) {
    e.preventDefault();
    setBusy(true); setErr('');
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: { shouldCreateUser: false, emailRedirectTo: window.location.origin },
    });
    setBusy(false);
    if (error) setErr(/signup|not allowed|not found/i.test(error.message) ? 'This email is not on the team yet. Ask your GM to invite you.' : error.message);
    else setSent(true);
  }

  return (
    <div className="center">
      <h1>Order Log</h1>
      {sent ? (
        <p>Check {email} for a sign-in link. Open it on this device.</p>
      ) : (
        <form className="stack" onSubmit={send}>
          <p>Sign in with your work email. We'll send you a link, no password needed.</p>
          <input type="text" inputMode="email" autoComplete="email" placeholder="you@example.com" value={email} onChange={e => setEmail(e.target.value)} required />
          <button className="btn primary" disabled={busy || !email.trim()}>{busy ? 'Sending…' : 'Send sign-in link'}</button>
          {err && <p style={{ color: 'var(--bad)' }}>{err}</p>}
        </form>
      )}
    </div>
  );
}
