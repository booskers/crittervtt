// Homebase server: run your own Critter backend.
//   node server.mjs [--port 8787] [--data ./homebase-data] [--www ../app/www] [--autosave-minutes 10]
// It keeps every table in files under --data, pushes changes to everyone over WebSockets, and (if --www points at the
// built app) also serves Critter itself, so people can play in a browser at http://your-address:8787.
import { createServer } from 'node:http';
import { readFile, writeFile, mkdir, rename, rm, readdir } from 'node:fs/promises';
import { existsSync, statSync } from 'node:fs';
import { join, normalize, extname, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash, timingSafeEqual } from 'node:crypto';
import { WebSocketServer } from 'ws';
import { ddbRequest } from './ddb.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const arg = (name, d) => { const i = process.argv.indexOf('--' + name); return i > 0 ? process.argv[i + 1] : process.env['HOMEBASE_' + name.toUpperCase()] || d; };
const PORT = +arg('port', 8787);
const DATA = resolve(arg('data', join(here, 'homebase-data')));
const WWW = resolve(arg('www', join(here, '..', 'app', 'www')));
const MAX_DOC = 900 * 1024;
await mkdir(DATA, { recursive: true });
// uploaded music, in pieces: audio/<lobby>-<track>-<n>, one file each, never pushed, only fetched
const AUDIO = join(DATA, 'audio');
await mkdir(AUDIO, { recursive: true });
const isAudio = p => typeof p === 'string' && /^audio\/[A-Za-z0-9]+-[A-Za-z0-9]+-\d+$/.test(p);
const audioFile = p => join(AUDIO, p.slice(6) + '.json');

/* ---------- storage: one JSON file per scope, written a moment after it changes ---------- */
// a scope is what clients subscribe to: "g" (profiles), "L<code>" (a lobby) or "u<uid>" (one player's private data)
const scopeOf = path => { const s = path.split('/'); return s[0] === 'players' ? 'g' : s[0] === 'lobbies' && s[1] ? 'L' + s[1] : s[0] === 'data' && s[1] === 'users' && s[2] ? 'u' + s[2] : null; };
const validPath = p => typeof p === 'string' && p.length < 400 && /^[\w-]+(\/[\w-]+)*$/.test(p);
const validId = s => typeof s === 'string' && /^[\w-]{1,80}$/.test(s);
const scopes = new Map(), saveT = new Map();
const fileOf = scope => join(DATA, encodeURIComponent(scope) + '.json');
async function scopeData(scope) {
  let m = scopes.get(scope);
  if (!m) {
    m = new Map();
    try { for (const [p, d] of Object.entries(JSON.parse(await readFile(fileOf(scope), 'utf8')))) m.set(p, d); } catch {}
    if (!scopes.has(scope)) scopes.set(scope, m); else m = scopes.get(scope);
  }
  return m;
}
function saveSoon(scope) {
  clearTimeout(saveT.get(scope));
  saveT.set(scope, setTimeout(async () => {
    saveT.delete(scope);
    const tmp = fileOf(scope) + '.tmp';
    await writeFile(tmp, JSON.stringify(Object.fromEntries(scopes.get(scope) || [])));
    await rename(tmp, fileOf(scope));
  }, 800));
}

