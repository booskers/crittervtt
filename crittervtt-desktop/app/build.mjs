// Puts the Critter page, its SRD data and Homebase into ./www for the desktop app (and for the Homebase server).
// The page is the same file that is published as the claude.ai artifact.
//   homebase.config.json  { "server": "https://critter.poly-chrome.cc" } (or a workers.dev address), written by homebase-cloudflare/setup-homebase.cmd;
//                         without it the app asks where to connect
//   HOMEBASE_SERVER=<url> use another built-in Homebase for this build (for testing, e.g. http://localhost:8787 from "wrangler dev")
import { readFile, writeFile, mkdir, cp, rm, readdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';

const here = dirname(fileURLToPath(import.meta.url));
const src = join(here, '..', '..', 'crittervtt');
const out = join(here, 'www');

// empty www rather than delete it, so a running "wrangler dev" watching it doesn't block the build
await mkdir(out, { recursive: true });
for (const f of await readdir(out)) await rm(join(out, f), { recursive: true, force: true });

// the version shows under the logo (the page reads window.CRITTER_VERSION; the claude.ai copy has none and shows nothing)
const version = JSON.parse(await readFile(join(here, 'package.json'), 'utf8')).version;
const cfgFile = join(here, 'homebase.config.json');
const cfg = existsSync(cfgFile) ? JSON.parse(await readFile(cfgFile, 'utf8')) : {};
if (process.env.HOMEBASE_SERVER !== undefined) cfg.server = process.env.HOMEBASE_SERVER;
if (!cfg.server) delete cfg.server;
delete cfg.firebase;

await build({ entryPoints: [join(here, 'shim', 'homebase-client.js')], bundle: true, format: 'iife', minify: true, target: 'chrome120', outfile: join(out, 'homebase.js'), logLevel: 'warning' });

const wrap = body => `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<link rel="icon" href="favicon.ico" sizes="any">
<link rel="icon" href="favicon.png" type="image/png">
<link rel="apple-touch-icon" href="apple-touch-icon.png">
<link rel="manifest" href="manifest.webmanifest">
<meta name="theme-color" content="#0b0c0f">
<script>window.HOMEBASE_CONFIG = ${JSON.stringify(cfg)}; window.CRITTER_VERSION = ${JSON.stringify(version)};</script>
<script src="homebase.js"></script>
</head>
<body>
${body}
</body>
</html>
`;
const html = wrap(await readFile(join(src, 'crittervtt.html'), 'utf8'));
await writeFile(join(out, 'index.html'), html);
// Critter Music Link: hears and controls a table's music from outside, with the lobby code
await writeFile(join(out, 'music.html'), wrap(await readFile(join(here, 'music-link.html'), 'utf8')));
await cp(join(src, 'srd'), join(out, 'srd'), { recursive: true });
// the Critter icon for browser tabs and home screens
for (const f of ['favicon.ico', 'favicon.png', 'apple-touch-icon.png', 'icon-192.png', 'icon-512.png']) await cp(join(here, 'assets', f), join(out, f));
// installable from the browser (Chrome's "Install app"): its own window and home-screen icon
await writeFile(join(out, 'manifest.webmanifest'), JSON.stringify({
  name: 'Critter VTT', short_name: 'Critter VTT', description: 'A free virtual tabletop: battle map, dice, sheets and rulebooks, live with your group.',
  start_url: '/', scope: '/', display: 'standalone', background_color: '#0b0c0f', theme_color: '#0b0c0f',
  icons: [{ src: 'icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' }, { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' }]
}, null, 1));
console.log(`www ready: page ${(html.length / 1024).toFixed(0)} KB, Homebase ${cfg.server ? 'at ' + cfg.server : 'not configured (the app will ask)'}`);
