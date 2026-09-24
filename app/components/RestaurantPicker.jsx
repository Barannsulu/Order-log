'use client';
import { useState } from 'react';

export default function RestaurantPicker({ restaurants, value, onChange, onAdd, placeholder = 'Choose restaurant' }) {
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);

  async function add() {
    if (!name.trim()) return;
    setBusy(true);
    const r = await onAdd(name.trim());
    setBusy(false);
    if (r) { onChange(r.id); setAdding(false); setName(''); }
  }

  return (
    <>
      <select value={adding ? '__new' : value} onChange={e => { if (e.target.value === '__new') setAdding(true); else { setAdding(false); onChange(e.target.value); } }}>
        <option value="">{placeholder}</option>
        {restaurants.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
        <option value="__new">Add a restaurant…</option>
      </select>
      {adding && (
        <div className="row" style={{ marginTop: 8 }}>
          <input type="text" placeholder="Restaurant name" value={name} onChange={e => setName(e.target.value)} style={{ flex: 1 }} autoFocus />
          <button type="button" className="btn small" onClick={add} disabled={busy || !name.trim()}>{busy ? 'Adding…' : 'Add restaurant'}</button>
        </div>
      )}
    </>
  );
}
