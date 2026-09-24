'use client';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabase-browser';
import Login from './components/Login';
import Onboarding from './components/Onboarding';
import SearchView from './components/SearchView';
import ReceiptsView from './components/ReceiptsView';
import ReceiptDialog from './components/ReceiptDialog';
import AddView from './components/AddView';
import AskView from './components/AskView';

export default function Home() {
  const [session, setSession] = useState(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => { setSession(data.session); setReady(true); });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => sub.subscription.unsubscribe();
  }, []);

  if (!ready) return null;
  if (!session) return <Login />;
  return <App userId={session.user.id} />;
}

async function loadItems() {
  const all = [];
  for (let from = 0; from < 5000; from += 1000) {
    const { data, error } = await supabase.from('item_log').select('*')
      .order('receipt_date', { ascending: false }).range(from, from + 999);
    if (error || !data) break;
    all.push(...data);
    if (data.length < 1000) break;
  }
  return all;
}

function App({ userId }) {
  const [profiles, setProfiles] = useState([]);
  const [restaurants, setRestaurants] = useState([]);
  const [receipts, setReceipts] = useState([]);
  const [items, setItems] = useState([]);
  const [thumbs, setThumbs] = useState({});
  const [loaded, setLoaded] = useState(false);
  const [tab, setTab] = useState('search');
  const [openId, setOpenId] = useState(null);
  const [editing, setEditing] = useState(null);
  const [toast, setToast] = useState('');

  const load = useCallback(async () => {
    const [p, r, rc, it] = await Promise.all([
      supabase.from('profiles').select('id, full_name, restaurant_id').order('full_name'),
      supabase.from('restaurants').select('id, name').order('name'),
      supabase.from('receipts').select('id, vendor, receipt_date, total, restaurant_id, buyer_id, image_paths, receipt_items(count)')
        .order('receipt_date', { ascending: false }).order('created_at', { ascending: false }).limit(500),
      loadItems(),
    ]);
    setProfiles(p.data || []); setRestaurants(r.data || []); setReceipts(rc.data || []); setItems(it);
    setLoaded(true);
    const firsts = (rc.data || []).map(x => x.image_paths?.[0]).filter(Boolean);
    if (firsts.length) {
      const { data } = await supabase.storage.from('receipts').createSignedUrls(firsts, 3600);
      const m = {}; (data || []).forEach(d => { if (d.signedUrl) m[d.path] = d.signedUrl; });
      setThumbs(m);
    }
  }, []);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { if (!toast) return; const t = setTimeout(() => setToast(''), 3200); return () => clearTimeout(t); }, [toast]);

  const me = profiles.find(p => p.id === userId);
  const restName = useCallback(id => restaurants.find(r => r.id === id)?.name || '', [restaurants]);
  const personName = useCallback(id => profiles.find(p => p.id === id)?.full_name || 'Someone', [profiles]);
  const canon = useMemo(() => [...new Set(items.map(x => x.canonical))].sort(), [items]);
  const vendors = useMemo(() => [...new Set(items.map(x => x.vendor))].sort(), [items]);

  async function addRestaurant(name) {
    const { data, error } = await supabase.from('restaurants').insert({ name }).select('id, name').single();
    if (error) { setToast(error.code === '23505' ? 'That restaurant already exists.' : 'Could not add: ' + error.message); return null; }
    setRestaurants(rs => [...rs, data].sort((a, b) => a.name.localeCompare(b.name)));
    return data;
  }

  if (!loaded) return null;
  if (!me) return <div className="center"><h1>Order Log</h1><p>Your account isn't set up yet. Sign out and in again, or ask your GM.</p><button className="btn" onClick={() => supabase.auth.signOut()}>Sign out</button></div>;
  if (!me.full_name) return <Onboarding me={me} restaurants={restaurants} onAddRestaurant={addRestaurant} onDone={load} />;

  const go = t => { setTab(t); window.scrollTo(0, 0); };

  return (
    <>
      <header className="top">
        <h1>Order Log</h1>
        <span className="count">{receipts.length ? `${receipts.length} receipts` : ''}</span>
        <span className="who">{me.full_name}<button onClick={() => supabase.auth.signOut()}>Sign out</button></span>
      </header>
      <main>
        {tab === 'search' && <SearchView items={items} restaurants={restaurants} onOpen={setOpenId} empty="Add the first one from the Add tab. Every item on it becomes searchable here." />}
        {tab === 'receipts' && <ReceiptsView receipts={receipts} thumbs={thumbs} restName={restName} personName={personName} onOpen={setOpenId} />}
        {tab === 'add' && <AddView me={me} profiles={profiles} restaurants={restaurants} canon={canon} vendors={vendors} editing={editing}
          onAddRestaurant={addRestaurant} onCancelEdit={() => setEditing(null)}
          onSaved={m => { setToast(m); setEditing(null); load(); go('receipts'); }} />}
        {tab === 'ask' && <AskView sampleItem={canon[0]} />}
      </main>
      <nav className="tabs" aria-label="Sections">
        {[['search', 'Search'], ['receipts', 'Receipts'], ['add', 'Add'], ['ask', 'Ask']].map(([k, l]) => (
          <button key={k} aria-current={tab === k ? 'page' : undefined} onClick={() => { if (k !== 'add') setEditing(null); go(k); }}>{l}</button>
        ))}
      </nav>
      {openId && <ReceiptDialog id={openId} restName={restName} personName={personName} onClose={() => setOpenId(null)}
        onEdit={r => { setOpenId(null); setEditing(r); go('add'); }}
        onDeleted={() => { setOpenId(null); setToast('Receipt deleted.'); load(); }} />}
      {toast && <div id="toast" role="status" style={{ display: 'block' }}>{toast}</div>}
    </>
  );
}
