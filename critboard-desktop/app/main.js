// Critter desktop: one window per table seat, the page served from the app itself.
// Each window is frameless: Critter's own title bar (titlebar.html, in its own view) sits on top, the page below it.
const { app, BaseWindow, BrowserWindow, WebContentsView, Menu, protocol, net, shell, session, ipcMain, dialog } = require('electron');
const fsp = require('node:fs/promises');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

const WWW = path.join(__dirname, 'www');
const ICON = path.join(__dirname, 'assets', 'icon.png');
const BAR_H = 34;
// the app was called Critboard before: keep using its data folder, so profiles, players and Homebase settings carry over
{ const old = path.join(app.getPath('appData'), 'Critboard'); if (require('node:fs').existsSync(old)) app.setPath('userData', old); }
// the page is served as app://critboard/, so it gets its own storage and can fetch its SRD files
protocol.registerSchemesAsPrivileged([{ scheme: 'app', privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: true, stream: true } }]);

function serveFiles(ses) {
  ses.protocol.handle('app', req => {
    let p = decodeURIComponent(new URL(req.url).pathname);
    if (p === '/' || p === '') p = '/index.html';
    const file = path.normalize(path.join(WWW, p));
    if (!file.startsWith(WWW)) return new Response('Not found', { status: 404 });
    return net.fetch(pathToFileURL(file).toString());
  });
  // a file the page offers to save gets a proper save dialog
  ses.on('will-download', (e, item) => { item.setSaveDialogOptions({ title: 'Save from Critter VTT', defaultPath: item.getFilename() }); });
}

// the page tells the title bar its theme's colours, so the bar always matches it
const THEME_JS = `(() => {
  if (window.__critterBar) return; window.__critterBar = 1;
  const send = () => { const cs = getComputedStyle(document.documentElement), v = n => cs.getPropertyValue(n).trim();
    window.critterDesktop && window.critterDesktop.theme({ bg: v('--panel') || getComputedStyle(document.body).backgroundColor, ink: v('--ink'), muted: v('--muted'), line: v('--line'), accent: v('--accent'), hover: v('--hover') }); };
  // a game system's theme is the page's <style id="sysTheme">: watch it being added and rewritten
  let T = 0; const soon = () => { clearTimeout(T); T = setTimeout(send, 40); };
  const watched = new WeakSet(), watchStyle = () => { const st = document.getElementById('sysTheme'); if (st && !watched.has(st)) { watched.add(st); new MutationObserver(soon).observe(st, { childList: true, characterData: true, subtree: true }); soon(); } };
  new MutationObserver(() => { watchStyle(); soon(); }).observe(document.body, { childList: true });
  new MutationObserver(soon).observe(document.documentElement, { attributes: true });
  watchStyle(); send(); setTimeout(send, 1500);
})()`;

const partitions = new Set(), wins = new Map();   // BaseWindow -> { bar, page }
// updates from the GitHub releases (updater.js): the window in front carries the pop-up; every window closes before the installer takes over
const frontWin = () => { const f = BaseWindow.getFocusedWindow(); return f && wins.has(f) ? f : [...wins.keys()][0] || null; };
const updates = require('./updater')({ owner: 'booskers', repo: 'crittervtt', name: 'Critter VTT', appId: 'app.critboard.desktop', parent: frontWin,
  page: () => { const w = frontWin(); return w && wins.get(w) ? wins.get(w).page.webContents : null; },
  beforeInstall: () => { quietClose = true; return Promise.all([...wins.keys()].map(w => new Promise(res => { if (w.isDestroyed()) return res(); w.once('closed', res); w.close(); }))); } });
