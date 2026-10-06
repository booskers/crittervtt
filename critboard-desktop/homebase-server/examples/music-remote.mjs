// An outside app controlling a Critter table's music through a self-hosted Homebase server.
//   node examples/music-remote.mjs <server> <lobby code> <key> [play|pause|next|prev|stop|status]
//   node examples/music-remote.mjs http://192.168.1.20:8787 HZAYB5 EMJQE-SQSW5 next
// It reads the music state like the Critter page does, and sends commands the GM's page checks against the key.
import { WebSocket } from 'ws';
import { randomBytes } from 'node:crypto';

const [server, rawCode, key, op = 'status'] = process.argv.slice(2);
if (!server || !rawCode) { console.log('usage: node music-remote.mjs <server> <lobby code> <key> [play|pause|next|prev|stop|status]'); process.exit(1); }
const code = rawCode.toUpperCase().replace(/[^A-Z0-9]/g, '');
const id = n => randomBytes(n).toString('hex');
// every app gets its own player id and secret key on first contact; keep them if you connect again later
const uid = 'u' + id(10), secret = id(20), peer = 'p' + id(6), room = 'lobby-' + code.toLowerCase(), rid = id(5);

const ws = new WebSocket(server.replace(/^http/, 'ws').replace(/\/+$/, '') + '/ws');
const send = m => ws.send(JSON.stringify(m));
const done = (text, exit = 0) => { console.log(text); ws.close(); process.exit(exit); };
setTimeout(() => done('No answer in time. Is the GM\'s Critter page open at the table?', 1), 8000);

ws.on('open', () => {
  send({ t: 'hello', uid, key: secret });
  send({ t: 'sub', scope: 'L' + code });
  send({ t: 'join', room, peer, presence: { app: 'music-remote' } });
});
ws.on('message', raw => {
  const m = JSON.parse(raw);
  if (m.t === 'snap') {
    const lobby = m.docs.find(d => d.p === `lobbies/${code}`), music = (m.docs.find(d => d.p === `lobbies/${code}/state/music`) || {}).d || {};
    if (!lobby) done(`No lobby uses the code ${code}.`, 1);
    const cur = (music.list || []).find(t => t.id === music.cur);
    console.log(cur ? `${music.playing ? 'Playing' : 'Paused'}: ${cur.title}` : 'Nothing playing.');
    (music.list || []).forEach((t, i) => console.log(`  ${t.id === music.cur ? '>' : ' '} ${i + 1}. ${t.title}`));
    if (op === 'status') done('');
    else if (!key) done('A key is needed to control the music.', 1);
    // the GM's page answers with music-ack carrying this rid
    else send({ t: 'emit', room, peer, topic: 'music', data: { op, key, rid } });
  }
  if (m.t === 'evt' && m.topic === 'music-ack' && m.data && m.data.rid === rid) done(m.data.ok ? `${op}: done.` : `${op}: refused (${m.data.err}).`, m.data.ok ? 0 : 1);
});
ws.on('error', e => done('Could not reach the Homebase server: ' + e.message, 1));
