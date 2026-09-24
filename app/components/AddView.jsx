'use client';
import { useEffect, useRef, useState } from 'react';
import { supabase, api } from '@/lib/supabase-browser';
import { money, num, localISO, shrink } from '@/lib/util';
import RestaurantPicker from './RestaurantPicker';

const blank = () => ({ name: '', canonical: '', sku: '', qty: null, unit: '', unit_price: null, line_total: null });
const MAX_PHOTOS = 6;

export default function AddView({ me, profiles, restaurants, canon, vendors, editing, onAddRestaurant, onSaved, onCancelEdit }) {
  const [restaurantId, setRestaurantId] = useState(me.restaurant_id || '');
  const [buyerId, setBuyerId] = useState(me.id);
  const [photos, setPhotos] = useState([]); // {blob, url, path?}
  const [draft, setDraft] = useState(null);
  const [reading, setReading] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');
  const review = useRef(null);

  // Load a receipt into the form when editing.
  useEffect(() => {
    if (!editing) return;
    setRestaurantId(editing.restaurant_id || '');
    setBuyerId(editing.buyer_id || me.id);
    setPhotos([]);
    setDraft({
      id: editing.id, image_paths: editing.image_paths || [], vendor: editing.vendor, receipt_date: editing.receipt_date,
      invoice_no: editing.invoice_no || '', total: editing.total,
      items: (editing.receipt_items || []).map(({ name, canonical, sku, qty, unit, unit_price, line_total }) => ({ name, canonical, sku, qty, unit, unit_price, line_total })),
    });
  }, [editing, me.id]);

  useEffect(() => { if (draft) review.current?.scrollIntoView({ behavior: 'smooth' }); }, [!!draft]);

  useEffect(() => {
    if (!reading) return;
    const t0 = Date.now(); setElapsed(0);
    const t = setInterval(() => setElapsed(Math.round((Date.now() - t0) / 1000)), 1000);
    return () => clearInterval(t);
  }, [reading]);

  async function addFiles(files) {
    const next = [...photos];
    for (const f of files) {
      if (next.length >= MAX_PHOTOS) { setMsg(`Up to ${MAX_PHOTOS} photos per receipt.`); break; }
      const blob = await shrink(f);
      next.push({ blob, url: URL.createObjectURL(blob) });
    }
    setPhotos(next);
  }

  /** Upload any photo not yet in storage; returns all paths in order. */
  async function uploadPhotos() {
    const out = [];
    const next = [...photos];
    for (let i = 0; i < next.length; i++) {
      if (!next[i].path) {
        const path = `${me.id}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.jpg`;
        const { error } = await supabase.storage.from('receipts').upload(path, next[i].blob, { contentType: 'image/jpeg' });
        if (error) throw new Error('Photo upload failed: ' + error.message);
        next[i] = { ...next[i], path };
      }
      out.push(next[i].path);
    }
    setPhotos(next);
    return out;
  }

  async function read() {
    setReading(true); setMsg('');
    try {
      const paths = await uploadPhotos();
      const out = await api('/api/scan', { paths });
      const items = Array.isArray(out.items) ? out.items : [];
      setDraft({
        vendor: out.vendor || '', invoice_no: out.invoiceNo ? String(out.invoiceNo) : '', total: num(out.total),
        receipt_date: /^\d{4}-\d{2}-\d{2}$/.test(out.receiptDate || '') ? out.receiptDate : localISO(),
        items: items.map(it => ({
          name: String(it.name || ''), canonical: String(it.canonical || it.name || ''), sku: it.sku ? String(it.sku) : '',
          qty: num(it.qty), unit: it.unit ? String(it.unit) : '', unit_price: num(it.unitPrice), line_total: num(it.lineTotal),
        })),
      });
      if (!items.length) setMsg('No items found. Add them by hand, or retake the photo closer.');
    } catch (e) { setMsg(e.message); }
    setReading(false);
  }

  function reset() {
    photos.forEach(p => URL.revokeObjectURL(p.url));
    setPhotos([]); setDraft(null); setMsg(''); setBuyerId(me.id);
    if (editing) onCancelEdit();
  }

  const setField = (k, v) => setDraft(d => ({ ...d, [k]: v }));
  const setItem = (i, k, v) => setDraft(d => ({ ...d, items: d.items.map((x, j) => j === i ? { ...x, [k]: v } : x) }));

  async function save() {
    if (!restaurantId) return setMsg('Choose the restaurant first.');
    if (!draft.vendor?.trim()) return setMsg('Add the vendor name.');
    if (!draft.receipt_date) return setMsg('Add the receipt date.');
    setSaving(true); setMsg('');
    try {
      const newPaths = await uploadPhotos();
      const body = {
        restaurant_id: restaurantId, buyer_id: buyerId || null, vendor: draft.vendor.trim(), receipt_date: draft.receipt_date,
        invoice_no: draft.invoice_no?.trim() || null, total: num(draft.total),
        image_paths: [...(draft.image_paths || []), ...newPaths], updated_at: new Date().toISOString(),
      };
      let id = draft.id;
      if (id) {
        const { error } = await supabase.from('receipts').update(body).eq('id', id);
        if (error) throw error;
        const { error: e2 } = await supabase.from('receipt_items').delete().eq('receipt_id', id);
        if (e2) throw e2;
      } else {
        const { data, error } = await supabase.from('receipts').insert(body).select('id').single();
        if (error) throw error;
        id = data.id;
      }
      const items = draft.items.filter(x => (x.canonical || x.name || '').trim()).map((x, i) => {
        const qty = num(x.qty), up = num(x.unit_price);
        return {
          receipt_id: id, position: i, name: (x.name || x.canonical).trim(), canonical: (x.canonical || x.name).trim(),
          sku: x.sku || null, qty, unit: (x.unit || '').trim().toUpperCase() || null, unit_price: up,
          line_total: num(x.line_total) ?? (qty != null && up != null ? Math.round(qty * up * 100) / 100 : null),
        };
      });
      if (items.length) { const { error } = await supabase.from('receipt_items').insert(items); if (error) throw error; }
      photos.forEach(p => URL.revokeObjectURL(p.url));
      setPhotos([]); setDraft(null); setBuyerId(me.id);
      onSaved(draft.id ? 'Receipt updated.' : `Saved ${items.length} items.`);
    } catch (e) { setMsg('Could not save: ' + (e.message || e)); }
    setSaving(false);
  }

  const sum = draft ? draft.items.reduce((a, x) => a + (num(x.line_total) || 0), 0) : 0;
  const total = draft ? num(draft.total) : null;

  return (
    <section>
      <div className="panel">
        <h2>{editing ? 'Edit receipt' : 'New receipt'}</h2>
        <div className="grid2">
          <label className="f">Restaurant
            <RestaurantPicker restaurants={restaurants} value={restaurantId} onChange={setRestaurantId} onAdd={onAddRestaurant} />
          </label>
          <label className="f">Bought by
            <select value={buyerId} onChange={e => setBuyerId(e.target.value)}>
              {profiles.map(p => <option key={p.id} value={p.id}>{p.full_name || 'Unnamed'}{p.id === me.id ? ' (you)' : ''}</option>)}
            </select>
          </label>
        </div>

        {!editing && <>
          <div className="row" style={{ marginTop: 6 }}>
            <label className="btn" htmlFor="camIn">Take photo</label>
            <input className="file" id="camIn" type="file" accept="image/*" capture="environment" onChange={e => { addFiles([...e.target.files]); e.target.value = ''; }} />
            <label className="btn" htmlFor="libIn">Choose photos</label>
            <input className="file" id="libIn" type="file" accept="image/*" multiple onChange={e => { addFiles([...e.target.files]); e.target.value = ''; }} />
          </div>
          <p className="hint">Long receipt? Take one photo per section, top to bottom. Keep the paper flat and fill the frame.</p>
          <div className="thumbs">
            {photos.map((p, i) => (
              <figure key={p.url}>
                <img src={p.url} alt={`Photo ${i + 1}`} />
                <button aria-label="Remove photo" onClick={() => { URL.revokeObjectURL(p.url); setPhotos(photos.filter((_, j) => j !== i)); }}>×</button>
              </figure>
            ))}
          </div>
          <div className="row">
            <button className="btn primary" disabled={!photos.length || reading} onClick={read}>Read receipt</button>
            <button className="btn" disabled={reading} onClick={() => setDraft({ vendor: '', receipt_date: localISO(), invoice_no: '', total: null, items: [blank()] })}>Enter by hand</button>
          </div>
          {reading && <div className="working"><span className="dot" /><span>Reading the receipt… {elapsed}s</span></div>}
        </>}
        {msg && <p className="hint" style={{ color: 'var(--bad)' }}>{msg}</p>}
      </div>

      {draft && (
        <div className="panel" ref={review}>
          <h2>Check and save</h2>
          <div className="grid2">
            <label className="f">Vendor<input type="text" list="vendorList" value={draft.vendor || ''} onChange={e => setField('vendor', e.target.value)} /></label>
            <label className="f">Receipt date<input type="date" value={draft.receipt_date || ''} onChange={e => setField('receipt_date', e.target.value)} /></label>
            <label className="f">Invoice number<input type="text" value={draft.invoice_no || ''} onChange={e => setField('invoice_no', e.target.value)} /></label>
            <label className="f">Receipt total<input type="number" step="0.01" inputMode="decimal" value={draft.total ?? ''} onChange={e => setField('total', e.target.value)} /></label>
          </div>
          <datalist id="vendorList">{vendors.map(v => <option key={v} value={v} />)}</datalist>
          <datalist id="itemNames">{canon.map(v => <option key={v} value={v} />)}</datalist>

          {draft.items.map((it, i) => (
            <div className="ed" key={i}>
              <label className="nmf wide">Item<input type="text" list="itemNames" value={it.canonical ?? ''} onChange={e => setItem(i, 'canonical', e.target.value)} /></label>
              <button className="x" aria-label="Remove item" onClick={() => setDraft(d => ({ ...d, items: d.items.filter((_, j) => j !== i) }))}>×</button>
              <label className="wide">As printed<input type="text" value={it.name ?? ''} onChange={e => setItem(i, 'name', e.target.value)} /></label>
              <label>Qty<input type="number" step="any" inputMode="decimal" value={it.qty ?? ''} onChange={e => setItem(i, 'qty', e.target.value)} /></label>
              <label>Unit<input type="text" value={it.unit ?? ''} onChange={e => setItem(i, 'unit', e.target.value)} /></label>
              <label>Unit price<input type="number" step="0.01" inputMode="decimal" value={it.unit_price ?? ''} onChange={e => setItem(i, 'unit_price', e.target.value)} /></label>
              <label>Line total<input type="number" step="0.01" inputMode="decimal" value={it.line_total ?? ''} onChange={e => setItem(i, 'line_total', e.target.value)} /></label>
            </div>
          ))}
          <div className="row" style={{ marginTop: 12 }}>
            <button className="btn small" onClick={() => setDraft(d => ({ ...d, items: [...d.items, blank()] }))}>Add item</button>
            <span className="hint" style={{ margin: 0 }}>
              {draft.items.length > 0 && <>Items add up to {money(sum)}{total != null && Math.abs(total - sum) > 0.02 && <>, receipt says {money(total)} (tax and fees may explain it)</>}</>}
            </span>
          </div>
          <div className="row" style={{ marginTop: 18 }}>
            <button className="btn primary" onClick={save} disabled={saving}>{saving ? 'Saving…' : 'Save receipt'}</button>
            <button className="btn" onClick={reset} disabled={saving}>Discard</button>
          </div>
        </div>
      )}
    </section>
  );
}
