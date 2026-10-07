// Builds the three websites (GitHub Pages, each repo's docs/) from one template:
//   node critter-design/sites/build.mjs [screenshots folder]
// Screenshots (vtt-*.jpg, sounds-*.jpg, notes-*.jpg) are copied from the folder when given; otherwise each site keeps its own.
// Every site gets the logos and icons of all three apps (for the "Check out also" strip and the family section),
// the Atkinson Hyperlegible Next font (OFL) and site.css.
import { readFileSync, writeFileSync, mkdirSync, copyFileSync, existsSync, readdirSync, rmSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url)), ROOT = join(here, '..', '..');
const SHOTS = process.argv[2] || '';
const GH = 'https://github.com/booskers';

/* ---------------- the three apps ---------------- */
const APPS = {
  vtt: {
    name: 'Critter VTT', repo: 'crittervtt', out: join(ROOT, 'docs'), color: '#ff5c00', accent2: '#3cc4c4',
    logo: join(ROOT, 'crittervtt-desktop', 'app', 'logo-src', 'critter-vtt-logo.svg'), icon: join(ROOT, 'crittervtt-desktop', 'app', 'assets', 'icon.png'),
    setup: 'Critter-Setup.exe', tagline: 'the free virtual tabletop', short: 'The free virtual tabletop: battle maps, 3D dice and sheets, in a browser or on Windows.'
  },
  sounds: {
    name: 'Critter Sounds', repo: 'critter-sounds', out: join(ROOT, 'crittervtt-desktop', 'music', 'docs'), color: '#8800ff', accent2: '#4cc9f0',
    logo: join(ROOT, 'crittervtt-desktop', 'music', 'src', 'logo.svg'), icon: join(ROOT, 'crittervtt-desktop', 'music', 'assets', 'icon.png'),
    setup: 'Critter-Sounds-Setup.exe', tagline: 'music and sound, played live to your table', short: 'Music, sound pads and soundscapes, played live to your table, Discord or Fluxer.'
  },
  notes: {
    name: 'Critter Notes', repo: 'critter-notes', out: join(ROOT, 'critter-notes', 'docs'), color: '#ffbd00', accent2: '#7a8cff',
    logo: join(ROOT, 'critter-notes', 'logo-src', 'critter-notes-logo.svg'), icon: join(ROOT, 'critter-notes', 'assets', 'icon.png'),
    setup: 'Critter-Notes-Setup.exe', tagline: 'your campaign, planned and ready to run', short: 'Plan sessions, write the world, draw maps and boards, and send it all to the table.'
  }
};
const site = k => `https://booskers.github.io/${APPS[k].repo}/`;
const dl = k => `${GH}/${APPS[k].repo}/releases/latest/download/${APPS[k].setup}`;