/* ---------- autosaves ---------- */
// a lobby that changed is saved at most every 10 minutes, under --data/saves/<lobby>/. A save is a list of its documents'
// fingerprints; each document's content is kept once however many saves share it, so a background picture costs its size once.
// Kept: the 12 newest, the newest of each day for a week, and the 20 newest named ones (session start and end, by hand).
const SAVE_EVERY = Math.max(1, +arg('autosave-minutes', 10) || 10) * 60 * 1000, KEEP_RECENT = 12, KEEP_DAYS = 7, KEEP_NAMED = 20;
const SAVES = join(DATA, 'saves');
const saveDir = scope => join(SAVES, encodeURIComponent(scope));
const dirty = new Set();
let saveIdx = new Map();   // scope -> [{ id, ts, label, n, size, sig, man }]
async function savesOf(scope) {
  if (!saveIdx.has(scope)) { let list = []; try { list = JSON.parse(await readFile(join(saveDir(scope), 'index.json'), 'utf8')); } catch {} saveIdx.set(scope, list); }
  return saveIdx.get(scope);
}
async function writeSaves(scope) { const f = join(saveDir(scope), 'index.json'); await writeFile(f + '.tmp', JSON.stringify(saveIdx.get(scope) || [])); await rename(f + '.tmp', f); }
const fp = s => hash(s).slice(0, 24);
async function snapshot(scope, label) {
  const data = await scopeData(scope); if (!data.size) return null;
  const list = await savesOf(scope), last = list[0], prev = last ? last.man : {}, man = {};
  await mkdir(join(saveDir(scope), 'b'), { recursive: true });
  let size = 0;
  for (const [p, d] of data) {
    const s = JSON.stringify(d), h = fp(s); man[p] = h; size += s.length;
    const f = join(saveDir(scope), 'b', h + '.json');
    if (prev[p] !== h && !existsSync(f)) await writeFile(f, s);
  }
  const sig = fp(JSON.stringify(man));
  if (!label && last && last.sig === sig) return null;
  const id = (list.reduce((m, x) => Math.max(m, x.id), 0) || 0) + 1;
  list.unshift({ id, ts: Date.now(), label: label || null, n: data.size, size, sig, man });
  // what's kept
  const keep = new Set(), days = new Set(), now = Date.now();
  list.filter(r => !r.label).slice(0, KEEP_RECENT).forEach(r => keep.add(r.id));
  list.filter(r => r.label).slice(0, KEEP_NAMED).forEach(r => keep.add(r.id));
  for (const r of list) if (now - r.ts < KEEP_DAYS * 864e5) { const d = Math.floor(r.ts / 864e5); if (!days.has(d)) { days.add(d); keep.add(r.id); } }
  const kept = list.filter(r => keep.has(r.id));
  if (kept.length < list.length) {
    saveIdx.set(scope, kept);
    const used = new Set(kept.flatMap(r => Object.values(r.man)));
    for (const f of await readdir(join(saveDir(scope), 'b'))) if (!used.has(f.replace(/\.json$/, ''))) await rm(join(saveDir(scope), 'b', f), { force: true });
  }
  await writeSaves(scope);
  return id;
}
async function restoreSave(scope, id) {
  const row = (await savesOf(scope)).find(r => r.id === id); if (!row) return false;
  await snapshot(scope, 'Before rewinding');
  const data = await scopeData(scope), out = [];
  for (const p of [...data.keys()]) if (!(p in row.man)) { data.delete(p); out.push({ p, d: null }); }
  for (const [p, h] of Object.entries(row.man)) {
    let s; try { s = await readFile(join(saveDir(scope), 'b', h + '.json'), 'utf8'); } catch { continue; }
    if (data.has(p) && JSON.stringify(data.get(p)) === s) continue;
    const d = JSON.parse(s); data.set(p, d); out.push({ p, d });
  }
  saveSoon(scope);
  for (const ws of subs.get(scope) || []) for (const c of out) send(ws, { t: 'chg', scope, ...c });
  return true;
}
setInterval(async () => {
  const list = [...dirty]; dirty.clear();
  for (const scope of list) { try { await snapshot(scope, ''); } catch (e) { console.error(e); } }
}, SAVE_EVERY);
const isHostOf = (data, code, uid) => { const d = data.get('lobbies/' + code); return !!d && (d.owner === uid || (d.roles && d.roles[uid] === 'co')); };
// the lobby document itself (lobbies/<code>) says who owns the table. Its creator becomes the owner, the owner never
// changes, only the owner and co-owners change who's a co-owner, and only the owner deletes it.
const isLobbyRoot = path => /^lobbies\/[\w-]+$/.test(path);
function guardLobbyRoot(data, path, uid, op, d) {
  const cur = data.get(path), code = path.slice(8);
  if (!cur || !cur.owner) return op === 'delete' ? d : { ...d, owner: uid };
  if (op === 'delete') return cur.owner === uid ? d : undefined;
  const out = { ...d, owner: cur.owner };
  if (!isHostOf(data, code, uid)) { if (cur.roles !== undefined) out.roles = cur.roles; else delete out.roles; }
  return out;
}
/* ---------- fair use: one client can't swamp the server ---------- */
// Each connection gets token buckets: messages wait (not dropped) when one runs dry, so a big import just takes longer.
// Each address also has a shared bucket and a daily cap on writes, since anyone can open many connections.
const LIMITS = { msg: [60, 400], write: [30, 600], sub: [2, 40] };   // [per second, burst]
const IP_LIMITS = { msg: [400, 4000], write: [40, 2000] };   // a whole table can share one home connection
const IP_SOCKETS = 40, IP_WRITES_PER_DAY = 40000, MAX_QUEUE = 3000;
const MAX_LOBBY_BYTES = 64 * 1024 * 1024, MAX_LOBBY_DOCS = 20000;
const bucket = ([rate, burst]) => ({ rate, burst, n: burst, t: Date.now() });
function take(b, cost) {
  const now = Date.now(); b.n = Math.min(b.burst, b.n + (now - b.t) / 1000 * b.rate); b.t = now;
  b.n -= cost; return b.n >= 0 ? 0 : Math.ceil(-b.n / b.rate * 1000);
}
const sleep = ms => new Promise(r => setTimeout(r, ms));
// --trust-proxy: behind a reverse proxy (nginx, Caddy, a tunnel), the player's address is in X-Forwarded-For
const TRUST_PROXY = process.argv.includes('--trust-proxy') || process.env.HOMEBASE_TRUST_PROXY === '1';
const addrOf = req => (TRUST_PROXY && String(req.headers['x-forwarded-for'] || '').split(',')[0].trim()) || req.socket.remoteAddress || 'local';
const ips = new Map();
function ipOf(addr) {
  let x = ips.get(addr);
  if (!x) { x = { sockets: 0, msg: bucket(IP_LIMITS.msg), write: bucket(IP_LIMITS.write), day: 0, writes: 0 }; ips.set(addr, x); }
  const d = Math.floor(Date.now() / 864e5); if (x.day !== d) { x.day = d; x.writes = 0; }
  return x;
}
async function throttle(ws, m) {
  const ip = ipOf(ws.ip);
  const kind = m.t === 'write' ? 'write' : m.t === 'sub' ? 'sub' : 'msg';
  const cost = kind === 'write' ? Math.max(1, Math.min(100, Array.isArray(m.ops) ? m.ops.length : 1)) : 1;
  for (let wait = 1; wait > 0;) {
    wait = Math.max(take(ws.rl[kind], cost), kind === 'sub' ? 0 : take(ip[kind], cost));
    if (wait > 0) { ws.rl[kind].n += cost; if (kind !== 'sub') ip[kind].n += cost; await sleep(Math.min(wait, 2000)); }
  }
  if (kind === 'write') ip.writes += cost;
}
const sizes = new Map();
async function scopeSize(scope) {
  let n = sizes.get(scope);
  if (n === undefined) { n = 0; for (const [p, d] of await scopeData(scope)) n += p.length + JSON.stringify(d).length; sizes.set(scope, n); }
  return n;
}

