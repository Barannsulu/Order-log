'use client';
import { useMemo, useState } from 'react';
import { money, norm, daysAgo, fmtDate } from '@/lib/util';

function Spark({ vals }) {
  const w = 300, h = 44, p = 4, mn = Math.min(...vals), mx = Math.max(...vals), rng = (mx - mn) || 1;
  const pts = vals.map((v, i) => [p + i * (w - 2 * p) / (vals.length - 1), h - p - (v - mn) / rng * (h - 2 * p)]);
  const last = pts[pts.length - 1];
  return (
    <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" role="img" aria-label={`Price history from ${money(vals[0])} to ${money(vals[vals.length - 1])}`}>
      <polyline points={pts.map(q => q.join(',')).join(' ')} fill="none" stroke="var(--navy)" strokeWidth="2" vectorEffect="non-scaling-stroke" />
      <circle cx={last[0]} cy={last[1]} r="3.5" fill="var(--buoy)" />
    </svg>
  );
}

function Insight({ rows }) {
  const groups = new Map();
  for (const x of rows) {
    if (x.unit_price == null) continue;
    const k = (x.canonical || x.name) + '\u0000' + (x.unit || '');
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k).push(x);
  }
  const top = [...groups.entries()].sort((a, b) => b[1].length - a[1].length).slice(0, 3);
  if (!top.length) return null;
  const line = x => `  ${x.buyer || 'Someone'}, ${x.restaurant || ''}, ${x.vendor || ''}, ${fmtDate(x.receipt_date)}`;
  return (
    <div className="insight">
      {top.map(([k, xs]) => {
        const [name, unit] = k.split('\u0000');
        const byDate = [...xs].sort((a, b) => String(a.receipt_date).localeCompare(String(b.receipt_date)));
        const last = byDate[byDate.length - 1];
        const low = xs.reduce((m, x) => Number(x.unit_price) < Number(m.unit_price) ? x : m, xs[0]);
        return (
          <div className="grp" key={k}>
            <h3>{name}{unit && <span className="unit">  per {unit}</span>}</h3>
            <p><span className="k">Last</span><b>{money(last.unit_price)}</b>{line(last)}</p>
            {low !== last && <p><span className="k">Lowest</span><b>{money(low.unit_price)}</b>{line(low)}</p>}
            {byDate.length > 1 && <Spark vals={byDate.map(x => Number(x.unit_price))} />}
          </div>
        );
      })}
    </div>
  );
}

export default function SearchView({ items, restaurants, onOpen, empty }) {
  const [q, setQ] = useState('');
  const [vendor, setVendor] = useState('');
  const [rest, setRest] = useState('');
  const [days, setDays] = useState(0);
  const [sort, setSort] = useState('date');

  const vendors = useMemo(() => [...new Set(items.map(x => x.vendor).filter(Boolean))].sort(), [items]);

  const rows = useMemo(() => {
    let r = items;
    if (vendor) r = r.filter(x => x.vendor === vendor);
    if (rest) r = r.filter(x => x.restaurant_id === rest);
    if (days) { const cut = daysAgo(days); r = r.filter(x => String(x.receipt_date) >= cut); }
    const nq = norm(q).trim();
    if (nq) {
      const toks = nq.split(/\s+/);
      r = r.filter(x => { const hay = norm([x.canonical, x.name, x.sku, x.vendor, x.restaurant, x.buyer, x.invoice_no].join(' ')); return toks.every(t => hay.includes(t)); });
    }
    const up = x => x.unit_price == null ? null : Number(x.unit_price);
    r = [...r];
    if (sort === 'low') r.sort((a, b) => (up(a) ?? 1e12) - (up(b) ?? 1e12));
    else if (sort === 'high') r.sort((a, b) => (up(b) ?? -1) - (up(a) ?? -1));
    else if (sort === 'name') r.sort((a, b) => String(a.canonical).localeCompare(String(b.canonical)));
    else r.sort((a, b) => String(b.receipt_date).localeCompare(String(a.receipt_date)));
    return r;
  }, [items, q, vendor, rest, days, sort]);

  const shown = rows.slice(0, 200);

  return (
    <section>
      <div className="search">
        <input type="search" placeholder="Search item, vendor, restaurant or person" value={q} onChange={e => setQ(e.target.value)} aria-label="Search" />
      </div>
      <div className="filters">
        <select value={vendor} onChange={e => setVendor(e.target.value)} aria-label="Vendor">
          <option value="">All vendors</option>{vendors.map(v => <option key={v}>{v}</option>)}
        </select>
        <select value={rest} onChange={e => setRest(e.target.value)} aria-label="Restaurant">
          <option value="">All restaurants</option>{restaurants.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
        </select>
        <select value={days} onChange={e => setDays(+e.target.value)} aria-label="Date range">
          <option value={0}>Any date</option><option value={30}>Last 30 days</option><option value={90}>Last 90 days</option><option value={365}>Last 12 months</option>
        </select>
        <select value={sort} onChange={e => setSort(e.target.value)} aria-label="Sort">
          <option value="date">Newest first</option><option value="low">Lowest unit price</option><option value="high">Highest unit price</option><option value="name">Item name A–Z</option>
        </select>
      </div>
      {q.trim() && <Insight rows={rows} />}
      <ul className="list">
        {!items.length ? <li className="empty"><strong>No receipts yet</strong>{empty}</li>
          : !rows.length ? <li className="empty"><strong>Nothing matches</strong>Try a shorter word, or clear the filters.</li>
          : shown.map(x => (
            <li key={x.item_id} className="item" tabIndex={0} onClick={() => onOpen(x.receipt_id)} onKeyDown={e => e.key === 'Enter' && onOpen(x.receipt_id)}>
              <div>
                <div className="nm">{x.canonical}</div>
                {x.name && x.name !== x.canonical && <div className="raw">{x.name}</div>}
              </div>
              <div className="price">{money(x.unit_price)}<small>{x.unit ? 'per ' + x.unit : ''}</small></div>
              <div className="meta">
                <span><b>{x.vendor}</b></span><span>{x.restaurant}</span><span>{x.buyer || 'Someone'}</span><span>{fmtDate(x.receipt_date)}</span>
                {x.qty != null && <span>Qty {Number(x.qty)}</span>}
              </div>
            </li>
          ))}
        {rows.length > shown.length && <li className="more">Showing 200 of {rows.length}. Narrow the search to see the rest.</li>}
      </ul>
    </section>
  );
}
