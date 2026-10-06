// Homebase on Cloudflare: the Homebase server as a Worker plus one Durable Object, on the free Workers plan.
// It speaks the same WebSocket protocol as homebase-server/server.mjs, so the Critter app connects to either.
// The Worker also serves the built app (../app/www), so people can play in a browser at the workers.dev address.
import { DurableObject } from 'cloudflare:workers';
import { ddbRequest } from './ddb.js';

const json = (o, status = 200) => new Response(JSON.stringify(o), { status, headers: { 'content-type': 'application/json', 'access-control-allow-origin': '*' } });

export default {
  async fetch(req, env) {
    const url = new URL(req.url);
    if (url.pathname === '/health' || url.pathname === '/api/health') return json({ ok: true, service: 'homebase', host: 'cloudflare' });
    if (url.pathname === '/ws') {
      if (req.headers.get('Upgrade') !== 'websocket') return new Response('Expected a WebSocket', { status: 426 });
      // every table lives in one Durable Object: plenty for a gaming group, and rooms and lobbies can see each other
      return env.HUB.get(env.HUB.idFromName('hub')).fetch(req);
    }
    // D&D Beyond imports for a lobby's owner and co-owners: the hub checks who's asking (see ddb.js)
    if (url.pathname === '/ddb' && req.method === 'POST') return env.HUB.get(env.HUB.idFromName('hub')).fetch(req);
    if (env.ASSETS) return env.ASSETS.fetch(req);
    return new Response('Homebase is running. Connect the Critter app to this address.', { headers: { 'content-type': 'text/plain; charset=utf-8' } });
  }
};

/* ---------- the rules, as in the self-hosted server ---------- */
// a scope is what clients subscribe to: "g" (profiles), "L<code>" (a lobby) or "u<uid>" (one player's private data)
const scopeOf = path => { const s = path.split('/'); return s[0] === 'players' ? 'g' : s[0] === 'lobbies' && s[1] ? 'L' + s[1] : s[0] === 'data' && s[1] === 'users' && s[2] ? 'u' + s[2] : null; };
const validPath = p => typeof p === 'string' && p.length < 400 && /^[\w-]+(\/[\w-]+)*$/.test(p);
const validId = s => typeof s === 'string' && /^[\w-]{1,80}$/.test(s);
const isAudio = p => typeof p === 'string' && /^audio\/[A-Za-z0-9]+-[A-Za-z0-9]+-\d+$/.test(p);
const mayWrite = (uid, path) => { const s = path.split('/'); return s[0] === 'players' ? s.length === 2 && s[1] === uid : s[0] === 'data' ? s[1] === 'users' && s[2] === uid : s[0] === 'lobbies'; };
const mayRead = (uid, scope) => scope === 'g' || scope[0] === 'L' || scope === 'u' + uid;
const MAX_DOC = 900 * 1024, SNAP_PART = 1024 * 1024;
const hex = async s => [...new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s)))].map(b => b.toString(16).padStart(2, '0')).join('');
// documents are stored under "<scope>\u0001<path>", so one scope is one range of the primary key
const SEP = '\u0001';
// autosaves: a lobby that changed is saved at most every 10 minutes. A save is a list of its documents' fingerprints;
// each document's content is stored once per lobby however many saves share it, so a background picture costs its size once.
// Kept: the 12 newest, the newest of each day for a week, and the 20 newest named ones (session start and end, by hand).
const SAVE_EVERY = 10 * 60 * 1000, KEEP_RECENT = 12, KEEP_DAYS = 7, KEEP_NAMED = 20;
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
/* ---------- fair use: one client can't use up the free plan for every table ---------- */
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