/* ---------- who's who: a player id with a secret key, remembered on first use ---------- */
const AUTH_FILE = join(DATA, 'players.auth.json');
let auth = {}; try { auth = JSON.parse(await readFile(AUTH_FILE, 'utf8')); } catch {}
const hash = s => createHash('sha256').update(s).digest('hex');
async function checkAuth(uid, key) {
  if (!validId(uid) || typeof key !== 'string' || key.length < 16 || key.length > 200) return false;
  const h = hash(key);
  if (!auth[uid]) { auth[uid] = h; await writeFile(AUTH_FILE, JSON.stringify(auth)); return true; }
  return auth[uid].length === h.length && timingSafeEqual(Buffer.from(auth[uid]), Buffer.from(h));
}
const mayWrite = (uid, path) => { const s = path.split('/'); return s[0] === 'players' ? s.length === 2 && s[1] === uid : s[0] === 'data' ? s[1] === 'users' && s[2] === uid : s[0] === 'lobbies'; };
const mayRead = (uid, scope) => scope === 'g' || scope[0] === 'L' || scope === 'u' + uid;

/* ---------- connections ---------- */
const subs = new Map();      // scope -> Set(ws)
const rooms = new Map();     // room -> Map(peer -> { ws, by, presence })
const send = (ws, m) => { if (ws.readyState === 1) ws.send(JSON.stringify(m)); };
const peersOf = room => [...(rooms.get(room) || new Map())].map(([peer, x]) => ({ peer, by: x.by, presence: x.presence }));
const peerT = new Map();
function announcePeers(room) {
  if (peerT.has(room)) return;
  peerT.set(room, setTimeout(() => { peerT.delete(room); const list = peersOf(room); for (const [, x] of rooms.get(room) || []) send(x.ws, { t: 'peers', room, peers: list }); }, 40));
}
async function handle(ws, m) {
  if (m.t === 'hello') { ws.uid = (await checkAuth(m.uid, m.key)) ? m.uid : null; send(ws, { t: 'hello', ok: !!ws.uid }); if (!ws.uid) ws.close(4001, 'wrong key'); return; }
  if (!ws.uid) return;
  const ack = (extra) => m.rid && send(ws, { t: 'ack', rid: m.rid, ...extra });
  switch (m.t) {
    case 'sub': {
      if (typeof m.scope !== 'string' || !(m.scope === 'g' || validId(m.scope.slice(1))) || !mayRead(ws.uid, m.scope)) return ack({ error: 'not allowed' });
      if (!subs.has(m.scope)) subs.set(m.scope, new Set()); subs.get(m.scope).add(ws); ws.scopes.add(m.scope);
      const data = await scopeData(m.scope);
      send(ws, { t: 'snap', scope: m.scope, docs: [...data].map(([p, d]) => ({ p, d })) });
      return;
    }
    case 'unsub': { if (typeof m.scope === 'string') unsubscribe(ws, m.scope); return; }
    case 'get': {
      if (isAudio(m.path)) { try { return ack({ exists: true, data: JSON.parse(await readFile(audioFile(m.path), 'utf8')) }); } catch { return ack({ exists: false }); } }
      if (!validPath(m.path)) return ack({ error: 'bad path' });
      const scope = scopeOf(m.path); if (!scope || !mayRead(ws.uid, scope)) return ack({ error: 'not allowed' });
      const d = (await scopeData(scope)).get(m.path);
      return ack({ exists: d !== undefined, data: d });
    }
    case 'write': {
      const ops = Array.isArray(m.ops) ? m.ops.slice(0, 100) : [];
      for (const op of ops) if (!op || !(isAudio(op.path) || (validPath(op.path) && mayWrite(ws.uid, op.path) && scopeOf(op.path)))) return ack({ error: 'not allowed: ' + (op && op.path) });
      if (ipOf(ws.ip).writes > IP_WRITES_PER_DAY) return ack({ error: 'quota: this address has made too many changes today; try again tomorrow' });
      for (const op of ops) {
        if (isAudio(op.path)) {
          if (op.op === 'delete') { await rm(audioFile(op.path), { force: true }); continue; }
          const d = op.data && typeof op.data === 'object' ? op.data : {};
          if (JSON.stringify(d).length > 300 * 1024) return ack({ error: 'too large' });
          await writeFile(audioFile(op.path), JSON.stringify(d)); continue;
        }
        const scope = scopeOf(op.path), data = await scopeData(scope);
        const old = data.get(op.path), oldLen = old === undefined ? 0 : op.path.length + JSON.stringify(old).length;
        let d = null;
        if (op.op !== 'delete') {
          d = op.data && typeof op.data === 'object' ? op.data : {};
          if (op.op === 'update') d = { ...(old || {}), ...d };
          if (isLobbyRoot(op.path)) d = guardLobbyRoot(data, op.path, ws.uid, op.op, d);
          const len = JSON.stringify(d).length;
          if (len > MAX_DOC) return ack({ error: 'too large' });
          const size = (await scopeSize(scope)) - oldLen + op.path.length + len;
          if (scope[0] === 'L' && size > oldLen && (size > MAX_LOBBY_BYTES || (old === undefined && data.size >= MAX_LOBBY_DOCS))) return ack({ error: 'quota: this table is full (64 MB). Remove pictures or Library entries to make room.' });
          data.set(op.path, d); sizes.set(scope, size);
        } else {
          if (isLobbyRoot(op.path) && guardLobbyRoot(data, op.path, ws.uid, 'delete', true) === undefined) return ack({ error: 'not allowed: only the owner can close this table' });
          data.delete(op.path); if (sizes.has(scope)) sizes.set(scope, sizes.get(scope) - oldLen);
        }
        saveSoon(scope); if (scope[0] === 'L') dirty.add(scope);
        for (const s of subs.get(scope) || []) send(s, { t: 'chg', scope, p: op.path, d });
      }
      return ack({ ok: true });
    }
    // autosaves, for the lobby owner and co-owners: list them, save now (named), and rewind to one
    case 'saves': case 'savenow': case 'restore': {
      if (typeof m.scope !== 'string' || m.scope[0] !== 'L' || !validId(m.scope.slice(1))) return ack({ error: 'bad lobby' });
      if (!isHostOf(await scopeData(m.scope), m.scope.slice(1), ws.uid)) return ack({ error: 'not allowed' });
      if (m.t === 'saves') return ack({ saves: (await savesOf(m.scope)).slice(0, 60).map(({ man, sig, ...r }) => r) });
      if (m.t === 'savenow') return ack({ id: await snapshot(m.scope, String(m.label || 'Saved by hand').slice(0, 80)) });
      return ack(await restoreSave(m.scope, Number(m.id)) ? { ok: true } : { error: 'no such save' });
    }
    case 'join': {
      if (!validId(m.room) || !validId(m.peer)) return;
      // a peer id belongs to the player who took it first (the same player may take it back after a reconnect)
      const taken = rooms.get(m.room)?.get(m.peer);
      if (taken && taken.ws !== ws) { if (taken.by !== ws.uid) return; taken.ws.rooms?.delete(m.room); }
      if (ws.rooms.size >= 8 && !ws.rooms.has(m.room)) return;
      if (!rooms.has(m.room)) rooms.set(m.room, new Map());
      rooms.get(m.room).set(m.peer, { ws, by: ws.uid, presence: m.presence || {} }); ws.rooms.set(m.room, m.peer);
      return announcePeers(m.room);
    }
    case 'presence': {
      const p = rooms.get(m.room)?.get(m.peer); if (!p || p.ws !== ws) return;
      if (JSON.stringify(m.presence || {}).length > 20000) return;
      p.presence = m.presence || {}; return announcePeers(m.room);
    }
    case 'emit': {
      const r = rooms.get(m.room); if (!r || r.get(m.peer)?.ws !== ws || typeof m.topic !== 'string') return;
      const msg = { t: 'evt', room: m.room, topic: m.topic, data: m.data ?? null, by: ws.uid, peer: m.peer };
      if (JSON.stringify(msg).length > 60000) return;
      for (const [, x] of r) send(x.ws, msg);
      return ack({ ok: true });
    }
    case 'leave': { leaveRoom(ws, m.room); return; }
  }
}
// a scope nobody listens to any more is dropped from memory once it's on disk, so only open tables use memory
function unsubscribe(ws, scope) {
  ws.scopes.delete(scope);
  const set = subs.get(scope); if (!set) return;
  set.delete(ws);
  if (set.size || scope === 'g') return;
  subs.delete(scope);
  const drop = () => { if (subs.has(scope)) return; if (saveT.has(scope)) { setTimeout(drop, 2000); return; } scopes.delete(scope); sizes.delete(scope); };
  setTimeout(drop, 2000);
}
function leaveRoom(ws, room) {
  const peer = ws.rooms.get(room); if (!peer) return;
  ws.rooms.delete(room); const r = rooms.get(room); if (r) { r.delete(peer); if (!r.size) rooms.delete(room); else announcePeers(room); }
}

