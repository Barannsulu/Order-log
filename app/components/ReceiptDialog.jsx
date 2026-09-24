'use client';
import { useEffect, useRef, useState } from 'react';
import { supabase } from '@/lib/supabase-browser';
import { money, fmtDate } from '@/lib/util';

export default function ReceiptDialog({ id, restName, personName, onClose, onEdit, onDeleted }) {
  const ref = useRef(null);
  const [r, setR] = useState(null);
  const [urls, setUrls] = useState([]);
  const [armed, setArmed] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    ref.current?.showModal();
    let live = true;
    (async () => {
      const { data } = await supabase.from('receipts').select('*, receipt_items(*)').eq('id', id).single();
      if (!live || !data) return;
      data.receipt_items.sort((a, b) => a.position - b.position);
      setR(data);
      if (data.image_paths?.length) {
        const { data: s } = await supabase.storage.from('receipts').createSignedUrls(data.image_paths, 3600);
        if (live) setUrls((s || []).map(x => x.signedUrl).filter(Boolean));
      }
    })();
    return () => { live = false; };
  }, [id]);

  async function del() {
    if (!armed) { setArmed(true); return; }
    setBusy(true);
    const { error } = await supabase.from('receipts').delete().eq('id', id);
    if (!error && r.image_paths?.length) await supabase.storage.from('receipts').remove(r.image_paths);
    setBusy(false);
    if (error) alert('Could not delete: ' + error.message); else onDeleted();
  }

  return (
    <dialog ref={ref} onClose={onClose}>
      <div className="dlg">
        {!r ? <p>Loading…</p> : <>
          <header><h2>{r.vendor}</h2><button className="btn small" onClick={() => ref.current.close()}>Close</button></header>
          <div className="s">{restName(r.restaurant_id)}, {personName(r.buyer_id)}, {fmtDate(r.receipt_date)}{r.invoice_no ? `, #${r.invoice_no}` : ''}</div>
          {urls.length > 0 && <div className="imgs">{urls.map(u => <a key={u} href={u} target="_blank" rel="noopener"><img src={u} alt="Receipt photo" /></a>)}</div>}
          <div className="tw"><table>
            <thead><tr><th>Item</th><th className="n">Qty</th><th>Unit</th><th className="n">Price</th><th className="n">Total</th></tr></thead>
            <tbody>{r.receipt_items.map(it => (
              <tr key={it.id}>
                <td><div>{it.canonical}</div>{it.name !== it.canonical && <div style={{ color: 'var(--muted)', fontSize: 13 }}>{it.name}</div>}</td>
                <td className="n">{it.qty ?? ''}</td><td>{it.unit}</td><td className="n">{money(it.unit_price)}</td><td className="n">{money(it.line_total)}</td>
              </tr>))}</tbody>
            <tfoot><tr><td colSpan={4}><b>Receipt total</b></td><td className="n"><b>{money(r.total)}</b></td></tr></tfoot>
          </table></div>
          <div className="row" style={{ marginTop: 16 }}>
            <button className="btn" onClick={() => onEdit(r)}>Edit</button>
            <button className="btn danger" onClick={del} disabled={busy}>{armed ? 'Tap again to delete' : 'Delete'}</button>
          </div>
        </>}
      </div>
    </dialog>
  );
}
