// The public Critter VTT moved from critter.poly-chrome.cc to live.crittervtt.com. A browser keeps each address's data
// apart (your name and seat, settings, your Homebase identity, rulebooks, campaigns saved in the browser), so moving
// brings it along. Both addresses are the same Homebase; only what the browser keeps has to move.
//  - At the old address, "Move to live.crittervtt.com" opens the new address in a window of its own, hands it
//    everything with postMessage (to that exact address only), and from then on the old address goes straight to the new.
//  - The new address, opened like that (?critter-move=1), takes it in (from the old address only) instead of starting.
//  - ?critter-export=1 doesn't start Critter VTT either: the Android app reads the old address's settings that way.
// This runs before everything else on the page (build.mjs puts it first), so a page that is only moving data never
// starts Critter VTT: window.__MOVING tells the Homebase client and the page to stay still.
(() => {
  const OLD = 'https://critter.poly-chrome.cc', NEW = 'https://live.crittervtt.com';
  const q = new URLSearchParams(location.search), here = location.origin;
  const LS = { get: k => { try { return localStorage.getItem(k); } catch { return null; } }, set: (k, v) => { try { localStorage.setItem(k, v); } catch {} } };
  window.CRITTER_MOVE = { OLD, NEW, here: here === OLD ? 'old' : here === NEW ? 'new' : '' };

  /* ---------- what moves: localStorage, and every IndexedDB database with its stores, indexes and records ---------- */
  const req = r => new Promise((ok, no) => { r.onsuccess = () => ok(r.result); r.onerror = () => no(r.error); });
  // a chosen folder (saves on disk) can't change address: browsers don't hand that permission on. The folder stays
  // where it is; at the new address it's picked again.
  const movable = v => !(typeof FileSystemHandle !== 'undefined' && (v instanceof FileSystemHandle || (v && typeof v === 'object' && Object.values(v).some(x => x instanceof FileSystemHandle))));
  async function dump() {
    const ls = {}; try { for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); ls[k] = localStorage.getItem(k); } } catch {}
    const names = indexedDB.databases ? (await indexedDB.databases()).map(d => d.name).filter(Boolean) : ['critter-books', 'critter-autosaves', 'critboard-music'];
    const dbs = [];
    for (const name of names) {
      let db; try { db = await req(indexedDB.open(name)); } catch { continue; }
      const stores = [];
      for (const s of db.objectStoreNames) {
        const st = db.transaction(s).objectStore(s);
        const keys = await req(st.getAllKeys()), vals = await req(db.transaction(s).objectStore(s).getAll());
        const recs = []; keys.forEach((k, i) => { if (movable(vals[i])) recs.push([k, vals[i]]); });
        stores.push({ name: s, keyPath: st.keyPath, auto: st.autoIncrement, indexes: [...st.indexNames].map(n => { const ix = st.index(n); return { n, kp: ix.keyPath, u: ix.unique, m: ix.multiEntry }; }), recs });
      }
      dbs.push({ name, version: db.version, stores }); db.close();
    }
    return { ls, dbs };
  }
  async function load({ ls, dbs }) {
    for (const [k, v] of Object.entries(ls || {})) LS.set(k, v);
    for (const d of dbs || []) {
      try { await req(indexedDB.deleteDatabase(d.name)); } catch {}
      const open = indexedDB.open(d.name, d.version || 1);
      open.onupgradeneeded = () => {
        const db = open.result;
        for (const s of d.stores) { const st = db.createObjectStore(s.name, { keyPath: s.keyPath ?? undefined, autoIncrement: !!s.auto }); for (const ix of s.indexes || []) st.createIndex(ix.n, ix.kp, { unique: ix.u, multiEntry: ix.m }); }
      };
      const db = await req(open);
      for (const s of d.stores) {
        if (!s.recs.length) continue;
        const tx = db.transaction(s.name, 'readwrite'), st = tx.objectStore(s.name);
        for (const [k, v] of s.recs) { try { s.keyPath == null ? st.put(v, k) : st.put(v); } catch {} }
        await new Promise(ok => { tx.oncomplete = ok; tx.onerror = ok; tx.onabort = ok; });
      }
      db.close();
    }
  }
  const has = () => !!(LS.get('tt.profile') || LS.get('hb.uid'));
  const cover = text => {
    const show = () => {
      let c = document.getElementById('critterMove');
      if (!c) { c = document.createElement('div'); c.id = 'critterMove'; c.style.cssText = 'position:fixed;inset:0;z-index:99999;display:grid;place-items:center;padding:24px;background:#0b0c0f;color:#ece8e0;font:16px/1.5 system-ui,sans-serif;text-align:center'; document.body.append(c); }
      c.textContent = text;
    };
    if (document.body) show(); else addEventListener('DOMContentLoaded', show);
  };

  /* ---------- the new address, opened by the old one: take it all in, then close ---------- */
  if (here === NEW && q.get('critter-move') === '1' && window.opener) {
    window.__MOVING = true; cover('Moving your Critter VTT here…');
    addEventListener('message', async e => {
      if (e.origin !== OLD || !e.data || e.data.t !== 'critter-move') return;
      if (has() && !confirm('This address already has Critter VTT settings. Replace them with the ones from critter.poly-chrome.cc?')) { e.source.postMessage({ t: 'critter-move-done', ok: false }, OLD); cover('Kept what was here.'); return; }
      try { await load(e.data.payload); e.source.postMessage({ t: 'critter-move-done', ok: true }, OLD); cover('Done. Critter VTT opens here now.'); setTimeout(() => window.close(), 400); }
      catch (err) { e.source.postMessage({ t: 'critter-move-done', ok: false, err: String(err) }, OLD); cover('Something went wrong; your data is still at critter.poly-chrome.cc.'); }
    });
    window.opener.postMessage({ t: 'critter-move-ready' }, OLD);
  }
  // the Android app reads the old address this way (it doesn't need the page to start)
  if (q.get('critter-export') === '1') { window.__MOVING = true; cover('Moving to live.crittervtt.com…'); }

  /* ---------- the old address: once moved, it goes straight to the new one ---------- */
  if (here === OLD && !window.__MOVING && LS.get('tt.movedTo') === NEW && !/CritterPlayer\//.test(navigator.userAgent)) {
    window.__MOVING = true; location.replace(NEW + location.pathname + location.search + location.hash); return;
  }
  // "Move to live.crittervtt.com": the page's notice calls this from a click (a new window needs one)
  window.critterMove = () => new Promise((resolve, reject) => {
    const w = window.open(NEW + '/?critter-move=1', 'critter-move'); if (!w) return reject(new Error('The new window was blocked. Allow pop-ups for this site and try again.'));
    let sent = false;
    const onMsg = async e => {
      if (e.origin !== NEW || e.source !== w || !e.data) return;
      if (e.data.t === 'critter-move-ready' && !sent) { sent = true; try { w.postMessage({ t: 'critter-move', payload: await dump() }, NEW); } catch (err) { removeEventListener('message', onMsg); reject(err); } }
      else if (e.data.t === 'critter-move-done') {
        removeEventListener('message', onMsg);
        if (!e.data.ok) return reject(new Error(e.data.err || 'Nothing was moved.'));
        LS.set('tt.movedTo', NEW); resolve(); location.replace(NEW + location.pathname + location.hash);
      }
    };
    addEventListener('message', onMsg);
  });
  // (the Android app: export at the old address, import at the new one, each opened with ?critter-export=1)
  window.critterExport = dump; window.critterImport = load;
})();
