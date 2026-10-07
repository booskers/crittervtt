// Homebase on Cloudflare: the Homebase server as a Worker plus one Durable Object, on the free Workers plan.
// It speaks the same WebSocket protocol as homebase-server/server.mjs, so the Critter app connects to either.
// The Worker also serves the built app (../app/www), so people can play in a browser at this Worker's address.
//
// Made to get a lot out of the free plan: every table shares one Durable Object (one object's running time fits the
// free allowance however many tables play), connections hibernate when quiet and Cloudflare answers their keep-alive
// pings itself (free), a cursor moving goes out as that one player's presence, several changes travel in one message,
// and an autosave is a few rows however many things changed. /stats shows what the hub did, hour by hour.
import { DurableObject } from 'cloudflare:workers';
import { ddbRequest } from './ddb.js';

const json = (o, status = 200) => new Response(JSON.stringify(o), { status, headers: { 'content-type': 'application/json', 'access-control-allow-origin': '*', 'cache-control': 'no-store' } });

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
    // what the hub did, hour by hour (counts only: no lobby codes, players or addresses)
    if (url.pathname === '/stats') return env.HUB.get(env.HUB.idFromName('hub')).fetch(req);
    if (env.ASSETS) return env.ASSETS.fetch(req);
    return new Response('Homebase is running. Connect the Critter VTT app to this address.', { headers: { 'content-type': 'text/plain; charset=utf-8' } });
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
// what changed since the save before goes into one "pack" row (or a few, for big pictures), so a save costs a few rows
// however many things changed, and a background picture is stored once however many saves share it.
// Kept: the 12 newest, the newest of each day for a week, and the 20 newest named ones (session start and end, by hand).
// (Saves from before packs point into the blobs table, one row per document; they still work and age out as before.)
const SAVE_EVERY = 10 * 60 * 1000, KEEP_RECENT = 12, KEEP_DAYS = 7, KEEP_NAMED = 20, PACK_MAX = 1800 * 1024;
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
// the keep-alive the apps send every 25 s: Cloudflare answers it without waking the hub, and it isn't billed
const PING = '{"t":"ping"}', PONG = '{"t":"pong"}';
// a player's presence that is kept through hibernation: everything but what moves all the time (the cursor, a stroke
// being drawn, a measurement, a ping), which is sent again as soon as it changes. Critter VTT keeps its name, look and
// scene this way, Critter Sounds its name and kind in the "lan" room. (If it's big, just the name, look and scene.)
const FLEETING = new Set(['x', 'y', 'd', 'm', 'pg']);
const presCore = p => {
  const o = {}; for (const [k, v] of Object.entries(p || {})) if (!FLEETING.has(k)) o[k] = v;
  if (JSON.stringify(o).length <= 600) return o;
  const s = {}; for (const k of ['n', 'a', 'c', 'sc', 'dj']) if (o[k] !== undefined) s[k] = o[k]; return s;
};
const HOUR = 3600e3;
/* "lan": Critter Sounds finds the other Critter Sounds on the same network here. Everyone whose connection comes from the
   same network shares one room: the same public IPv4 address, the same IPv6 /64 (and, on a server in the home itself,
   every private address). The room's real name is a salted hash that never leaves the hub and can't be joined by name,
   so nobody can look into another network's room. Only names and kinds pass through it, and the handshake for a direct
   connection that Critter Sounds keeps to the local network. (As in homebase-server/server.mjs.) */
function netOf(ip) {
  ip = String(ip || '').replace(/^::ffff:/i, '').replace(/%.*$/, '');
  const v4 = /^(\d+)\.(\d+)\.\d+\.\d+$/.exec(ip);
  if (v4) { const a = +v4[1], b = +v4[2]; return a === 10 || a === 127 || (a === 192 && b === 168) || (a === 172 && b >= 16 && b <= 31) || (a === 169 && b === 254) ? 'private' : ip; }
  if (!ip.includes(':')) return 'private';
  if (ip === '::1' || /^f[cd]/i.test(ip) || /^fe[89ab]/i.test(ip)) return 'private';
  const [l, r = ''] = ip.split('::'), L = l ? l.split(':') : [], R = r ? r.split(':') : [], all = [...L, ...Array(Math.max(0, 8 - L.length - R.length)).fill('0'), ...R];
  return all.slice(0, 4).map(x => parseInt(x || '0', 16).toString(16)).join(':') + '::/64';
}
const outName = room => (room.startsWith('lan_') ? 'lan' : room);