// set while an update closes the windows: the pages save without asking
let quietClose = false;
function openWindow(partition, page) {
  const ses = partition ? session.fromPartition(partition) : session.defaultSession;
  if (!partitions.has(partition || 'default')) { partitions.add(partition || 'default'); serveFiles(ses); }
  const music = page === 'music.html';
  const win = new BaseWindow({
    width: music ? 560 : 1440, height: music ? 820 : 900, minWidth: music ? 360 : 900, minHeight: 600,
    backgroundColor: '#0c0d10', title: music ? 'Critter Music Link' : 'Critter VTT', icon: ICON, frame: false, show: false
  });
  const bar = new WebContentsView({ webPreferences: { contextIsolation: true, sandbox: true, preload: path.join(__dirname, 'titlebar-preload.js') } });
  // the table's music starts when the lobby owner presses play, without each player clicking first
  const view = new WebContentsView({ webPreferences: { contextIsolation: true, sandbox: true, session: ses, spellcheck: false, autoplayPolicy: 'no-user-gesture-required', preload: path.join(__dirname, 'page-preload.js') } });
  // the bar is see-through: the page fills the whole window and the bar lies over its top edge
  bar.setBackgroundColor('#00000000'); view.setBackgroundColor('#0c0d10');
  win.contentView.addChildView(view); win.contentView.addChildView(bar);
  const layout = () => {
    const [w, h] = win.getContentSize(), full = win.isFullScreen();
    bar.setVisible(!full);
    bar.setBounds({ x: 0, y: 0, width: w, height: BAR_H });
    view.setBounds({ x: 0, y: 0, width: w, height: h });
    if (!view.webContents.isDestroyed()) view.webContents.send('page:full', full);
  };
  layout();
  for (const ev of ['resize', 'maximize', 'unmaximize', 'enter-full-screen', 'leave-full-screen']) win.on(ev, layout);
  const state = () => { if (!bar.webContents.isDestroyed()) bar.webContents.send('bar:state', { max: win.isMaximized(), focus: win.isFocused(), title: win.getTitle() }); };
  for (const ev of ['maximize', 'unmaximize', 'focus', 'blur']) win.on(ev, state);
  bar.webContents.loadFile(path.join(__dirname, 'titlebar.html'));
  bar.webContents.on('did-finish-load', () => { state(); win.show(); });
  wins.set(win, { bar, page: view });
  win.on('closed', () => { wins.delete(win); for (const v of [bar, view]) if (!v.webContents.isDestroyed()) v.webContents.close(); });
  // closing: the page gets a moment (at most 5 s) to save and close the GM's lobby, which lasts one evening
  // If the table changed since its last save, the page asks first (Save, Don't save, Cancel): while it asks ('app:quit-wait')
  // there's no time limit, Cancel ('app:quit-cancel') keeps the window open, and a page that has crashed doesn't hold it up.
  // An update closing the windows (quietClose) saves without asking.
  let closing = false;
  win.on('close', e => {
    if (closing || view.webContents.isDestroyed()) return;
    e.preventDefault(); closing = true;
    const vw = view.webContents;
    const off = () => { ipcMain.removeListener('app:quit-ok', ok); ipcMain.removeListener('app:quit-wait', wait); ipcMain.removeListener('app:quit-cancel', cancel); vw.removeListener('render-process-gone', done); clearTimeout(t); };
    function done() { off(); if (!win.isDestroyed()) win.close(); }
    const ok = ev => { if (ev.sender === vw) done(); };
    const wait = ev => { if (ev.sender === vw) clearTimeout(t); };
    const cancel = ev => { if (ev.sender === vw) { off(); closing = false; } };
    let t = setTimeout(done, 5000);
    ipcMain.on('app:quit-ok', ok); ipcMain.on('app:quit-wait', wait); ipcMain.on('app:quit-cancel', cancel);
    vw.once('render-process-gone', done);
    vw.send('app:quitting', { quiet: quietClose });
  });

  const wc = view.webContents;
  // CB_DEV_URL=<http://localhost:8787/>: load the page from a test server instead of the built www (for trying changes without a build)
  wc.loadURL(process.env.CB_DEV_URL ? process.env.CB_DEV_URL + (page && page !== 'index.html' ? page : '') : 'app://critboard/' + (page || 'index.html'));
  wc.on('page-title-updated', (e, t) => { win.setTitle(t); state(); });
  wc.on('did-finish-load', () => wc.executeJavaScript(THEME_JS).catch(() => {}));
  // a Critter window popped out of the table (a blank page the table fills itself); links to the web open in the normal browser
  wc.setWindowOpenHandler(({ url }) => {
    if (url === 'about:blank' || url === '') return { action: 'allow', overrideBrowserWindowOptions: { autoHideMenuBar: true, backgroundColor: '#0c0d10', minWidth: 300, minHeight: 240, icon: ICON } };
    if (/^https?:/i.test(url)) shell.openExternal(url);
    return { action: 'deny' };
  });
  wc.on('will-navigate', (e, url) => { if (!url.startsWith('app://') && !(process.env.CB_DEV_URL && url.startsWith(process.env.CB_DEV_URL))) { e.preventDefault(); if (/^https?:/i.test(url)) shell.openExternal(url); } });
  // the menu's shortcuts, since a frameless window has no menu bar to carry them
  wc.on('before-input-event', (e, i) => {
    if (i.type !== 'keyDown') return;
    const k = i.key.toLowerCase(), c = i.control || i.meta;
    const run = fn => { e.preventDefault(); fn(); };
    if (c && !i.shift && k === 'n') run(() => openWindow());
    else if (c && !i.shift && k === 'r') run(() => wc.reload());
    else if (k === 'f11') run(() => win.setFullScreen(!win.isFullScreen()));
    else if (c && i.shift && k === 'i') run(() => wc.toggleDevTools());
    else if (c && k === '0') run(() => wc.setZoomLevel(0));
    else if (c && (k === '=' || k === '+')) run(() => wc.setZoomLevel(wc.getZoomLevel() + 0.5));
    else if (c && k === '-') run(() => wc.setZoomLevel(wc.getZoomLevel() - 0.5));
  });
  win.webContents = wc;   // so the rest of this file can treat it like a BrowserWindow's page
  return win;
}

