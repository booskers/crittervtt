// Puts Homebase on your Cloudflare account (free Workers plan) and builds the Critter app to use it by default.
// Run it with setup-homebase.cmd (or: node setup.mjs). It uses Wrangler, Cloudflare's tool, through npx.
import { spawn, spawnSync } from 'node:child_process';
import { writeFileSync, existsSync, readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createInterface } from 'node:readline/promises';

const here = dirname(fileURLToPath(import.meta.url));
const appDir = join(here, '..', 'app');
const cfgFile = join(appDir, 'homebase.config.json');
const say = s => console.log('\n' + s);
const run = (cmd, args, cwd) => spawnSync(cmd, args, { cwd, shell: true, stdio: 'inherit' }).status === 0;
// runs a command on screen (so its questions can be answered) and also keeps what it printed
const runTee = (cmd, args, cwd) => new Promise(resolve => {
  let out = '';
  const p = spawn(cmd, args, { cwd, shell: true, stdio: ['inherit', 'pipe', 'pipe'] });
  p.stdout.on('data', d => { out += d; process.stdout.write(d); });
  p.stderr.on('data', d => { out += d; process.stderr.write(d); });
  p.on('close', code => resolve({ ok: code === 0, out }));
});
const wrangler = ['--yes', 'wrangler@4'];

say('== Homebase setup on Cloudflare ==\nThis puts Homebase on your Cloudflare account, on the free Workers plan.');

say('1. Installing what the app build needs (once).');
if (!existsSync(join(appDir, 'node_modules'))) run('npm', ['install', '--no-audit', '--no-fund'], appDir);

say('2. Building the Critter app, so the Worker can also serve it to browsers.');
if (!run('node', ['build.mjs'], appDir)) { say('The app did not build. Check the messages above.'); process.exit(1); }

say('3. Signing in to Cloudflare (a browser window may open).');
const who = spawnSync('npx', [...wrangler, 'whoami'], { cwd: here, shell: true, encoding: 'utf8' });
if (!/associated with the email|You are logged in/i.test((who.stdout || '') + (who.stderr || ''))) {
  if (!run('npx', [...wrangler, 'login'], here)) { say('Sign-in did not finish. Run this again.'); process.exit(1); }
}

say('4. Putting Homebase online. If Cloudflare asks you to pick a workers.dev subdomain, choose one: it becomes part of the address.');
const dep = await runTee('npx', [...wrangler, 'deploy'], here);
// a custom domain in wrangler.toml (routes … custom_domain = true) is the address to use; otherwise the workers.dev one
const customDomain = (readFileSync(join(here, 'wrangler.toml'), 'utf8').match(/pattern\s*=\s*"([^"*\/]+)"\s*,\s*custom_domain\s*=\s*true/) || [])[1];
let url = customDomain ? 'https://' + customDomain : ((dep.out.match(/https:\/\/[\w.-]+\.workers\.dev/g) || []).pop() || '').replace(/\/+$/, '');
if (!dep.ok) { say('Homebase did not go online. Check the messages above, then run this again.'); process.exit(1); }
if (!url) {
  say('Homebase went online, but I could not read its address from the output above.');
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  url = (await rl.question('Paste the https://….workers.dev address: ')).trim().replace(/\/+$/, ''); rl.close();
  if (!url) process.exit(1);
}
await finish(url);

async function finish(url) {
  say(`5. Checking ${url} …`);
  let ok = false;
  for (let i = 0; i < 10 && !ok; i++) { try { ok = !!(await (await fetch(url + '/health')).json()).ok; } catch {} if (!ok) await new Promise(r => setTimeout(r, 3000)); }
  console.log(ok ? 'Homebase answers.' : 'Homebase does not answer yet (new addresses can take a minute). Carrying on.');

  const cfg = existsSync(cfgFile) ? JSON.parse(readFileSync(cfgFile, 'utf8')) : {};
  cfg.server = url; delete cfg.firebase;
  writeFileSync(cfgFile, JSON.stringify(cfg, null, 2) + '\n');
  console.log(`Saved the address to ${cfgFile}`);

  say('6. Building the Critter installer with this Homebase as its default.');
  const b = run('npm', ['run', 'dist'], appDir);
  say(b ? `Done.\n  Installer: ${join(appDir, 'dist')}\n  Play in a browser: ${url}\nEveryone who installs it, or opens that address, plays through your Homebase.` : 'The installer did not build; run "npm run dist" in the app folder.');
}