/* ---------------- a few line icons (24px, stroke) ---------------- */
const I = {
  dice: '<path d="M12 2l8.7 5v10L12 22l-8.7-5V7z"/><path d="M12 22V12M3.3 7L12 12l8.7-5"/>',
  map: '<path d="M9 4L3 6v14l6-2 6 2 6-2V4l-6 2z"/><path d="M9 4v14M15 6v14"/>',
  sheet: '<rect x="4" y="3" width="16" height="18" rx="2"/><path d="M8 8h8M8 12h8M8 16h5"/>',
  book: '<path d="M4 19.5A2.5 2.5 0 016.5 17H20V3H6.5A2.5 2.5 0 004 5.5z"/><path d="M4 19.5A2.5 2.5 0 006.5 22H20v-5"/>',
  swords: '<path d="M14.5 17.5L3 6V3h3l11.5 11.5M13 19l6-6M16 16l4 4M19 21l2-2M9.5 6.5L21 18v3h-3L6.5 9.5M5 14l4 4M7 17l-3 3M3 19l2 2"/>',
  wall: '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 10h18M3 15h18M9 4v6M15 10v5M9 15v5"/>',
  rewind: '<path d="M3 12a9 9 0 109-9 9.75 9.75 0 00-6.74 2.74L3 8"/><path d="M3 3v5h5"/>',
  phone: '<rect x="7" y="2" width="10" height="20" rx="2"/><path d="M11 18h2"/>',
  server: '<rect x="3" y="3" width="18" height="7" rx="2"/><rect x="3" y="14" width="18" height="7" rx="2"/><path d="M7 6.5h.01M7 17.5h.01"/>',
  users: '<path d="M17 20v-2a4 4 0 00-4-4H7a4 4 0 00-4 4v2"/><circle cx="10" cy="7" r="4"/><path d="M21 20v-2a4 4 0 00-3-3.9M16 3.1a4 4 0 010 7.8"/>',
  eye: '<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
  update: '<path d="M21 12a9 9 0 11-3-6.7L21 8"/><path d="M21 3v5h-5"/>',
  music: '<path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/>',
  pads: '<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>',
  nodes: '<circle cx="6" cy="6" r="3"/><circle cx="18" cy="18" r="3"/><path d="M9 6h4a3 3 0 013 3v6"/>',
  wave: '<path d="M2 12h3l3-8 4 16 3-8h7"/>',
  globe: '<circle cx="12" cy="12" r="10"/><path d="M2 12h20M12 2a15 15 0 010 20M12 2a15 15 0 000 20"/>',
  mic: '<rect x="9" y="2" width="6" height="12" rx="3"/><path d="M5 10a7 7 0 0014 0M12 17v5"/>',
  layout: '<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M9 21V9"/>',
  log: '<path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><path d="M14 2v6h6M8 13h8M8 17h5"/>',
  pen: '<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 013 3L7 19l-4 1 1-4z"/>',
  board: '<rect x="3" y="3" width="7" height="9" rx="1.5"/><rect x="14" y="3" width="7" height="5" rx="1.5"/><rect x="14" y="12" width="7" height="9" rx="1.5"/><rect x="3" y="16" width="7" height="5" rx="1.5"/>',
  clock: '<circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>',
  link: '<path d="M10 13a5 5 0 007.5.5l3-3a5 5 0 00-7-7l-1.7 1.7"/><path d="M14 11a5 5 0 00-7.5-.5l-3 3a5 5 0 007 7l1.7-1.7"/>',
  send: '<path d="M22 2L11 13M22 2l-7 20-4-9-9-4z"/>',
  lock: '<rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 018 0v4"/>',
  table: '<path d="M3 3h18v18H3zM3 9h18M3 15h18M9 3v18"/>',
  play: '<path d="M6 4l14 8-14 8z"/>',
  down: '<path d="M12 4v11m0 0l-5-5m5 5l5-5M4 20h16"/>'
};
const ic = n => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${I[n]}</svg>`;
const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const card = ([icon, title, text], two) => `<div class="card${two ? ' two' : ''}"><div class="ic">${ic(icon)}</div><h3>${esc(title)}</h3><p>${text}</p></div>`;
const ticks = list => `<ul class="ticks">${list.map(([b, t]) => `<li><b>${b}</b> ${t}</li>`).join('')}</ul>`;
const shot = (file, alt, w, h, caption) => `<figure class="media"><img src="img/${file}" alt="${esc(alt)}" width="${w}" height="${h}" loading="lazy">${caption ? `<figcaption>${caption}</figcaption>` : ''}</figure>`;

/* ---------------- each app's page ---------------- */
const PAGES = {
  vtt: {
    title: 'Critter VTT', desc: 'A free virtual tabletop: battle maps, 3D dice, character sheets and rulebooks, shared live with your group in a browser or on Windows.',
    nav: [['#play', 'Features'], ['#sheets', 'Sheets'], ['#host', 'Host it'], ['#download', 'Download']],
    h1: 'Your table, <em>ready to play.</em>',
    lede: 'Critter VTT is a free virtual tabletop. Share a lobby code and your group sits down at the same battle map, with the same dice, sheets and rulebooks, and every roll as it happens.',
    ctas: [['primary', 'play', 'Play in your browser', 'https://critter.poly-chrome.cc'], ['', 'down', 'Download for Windows', dl('vtt')]],
    note: 'Free and open source. Nothing to install to play in a browser.',
    hero: ['vtt-hero.jpg', 'A battle in Critter VTT: the dungeon map with character and monster tokens, a fireball measured over three goblins, 3D dice rolling, the turn order and a busy chat', 3200, 1920, 'Round one in the crypt: Seraphine’s Fireball rolls 8d6 in her colour while the GM rolls the goblins’ saves. The turn order, live cursors and the 20 ft radius are all shared.'],
    sections: [
      { id: 'play', eyebrow: 'At the table', h2: 'Everyone sees the same moment.', sub: 'The board, the dice and the chat are shared live. Rolls tumble on everyone’s screen in the roller’s colour, and land in the chat with every die shown.',
        body: ticks([['3D dice', 'from d4 to d100 with real physics, plus typed rolls like <code>2d20kh1+7</code>, modifiers, advantage, and hidden GM rolls.'], ['A battle map', 'with tokens, health bars, drawing tools, arrows, text and live cursors for every player.'], ['Measuring', 'lines, cones and circles that count squares and light up every token they catch.'], ['Turn order', 'with initiative rolled from each sheet, rounds, and a ring around whoever’s up.'], ['Chat and whispers', 'with messages, replies, private rolls and handouts.']]) },
      { id: 'sheets', eyebrow: 'Characters', h2: 'Sheets that roll for you.', sub: 'Each player claims their seat and gets their own sheet, coloured in their colour. Click a skill, a save or an attack, and it rolls.', rev: true,
        media: shot('vtt-sheet.jpg', 'Brannoc Ironfist’s D&D 5e character sheet open beside the board and the chat', 3200, 1920),
        body: ticks([['Character sheets', 'for D&amp;D 5e, Pathfinder 2e, Daggerheart and more, with conditions that change the rolls.'], ['Bring your character', 'from D&amp;D Beyond (through your Homebase), Foundry VTT, or a filled-in PDF.'], ['Level up', 'step by step, with the rules of your system.']]) },
      { id: 'library', eyebrow: 'Rulebooks', h2: 'The rules are already on the table.', sub: 'A built-in compendium of monsters, spells, items, classes and backgrounds: search it, drop a monster on the board, or add it straight to the turn order.',
        media: shot('vtt-library.jpg', 'The Library window searching the D&D 5e compendium for dragons, beside the battle map', 3200, 1920),
        body: ticks([['Compendium', 'for D&amp;D 5e, Pathfinder 2e, Daggerheart, Blades in the Dark and Fate.'], ['Eleven game systems', 'with their own dice rules, from plain dice to Call of Cthulhu, Powered by the Apocalypse, Vampire and Shadowrun.'], ['Your own books', 'imported for your private games, kept in your browser or shared with the table.']]) },
      { id: 'phone', eyebrow: 'Anywhere', h2: 'Play from a phone.', sub: 'Critter VTT runs in any modern browser. On a phone, the board fills the screen and the dice and chat slide up from the bottom.', phone: true,
        media: shot('vtt-phone.jpg', 'Critter VTT on a phone, showing the board and the dice tray in Seraphine’s green', 1170, 2532),
        body: ticks([['No install', 'for players: open the link and type the lobby code.'], ['The Windows app', 'adds a saves folder on your computer and updates itself.'], ['Accessible', 'with keyboard control of tokens, screen reader labels and an accessibility menu.']]) }
    ],
    cards: [['wall', 'Scene builder', 'Walls, doors, windows and lights, with fog of war that the GM reveals as the party explores.'], ['rewind', 'Rewind the table', 'The server saves every ten minutes while you play. Rewind a lost evening, and undo the rewind too.'], ['users', 'Players and seats', 'The owner sets up the players; each person claims theirs with a name, token and colour.'], ['clock', 'Trackers and clocks', 'Progress clocks and trackers the whole table can see.'], ['music', 'Music at the table', 'Critter Sounds streams to every player. Each player keeps their own volume.'], ['eye', 'GM tools', 'Hidden rolls, a GM layer, an encounter builder, random tables and scenes prepared in advance.']],
    host: true
  },
  sounds: {
    title: 'Critter Sounds', desc: 'Critter Sounds plays music, sound pads and soundscapes live to your tabletop group: in Critter VTT, or in a Discord or Fluxer voice channel.',
    nav: [['#features', 'Features'], ['#scapes', 'Soundscapes'], ['#library', 'Library'], ['#download', 'Download']],
    h1: 'The soundtrack to your game, <em>played live.</em>',
    lede: 'Music, sound effects and ambience for your tabletop game, played from your computer to everyone at the table: in Critter VTT, or in a Discord or Fluxer voice channel.',
    ctas: [['primary', 'down', 'Download for Windows', dl('sounds')], ['', 'play', 'How it connects', '#how']],
    note: 'Free and open source. Windows 10 and 11.',
    hero: ['sounds-main.jpg', 'Critter Sounds connected to a table, playing The Drowned Tower with the Cave effect, with playlists, sound pads, soundscapes, scenes and the queue', 2560, 1404, 'Connected to the table and heard by all four seats: a dungeon playlist with the Cave effect, rain looping on a pad, and the next tracks queued.'],
    sections: [
      { id: 'features', eyebrow: 'Running the music', h2: 'Everything the music needs.', sub: 'It plays from your computer and streams to every player over WebRTC, so there’s nothing to upload and no limit on tracks.',
        body: ticks([['Playlists', 'from your folders, with a queue, fades and crossfades.'], ['Sound pads', 'that pick their own icon and tag from the name; keys 1 to 9 play them, and the music dips underneath.'], ['Scenes', 'that remember a playlist with its effects and volume, and crossfade into it.'], ['Effects', 'such as Tavern next door, Underwater, Cave and Boss fight, applied on each player’s side.'], ['Discord and Fluxer bots', 'that play the same mix in a voice channel.']]) },
      { id: 'scapes', eyebrow: 'Soundscapes', h2: 'Living backgrounds, built from nodes.', sub: 'Patch noise, samples, LFOs and random triggers together: rain that comes and goes, a bell that tolls now and then, a wolf in the distance. Every change is heard as you make it.', rev: true,
        media: shot('sounds-scape.jpg', 'The soundscape editor with the Sunken crypt soundscape: brown noise through a slowly swept filter, rain that comes and goes, and a bell and a wolf that sound at random into a cave reverb', 2560, 1404),
        body: ticks([['A node editor', 'with sound, control and trigger cables, colour-coded.'], ['Macro sliders', 'like Danger or Intensity show on the soundscape’s tile, to change it while it plays.'], ['Render a loop', 'up to ten minutes long, crossfaded so it loops without a seam.'], ['Your own nodes', 'in a few lines of JavaScript.']]) },
      { id: 'library', eyebrow: 'Online library', h2: 'Free music, credited.', sub: 'Search free music and sound effects inside the app. Preview it, queue it, make it a pad, or save it to play offline. Every track keeps its credit, and players see it.',
        media: shot('sounds-library.jpg', 'The online library searching Tabletop Audio for tavern ambiences, beside the playlist and sound pads', 2560, 1404, 'Tavern ambiences from <a href="https://tabletopaudio.com">Tabletop Audio</a> (CC BY-NC-ND 4.0), shown with their credit.'),
        body: ticks([['Tabletop Audio', 'with about 520 ten-minute ambiences and pieces of music.'], ['Incompetech', 'with about 1,440 pieces by Kevin MacLeod.'], ['Openverse and Freesound', 'for sound effects, each with its license.'], ['YouTube', 'search, keeping only the sound, for what you may use.']]) }
    ],
    cards: [['layout', 'Your layout, your way', 'A canvas of windows you split, dock and resize, with ready layouts for playing and preparing.'], ['log', 'Session log', 'Every track, pad and scene is logged with its time, and shows as small notes in Critter VTT’s chat.'], ['wave', 'Never louder', 'Effects are loudness-matched, so they never make the music louder. Any player can turn them off.'], ['mic', 'Voice channels', 'A bot of your own joins Discord or Fluxer and plays the table’s mix, effects included.'], ['update', 'Updates itself', 'New versions install from inside the app, with what changed.'], ['eye', 'Guided from the start', 'A short setup, a quick and a full tour, and a guided first soundscape.']],
    how: true
  },
  notes: {
    title: 'Critter Notes', desc: 'Critter Notes is a notebook for game masters: plan sessions, write the world, draw maps, boards and mind maps, and send it all to your Critter VTT table.',
    nav: [['#write', 'Features'], ['#maps', 'Maps'], ['#table', 'At the table'], ['#download', 'Download']],
    h1: 'Your campaign, <em>planned and ready to run.</em>',
    lede: 'A notebook for game masters. Plan sessions, write the world, draw maps, boards and mind maps, and bring it all to your Critter VTT table when you play.',
    ctas: [['primary', 'down', 'Download for Windows', dl('notes')], ['', 'book', 'See what’s inside', '#write']],
    note: 'Free and open source. Your campaigns stay on your computer as plain files.',
    hero: ['notes-home.jpg', 'The home page of a Critter Notes campaign: the next session with its scenes, paths and clues, the open threads, and what changed recently', 2559, 1404, 'The Lantern Road, the sample campaign that comes with the app: the next session at a glance, the open threads, and what changed.'],
    sections: [
      { id: 'write', eyebrow: 'Writing', h2: 'A page for everything in your world.', sub: 'Characters, locations, factions, quests, items, lore and events, each with its own fields, written in a visual editor and linked to each other as you type.', rev: true,
        media: shot('notes-doc.jpg', 'Mother Vey’s character page: her details, secret, relationships, and backlinks from six other pages', 2559, 1404),
        body: ticks([['Details', 'for each kind of page: a character’s wants and secret, a location’s ruler, a quest’s steps.'], ['Links', 'both ways: every page shows where it’s mentioned, and new names are suggested as you write.'], ['Relationships', 'like “leads”, “fears” or “swore revenge on”, drawn as a graph.'], ['The rules', 'from the same compendium as Critter VTT, linked into your pages.']]) },
      { id: 'maps', eyebrow: 'Maps and boards', h2: 'Draw it, pin it, plan it.', sub: 'Maps with pins for every place, boards for planning how a session might go, and mind maps for untangling a plot.',
        media: shot('notes-map.jpg', 'The Gallowmere Reach map with pins for the town, the tavern, a shipwreck and an old watchtower', 2559, 1404),
        body: ticks([['Maps', 'with pins that open their pages, and a scale.'], ['Boards', 'for scenes and branches: what happens if they say yes, and if they say no.'], ['Timeline and calendar', 'in your world’s own dates, with progress clocks.'], ['Threads and clues', 'so you know what’s still open and what the party hasn’t found.']]) },
      { id: 'graph', eyebrow: 'The big picture', h2: 'See how it all connects.', sub: 'The graph shows every page and every link, coloured by kind. Filter it to the factions, or the people, and spot the threads you haven’t pulled yet.', rev: true,
        media: shot('notes-graph.jpg', 'The graph of the sample campaign, linking sessions, quests, characters, locations, factions, items, lore, maps and events', 2559, 1404),
        body: ticks([['A graph', 'of everything, or only what you pick.'], ['Home', 'shows the next session, open threads, recent changes, and names mentioned but not written yet.'], ['Find', 'anything with Ctrl+K.']]) },
      { id: 'table', eyebrow: 'At the table', h2: 'From your notes to the table.', sub: 'Link a campaign to your Critter VTT lobby, and send what you’ve prepared at the moment it matters.',
        media: shot('notes-board.jpg', 'The board “How Session 1 might go”, from a strong start through the tavern to the sea wall, with a branch if the party refuses', 2559, 1404),
        body: ticks([['Send to the table', 'notes, handouts, character and monster sheets, and scenes.'], ['Run a session', 'with your plan beside you.'], ['Cue the music', 'in Critter Sounds from your scene notes.'], ['Share', 'with co-writers (encrypted), and give players their own view without your secrets.']]) }
    ],
    cards: [['pen', 'A visual editor', 'Write like in a word processor; it’s kept as plain Markdown underneath.'], ['board', 'Boards and mind maps', 'Cards and arrows for plans and plots.'], ['clock', 'Calendar and timeline', 'Your world’s calendar, with events on a timeline.'], ['table', 'Random tables and encounters', 'Roll on your own tables, and build encounters from the compendium.'], ['lock', 'Your files', 'Campaigns are plain files on your computer, easy to back up.'], ['eye', 'Focus mode', 'Hide everything but the page, with a reading size and font of your own.']]
  }
};

/* ---------------- page template ---------------- */
function page(k) {
  const A = APPS[k], P = PAGES[k], others = Object.keys(APPS).filter(x => x !== k);
  const promo = `<div class="promo"><div class="wrap"><span class="lbl">Check out also:</span>${others.map(o => `<a href="${site(o)}" style="--c:${APPS[o].color}"><img src="img/icon-${o}.png" alt=""><b>${APPS[o].name}</b><span class="what">${APPS[o].tagline}</span></a>`).join('')}</div></div>`;
  const sections = P.sections.map((s, i) => `
