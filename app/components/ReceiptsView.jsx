'use client';
import { money, fmtDate } from '@/lib/util';

export default function ReceiptsView({ receipts, thumbs, restName, personName, onOpen }) {
  if (!receipts.length) return <ul className="list"><li className="empty"><strong>No receipts yet</strong>Photos you add are kept here with everything read from them.</li></ul>;
  return (
    <ul className="list">
      {receipts.map(r => (
        <li key={r.id} className="rc" tabIndex={0} onClick={() => onOpen(r.id)} onKeyDown={e => e.key === 'Enter' && onOpen(r.id)}>
          {thumbs[r.image_paths?.[0]] ? <img className="th" src={thumbs[r.image_paths[0]]} alt="" loading="lazy" /> : <div className="th" />}
          <div>
            <div className="v">{r.vendor}</div>
            <div className="s">{restName(r.restaurant_id)}  {personName(r.buyer_id)}  {fmtDate(r.receipt_date)}</div>
            <div className="s">{r.receipt_items?.[0]?.count ?? 0} items</div>
          </div>
          <div className="price">{money(r.total)}</div>
        </li>
      ))}
    </ul>
  );
}