export class Hub extends DurableObject {
  constructor(ctx, env) {
    super(ctx, env);
    this.sql = ctx.storage.sql;
    this.sql.exec('CREATE TABLE IF NOT EXISTS docs (k TEXT PRIMARY KEY, data TEXT NOT NULL)');
    this.sql.exec('CREATE TABLE IF NOT EXISTS audio (id TEXT PRIMARY KEY, data TEXT NOT NULL)');
    this.sql.exec('CREATE TABLE IF NOT EXISTS auth (uid TEXT PRIMARY KEY, hash TEXT NOT NULL)');
    this.sql.exec('CREATE TABLE IF NOT EXISTS blobs (k TEXT PRIMARY KEY, data TEXT NOT NULL)');
    this.sql.exec('CREATE TABLE IF NOT EXISTS saves (id INTEGER PRIMARY KEY AUTOINCREMENT, scope TEXT NOT NULL, ts INTEGER NOT NULL, label TEXT, man TEXT NOT NULL, n INTEGER, size INTEGER, sig TEXT)');
    this.sql.exec('CREATE INDEX IF NOT EXISTS saves_scope ON saves (scope, ts)');
    this.sql.exec('CREATE TABLE IF NOT EXISTS dirty (scope TEXT PRIMARY KEY)');
    this.dirty = new Set(this.sql.exec('SELECT scope FROM dirty').toArray().map(r => r.scope));
    this.scopes = new Map();   // scope -> Map(path -> data), loaded on first use
    this.subs = new Map();     // scope -> Set(ws)
    this.rooms = new Map();    // room -> Map(peer -> { ws, by, presence })
    this.peerT = new Map();
    this.ips = new Map();      // address -> { sockets, msg, write, day, writes }
    this.sizes = new Map();    // scope -> bytes stored, for loaded scopes
  }

  ipOf(addr) {
    let x = this.ips.get(addr);
    if (!x) { x = { sockets: 0, msg: bucket(IP_LIMITS.msg), write: bucket(IP_LIMITS.write), day: 0, writes: 0 }; this.ips.set(addr, x); }
    const d = Math.floor(Date.now() / 864e5); if (x.day !== d) { x.day = d; x.writes = 0; }
    return x;
  }
  // waits until this connection (and its address) may send again
  async throttle(ws, m) {
    const ip = this.ipOf(ws.ip);
    const kind = m.t === 'write' ? 'write' : m.t === 'sub' ? 'sub' : 'msg';
    const cost = kind === 'write' ? Math.max(1, Math.min(100, Array.isArray(m.ops) ? m.ops.length : 1)) : 1;
    for (let wait = 1; wait > 0;) {
      wait = Math.max(take(ws.rl[kind], cost), kind === 'sub' ? 0 : take(ip[kind], cost));
      if (wait > 0) { ws.rl[kind].n += cost; if (kind !== 'sub') ip[kind].n += cost; await sleep(Math.min(wait, 2000)); }
    }
    if (kind === 'write') ip.writes += cost;
  }

  async fetch(req) {
    if (req && new URL(req.url).pathname === '/ddb') return this.ddb(req);
    const addr = req.headers.get('CF-Connecting-IP') || 'local', ip = this.ipOf(addr);
    if (ip.sockets >= IP_SOCKETS) return new Response('Too many connections from this address', { status: 429 });
    const [client, ws] = Object.values(new WebSocketPair());
    ws.accept();
    ws.uid = null; ws.scopeSet = new Set(); ws.roomMap = new Map(); ws.ip = addr; ip.sockets++;
    ws.rl = { msg: bucket(LIMITS.msg), write: bucket(LIMITS.write), sub: bucket(LIMITS.sub) };
    // one message at a time per connection, so nothing sent right after "hello" arrives before the player is known
    let chain = Promise.resolve(), queued = 0;
    ws.addEventListener('message', ev => {
      let m; try { m = JSON.parse(typeof ev.data === 'string' ? ev.data : new TextDecoder().decode(ev.data)); } catch { return; }
      if (++queued > MAX_QUEUE) { try { ws.close(4008, 'too many messages'); } catch {} return; }
      chain = chain.then(() => (m.t === 'hello' || m.t === 'ping' ? null : this.throttle(ws, m))).then(() => this.handle(ws, m)).catch(e => console.error(e)).finally(() => { queued--; });
    });
    let done = false;
    const gone = () => {
      if (done) return; done = true; ip.sockets--;
      for (const s of ws.scopeSet) this.unsubscribe(ws, s);
      for (const r of [...ws.roomMap.keys()]) this.leaveRoom(ws, r);
    };
    ws.addEventListener('close', gone); ws.addEventListener('error', gone);
    return new Response(null, { status: 101, webSocket: client });
  }
  // a scope nobody listens to any more is dropped from memory (the database keeps it), so only open tables use memory
  unsubscribe(ws, scope) {
    ws.scopeSet.delete(scope);
    const set = this.subs.get(scope); if (!set) return;
    set.delete(ws);
    if (!set.size) { this.subs.delete(scope); if (scope !== 'g') { this.scopes.delete(scope); this.sizes.delete(scope); } }
  }
  scopeSize(scope) {
    let n = this.sizes.get(scope);
    if (n === undefined) { n = 0; for (const [p, d] of this.scopeData(scope)) n += p.length + JSON.stringify(d).length; this.sizes.set(scope, n); }
    return n;
  }