/* ---------- http: health check, and the app itself when it's there ---------- */
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.json': 'application/json', '.css': 'text/css', '.png': 'image/png', '.svg': 'image/svg+xml', '.ico': 'image/x-icon' };
const server = createServer(async (req, res) => {
  const url = new URL(req.url, 'http://x');
  res.setHeader('access-control-allow-origin', '*');
  if (url.pathname === '/health' || url.pathname === '/api/health') { res.setHeader('content-type', 'application/json'); res.end(JSON.stringify({ ok: true, service: 'homebase', players: [...wss.clients].length })); return; }
  // D&D Beyond imports, for a lobby's owner and co-owners (see ddb.mjs); sent as text so browsers skip a preflight
  if (url.pathname === '/ddb' && req.method === 'POST') {
    res.setHeader('content-type', 'application/json');
    const reply = (o, status = 200) => { res.statusCode = status; res.end(JSON.stringify(o)); };
    let body = '';
    for await (const c of req) { body += c; if (body.length > 20000) return reply({ error: 'too large' }, 413); }
    if (take(ipOf(addrOf(req)).msg, 30) > 0) return reply({ error: 'Too many requests; wait a moment.' }, 429);
    let m; try { m = JSON.parse(body); } catch { return reply({ error: 'bad request' }, 400); }
    if (!validId(m.uid) || !auth[m.uid] || !(await checkAuth(m.uid, m.key))) return reply({ error: 'not allowed' }, 403);
    if (typeof m.scope !== 'string' || m.scope[0] !== 'L' || !validId(m.scope.slice(1)) || !isHostOf(await scopeData(m.scope), m.scope.slice(1), m.uid)) return reply({ error: 'Only the lobby owner and co-owners can import from D&D Beyond.' }, 403);
    try { return reply({ data: await ddbRequest(m) }); } catch (e) { return reply({ error: String((e && e.message) || e).slice(0, 300) }, 502); }
  }
  if (!existsSync(WWW)) { res.setHeader('content-type', 'text/plain; charset=utf-8'); res.end('Homebase is running. Connect the Critter app to this address.'); return; }
  let p = decodeURIComponent(url.pathname); if (p.endsWith('/')) p += 'index.html';
  const file = normalize(join(WWW, p));
  if (!file.startsWith(WWW) || !existsSync(file) || !statSync(file).isFile()) { res.statusCode = 404; res.end('Not found'); return; }
  res.setHeader('content-type', TYPES[extname(file)] || 'application/octet-stream');
  res.end(await readFile(file));
});
const wss = new WebSocketServer({ server, path: '/ws', maxPayload: 2 * 1024 * 1024 });
wss.on('connection', (ws, req) => {
  ws.ip = addrOf(req);
  const ip = ipOf(ws.ip);
  if (ip.sockets >= IP_SOCKETS) { ws.close(4029, 'too many connections from this address'); return; }
  ip.sockets++;
  ws.scopes = new Set(); ws.rooms = new Map(); ws.alive = true;
  ws.rl = { msg: bucket(LIMITS.msg), write: bucket(LIMITS.write), sub: bucket(LIMITS.sub) };
  ws.on('pong', () => { ws.alive = true; });
  // one message at a time per connection, so nothing sent right after "hello" arrives before the player is known
  let chain = Promise.resolve(), queued = 0;
  ws.on('message', raw => {
    let m; try { m = JSON.parse(raw); } catch { return; }
    if (++queued > MAX_QUEUE) { ws.close(4008, 'too many messages'); return; }
    chain = chain.then(() => (m.t === 'hello' || m.t === 'ping' ? null : throttle(ws, m))).then(() => handle(ws, m)).catch(e => console.error(e)).finally(() => { queued--; });
  });
  ws.on('close', () => { ip.sockets--; for (const s of [...ws.scopes]) unsubscribe(ws, s); for (const r of [...ws.rooms.keys()]) leaveRoom(ws, r); });
});
// drop connections that stopped answering
setInterval(() => { for (const ws of wss.clients) { if (!ws.alive) { ws.terminate(); continue; } ws.alive = false; ws.ping(); } }, 30000);
server.listen(PORT, () => {
  console.log(`Homebase running on http://localhost:${PORT}`);
  console.log(`  data: ${DATA}`);
  console.log(existsSync(WWW) ? `  serving the Critter app from ${WWW}` : '  (no app folder found, so only the Critter app can connect)');
});