<section id="${s.id}"${i % 2 ? ' class="alt"' : ''}>
  <div class="wrap">
    <div class="split${s.rev ? ' rev' : ''}${s.phone ? ' phone' : ''}">
      <div>
        <span class="eyebrow${i % 2 ? ' two' : ''}">${esc(s.eyebrow)}</span>
        <h2>${s.h2}</h2>
        <p class="sub">${s.sub}</p>
        ${s.body}
      </div>
      ${s.media || ''}
    </div>
  </div>
</section>`).join('');
  const how = P.how ? `
<section id="how" class="alt">
  <div class="wrap">
    <span class="eyebrow two">How it connects</span>
    <h2>One code, and the table hears it.</h2>
    <p class="sub">In Critter VTT, the lobby owner opens <b>Music</b> and copies the table’s music code. Paste it into Critter Sounds and press <b>Connect</b>. Only an app with the right key can play to your table, and each player sets their own volume.</p>
    <div class="grid">${card(['link', '1. Open your table', 'Start a lobby in <a href="' + site('vtt') + '">Critter VTT</a> and open <b>Music</b> in the bottom bar.'])}${card(['send', '2. Paste the code', 'It looks like <code>ABCDEF-KEY12-34567</code>: the lobby, then the key.'])}${card(['play', '3. Play', 'Tracks, pads and soundscapes reach every player with their credits.'])}</div>
  </div>