const winOf = sender => { for (const [w, x] of wins) if (x.bar.webContents === sender || x.page.webContents === sender) return w; return null; };
function critterMenu(win) {
  const wc = win && wins.get(win) ? wins.get(win).page.webContents : null;
  return Menu.buildFromTemplate([
    { label: 'New window', accelerator: 'CmdOrCtrl+N', click: () => openWindow() },
    { label: 'Second seat on this computer', click: () => openWindow('persist:seat2'), toolTip: 'A separate player, for testing or hot-seat play' },
    { label: 'Music Link', click: () => openWindow(undefined, 'music.html'), toolTip: 'Hear or control a table\'s music in its own window' },
    { type: 'separator' },
    { label: 'Homebase…', click: () => { if (wc) wc.executeJavaScript('window.CRITBOARD_DESKTOP && window.CRITBOARD_DESKTOP.changeHomebase()'); } },
    { type: 'separator' },
    { label: 'View', submenu: [
      { label: 'Reload', accelerator: 'CmdOrCtrl+R', click: () => wc && wc.reload() },
      { label: 'Full screen', accelerator: 'F11', click: () => win && win.setFullScreen(!win.isFullScreen()) },
      { type: 'separator' },
      { label: 'Actual size', accelerator: 'CmdOrCtrl+0', click: () => wc && wc.setZoomLevel(0) },
      { label: 'Zoom in', accelerator: 'CmdOrCtrl+=', click: () => wc && wc.setZoomLevel(wc.getZoomLevel() + 0.5) },
      { label: 'Zoom out', accelerator: 'CmdOrCtrl+-', click: () => wc && wc.setZoomLevel(wc.getZoomLevel() - 0.5) },
      { type: 'separator' },
      { label: 'Developer tools', accelerator: 'CmdOrCtrl+Shift+I', click: () => wc && wc.toggleDevTools() }
    ] },
    ...updates.menuItems(),
    { type: 'separator' },
    { label: 'Cloudflare dashboard', click: () => shell.openExternal('https://dash.cloudflare.com/') },
    { type: 'separator' },
    { label: 'Quit Critter VTT', click: () => app.quit() }
  ]);
}
ipcMain.on('bar:cmd', (e, cmd, arg) => {
  const win = winOf(e.sender); if (!win) return;
  if (cmd === 'min') win.minimize();
  else if (cmd === 'max') win.isMaximized() ? win.unmaximize() : win.maximize();
  else if (cmd === 'close') win.close();
  else if (cmd === 'menu') critterMenu(win).popup({ window: win, x: Math.round((arg && arg.x) || 8), y: BAR_H });
});
/* the GM's saves folder: Critter writes its table saves there as plain files, and finds them again on the next start */
const SETTINGS = () => path.join(app.getPath('userData'), 'critter-settings.json');
let settingsCache = null;
async function settings() { if (!settingsCache) { try { settingsCache = JSON.parse(await fsp.readFile(SETTINGS(), 'utf8')); } catch { settingsCache = {}; } } return settingsCache; }
async function saveSettings(patch) { settingsCache = { ...(await settings()), ...patch }; await fsp.writeFile(SETTINGS(), JSON.stringify(settingsCache, null, 1)); }
// unless the GM picked a folder of their own, saves live in Documents\CritterVTT\Saves (made when first needed);
// saves kept in the old default (Documents\Critter Saves) move there once
const defaultSavesDir = () => path.join(app.getPath('documents'), 'CritterVTT', 'Saves');
const oldDefaultDir = () => path.join(app.getPath('documents'), 'Critter Saves');
let savesMoved = false;
async function savesRoot() {
  const s = await settings(), fs = require('node:fs');
  if (s.savesDir && path.resolve(s.savesDir) !== path.resolve(oldDefaultDir()) && fs.existsSync(s.savesDir)) return s.savesDir;
  const dir = defaultSavesDir();
  try {
    if (!savesMoved) {
      savesMoved = true;
      const old = oldDefaultDir();
      if (fs.existsSync(old) && !fs.existsSync(dir)) { await fsp.mkdir(path.dirname(dir), { recursive: true }); try { await fsp.rename(old, dir); } catch { await fsp.cp(old, dir, { recursive: true }); } }
    }
    await fsp.mkdir(dir, { recursive: true });
    if (s.savesDir !== dir) await saveSettings({ savesDir: dir });
    return dir;
  } catch { return null; }
}
// a path inside the saves folder, never outside it
async function inSaves(rel) {
  const root = await savesRoot(); if (!root || typeof rel !== 'string' || rel.length > 400 || /(^|[\\/])\.\.([\\/]|$)/.test(rel) || path.isAbsolute(rel)) return null;
  const p = path.normalize(path.join(root, rel)); return p === root || p.startsWith(root + path.sep) ? p : null;
}
const savesName = dir => path.resolve(dir) === path.resolve(defaultSavesDir()) ? 'CritterVTT › Saves' : path.basename(dir);
ipcMain.handle('saves:info', async () => { const r = await savesRoot(); return r ? { path: r, name: savesName(r) } : { path: null, suggested: defaultSavesDir() }; });
ipcMain.handle('saves:pick', async (e, useDefault) => {
  let dir = null;
  if (useDefault) dir = defaultSavesDir();
  else { const w = winOf(e.sender); const r = await dialog.showOpenDialog(w || undefined, { title: 'Where should Critter VTT keep its saves?', defaultPath: (await savesRoot()) || defaultSavesDir(), properties: ['openDirectory', 'createDirectory', 'promptToCreate'] }); if (r.canceled || !r.filePaths[0]) return null; dir = r.filePaths[0]; }
  await fsp.mkdir(dir, { recursive: true }); await saveSettings({ savesDir: dir });
  return { path: dir, name: savesName(dir) };
});
ipcMain.handle('saves:read', async (e, rel) => { const p = await inSaves(rel); if (!p) return null; try { return await fsp.readFile(p, 'utf8'); } catch { return null; } });
// saves are .json (pictures .txt) only: the page can't leave anything there that would run when opened
ipcMain.handle('saves:write', async (e, rel, text) => { const p = await inSaves(rel); if (!p || !/\.(json|txt)$/i.test(p) || typeof text !== 'string' || text.length > 80e6) return false; await fsp.mkdir(path.dirname(p), { recursive: true }); await fsp.writeFile(p + '.tmp', text); await fsp.rename(p + '.tmp', p); return true; });
ipcMain.handle('saves:list', async (e, rel) => { const p = await inSaves(rel || '.'); if (!p) return []; try { return (await fsp.readdir(p, { withFileTypes: true })).map(d => ({ name: d.name, dir: d.isDirectory() })); } catch { return []; } });
ipcMain.handle('saves:remove', async (e, rel) => { const p = await inSaves(rel); if (!p) return false; await fsp.rm(p, { force: true, recursive: true }); return true; });
// only folders are opened (in Explorer); a file is shown in its folder, never opened, so nothing in there can be run
ipcMain.handle('saves:open', async (e, rel) => {
  const p = (await inSaves(rel || '.')) || (rel && rel !== '.' ? null : await savesRoot()); if (!p) return false;
  let dir = false; try { dir = (await fsp.stat(p)).isDirectory(); } catch {}
  if (dir) await shell.openPath(p); else shell.showItemInFolder(p);
  return true;
});

