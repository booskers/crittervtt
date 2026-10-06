// what the Critter page can ask of the app: its theme's colours for the title bar, and its saves folder.
// The page also learns it runs in the app (html.critter-app): it leaves room for the title bar and hides the pop-out buttons.
const { contextBridge, ipcRenderer } = require('electron');
const clean = t => { const out = {}; for (const k of ['bg', 'ink', 'muted', 'line', 'accent', 'hover']) { const v = t && t[k]; if (typeof v === 'string' && v.length < 60 && /^[#\w(),.\s%-]+$/.test(v)) out[k] = v; } return out; };
const rel = p => String(p || '').slice(0, 400);
contextBridge.exposeInMainWorld('critterDesktop', {
  theme: t => ipcRenderer.send('page:theme', clean(t)),
  // the GM's saves folder: plain files Critter finds again next time (paths are always inside that folder)
  saves: {
    info: () => ipcRenderer.invoke('saves:info'),
    pick: useDefault => ipcRenderer.invoke('saves:pick', !!useDefault),
    read: p => ipcRenderer.invoke('saves:read', rel(p)),
    write: (p, text) => ipcRenderer.invoke('saves:write', rel(p), String(text)),
    list: p => ipcRenderer.invoke('saves:list', rel(p)),
    remove: p => ipcRenderer.invoke('saves:remove', rel(p)),
    open: p => ipcRenderer.invoke('saves:open', rel(p))
  }
});
const mark = () => { if (document.documentElement) document.documentElement.classList.add('critter-app'); };
mark(); document.addEventListener('DOMContentLoaded', mark);
ipcRenderer.on('page:full', (e, on) => document.documentElement.classList.toggle('app-full', !!on));