</section>` : '';
  const host = P.host ? `
<section id="host" class="alt">
  <div class="wrap">
    <span class="eyebrow two">Host it yourself</span>
    <h2>Your group, your server.</h2>
    <p class="sub">Critter VTT connects through Homebase, a small server that keeps your tables and pushes every change live. Use the shared one, or run your own.</p>
    <div class="grid">${card(['server', 'On Cloudflare', 'A Worker on your own free Cloudflare account: one double-click on <code>setup-homebase.cmd</code> puts it online.'], true)}${card(['layout', 'On your computer', 'A small Node server: <code>node server.mjs --port 8787</code>. Players open its address in a browser.'], true)}${card(['lock', 'Your data', 'Tables, autosaves and uploaded music stay on your server, in a folder you can back up.'], true)}</div>
    <p class="small" style="margin-top:20px">The full guide is in the <a href="${GH}/crittervtt/blob/main/crittervtt-desktop/README.md">project README</a>.</p>
  </div>
</section>` : '';
  const family = `
<section id="family">
  <div class="wrap">
    <span class="eyebrow">The Critter family</span>
    <h2>Three apps, one table.</h2>
    <p class="sub">${k === 'vtt' ? 'Critter VTT is where you play. Critter Sounds runs the music, and Critter Notes keeps the campaign. They connect through the same Homebase.' : k === 'sounds' ? 'Critter Sounds plays to Critter VTT, the table, and takes its cues from Critter Notes, the GM’s notebook. All three connect through the same Homebase.' : 'Critter Notes sends what you prepared to Critter VTT, the table, and cues the music in Critter Sounds. All three connect through the same Homebase.'}</p>
    <div class="family">${Object.keys(APPS).map(o => o === k
      ? `<div class="fam here" style="--c:${APPS[o].color}"><img class="lg" src="img/logo-${o}.svg" alt="${APPS[o].name}"><p>${APPS[o].short}</p><span class="here-tag">You’re here</span></div>`
      : `<a class="fam" href="${site(o)}" style="--c:${APPS[o].color}"><img class="lg" src="img/logo-${o}.svg" alt="${APPS[o].name}"><p>${APPS[o].short}</p><span class="go">Take a look →</span></a>`).join('')}</div>
  </div>
