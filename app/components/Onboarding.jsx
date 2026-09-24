'use client';
import { useState } from 'react';
import { supabase } from '@/lib/supabase-browser';
import RestaurantPicker from './RestaurantPicker';

export default function Onboarding({ me, restaurants, onAddRestaurant, onDone }) {
  const [name, setName] = useState('');
  const [rest, setRest] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  async function save(e) {
    e.preventDefault();
    setBusy(true); setErr('');
    const { error } = await supabase.from('profiles').update({ full_name: name.trim(), restaurant_id: rest || null }).eq('id', me.id);
    setBusy(false);
    if (error) setErr(error.message); else onDone();
  }

  return (
    <div className="center">
      <h1>Welcome</h1>
      <form className="stack" onSubmit={save}>
        <p>Your name shows next to the receipts you add, so the team knows who bought what.</p>
        <input type="text" placeholder="Your name" value={name} onChange={e => setName(e.target.value)} required />
        <RestaurantPicker restaurants={restaurants} value={rest} onChange={setRest} onAdd={onAddRestaurant} placeholder="Your restaurant" />
        <button className="btn primary" disabled={busy || !name.trim()}>{busy ? 'Saving…' : 'Continue'}</button>
        {err && <p style={{ color: 'var(--bad)' }}>{err}</p>}
      </form>
    </div>
  );
}