  async ddb(req) {
    const body = await req.text();
    if (body.length > 20000) return json({ error: 'too large' }, 413);
    if (take(this.ipOf(req.headers.get('CF-Connecting-IP') || 'local').msg, 30) > 0) return json({ error: 'Too many requests; wait a moment.' }, 429);
    let m; try { m = JSON.parse(body); } catch { return json({ error: 'bad request' }, 400); }
    const known = validId(m.uid) && this.sql.exec('SELECT 1 FROM auth WHERE uid = ?', m.uid).toArray().length > 0;
    if (!known || !(await this.checkAuth(m.uid, m.key))) return json({ error: 'not allowed' }, 403);
    if (typeof m.scope !== 'string' || m.scope[0] !== 'L' || !validId(m.scope.slice(1)) || !isHostOf(this.scopeData(m.scope), m.scope.slice(1), m.uid)) return json({ error: 'Only the lobby owner and co-owners can import from D&D Beyond.' }, 403);
    try { return json({ data: await ddbRequest(m) }); } catch (e) { return json({ error: String((e && e.message) || e).slice(0, 300) }, 502); }
  }
  send(ws, m) { try { ws.send(JSON.stringify(m)); } catch {} }
  scopeData(scope) {
    let m = this.scopes.get(scope);
    if (!m) {
      m = new Map();
      for (const r of this.sql.exec('SELECT k, data FROM docs WHERE k > ? AND k < ?', scope + SEP, scope + '\u0002')) m.set(r.k.slice(scope.length + 1), JSON.parse(r.data));
      this.scopes.set(scope, m);
    }
    return m;
  }
  async checkAuth(uid, key) {
    if (!validId(uid) || typeof key !== 'string' || key.length < 16 || key.length > 200) return false;
    const h = await hex(key), row = this.sql.exec('SELECT hash FROM auth WHERE uid = ?', uid).toArray()[0];
    if (!row) { this.sql.exec('INSERT INTO auth (uid, hash) VALUES (?, ?)', uid, h); return true; }
    const a = new TextEncoder().encode(row.hash), b = new TextEncoder().encode(h);
    return a.length === b.length && crypto.subtle.timingSafeEqual(a, b);
  }
  announcePeers(room) {
    if (this.peerT.has(room)) return;
    this.peerT.set(room, setTimeout(() => {
      this.peerT.delete(room);
      const r = this.rooms.get(room); if (!r) return;
      const peers = [...r].map(([peer, x]) => ({ peer, by: x.by, presence: x.presence }));
      for (const [, x] of r) this.send(x.ws, { t: 'peers', room, peers });
    }, 40));
  }
  /* ---------- autosaves ---------- */
  async markDirty(scope) {
    if (scope[0] !== 'L' || this.dirty.has(scope)) return;
    this.dirty.add(scope); this.sql.exec('INSERT OR IGNORE INTO dirty (scope) VALUES (?)', scope);
    if (!(await this.ctx.storage.getAlarm())) await this.ctx.storage.setAlarm(Date.now() + SAVE_EVERY);
  }
  async alarm() {
    const list = [...this.dirty]; this.dirty.clear(); this.sql.exec('DELETE FROM dirty');
    for (const scope of list) { try { await this.snapshot(scope, ''); } catch (e) { console.error(e); } }
  }
  // saves a lobby as it is now; nothing is written when nothing changed since the last save (unless it is named)
  async snapshot(scope, label) {
    const data = this.scopeData(scope); if (!data.size) return null;
    const last = this.sql.exec('SELECT man, sig FROM saves WHERE scope = ? ORDER BY ts DESC LIMIT 1', scope).toArray()[0];
    const prev = last ? JSON.parse(last.man) : {}, man = {};
    let size = 0;
    for (const [p, d] of data) {
      const s = JSON.stringify(d), h = (await hex(s)).slice(0, 24); man[p] = h; size += s.length;
      if (prev[p] !== h) this.sql.exec('INSERT OR IGNORE INTO blobs (k, data) VALUES (?, ?)', scope + SEP + h, s);
    }
    const sig = (await hex(JSON.stringify(man))).slice(0, 24);
    if (!label && last && last.sig === sig) return null;
    this.sql.exec('INSERT INTO saves (scope, ts, label, man, n, size, sig) VALUES (?, ?, ?, ?, ?, ?, ?)', scope, Date.now(), label || null, JSON.stringify(man), data.size, size, sig);
    const id = this.sql.exec('SELECT last_insert_rowid() AS id').toArray()[0].id;
    this.prune(scope);
    return id;
  }
  prune(scope) {
    const rows = this.sql.exec('SELECT id, ts, label FROM saves WHERE scope = ? ORDER BY ts DESC', scope).toArray(), keep = new Set(), days = new Set(), now = Date.now();
    rows.filter(r => !r.label).slice(0, KEEP_RECENT).forEach(r => keep.add(r.id));
    rows.filter(r => r.label).slice(0, KEEP_NAMED).forEach(r => keep.add(r.id));
    for (const r of rows) if (now - r.ts < KEEP_DAYS * 864e5) { const d = Math.floor(r.ts / 864e5); if (!days.has(d)) { days.add(d); keep.add(r.id); } }
    const drop = rows.filter(r => !keep.has(r.id)); if (!drop.length) return;
    for (const r of drop) this.sql.exec('DELETE FROM saves WHERE id = ?', r.id);
    // content no save of this lobby points at any more
    const used = new Set();
    for (const r of this.sql.exec('SELECT man FROM saves WHERE scope = ?', scope)) for (const h of Object.values(JSON.parse(r.man))) used.add(h);
    for (const r of this.sql.exec('SELECT k FROM blobs WHERE k > ? AND k < ?', scope + SEP, scope + '\u0002').toArray()) if (!used.has(r.k.slice(scope.length + 1))) this.sql.exec('DELETE FROM blobs WHERE k = ?', r.k);
  }
  // puts a lobby back as it was in a save; what it has now is saved first, so a rewind can be undone
  async restore(scope, id) {
    const row = this.sql.exec('SELECT man FROM saves WHERE scope = ? AND id = ?', scope, id).toArray()[0]; if (!row) return false;
    await this.snapshot(scope, 'Before rewinding');
    const man = JSON.parse(row.man), data = this.scopeData(scope), out = [];
    for (const p of [...data.keys()]) if (!(p in man)) { data.delete(p); this.sql.exec('DELETE FROM docs WHERE k = ?', scope + SEP + p); out.push({ p, d: null }); }
    for (const [p, h] of Object.entries(man)) {
      const b = this.sql.exec('SELECT data FROM blobs WHERE k = ?', scope + SEP + h).toArray()[0]; if (!b) continue;
      const cur = data.get(p); if (cur !== undefined && JSON.stringify(cur) === b.data) continue;
      const d = JSON.parse(b.data); data.set(p, d); this.sql.exec('INSERT OR REPLACE INTO docs (k, data) VALUES (?, ?)', scope + SEP + p, b.data); out.push({ p, d });
    }
    for (const s of this.subs.get(scope) || []) for (const c of out) this.send(s, { t: 'chg', scope, ...c });
    return true;
  }