</section>`;
  const download = `
<section id="download" class="alt">
  <div class="wrap">
    <span class="eyebrow">Download</span>
    <h2>Get ${A.name}.</h2>
    <div class="dl">
      <div class="dlcard main">
        <img src="img/logo-${k}.svg" alt="${A.name}" style="height:44px;width:auto;align-self:flex-start">
        <p>${k === 'vtt' ? 'The Windows app, with its own window, a saves folder on your computer, and updates from inside the app.' : k === 'sounds' ? 'For whoever runs the music. Plays from your computer to the table, Discord or Fluxer, and updates itself.' : 'For game masters. Your campaigns stay on your computer as plain files, and the app updates itself.'}</p>
        <div class="row"><a class="btn primary" href="${dl(k)}">${ic('down')} ${A.name} for Windows</a></div>
      </div>
      <div class="dlcard">
        ${k === 'vtt' ? `<h3>In your browser</h3><p>Nothing to install. Works on computers, tablets and phones.</p><div class="row"><a class="btn" href="https://critter.poly-chrome.cc">${ic('play')} Open critter.poly-chrome.cc</a></div>`
          : `<h3>Plays with Critter VTT</h3><p>${k === 'sounds' ? 'The virtual tabletop it plays to: free, in a browser or on Windows.' : 'The virtual tabletop your notes go to: free, in a browser or on Windows.'}</p><div class="row"><a class="btn" href="${site('vtt')}">${ic('dice')} Get Critter VTT</a></div>`}
      </div>
    </div>
    <p class="small" style="margin-top:20px">The installer isn’t code-signed yet, so Windows SmartScreen may warn the first time: choose <b>More info › Run anyway</b>. Every version and what changed is on the <a href="${GH}/${A.repo}/releases">Releases page</a>.</p>
  </div>
