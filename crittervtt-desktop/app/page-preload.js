// what the Critter page can ask of the app: its theme's colours for the title bar, and its saves folder.
// The page also learns it runs in the app (html.critter-app): it leaves room for the title bar and hides the pop-out buttons.
const { contextBridge, ipcRenderer } = require('electron');
const clean = t => { const out = {}; for (const k of ['bg', 'ink', 'muted', 'line', 'accent', 'hover']) { const v = t && t[k]; if (typeof v === 'string' && v.length < 60 && /^[#\w(),.\s%-]+$/.test(v)) out[k] = v; } return out; };
const rel = p => String(p || '').slice(0, 400);
// closing: the page's tidy-up (if it set one), then the app may close the window
let quitFn = null;
// the page's quitFn may answer 'cancel' (the GM chose to stay); it can say it's asking (quitWait), so the app waits as long as it takes
ipcRenderer.on('app:quitting', async (e, info) => { let r; try { if (quitFn) r = await quitFn(info || {}); } catch {} ipcRenderer.send(r === 'cancel' ? 'app:quit-cancel' : 'app:quit-ok'); });
contextBridge.exposeInMainWorld('critterDesktop', {
  theme: t => ipcRenderer.send('page:theme', clean(t)),
  // the app is closing: the page tidies up (a last save, the GM's lobby closed), then says so; the app waits at most 5 s
  onQuit: fn => { quitFn = typeof fn === 'function' ? fn : null; },
  // the page is asking the GM something before it closes: no time limit
  quitWait: () => ipcRenderer.send('app:quit-wait'),
  // the GM's saves folder: plain files Critter finds again next time (paths are always inside that folder)
  saves: {
    info: () => ipcRenderer.invoke('saves:info'),
    pick: useDefault => ipcRenderer.invoke('saves:pick', !!useDefault),
    read: p => ipcRenderer.invoke('saves:read', rel(p)),
    write: (p, text) => ipcRenderer.invoke('saves:write', rel(p), String(text)),
    list: p => ipcRenderer.invoke('saves:list', rel(p)),
    remove: p => ipcRenderer.invoke('saves:remove', rel(p)),
    open: p => ipcRenderer.invoke('saves:open', rel(p))
  },
  // updates from GitHub: { auto, skip, version, repo, changelog }, the on-start setting, a check now, the GitHub page
  updates: {
    get: () => ipcRenderer.invoke('upd:get'),
    set: auto => ipcRenderer.invoke('upd:set', { auto: !!auto }),
    check: () => ipcRenderer.invoke('upd:check'),
    github: () => ipcRenderer.invoke('upd:github')
  }
});
const mark = () => { if (document.documentElement) document.documentElement.classList.add('critter-app'); };
mark(); document.addEventListener('DOMContentLoaded', mark);
ipcRenderer.on('page:full', (e, on) => document.documentElement.classList.toggle('app-full', !!on));