ipcMain.on('page:theme', (e, t) => { const win = winOf(e.sender); if (win && wins.get(win)) wins.get(win).bar.webContents.send('bar:theme', t); });

app.whenReady().then(() => {
  Menu.setApplicationMenu(null);
  const win = openWindow();
  if (!process.env.CB_SELFTEST) updates.onStart();
  // CB_SELFTEST=<folder>: load, check the page and its SRD data, save a screenshot, quit (used when building)
  if (process.env.CB_SELFTEST) {
    const fs = require('node:fs');
    win.webContents.once('did-finish-load', () => setTimeout(async () => {
      if (process.env.CB_SELFTEST_SERVER && !process.env.CB_SELFTEST_DONE) {
        // point this seat at a test Homebase server once, then reload and look again
        process.env.CB_SELFTEST_DONE = '1';
        await win.webContents.executeJavaScript(`localStorage.setItem('hb.mode', 'server'); localStorage.setItem('hb.server', ${JSON.stringify(process.env.CB_SELFTEST_SERVER)}); location.reload();`);
        win.webContents.once('did-finish-load', () => setTimeout(() => win.webContents.emit('cb-selftest'), 4000));
        return;
      }
      win.webContents.emit('cb-selftest');
    }, 4000));
    win.webContents.on('cb-selftest', async () => {
      const report = await win.webContents.executeJavaScript(`(async () => ({
        title: document.title, desktop: !!window.CRITBOARD_DESKTOP, relay: (window.CRITBOARD_DESKTOP || {}).relay,
        claude: !!window.claude, titleBarLink: typeof window.critterDesktop + (window.__critterBar ? ', watching the theme' : ', not watching'), board: !!document.querySelector('#board'), tools: document.querySelectorAll('#tools .tb').length,
        musicLink: await fetch('music.html').then(r => r.ok && r.text()).then(t => !!t && t.includes('Critter Music Link')).catch(() => false),
        srd: await fetch('srd/index.json').then(r => r.ok ? r.json() : null).then(j => j ? Object.keys(j.systems).join(',') : 'missing').catch(e => 'error ' + e.message),
        homebase: window.CRITBOARD_DESKTOP ? window.CRITBOARD_DESKTOP.mode || 'not chosen' : 'missing',
        serverHealth: window.CRITBOARD_DESKTOP && window.CRITBOARD_DESKTOP.server ? await fetch(window.CRITBOARD_DESKTOP.server + '/health').then(r => r.json()).then(j => j.ok).catch(e => 'error ' + e.message) : 'no server'
      }))()`);
      fs.writeFileSync(require('node:path').join(process.env.CB_SELFTEST, 'selftest.json'), JSON.stringify(report, null, 2));
      // CB_SELFTEST_JS: something to run in the page before the screenshots (e.g. switch the theme)
      if (process.env.CB_SELFTEST_JS) { console.log('selftest js:', await win.webContents.executeJavaScript(process.env.CB_SELFTEST_JS).catch(e => 'error ' + e.message)); await new Promise(r => setTimeout(r, 600)); }
      // the screenshot is a bonus: the whole window, title bar included, when the machine can capture it
      const shot = async (wc, name) => { try { fs.writeFileSync(require('node:path').join(process.env.CB_SELFTEST, name), (await wc.capturePage()).toPNG()); } catch (e) { console.log('capture', name, e && e.message); } };
      await shot(win.webContents, 'selftest.png'); await shot(wins.get(win).bar.webContents, 'selftest-bar.png');
      app.quit();
    });
  }
});
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
app.on('activate', () => { if (BaseWindow.getAllWindows().length === 0) openWindow(); });