</section>`;
  const [hf, halt, hw, hh, hcap] = P.hero;
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${A.name}</title>
<meta name="description" content="${esc(P.desc)}">
<meta property="og:title" content="${A.name}">
<meta property="og:description" content="${esc(P.desc)}">
<meta property="og:image" content="${site(k)}img/${hf}">
<meta name="theme-color" content="#0c0d10">
<link rel="icon" href="img/icon-${k}.png">
<link rel="stylesheet" href="site.css">
<style>:root{--accent:${A.color};--accent-2:${A.accent2};${k === 'notes' ? '--on-accent:#1a1300;' : k === 'vtt' ? '--on-accent:#1a0900;' : ''}}</style>
</head>
<body>
<header>
${promo}
<nav class="top" aria-label="${A.name}">
  <div class="wrap">
    <a class="brand" href="#top" aria-label="${A.name} home"><img src="img/logo-${k}.svg" alt="${A.name}"></a>
    <div class="links">${P.nav.map(([h, t], i) => `<a href="${h}"${i < 2 ? ' class="hide-s"' : ''}>${t}</a>`).join('')}<a href="${GH}/${A.repo}">GitHub</a></div>
  </div>
</nav>
</header>
<main>
<section class="hero" id="top">
  <div class="wrap">
    <img class="logo" src="img/logo-${k}.svg" alt="${A.name}">
    <h1>${P.h1}</h1>
    <p class="lede">${P.lede}</p>
    <div class="ctas">${P.ctas.map(([cls, icon, t, h]) => `<a class="btn ${cls}" href="${h}">${ic(icon)} ${t}</a>`).join('')}</div>
    <p class="note">${P.note}</p>
    <figure class="shot"><img src="img/${hf}" alt="${esc(halt)}" width="${hw}" height="${hh}"><figcaption>${hcap}</figcaption></figure>
  </div>
</section>
${sections}
<section id="more">
  <div class="wrap">
    <span class="eyebrow">And more</span>
    <h2>The little things that help.</h2>
    <div class="grid" style="margin-top:28px">${P.cards.map(c => card(c)).join('')}</div>
  </div>
</section>
${how}${host}${family}${download}
</main>
<footer>
  <div class="wrap">
    <div>${A.name} · Made with love by booskers / Polychrome · <a href="${GH}/${A.repo}">Source on GitHub</a> · MIT License</div>
    <div>Game icons from <a href="https://game-icons.net">game-icons.net</a> (CC BY 3.0) · Font: Atkinson Hyperlegible Next (OFL)</div>
  </div>
</footer>
</body>
</html>
`;
}

