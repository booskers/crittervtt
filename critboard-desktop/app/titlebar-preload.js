// the title bar's line to the app: window buttons and the menu out, window state and the page's colours in
const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('bar', {
  cmd: (c, arg) => ipcRenderer.send('bar:cmd', c, arg),
  onState: fn => ipcRenderer.on('bar:state', (e, s) => fn(s)),
  onTheme: fn => ipcRenderer.on('bar:theme', (e, t) => fn(t))
});