export class Hub extends DurableObject {
  constructor(ctx, env) {
    super(ctx, env);
    this.sql = ctx.storage.sql;
    this.sql.exec('CREATE TABLE IF NOT EXISTS docs (k TEXT PRIMARY KEY, data TEXT NOT NULL)');
    this.sql.exec('CREATE TABLE IF NOT EXISTS audio (id TEXT PRIMARY KEY, data TEXT NOT NULL)');
    this.sql.exec('CREATE TABLE IF NOT EXISTS auth (uid TEXT PRIMARY KEY, hash TEXT NOT NULL)');
    this.sql.exec('CREATE TABLE IF NOT EXISTS blobs (k TEXT PRIMARY KEY, data TEXT NOT NULL)');
    this.sql.exec('CREATE TABLE IF NOT EXISTS packs (k TEXT PRIMARY KEY, data TEXT NOT NULL)');
    this.sql.exec('CREATE TABLE IF NOT EXISTS saves (id INTEGER PRIMARY KEY AUTOINCREMENT, scope TEXT NOT NULL, ts INTEGER NOT NULL, label TEXT, man TEXT NOT NULL, n INTEGER, size INTEGER, sig TEXT)');
    this.sql.exec('CREATE INDEX IF NOT EXISTS saves_scope ON saves (scope, ts)');
    this.sql.exec('CREATE TABLE IF NOT EXISTS dirty (scope TEXT PRIMARY KEY)');
    this.sql.exec('CREATE TABLE IF NOT EXISTS stats (hour INTEGER PRIMARY KEY, data TEXT NOT NULL)');
    this.sql.exec('CREATE TABLE IF NOT EXISTS meta (k TEXT PRIMARY KEY, v TEXT NOT NULL)');
    this.lanRooms = new Map();
    this.dirty = new Set(this.sql.exec('SELECT scope FROM dirty').toArray().map(r => r.scope));
    this.scopes = new Map();   // scope -> Map(path -> data), loaded on first use
    this.subs = new Map();     // scope -> Set(ws)
    this.rooms = new Map();    // room -> Map(peer -> { ws, by, presence })
    this.peerT = new Map();
    this.ips = new Map();      // address -> { sockets, msg, write, day, writes }
    this.sizes = new Map();    // scope -> bytes stored, for loaded scopes
    this.live = new Map();     // ws -> what this connection is doing right now (rate limits, its message queue)
    this.st = null; this.stSaved = 0;
    ctx.setWebSocketAutoResponse(new WebSocketRequestResponsePair(PING, PONG));
    // waking from hibernation: the connections are still there; who they are, what they follow and which rooms they're
    // in come back from what each one carries with it
    for (const ws of ctx.getWebSockets()) {
      const a = ws.deserializeAttachment() || {};
      this.ipOf(a.ip || 'local').sockets++;
      for (const s of a.scopes || []) { if (!this.subs.has(s)) this.subs.set(s, new Set()); this.subs.get(s).add(ws); }
      for (const [room, peer] of Object.entries(a.rooms || {})) {
        if (!this.rooms.has(room)) this.rooms.set(room, new Map());
        this.rooms.get(room).set(peer, { ws, by: a.uid, presence: (a.pres && a.pres[room]) || {} });
      }
    }
  }

