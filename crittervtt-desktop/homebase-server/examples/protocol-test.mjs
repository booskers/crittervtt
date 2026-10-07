// tests the Homebase protocol against a running hub (Cloudflare or this server): node examples/protocol-test.mjs http://localhost:8787
// (NOSTATS=1 for this server, which has no /stats). It makes a throwaway test table and drops it at the end.
const base = process.argv[2] || 'http://127.0.0.1:8799';
const sleep = ms => new Promise(r => setTimeout(r, ms));
const rand = n => [...crypto.getRandomValues(new Uint8Array(n))].map(b => 'abcdefghijklmnopqrstuvwxyz0123456789'[b % 36]).join('');
let failures = 0;
const check = (name, ok, extra = '') => { console.log((ok ? 'PASS ' : 'FAIL ') + name + (extra ? '  ' + extra : '')); if (!ok) failures++; };

function client(caps) {
  const ws = new WebSocket(base.replace(/^http/, 'ws') + '/ws'), got = [], waits = new Map(); let rid = 0;
  const uid = 'u' + rand(20), key = rand(40);
  ws.onmessage = ev => { const m = ev.data === '{"t":"pong"}' ? { t: 'pong' } : JSON.parse(ev.data); got.push(m); if (m.t === 'ack' && waits.has(m.rid)) { waits.get(m.rid)(m); waits.delete(m.rid); } };
  const ready = new Promise(r => { ws.onopen = () => { ws.send(JSON.stringify({ t: 'hello', uid, key, ...(caps ? { caps } : {}) })); r(); }; });
  const c = {
    uid, got, ws,
    send: m => ws.send(typeof m === 'string' ? m : JSON.stringify(m)),
    req: m => new Promise(r => { const id = ++rid; waits.set(id, r); ws.send(JSON.stringify({ ...m, rid: id })); }),
    ready: async () => { await ready; for (let i = 0; i < 50 && !got.some(m => m.t === 'hello'); i++) await sleep(50); },
    take: t => got.filter(m => m.t === t),
    clear: () => { got.length = 0; }
  };
  return c;
}

const code = 'T' + rand(5).toUpperCase(), scope = 'L' + code, room = 'lobby-' + code.toLowerCase();
const A = client(['pres', 'each']), B = client(['pres', 'each']), O = client(null);
await Promise.all([A.ready(), B.ready(), O.ready()]);
check('hello ok', [A, B, O].every(c => c.take('hello')[0]?.ok));

// presence: newer clients get just the one player, older ones the whole list; the sender gets nothing back
for (const c of [A, B, O]) c.send({ t: 'join', room, peer: 'p' + c.uid.slice(1, 9), presence: { n: c === O ? 'Old' : 'New' } });
await sleep(300); [A, B, O].forEach(c => c.clear());
A.send({ t: 'presence', room, peer: 'p' + A.uid.slice(1, 9), presence: { n: 'New', x: 10, y: 20 } });
await sleep(300);
check('pres reaches the newer client', B.take('pres').length === 1 && B.take('pres')[0].presence.x === 10 && B.take('peers').length === 0, JSON.stringify(B.got).slice(0, 120));
check('the older client gets the whole list', O.take('peers').length === 1 && O.take('pres').length === 0);
check('the sender gets nothing back', A.take('pres').length === 0 && A.take('peers').length === 0);

// writes: several in one message, one refused, the others through
A.send({ t: 'sub', scope }); await sleep(400);
const w = await A.req({ t: 'write', each: true, ops: [
  { op: 'set', path: `lobbies/${code}`, data: { owner: A.uid } },
  { op: 'set', path: `lobbies/${code}/shapes/s1`, data: { t: 'pen', x: 1 } },
  { op: 'set', path: `data/users/${B.uid}/secret`, data: { no: 1 } },
  { op: 'set', path: `lobbies/${code}/shapes/s2`, data: { t: 'pen', x: 2 } }
] });
check('batched write: refused one reported by index', w.ok && w.errs && w.errs[2] && !w.errs[0] && !w.errs[1] && !w.errs[3], JSON.stringify(w));
const g = await A.req({ t: 'get', path: `lobbies/${code}/shapes/s2` });
check('batched write: the others went through', g.exists && g.data.x === 2);
const old = await O.req({ t: 'write', ops: [{ op: 'set', path: `lobbies/${code}/shapes/s3`, data: { x: 3 } }, { op: 'set', path: `data/users/${A.uid}/x`, data: {} }] });
check('old all-or-nothing write still refuses the batch', !!old.error && !(await O.req({ t: 'get', path: `lobbies/${code}/shapes/s3` })).exists);

// keep-alive: answered with a pong
A.clear(); A.send('{"t":"ping"}'); await sleep(300);
check('ping gets a pong', A.take('pong').length === 1);

// autosaves in packs: save, change, rewind
const s1 = await A.req({ t: 'savenow', scope, label: 'test one' });
await A.req({ t: 'write', each: true, ops: [{ op: 'set', path: `lobbies/${code}/shapes/s1`, data: { t: 'pen', x: 99 } }, { op: 'delete', path: `lobbies/${code}/shapes/s2` }] });
const s2 = await A.req({ t: 'savenow', scope, label: 'test two' });
const list = await A.req({ t: 'saves', scope });
check('saves made', !!s1.id && !!s2.id && list.saves.length >= 2, JSON.stringify(list).slice(0, 160));
const r = await A.req({ t: 'restore', scope, id: s1.id });
const back1 = await A.req({ t: 'get', path: `lobbies/${code}/shapes/s1` }), back2 = await A.req({ t: 'get', path: `lobbies/${code}/shapes/s2` });
check('rewind puts both back', r.ok && back1.data?.x === 1 && back2.exists, JSON.stringify([r, back1.data, back2.exists]));

// the lan room: joined as "lan", reported as "lan", the real name refused
const L1 = client(['pres']), L2 = client(['pres']); await Promise.all([L1.ready(), L2.ready()]);
L1.send({ t: 'join', room: 'lan', peer: 'pl1' + rand(4), presence: { n: 'one' } }); L2.send({ t: 'join', room: 'lan', peer: 'pl2' + rand(4), presence: { n: 'two' } });
await sleep(300);
const lp = L2.take('peers').pop();
check('lan room shared, named "lan"', lp && lp.room === 'lan' && lp.peers.length >= 2, JSON.stringify(lp).slice(0, 160));
const bad = await L1.req({ t: 'emit', room: 'lan_' + 'x'.repeat(32), peer: 'x', topic: 'hi' });
check('a lan_ name is refused', bad.error === 'not allowed');

// stats (the Cloudflare hub only)
if (!process.env.NOSTATS) {
const st = await (await fetch(base + '/stats')).json();
check('stats', st.today && st.today.in > 0 && st.today.rowsW > 0 && Array.isArray(st.hours), JSON.stringify(st.today));

}
// clean up: drop the lobby
await A.req({ t: 'drop', scope });
for (const c of [A, B, O, L1, L2]) c.ws.close();
console.log(failures ? failures + ' FAILED' : 'all passed'); process.exit(failures ? 1 : 0);
