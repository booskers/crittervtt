// D&D Beyond for a lobby owner, the way the DDB Importer proxy does it (github.com/MrPrimate/ddb-proxy):
// the owner's CobaltSession cookie (their D&D Beyond login) is swapped for a short-lived token at D&D Beyond's login
// service, then D&D Beyond's own game-data services are asked for what the account owns. D&D Beyond decides what that
// is: the books on the account, plus anything shared through a campaign with content sharing.
// The cookie is used for this request only. It is never written to disk or logged; the token is kept in memory for
// four minutes (they last five), keyed by a hash of the cookie.
// The same file is used by the self-hosted server and the Cloudflare Worker (copied to homebase-cloudflare/src/ddb.js).
const AUTH = 'https://auth-service.dndbeyond.com/v1/cobalt-token';
const CHAR = 'https://character-service.dndbeyond.com/character/v5';
const MONSTERS = 'https://monster-service.dndbeyond.com/v1/Monster';
const CONFIG = 'https://www.dndbeyond.com/api/config/json';
// D&D Beyond's class ids (from ddb-proxy's config)
const CLASSES = [['Barbarian', 9], ['Bard', 1], ['Cleric', 2], ['Druid', 3], ['Fighter', 10], ['Monk', 11], ['Paladin', 4], ['Ranger', 5], ['Rogue', 12], ['Sorcerer', 6], ['Warlock', 7], ['Wizard', 8], ['Artificer', 252717], ['Blood Hunter', 357975]];
// sourceId 39 is D&D Beyond's "homebrew collection" placeholder; ddb-proxy leaves it out too
const NOT_A_BOOK = 39;

const tokens = new Map();
const sha = async s => [...new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s)))].map(b => b.toString(16).padStart(2, '0')).join('');
// what people paste: the bare value, or "CobaltSession=…", in quotes, with a ";" or spaces, or a whole Cookie header
function cleanCobalt(raw) {
  let s = String(raw || '').trim();
  const named = /(?:^|[;\s])CobaltSession\s*=\s*("?)([^;"\s]+)\1/.exec(s);
  if (named) s = named[2];
  s = s.replace(/^["']+|["';]+$/g, '').replace(/\s+/g, '');
  return s;
}
const UA = { 'user-agent': 'Mozilla/5.0 (compatible; Critter-Homebase/1.0)', accept: 'application/json' };
async function token(cobalt) {
  const k = await sha(cobalt), t = tokens.get(k);
  if (t && t.until > Date.now()) return t.token;
  const r = await fetch(AUTH, { method: 'POST', headers: { ...UA, 'content-type': 'application/json', cookie: `CobaltSession=${cobalt}` } });
  const j = await r.json().catch(() => null);
  if (r.ok && j && j.token) {
    for (const [key, v] of tokens) if (v.until <= Date.now()) tokens.delete(key);
    tokens.set(k, { token: j.token, until: Date.now() + 4 * 60 * 1000 });
    return j.token;
  }
  if (r.status === 401 || r.status === 403 || (j && j.token === null)) throw new Error(`D&D Beyond didn't accept that cookie (it answered ${r.status}, no login). Check it's the one named exactly CobaltSession (there are several starting with "Cobalt"), copy the whole value, and that you're still logged in on dndbeyond.com: logging out ends it. What was sent: ${cobalt.length} characters, starting "${cobalt.slice(0, 4)}…".`);
  throw new Error(`D&D Beyond's login service answered ${r.status}${j ? '' : ' with something other than JSON (it may be blocking this Homebase)'}.`);
}
async function get(url, tok) {
  const r = await fetch(url, { headers: tok ? { ...UA, authorization: `Bearer ${tok}` } : UA });
  if (!r.ok) throw new Error(`D&D Beyond answered ${r.status} for ${new URL(url).pathname}.`);
  return r.json();
}
const real = x => !x.sources || !x.sources.length || x.sources.some(s => s.sourceId != NOT_A_BOOK);
// the lookup tables Critter needs to read monsters and books: names for ids
function trimConfig(c) {
  const keep = ['sources', 'sourceCategories', 'challengeRatings', 'monsterTypes', 'monsterSubTypes', 'creatureSizes', 'alignments', 'stats', 'senses', 'movements', 'damageTypes', 'conditions', 'languages', 'abilitySkills', 'environments'];
  const out = {};
  for (const k of keep) if (Array.isArray(c && c[k])) out[k] = c[k].map(x => ({ id: x.id, name: x.name, value: x.value, proficiencyBonus: x.proficiencyBonus, key: x.key, isReleased: x.isReleased, description: typeof x.description === 'string' ? x.description.slice(0, 80) : undefined, stat: x.stat }));
  return out;
}
export async function ddbRequest(m) {
  const what = String(m.what || '');
  if (what === 'config') return trimConfig(await get(CONFIG));
  const cobalt = cleanCobalt(m.cobalt);
  if (!cobalt) throw new Error('Paste the value of your D&D Beyond CobaltSession cookie.');
  if (cobalt.length < 20 || cobalt.length > 8000 || /[^\x21-\x7e]/.test(cobalt)) throw new Error(`That doesn't look like a CobaltSession value (${cobalt.length} characters${/[^\x21-\x7e]/.test(cobalt) ? ', with characters a cookie can\'t have' : ''}). Copy only the Value column of the row named CobaltSession.`);
  const tok = await token(cobalt);
  const camp = /^\d{1,12}$/.test(String(m.campaignId || '')) ? `&campaignId=${m.campaignId}` : '';
  if (what === 'check') return { ok: true };
  if (what === 'items') { const j = await get(`${CHAR}/game-data/items?sharingSetting=2${camp}`, tok); return (j.data || []).filter(real); }
  if (what === 'spells') {
    // every class's list at level 20, plus the spells a class always has; one spell may appear under several classes
    // one class (cls), so the importer can report as it goes, or all of them
    const byId = new Map(), which = m.cls ? CLASSES.filter(([n]) => n === m.cls) : CLASSES;
    for (const [name, id] of which) {
      for (const url of [`${CHAR}/game-data/spells?classId=${id}&classLevel=20&sharingSetting=2${camp}`, `${CHAR}/game-data/always-known-spells?classId=${id}&classLevel=20&sharingSetting=2${camp}`]) {
        let j; try { j = await get(url, tok); } catch { continue; }
        for (const s of j.data || []) {
          const d = s && s.definition; if (!d || !d.id || !real(d)) continue;
          const have = byId.get(d.id) || { ...d, classes: [] };
          if (!have.classes.includes(name)) have.classes.push(name);
          byId.set(d.id, have);
        }
      }
    }
    return [...byId.values()];
  }
  if (what === 'monsters') {
    const skip = Math.max(0, Math.floor(+m.skip || 0)), take = 100;
    const src = (Array.isArray(m.sources) ? m.sources : []).filter(x => /^\d{1,6}$/.test(String(x))).map(s => `&sources=${s}`).join('');
    const j = await get(`${MONSTERS}?search=${encodeURIComponent(String(m.search || '').slice(0, 80))}&skip=${skip}&take=${take}${m.homebrew ? '' : '&showHomebrew=f'}${src}`, tok);
    return { total: j.pagination ? +j.pagination.total || 0 : null, list: (j.data || []).filter(x => x.isReleased === true || x.isHomebrew) };
  }
  throw new Error('Unknown D&D Beyond request.');
}