  async lanRoom(ip) {
    const net = netOf(ip); if (this.lanRooms.has(net)) return this.lanRooms.get(net);
    if (!this.lanSalt) {
      const row = this.sql.exec("SELECT v FROM meta WHERE k = 'lanSalt'").toArray()[0];
      if (row) this.lanSalt = row.v;
      else { this.lanSalt = [...crypto.getRandomValues(new Uint8Array(18))].map(b => b.toString(16).padStart(2, '0')).join(''); this.run("INSERT OR REPLACE INTO meta (k, v) VALUES ('lanSalt', ?)", this.lanSalt); }
    }
    const room = 'lan_' + (await hex(this.lanSalt + net)).slice(0, 32); this.lanRooms.set(net, room); return room;
  }
  /* ---------- a connection's own record: kept on the connection, so it survives hibernation ---------- */
  att(ws) { return ws.deserializeAttachment() || {}; }
  setAtt(ws, patch) {
    const a = { ...this.att(ws), ...patch };
    // a connection carries at most 2 KB: the presence it keeps is dropped first if it doesn't fit
    if (JSON.stringify(a).length > 2000) delete a.pres;
    try { ws.serializeAttachment(a); } catch (e) { console.error(e); }
  }
  liveOf(ws) {
    let L = this.live.get(ws);
    if (!L) { L = { rl: { msg: bucket(LIMITS.msg), write: bucket(LIMITS.write), sub: bucket(LIMITS.sub) }, chain: Promise.resolve(), queued: 0 }; this.live.set(ws, L); }
    return L;
  }

  /* ---------- what the hub did: counted per hour, one row per hour (written at most every 5 minutes) ---------- */
  stat(k, n = 1) {
    const h = Math.floor(Date.now() / HOUR);
    if (!this.st || this.st.hour !== h) {
      if (this.st) this.saveStats();
      const row = this.sql.exec('SELECT data FROM stats WHERE hour = ?', h).toArray()[0];
      this.st = { hour: h, c: row ? JSON.parse(row.data) : {} };
    }
    this.st.c[k] = (this.st.c[k] || 0) + n;
    if (Date.now() - this.stSaved > 5 * 60e3) this.saveStats();
  }
  saveStats() {
    if (!this.st) return; this.stSaved = Date.now();
    this.sql.exec('INSERT OR REPLACE INTO stats (hour, data) VALUES (?, ?)', this.st.hour, JSON.stringify(this.st.c));
    this.sql.exec('DELETE FROM stats WHERE hour < ?', this.st.hour - 24 * 30);
  }
  // writes to the database go through here, so the stats know how many rows were written (the free plan counts them)
  run(q, ...a) { const c = this.sql.exec(q, ...a); this.stat('rowsW', c.rowsWritten || 0); return c; }
  statsPage() {
    if (this.st) this.saveStats();
    const hours = this.sql.exec('SELECT hour, data FROM stats ORDER BY hour DESC LIMIT 48').toArray().map(r => ({ hour: new Date(r.hour * HOUR).toISOString().slice(0, 13) + ':00Z', ...JSON.parse(r.data) }));
    const today = {}, day = Math.floor(Date.now() / 864e5);
    for (const r of this.sql.exec('SELECT hour, data FROM stats WHERE hour >= ?', day * 24).toArray()) for (const [k, v] of Object.entries(JSON.parse(r.data))) today[k] = (today[k] || 0) + v;
    // the free plan, roughly: 100,000 Durable Object requests a day (a connection is one, incoming messages count 20 to 1)
    // and 100,000 rows written a day
    const requests = Math.round((today.connects || 0) + (today.in || 0) / 20 + (today.alarms || 0) + (today.http || 0));
    return json({
      now: { connections: this.ctx.getWebSockets().length, tablesOpen: [...this.subs.keys()].filter(s => s[0] === 'L').length, rooms: this.rooms.size },
      today: { ...today, durableObjectRequestsAbout: requests, freeRequestsUsed: Math.round(requests / 1000) + '%', freeRowsWrittenUsed: Math.round((today.rowsW || 0) / 1000) + '%' },
      hours
    });
  }

