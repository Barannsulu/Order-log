'use client';
import { useEffect, useRef, useState } from 'react';
import { api } from '@/lib/supabase-browser';

export default function AskView({ sampleItem }) {
  const [msgs, setMsgs] = useState([]);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const end = useRef(null);

  useEffect(() => { end.current?.scrollIntoView({ block: 'end' }); }, [msgs, busy]);

  async function ask(q) {
    q = q.trim(); if (!q || busy) return;
    const next = [...msgs, { role: 'user', content: q }];
    setMsgs(next); setText(''); setBusy(true); setErr('');
    try {
      const { text: a } = await api('/api/ask', { messages: next });
      setMsgs([...next, { role: 'assistant', content: a }]);
    } catch (e) { setErr(e.message); }
    setBusy(false);
  }

  const chips = [`What did we last pay for ${sampleItem || 'coconut shrimp'}?`, 'Which vendor is cheapest for what we order most?', 'What did we buy this week?'];

  return (
    <section>
      {!msgs.length && <div className="chips">{chips.map(c => <button key={c} onClick={() => ask(c)}>{c}</button>)}</div>}
      <div className="chat">
        {msgs.map((m, i) => <div key={i} className={'msg ' + (m.role === 'user' ? 'u' : 'a')}>{m.content}</div>)}
        {busy && <div className="msg a"><span className="working" style={{ margin: 0 }}><span className="dot" />Checking the purchase log…</span></div>}
        {err && <div className="msg a err">{err}</div>}
        <div ref={end} />
      </div>
      <form className="ask" onSubmit={e => { e.preventDefault(); ask(text); }}>
        <textarea rows={1} placeholder="What are you ordering today?" value={text} onChange={e => setText(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); ask(text); } }} />
        <button className="btn primary" disabled={busy || !text.trim()}>Ask</button>
      </form>
    </section>
  );
}
