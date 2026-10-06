// Contrast check for the specimen (index.html). Start a Chromium-based browser with --remote-debugging-port=9462
// on the served index.html, then: node <this file> 9462 index.html <dark|light> <real|white|black>
// It hides the text, screenshots what is behind each text line box and compares against the worst pixel.
// allcheck: every piece of text on the page.
// pixel contrast for text that sits on .bleed areas. node bleedcheck.mjs <port> <match> <scheme> <art: real|white|black>
const [port, match, scheme, art] = process.argv.slice(2);
const t = (await (await fetch(`http://127.0.0.1:${port}/json`)).json()).find(x => x.type === 'page' && x.url.includes(match));
const ws = new WebSocket(t.webSocketDebuggerUrl); await new Promise(r => ws.onopen = r);
let id = 0; const pend = new Map(); ws.onmessage = m => { const d = JSON.parse(m.data); if (pend.has(d.id)) { pend.get(d.id)(d); pend.delete(d.id); } };
const send = (method, params = {}) => new Promise(r => { const i = ++id; pend.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });
const ev = async js => { const r = await send('Runtime.evaluate', { expression: js, awaitPromise: true, returnByValue: true }); if (r.result.exceptionDetails) throw new Error(JSON.stringify(r.result.exceptionDetails).slice(0, 600)); return r.result.result.value; };
await ev(`document.querySelector('[data-scheme=${scheme}]').click(); scrollTo(0,0); 1`);
const H = await ev('document.documentElement.scrollHeight');
await send('Emulation.setDeviceMetricsOverride', { width: 1300, height: H, deviceScaleFactor: 1, mobile: false });
await new Promise(r => setTimeout(r, 900));
const items = await ev(`(() => {
  ${art === 'white' ? "document.querySelectorAll('.bleed').forEach(e => e.style.setProperty('--art','linear-gradient(#fff,#fff)'));" : art === 'black' ? "document.querySelectorAll('.bleed').forEach(e => e.style.setProperty('--art','linear-gradient(#000,#000)'));" : ''}
  const cv = document.createElement('canvas'); cv.width = cv.height = 1; const cx = cv.getContext('2d', { willReadFrequently: true });
  const rgb = c => { cx.clearRect(0, 0, 1, 1); cx.fillStyle = c; cx.fillRect(0, 0, 1, 1); return [...cx.getImageData(0, 0, 1, 1).data].slice(0, 3); };
  const out = [];
  for (const e of document.body.querySelectorAll('*')) { if (e.closest('template,option,select,.levels,.picks,.artpick')) continue;
    if (!e.offsetParent && e.tagName !== 'B') continue;
    const own = [...e.childNodes].some(n => n.nodeType === 3 && n.textContent.trim());
    if (!own || e.closest('svg')) continue;
    const cs = getComputedStyle(e);
    if (cs.visibility === 'hidden' || +cs.opacity === 0) continue;
    const rg = document.createRange(), rects = [];
    for (const n of e.childNodes) if (n.nodeType === 3 && n.textContent.trim()) { rg.selectNodeContents(n); rects.push(...rg.getClientRects()); }
    e.setAttribute('data-chk', 1);
    for (const r of rects) { if (r.width < 2 || r.height < 2) continue;
      out.push({ sel: (e.className || e.tagName) + ' "' + e.textContent.trim().slice(0, 24) + '"', x: r.left + scrollX, y: r.top + scrollY, w: r.width, h: r.height, c: rgb(cs.color), size: parseFloat(cs.fontSize), wt: +cs.fontWeight }); }
  }
  const st = document.createElement('style'); st.id = 'chkst'; st.textContent = '[data-chk]{color:transparent!important;text-shadow:none!important;-webkit-text-fill-color:transparent!important}[data-chk] svg,[data-chk] .art{visibility:hidden!important}'; document.head.append(st);
  return out;
})()`);
await new Promise(r => setTimeout(r, 900));
const shot = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true });
const res = await ev(`(async () => {
  const items = ${JSON.stringify(items)};
  const img = new Image(); img.src = 'data:image/png;base64,${shot.result.data}'; await img.decode();
  const c = document.createElement('canvas'); c.width = img.width; c.height = img.height; const g = c.getContext('2d'); g.drawImage(img, 0, 0);
  const lin = v => { v /= 255; return v <= .04045 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4; };
  const L = (r, gg, b) => .2126 * lin(r) + .7152 * lin(gg) + .0722 * lin(b);
  const hex = h => { const m = h.match(/\w\w/g).map(x => parseInt(x, 16)); return m; };
  return items.map(it => {
    const d = g.getImageData(Math.round(it.x), Math.round(it.y), Math.max(1, Math.round(it.w)), Math.max(1, Math.round(it.h))).data;
    const tl = L(...it.c);
    let worst = 99;
    for (let i = 0; i < d.length; i += 4) { const bl = L(d[i], d[i + 1], d[i + 2]); const cr = (Math.max(tl, bl) + .05) / (Math.min(tl, bl) + .05); if (cr < worst) worst = cr; }
    const large = it.size >= 24 || (it.size >= 18.66 && it.wt >= 700);
    return { sel: it.sel, ratio: +worst.toFixed(2), need: large ? 3 : 4.5 };
  });
})()`);
await ev(`document.getElementById('chkst').remove(); document.querySelectorAll('[data-chk]').forEach(e => e.removeAttribute('data-chk')); document.querySelectorAll('.bleed').forEach(e => e.style.removeProperty('--art')); 1`);
const bad = res.filter(r => r.ratio < r.need);
console.log(`${scheme}/${art}: ${res.length} text items on the page, ${bad.length} below AA; lowest ${Math.min(...res.map(r => r.ratio))}`);
for (const b of bad) console.log('  FAIL', b.ratio, '<', b.need, b.sel);
process.exit(0);