  ipOf(addr) {
    let x = this.ips.get(addr);
    if (!x) { x = { sockets: 0, msg: bucket(IP_LIMITS.msg), write: bucket(IP_LIMITS.write), day: 0, writes: 0 }; this.ips.set(addr, x); }
    const d = Math.floor(Date.now() / 864e5); if (x.day !== d) { x.day = d; x.writes = 0; }
    return x;
  }
  // waits until this connection (and its address) may send again
  async throttle(ws, m) {
    const ip = this.ipOf(this.att(ws).ip || 'local'), rl = this.liveOf(ws).rl;
    const kind = m.t === 'write' ? 'write' : m.t === 'sub' ? 'sub' : 'msg';
    const cost = kind === 'write' ? Math.max(1, Math.min(100, Array.isArray(m.ops) ? m.ops.length : 1)) : 1;
    for (let wait = 1; wait > 0;) {
      wait = Math.max(take(rl[kind], cost), kind === 'sub' ? 0 : take(ip[kind], cost));
      if (wait > 0) { rl[kind].n += cost; if (kind !== 'sub') ip[kind].n += cost; await sleep(Math.min(wait, 2000)); }
    }
    if (kind === 'write') ip.writes += cost;
  }

  async fetch(req) {
    const path = req ? new URL(req.url).pathname : '';
    if (path === '/ddb') { this.stat('http'); return this.ddb(req); }
    if (path === '/stats') { this.stat('http'); return this.statsPage(); }
    const addr = req.headers.get('CF-Connecting-IP') || 'local', ip = this.ipOf(addr);
    if (ip.sockets >= IP_SOCKETS) return new Response('Too many connections from this address', { status: 429 });
    const [client, ws] = Object.values(new WebSocketPair());
    // a hibernating connection: the hub may sleep while a table is quiet, and wakes for the next message
    this.ctx.acceptWebSocket(ws);
    ws.serializeAttachment({ uid: null, ip: addr, scopes: [], rooms: {}, caps: [] });
    ip.sockets++; this.stat('connects');
    return new Response(null, { status: 101, webSocket: client });
  }
  // one message at a time per connection, so nothing sent right after "hello" arrives before the player is known
  webSocketMessage(ws, raw) {
    let m; try { m = JSON.parse(typeof raw === 'string' ? raw : new TextDecoder().decode(raw)); } catch { return; }
    const L = this.liveOf(ws);
    if (++L.queued > MAX_QUEUE) { try { ws.close(4008, 'too many messages'); } catch {} return; }
    this.stat('in'); this.stat('in_' + (typeof m.t === 'string' ? m.t.slice(0, 12) : '?'));
    L.chain = L.chain.then(() => (m.t === 'hello' || m.t === 'ping' ? null : this.throttle(ws, m))).then(() => this.handle(ws, m)).catch(e => console.error(e)).finally(() => { L.queued--; });
    return L.chain;
  }
  webSocketClose(ws) { this.gone(ws); }
  webSocketError(ws) { this.gone(ws); }
  gone(ws) {
    if (!this.live.has(ws) && ws.__gone) return; ws.__gone = true;
    const a = this.att(ws), ip = this.ipOf(a.ip || 'local'); ip.sockets = Math.max(0, ip.sockets - 1);
    for (const s of a.scopes || []) this.unsubscribe(ws, s, true);
    for (const room of Object.keys(a.rooms || {})) this.leaveRoom(ws, room, true);
    this.live.delete(ws);
  }
  // a scope nobody listens to any more is dropped from memory (the database keeps it), so only open tables use memory
  unsubscribe(ws, scope, closing) {
    if (!closing) { const a = this.att(ws); this.setAtt(ws, { scopes: (a.scopes || []).filter(s => s !== scope) }); }
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
    if (!row) { this.run('INSERT INTO auth (uid, hash) VALUES (?, ?)', uid, h); return true; }
    const a = new TextEncoder().encode(row.hash), b = new TextEncoder().encode(h);
    return a.length === b.length && crypto.subtle.timingSafeEqual(a, b);
  }
  // who is in a room: the whole list goes out when someone joins or leaves, and to apps from before presence updates
  // (only: false, when a presence changed and the newer apps already got just that one player's)
  announcePeers(room, onlyOld) {
    const key = room + (onlyOld ? '\u0001old' : '');
    if (this.peerT.has(room) || this.peerT.has(key)) return;
    this.peerT.set(key, setTimeout(() => {
      this.peerT.delete(key);
      const r = this.rooms.get(room); if (!r) return;
      const peers = [...r].map(([peer, x]) => ({ peer, by: x.by, presence: x.presence }));
      for (const [, x] of r) if (!onlyOld || !this.att(x.ws).caps?.includes('pres')) { this.send(x.ws, { t: 'peers', room: outName(room), peers }); this.stat('outPeers'); }
    }, 40));
  }
  /* ---------- autosaves ---------- */
  async markDirty(scope) {
    if (scope[0] !== 'L' || this.dirty.has(scope)) return;
    this.dirty.add(scope); this.run('INSERT OR IGNORE INTO dirty (scope) VALUES (?)', scope);
    if (!(await this.ctx.storage.getAlarm())) await this.ctx.storage.setAlarm(Date.now() + SAVE_EVERY);
  }
  async alarm() {
    this.stat('alarms');
    const list = [...this.dirty]; this.dirty.clear(); this.run('DELETE FROM dirty');
    for (const scope of list) { try { await this.snapshot(scope, ''); } catch (e) { console.error(e); } }
  }
  // a save's list: path -> [fingerprint, pack] (or just the fingerprint, for saves from before packs)
  // saves a lobby as it is now; nothing is written when nothing changed since the last save (unless it is named)
  async snapshot(scope, label) {
    const data = this.scopeData(scope); if (!data.size) return null;
    const last = this.sql.exec('SELECT man, sig FROM saves WHERE scope = ? ORDER BY ts DESC LIMIT 1', scope).toArray()[0];
    const prev = last ? JSON.parse(last.man) : {}, where = new Map(), man = {};
    for (const v of Object.values(prev)) { const [h, pk] = Array.isArray(v) ? v : [v, 0]; where.set(h, pk); }
    let size = 0, pack = {}, packSize = 0; const packs = [];
    const newPack = () => 'p' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
    let pk = newPack();
    for (const [p, d] of data) {
      const s = JSON.stringify(d), h = (await hex(s)).slice(0, 24); size += s.length;
      if (where.has(h)) { man[p] = [h, where.get(h)]; continue; }
      if (packSize && packSize + s.length > PACK_MAX) { packs.push([pk, pack]); pack = {}; packSize = 0; pk = newPack(); }
      pack[h] = s; packSize += s.length; where.set(h, pk); man[p] = [h, pk];
    }
    if (packSize) packs.push([pk, pack]);
    const sig = (await hex(JSON.stringify(Object.fromEntries(Object.entries(man).map(([p, [h]]) => [p, h]))))).slice(0, 24);
    if (!label && last && last.sig === sig) return null;
    for (const [k, c] of packs) this.run('INSERT OR REPLACE INTO packs (k, data) VALUES (?, ?)', scope + SEP + k, JSON.stringify(c));
    this.run('INSERT INTO saves (scope, ts, label, man, n, size, sig) VALUES (?, ?, ?, ?, ?, ?, ?)', scope, Date.now(), label || null, JSON.stringify(man), data.size, size, sig);
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
    for (const r of drop) this.run('DELETE FROM saves WHERE id = ?', r.id);
    // content no save of this lobby points at any more: whole packs, and the one-row-per-document blobs of older saves
    const usedPacks = new Set(), usedBlobs = new Set();
    for (const r of this.sql.exec('SELECT man FROM saves WHERE scope = ?', scope)) for (const v of Object.values(JSON.parse(r.man))) { if (Array.isArray(v)) usedPacks.add(v[1]); else usedBlobs.add(v); }
    for (const r of this.sql.exec('SELECT k FROM packs WHERE k > ? AND k < ?', scope + SEP, scope + '\u0002').toArray()) if (!usedPacks.has(r.k.slice(scope.length + 1))) this.run('DELETE FROM packs WHERE k = ?', r.k);
    for (const r of this.sql.exec('SELECT k FROM blobs WHERE k > ? AND k < ?', scope + SEP, scope + '\u0002').toArray()) if (!usedBlobs.has(r.k.slice(scope.length + 1))) this.run('DELETE FROM blobs WHERE k = ?', r.k);
  }
  // puts a lobby back as it was in a save; what it has now is saved first, so a rewind can be undone
  async restore(scope, id) {
    const row = this.sql.exec('SELECT man FROM saves WHERE scope = ? AND id = ?', scope, id).toArray()[0]; if (!row) return false;
    await this.snapshot(scope, 'Before rewinding');
    const man = JSON.parse(row.man), data = this.scopeData(scope), out = [], packs = new Map();
    const content = v => {
      if (!Array.isArray(v)) { const b = this.sql.exec('SELECT data FROM blobs WHERE k = ?', scope + SEP + v).toArray()[0]; return b && b.data; }
      if (!packs.has(v[1])) { const r = this.sql.exec('SELECT data FROM packs WHERE k = ?', scope + SEP + v[1]).toArray()[0]; packs.set(v[1], r ? JSON.parse(r.data) : {}); }
      return packs.get(v[1])[v[0]];
    };
    for (const p of [...data.keys()]) if (!(p in man)) { data.delete(p); this.run('DELETE FROM docs WHERE k = ?', scope + SEP + p); out.push({ p, d: null }); }
    for (const [p, v] of Object.entries(man)) {
      const s = content(v); if (s === undefined || s === null) continue;
      const cur = data.get(p); if (cur !== undefined && JSON.stringify(cur) === s) continue;
      const d = JSON.parse(s); data.set(p, d); this.run('INSERT OR REPLACE INTO docs (k, data) VALUES (?, ?)', scope + SEP + p, s); out.push({ p, d });
    }
    this.sizes.delete(scope);
    for (const s of this.subs.get(scope) || []) for (const c of out) this.send(s, { t: 'chg', scope, ...c });
    return true;
  }