  leaveRoom(ws, room) {
    const peer = ws.roomMap.get(room); if (!peer) return;
    ws.roomMap.delete(room); const r = this.rooms.get(room);
    if (r) { r.delete(peer); if (!r.size) this.rooms.delete(room); else this.announcePeers(room); }
  }

  async handle(ws, m) {
    if (m.t === 'hello') { ws.uid = (await this.checkAuth(m.uid, m.key)) ? m.uid : null; this.send(ws, { t: 'hello', ok: !!ws.uid }); if (!ws.uid) ws.close(4001, 'wrong key'); return; }
    if (!ws.uid || m.t === 'ping') return;
    const ack = extra => m.rid && this.send(ws, { t: 'ack', rid: m.rid, ...extra });
    switch (m.t) {
      case 'sub': {
        if (typeof m.scope !== 'string' || !(m.scope === 'g' || validId(m.scope.slice(1))) || !mayRead(ws.uid, m.scope)) return ack({ error: 'not allowed' });
        if (!this.subs.has(m.scope)) this.subs.set(m.scope, new Set());
        this.subs.get(m.scope).add(ws); ws.scopeSet.add(m.scope);
        // a big lobby (background images, many drawings) goes out in parts; the client puts them together
        let part = [], size = 0;
        for (const [p, d] of this.scopeData(m.scope)) {
          const n = JSON.stringify(d).length + p.length;
          if (part.length && size + n > SNAP_PART) { this.send(ws, { t: 'snap', scope: m.scope, docs: part, more: true }); part = []; size = 0; }
          part.push({ p, d }); size += n;
        }
        this.send(ws, { t: 'snap', scope: m.scope, docs: part });
        return;
      }
      case 'unsub': { if (typeof m.scope === 'string') this.unsubscribe(ws, m.scope); return; }
      case 'get': {
        if (isAudio(m.path)) { const r = this.sql.exec('SELECT data FROM audio WHERE id = ?', m.path.slice(6)).toArray()[0]; return ack(r ? { exists: true, data: JSON.parse(r.data) } : { exists: false }); }
        if (!validPath(m.path)) return ack({ error: 'bad path' });
        const scope = scopeOf(m.path); if (!scope || !mayRead(ws.uid, scope)) return ack({ error: 'not allowed' });
        const d = this.scopeData(scope).get(m.path);
        return ack({ exists: d !== undefined, data: d });
      }
      case 'write': {
        const ops = Array.isArray(m.ops) ? m.ops.slice(0, 100) : [];
        for (const op of ops) if (!op || !(isAudio(op.path) || (validPath(op.path) && mayWrite(ws.uid, op.path) && scopeOf(op.path)))) return ack({ error: 'not allowed: ' + (op && op.path) });
        if (this.ipOf(ws.ip).writes > IP_WRITES_PER_DAY) return ack({ error: 'quota: this address has made too many changes today; try again tomorrow' });
        for (const op of ops) {
          if (isAudio(op.path)) {
            const id = op.path.slice(6);
            if (op.op === 'delete') { this.sql.exec('DELETE FROM audio WHERE id = ?', id); continue; }
            const s = JSON.stringify(op.data && typeof op.data === 'object' ? op.data : {});
            if (s.length > 300 * 1024) return ack({ error: 'too large' });
            this.sql.exec('INSERT OR REPLACE INTO audio (id, data) VALUES (?, ?)', id, s); continue;
          }
          const scope = scopeOf(op.path), data = this.scopeData(scope);
          const old = data.get(op.path), oldLen = old === undefined ? 0 : op.path.length + JSON.stringify(old).length;
          let d = null;
          if (op.op !== 'delete') {
            d = op.data && typeof op.data === 'object' ? op.data : {};
            if (op.op === 'update') d = { ...(old || {}), ...d };
            if (isLobbyRoot(op.path)) d = guardLobbyRoot(data, op.path, ws.uid, op.op, d);
            const s = JSON.stringify(d);
            if (s.length > MAX_DOC) return ack({ error: 'too large' });
            const size = this.scopeSize(scope) - oldLen + op.path.length + s.length;
            if (scope[0] === 'L' && size > oldLen && (size > MAX_LOBBY_BYTES || (old === undefined && data.size >= MAX_LOBBY_DOCS))) return ack({ error: 'quota: this table is full (64 MB). Remove pictures or Library entries to make room.' });
            data.set(op.path, d); this.sql.exec('INSERT OR REPLACE INTO docs (k, data) VALUES (?, ?)', scope + SEP + op.path, s);
            this.sizes.set(scope, size);
          } else {
            if (isLobbyRoot(op.path) && guardLobbyRoot(data, op.path, ws.uid, 'delete', true) === undefined) return ack({ error: 'not allowed: only the owner can close this table' });
            data.delete(op.path); this.sql.exec('DELETE FROM docs WHERE k = ?', scope + SEP + op.path);
            if (this.sizes.has(scope)) this.sizes.set(scope, this.sizes.get(scope) - oldLen);
          }
          for (const s of this.subs.get(scope) || []) this.send(s, { t: 'chg', scope, p: op.path, d });
          await this.markDirty(scope);
        }
        return ack({ ok: true });
      }
      // autosaves, for the lobby owner and co-owners: list them, save now (named), and rewind to one
      case 'saves': case 'savenow': case 'restore': {
        if (typeof m.scope !== 'string' || m.scope[0] !== 'L' || !validId(m.scope.slice(1))) return ack({ error: 'bad lobby' });
        if (!isHostOf(this.scopeData(m.scope), m.scope.slice(1), ws.uid)) return ack({ error: 'not allowed' });
        if (m.t === 'saves') return ack({ saves: this.sql.exec('SELECT id, ts, label, n, size FROM saves WHERE scope = ? ORDER BY ts DESC LIMIT 60', m.scope).toArray() });
        if (m.t === 'savenow') return ack({ id: await this.snapshot(m.scope, String(m.label || 'Saved by hand').slice(0, 80)) });
        return ack(await this.restore(m.scope, Number(m.id)) ? { ok: true } : { error: 'no such save' });
      }
      case 'join': {
        if (!validId(m.room) || !validId(m.peer)) return;
        // a peer id belongs to the player who took it first (the same player may take it back after a reconnect)
        const taken = this.rooms.get(m.room)?.get(m.peer);
        if (taken && taken.ws !== ws) { if (taken.by !== ws.uid) return; taken.ws.roomMap?.delete(m.room); }
        if (ws.roomMap.size >= 8 && !ws.roomMap.has(m.room)) return;
        if (!this.rooms.has(m.room)) this.rooms.set(m.room, new Map());
        this.rooms.get(m.room).set(m.peer, { ws, by: ws.uid, presence: m.presence || {} }); ws.roomMap.set(m.room, m.peer);
        return this.announcePeers(m.room);
      }
      case 'presence': {
        const p = this.rooms.get(m.room)?.get(m.peer); if (!p || p.ws !== ws) return;
        if (JSON.stringify(m.presence || {}).length > 20000) return;
        p.presence = m.presence || {}; return this.announcePeers(m.room);
      }
      case 'emit': {
        const r = this.rooms.get(m.room); if (!r || r.get(m.peer)?.ws !== ws || typeof m.topic !== 'string') return;
        const msg = { t: 'evt', room: m.room, topic: m.topic, data: m.data ?? null, by: ws.uid, peer: m.peer };
        if (JSON.stringify(msg).length > 60000) return;
        for (const [, x] of r) this.send(x.ws, msg);
        return ack({ ok: true });
      }
      case 'leave': return this.leaveRoom(ws, m.room);
    }
  }
}