/* ---------------- write the three sites ---------------- */
const fontDir = join(ROOT, 'crittervtt-desktop', 'music', 'src');
const logoSvg = k => {
  let s = readFileSync(APPS[k].logo, 'utf8');
  // the Sounds logo takes its colours from the page; on its own (in an <img>) it needs them written in
  return s.replace(/fill:currentColor/g, 'fill:rgb(221,221,221)').replace(/var\(--logo-c,(#[0-9a-f]+)\)/gi, '$1');
};
for (const k of Object.keys(APPS)) {
  const out = APPS[k].out, img = join(out, 'img'), fonts = join(out, 'fonts');
  mkdirSync(img, { recursive: true }); mkdirSync(fonts, { recursive: true });
  const keep = new Set();
  for (const o of Object.keys(APPS)) { writeFileSync(join(img, `logo-${o}.svg`), logoSvg(o)); copyFileSync(APPS[o].icon, join(img, `icon-${o}.png`)); keep.add(`logo-${o}.svg`).add(`icon-${o}.png`); }
  const used = [PAGES[k].hero[0], ...PAGES[k].sections.map(s => (/img\/([^"]+)"/.exec(s.media || '') || [])[1]).filter(Boolean)];
  for (const f of used) { if (SHOTS && existsSync(join(SHOTS, f))) copyFileSync(join(SHOTS, f), join(img, f)); if (!existsSync(join(img, f))) throw new Error(`${k}: missing screenshot ${f}`); keep.add(f); }
  for (const f of readdirSync(img)) if (!keep.has(f)) rmSync(join(img, f));          // pictures the page no longer uses
  for (const f of ['atkinson-latin.woff2', 'atkinson-latin-ext.woff2', 'OFL-Atkinson-Hyperlegible-Next.txt']) copyFileSync(join(fontDir, f), join(fonts, f));
  copyFileSync(join(here, 'site.css'), join(out, 'site.css'));
  for (const f of ['style.css']) if (existsSync(join(out, f))) rmSync(join(out, f));
  writeFileSync(join(out, '.nojekyll'), '');
  writeFileSync(join(out, 'index.html'), page(k));
  console.log(`${APPS[k].name}: ${join(out, 'index.html')} (${used.length} screenshots)`);
}