  leaveRoom(ws, room, closing) {
    const a = this.att(ws), peer = (a.rooms || {})[room]; if (!peer) return;
    if (!closing) { const rooms = { ...a.rooms }; delete rooms[room]; const pres = { ...(a.pres || {}) }; delete pres[room]; this.setAtt(ws, { rooms, pres }); }
    const r = this.rooms.get(room);
    if (r && r.get(peer)?.ws === ws) { r.delete(peer); if (!r.size) this.rooms.delete(room); else this.announcePeers(room); }
  }

  // one write, checked and stored; returns an error message, or nothing when it went through
  writeOne(ws, op) {
    if (!op || !(isAudio(op.path) || (validPath(op.path) && mayWrite(ws.uid, op.path) && scopeOf(op.path)))) return 'not allowed: ' + (op && op.path);
    if (isAudio(op.path)) {
      const id = op.path.slice(6);
      if (op.op === 'delete') { this.run('DELETE FROM audio WHERE id = ?', id); return; }
      const s = JSON.stringify(op.data && typeof op.data === 'object' ? op.data : {});
      if (s.length > 300 * 1024) return 'too large';
      this.run('INSERT OR REPLACE INTO audio (id, data) VALUES (?, ?)', id, s); return;
    }
    const scope = scopeOf(op.path), data = this.scopeData(scope);
    const old = data.get(op.path), oldLen = old === undefined ? 0 : op.path.length + JSON.stringify(old).length;
    let d = null;
    if (op.op !== 'delete') {
      d = op.data && typeof op.data === 'object' ? op.data : {};
      if (op.op === 'update') d = { ...(old || {}), ...d };
      if (isLobbyRoot(op.path)) d = guardLobbyRoot(data, op.path, ws.uid, op.op, d);
      const s = JSON.stringify(d);
      if (s.length > MAX_DOC) return 'too large';
      const size = this.scopeSize(scope) - oldLen + op.path.length + s.length;
      if (scope[0] === 'L' && size > oldLen && (size > MAX_LOBBY_BYTES || (old === undefined && data.size >= MAX_LOBBY_DOCS))) return 'quota: this table is full (64 MB). Remove pictures or Library entries to make room.';
      data.set(op.path, d); this.run('INSERT OR REPLACE INTO docs (k, data) VALUES (?, ?)', scope + SEP + op.path, s);
      this.sizes.set(scope, size);
    } else {
      if (isLobbyRoot(op.path) && guardLobbyRoot(data, op.path, ws.uid, 'delete', true) === undefined) return 'not allowed: only the owner can close this table';
      data.delete(op.path); this.run('DELETE FROM docs WHERE k = ?', scope + SEP + op.path);
      if (this.sizes.has(scope)) this.sizes.set(scope, this.sizes.get(scope) - oldLen);
    }
    for (const s of this.subs.get(scope) || []) this.send(s, { t: 'chg', scope, p: op.path, d });
    this.markDirty(scope).catch(e => console.error(e));
  }

  async handle(ws, m) {
    if (m.t === 'hello') {
      const uid = (await this.checkAuth(m.uid, m.key)) ? m.uid : null; ws.uid = uid;
      this.setAtt(ws, { uid, caps: Array.isArray(m.caps) ? m.caps.filter(c => typeof c === 'string').slice(0, 10) : [] });
      this.send(ws, { t: 'hello', ok: !!uid }); if (!uid) ws.close(4001, 'wrong key'); return;
    }
    // (after hibernation the connection object is new: who it is comes back from its record)
    if (ws.uid === undefined) ws.uid = this.att(ws).uid || null;
    if (!ws.uid || m.t === 'ping') return;
    const ack = extra => m.rid && this.send(ws, { t: 'ack', rid: m.rid, ...extra });
    // "lan" is this network's own room; its real name can't be used directly
    if (typeof m.room === 'string') { if (m.room === 'lan') m.room = await this.lanRoom(this.att(ws).ip); else if (m.room.startsWith('lan_')) return ack({ error: 'not allowed' }); }
    switch (m.t) {
      case 'sub': {
        if (typeof m.scope !== 'string' || !(m.scope === 'g' || validId(m.scope.slice(1))) || !mayRead(ws.uid, m.scope)) return ack({ error: 'not allowed' });
        if (!this.subs.has(m.scope)) this.subs.set(m.scope, new Set());
        this.subs.get(m.scope).add(ws);
        const a = this.att(ws); if (!(a.scopes || []).includes(m.scope)) this.setAtt(ws, { scopes: [...(a.scopes || []), m.scope].slice(-40) });
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
        this.stat('ops', ops.length);
        if (this.ipOf(this.att(ws).ip || 'local').writes > IP_WRITES_PER_DAY) return ack({ error: 'quota: this address has made too many changes today; try again tomorrow' });
        // "each": several changes gathered into one message, each going through (or not) on its own
        if (m.each) { const errs = {}; ops.forEach((op, i) => { const e = this.writeOne(ws, op); if (e) errs[i] = e; }); return ack(Object.keys(errs).length ? { ok: true, errs } : { ok: true }); }
        // all or nothing, as apps from before "each" expect
        for (const op of ops) if (!op || !(isAudio(op.path) || (validPath(op.path) && mayWrite(ws.uid, op.path) && scopeOf(op.path)))) return ack({ error: 'not allowed: ' + (op && op.path) });
        for (const op of ops) { const e = this.writeOne(ws, op); if (e) return ack({ error: e }); }
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
      // the lobby owner closes the table for good: everything of the lobby goes (documents, saves, pictures, uploaded audio).
      // Critter VTT does this when the GM stops playing; the GM's own saves keep the campaign.
      case 'drop': {
        if (typeof m.scope !== 'string' || m.scope[0] !== 'L' || !validId(m.scope.slice(1))) return ack({ error: 'bad lobby' });
        const code = m.scope.slice(1), root = this.scopeData(m.scope).get('lobbies/' + code);
        if (!root || root.owner !== ws.uid) return ack({ error: 'not allowed' });
        for (const s of this.subs.get(m.scope) || []) this.send(s, { t: 'chg', scope: m.scope, p: 'lobbies/' + code, d: null });
        this.run('DELETE FROM docs WHERE k > ? AND k < ?', m.scope + SEP, m.scope + '\u0002');
        this.run('DELETE FROM blobs WHERE k > ? AND k < ?', m.scope + SEP, m.scope + '\u0002');
        this.run('DELETE FROM packs WHERE k > ? AND k < ?', m.scope + SEP, m.scope + '\u0002');
        this.run('DELETE FROM saves WHERE scope = ?', m.scope);
        this.run('DELETE FROM dirty WHERE scope = ?', m.scope); this.dirty.delete(m.scope);
        this.run('DELETE FROM audio WHERE id LIKE ?', code + '-%');
        this.scopes.delete(m.scope); this.sizes.delete(m.scope);
        return ack({ ok: true });
      }
      case 'join': {
        if (!validId(m.room) || !validId(m.peer)) return;
        // a peer id belongs to the player who took it first (the same player may take it back after a reconnect)
        const taken = this.rooms.get(m.room)?.get(m.peer);
        if (taken && taken.ws !== ws) {
          if (taken.by !== ws.uid) return;
          const ta = this.att(taken.ws); if (ta.rooms) { const rooms = { ...ta.rooms }; delete rooms[m.room]; this.setAtt(taken.ws, { rooms }); }
        }
        const a = this.att(ws);
        if (Object.keys(a.rooms || {}).length >= 8 && !(a.rooms || {})[m.room]) return;
        if (!this.rooms.has(m.room)) this.rooms.set(m.room, new Map());
        const presence = m.presence && typeof m.presence === 'object' ? m.presence : {};
        this.rooms.get(m.room).set(m.peer, { ws, by: ws.uid, presence });
        this.setAtt(ws, { rooms: { ...(a.rooms || {}), [m.room]: m.peer }, pres: { ...(a.pres || {}), [m.room]: presCore(presence) } });
        return this.announcePeers(m.room);
      }
      case 'presence': {
        const r = this.rooms.get(m.room), p = r?.get(m.peer); if (!p || p.ws !== ws) return;
        const presence = m.presence && typeof m.presence === 'object' ? m.presence : {};
        if (JSON.stringify(presence).length > 20000) return;
        // what's kept through hibernation changes rarely (a name, a scene): the record is rewritten only then
        const core = presCore(presence), a = this.att(ws);
        if (JSON.stringify(core) !== JSON.stringify((a.pres || {})[m.room] || {})) this.setAtt(ws, { pres: { ...(a.pres || {}), [m.room]: core } });
        p.presence = presence;
        // the newer apps get just this player's presence; older ones the whole list, as before
        const msg = JSON.stringify({ t: 'pres', room: outName(m.room), peer: m.peer, by: ws.uid, presence });
        let old = false;
        for (const [peer, x] of r) {
          if (peer === m.peer) continue;
          if (this.att(x.ws).caps?.includes('pres')) { try { x.ws.send(msg); } catch {} this.stat('outPres'); } else old = true;
        }
        if (old) this.announcePeers(m.room, true);
        return;
      }
      case 'emit': {
        const r = this.rooms.get(m.room); if (!r || r.get(m.peer)?.ws !== ws || typeof m.topic !== 'string') return;
        const msg = { t: 'evt', room: outName(m.room), topic: m.topic, data: m.data ?? null, by: ws.uid, peer: m.peer };
        if (JSON.stringify(msg).length > 60000) return;
        // "to": for one peer only (a handshake), else for everyone in the room
        if (m.to !== undefined) { const x = validId(m.to) && r.get(m.to); if (x) this.send(x.ws, msg); return ack({ ok: !!x }); }
        for (const [, x] of r) this.send(x.ws, msg);
        return ack({ ok: true });
      }
      case 'leave': return this.leaveRoom(ws, m.room);
    }
  }
}
