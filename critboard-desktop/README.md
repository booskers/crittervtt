# Critter desktop and Homebase

- **`app/`**: the Windows app (Electron). It runs the same Critter page as the claude.ai artifact. **Homebase** (`app/shim/homebase-client.js`) connects it to other players.
- **`homebase-cloudflare/`**: the default Homebase. It's a Cloudflare Worker with one Durable Object, on your own Cloudflare account and the free Workers plan.
  - Tables are stored in the Durable Object's built-in database, and everything is pushed live over WebSockets.
  - The Worker also hosts the app, so players can join from a browser with nothing installed.
- **`homebase-server/`**: the self-hosted Homebase. A small Node server with the same protocol, for running on your own computer or server.

## Set up Homebase on Cloudflare (once)

You need [Node.js](https://nodejs.org) and a free [Cloudflare account](https://dash.cloudflare.com/sign-up). Then double-click `homebase-cloudflare/setup-homebase.cmd`. It:

1. Builds the app.
2. Signs you in to Cloudflare in your browser. Allow Wrangler (Cloudflare's tool) access when asked.
3. Puts Homebase online. On a new account, Cloudflare first asks you to choose a **workers.dev subdomain**; it becomes part of the address.
4. Checks the address answers and saves it to `app/homebase.config.json`.
5. Builds `app/dist/Critter Setup 1.0.0.exe`, which connects to your Homebase **by default**.

After that:
- **Desktop players:** share that installer with your group. There's nothing for them to set up.
- **Browser players:** anyone can open `https://critboard-homebase.<your subdomain>.workers.dev` and play there.
- **After changing Critter:** run the setup again to update the Worker and the installer. It skips the steps that are already done.

**Free plan, per day:** 100,000 requests, 13,000 GB-seconds of Durable Object time, 100,000 database row writes and 5 million row reads, plus 5 GB of storage.
- **Time online:** Homebase runs while anyone is connected, which comes to about 29 hours of open table a day.
- **Writes:** each drawing, roll or move is about one row write. An uploaded song is about 60.
- **Your home group** stays well inside all of that. Check Cloudflare's pricing page for current numbers.

### Updating the live site

After changing the page (`critboard/critboard.html`) or the Homebase client, run `npm run deploy` in `homebase-cloudflare`. It rebuilds `app/www` and puts it and the Worker online. It doesn't build the desktop installer.

## Run your own Homebase server instead

Double-click `homebase-server/start-homebase.cmd`, or run `npm install`, then `node server.mjs --port 8787`. Then:

- **In the app:** choose **Critter › Homebase…** and *Your own Homebase server*, and enter `http://<that computer's address>:8787`.
- **In a browser:** anyone can open `http://<that computer's address>:8787` and play without installing anything. The server serves the app from `app/www`; use `--www` to point elsewhere.
- **Storage:** tables are saved under `homebase-server/homebase-data/`, autosaves under `homebase-data/saves/`, and uploaded music under `homebase-data/audio/`. Use `--data` to keep them elsewhere, and back up that folder.
- **Players outside your home network** need a way in: port forwarding on your router, a VPN like Tailscale, or a small rented server.

## Autosaves

Homebase saves every lobby by itself, so a lost evening can be rewound.
- **When:** at most every 10 minutes while something at the table changes, and when the lobby owner starts or ends a session. A quiet table makes no saves.
- **What a save costs:** each save is a short list of the lobby's documents with a fingerprint each. A document's content is stored once per lobby, however many saves share it, so a background picture costs its size once and a typical save writes only the few documents that changed.
- **What's kept:** the 12 newest saves, the newest one of each day for a week, and the 20 newest named ones (session start and end, *Save now*). Content no save needs any more is deleted.
- **Rewinding:** the lobby owner or a co-owner opens **Critter menu (Esc) › Rewind the table** (also in GM tools › Tools, and Table rules › Back up this table). Rewinding saves the table as it is first, so it can be undone.
- **On Cloudflare:** saves live in the same Durable Object database, and a Durable Object alarm makes them. Expect a few hundred row writes per hour of play: well inside the free plan.
- **Self-hosted:** saves are under `homebase-data/saves/<lobby>/`. `--autosave-minutes` changes the interval.

### The GM's own saves (on their computer)

Separately from the Homebase, the lobby owner's and co-owners' page saves the table itself:
- **When:** a few seconds after every change ("Latest", overwritten), a dated save every 10 minutes while it changes, and named saves (the Save button, Ctrl+S, session start and end). Pictures are stored once each, so a save only writes the table's small data.
- **Where:** on first start, a GM picks a **saves folder**. In the desktop app it's any folder (suggested: *Documents › Critter Saves*); the app remembers it in `critter-settings.json` in its data folder. In Chrome or Edge it can also be a folder, through the browser's folder access (one click lets it in again each session). Otherwise, and on claude.ai, saves stay in the browser (IndexedDB).
- **The folder:** `<lobby>/index.json` lists the saves, `latest.json` is the newest, `saves/` holds the dated and named ones, `pictures/` the pictures they point at. Each save is plain JSON.
- **Carrying on:** on the next start, Critter looks for the newest save. If it's from another table, or the table is gone from the Homebase, it offers to carry on: it reopens the lobby, or sets up a new one from the save.

## Music and Music Link

**In Critter:** the music comes from **Critter Sounds**, the separate desktop app (below).
- **The lobby owner** opens **Music** in the bottom bar to get the table's **music code**. The code is blurred until it's clicked three times, and its Copy button copies it without showing it. *Make a new code* stops the old one.
- **Players** see **Music** once something plays: volume, mute, and a switch that turns the music effects off for them alone.

**Music Link** is the outside app. Open it from **Critter › Music Link**, or in a browser at `<Homebase address>/music`.
- **Connecting:** enter the lobby code. It connects through the same Homebase as the app.
- **Listening:** with just the code it plays the table's music on that device. Use it for a speaker computer, a phone, or a stream (capture it in OBS).
- **Controlling:** with the **remote key** (the part of the music code after the lobby code) it can also play, pause, skip, seek, pick tracks and change the table volume.
- **Shortcut:** `music#CODE/KEY` fills both in.

### Connecting your own app

Anything that can open a WebSocket to your Homebase can join in. [`homebase-server/examples/music-remote.mjs`](homebase-server/examples/music-remote.mjs) is a working example, and it works with the Cloudflare Homebase and the self-hosted server alike:

```
node examples/music-remote.mjs https://critboard-homebase.<you>.workers.dev HZAYB5 EMJQE-SQSW5 next
```

**The connection:**
- **Connect:** open a WebSocket at `/ws` and send `{ t: 'hello', uid, key }`. Pick any id and a secret of 16 or more characters, and keep them; the first use claims the id.
- **Subscribe:** `{ t: 'sub', scope: 'L<CODE>' }` returns every document in the lobby, then pushes `chg` messages as they change. Large lobbies arrive in several `snap` messages; each one except the last has `more: true`.
- **Fetch one document:** `{ t: 'get', path, rid }` answers with an `ack` carrying `exists` and `data`.
- **Join the room:** `{ t: 'join', room: 'lobby-<code in lowercase>', peer }`.
- **Send an event:** `{ t: 'emit', room, peer, topic, data }`.
- **Autosaves** (lobby owner and co-owners only): `{ t: 'saves', scope: 'L<CODE>', rid }` lists them, `{ t: 'savenow', scope, label, rid }` makes a named one, `{ t: 'restore', scope, id, rid }` rewinds to one.

**What to read:**
- **The music state:** the document `lobbies/<CODE>/state/music`, shaped `{ list: [{ id, title, kind: 'file'|'url', src, n, mime, dur }], cur, playing, at, t0, loop, shuffle, tv, lk }`.
- **Position in the current track:** while playing, `at + (now - t0) / 1000` seconds; while paused, `at`.
- **Uploaded tracks:** an uploaded track (`kind: 'file'`) is `n` documents `audio/<CODE>-<id>-<0..n-1>`, each `{ d: <base64 piece> }`. Fetch them with `get`, join them and decode.

**How to send commands:**
- **Message:** send the event `music` with `{ op, key, rid }`. `op` is one of:
  - `play` (optional `track: <id>`)
  - `pause`, `toggle`, `stop`, `next`, `prev`
  - `seek` (`to`: seconds)
  - `volume` (`value`: 0 to 1)
  - `loop` (`value`: `all`, `one` or `off`)
  - `shuffle` (`value`: true or false)
- **Reply:** the GM's Critter page checks the key and answers with the event `music-ack` `{ rid, ok, err }`.
- **Requirement:** an owner or co-owner must have the table open, because their page applies the change.

The claude.ai artifact has the same music player, but outside apps can only connect through Homebase.

## Security

- **Player ids:** each computer gets a random id and secret key on first connect, and Homebase holds it to that.
- **What players can change:** only their own profile and private data. Lobbies are open to anyone with the code, as on claude.ai.
- **Music remote key:** the key keeps casual remotes out, but it isn't strong security. Anyone with the lobby code can already change a lobby's data directly, on claude.ai and on Homebase alike.
- **D&D Beyond imports (`POST /ddb`):** only a lobby's owner or co-owner, with their player key, can use it. The importer sends their D&D Beyond `CobaltSession` cookie, and Homebase swaps it for a short-lived token, the way the DDB Importer proxy does (`homebase-server/ddb.mjs`, copied to `homebase-cloudflare/src/ddb.js`). The cookie is a full D&D Beyond login. Homebase uses it for that one request and never writes it down or logs it. The token stays in memory for four minutes. These are D&D Beyond's undocumented services, so they can change without notice.

## Building and testing

After changing `critboard/critboard.html` (the artifact) or Homebase:

```
cd app
npm install
npm run dist
```

- **Without packaging:** `npm start` runs the app.
- **Without building www:** `CB_DEV_URL=http://localhost:8787/ npx electron .` runs the app against a test Homebase server that serves the page (`node server.mjs --www <folder>`), so page changes can be tried in the app without a build.
- **The window:** each window is frameless, with Critter's own title bar (`titlebar.html`, in its own view above the page) that takes the colours of the page's theme. The ▾ next to the logo opens the Critter menu; the usual shortcuts (Ctrl+N, Ctrl+R, F11, Ctrl+0/+/-, Ctrl+Shift+I) still work.
- **Icons:** `build/icon.ico` is the app and installer icon; `assets/` holds the window icon and the favicons that `build.mjs` copies into `www/` for the browser version.
- **Testing the Cloudflare Homebase locally:** run `npx wrangler dev` in `homebase-cloudflare/` to start it at `http://localhost:8787`. Then build the app against it with `HOMEBASE_SERVER=http://localhost:8787 node build.mjs`.
- **Updates:** `updater.js` (electron-updater) checks this repository's latest release when the app starts (the settings gear › Updates turns that off) and from **Check for updates** in the gear, the Critter VTT menu, Help and the title bar's menu. The pop-up (`update.html`) lists up to five changes from the release notes, offers Update now, Later or Skip this version, shows the download, and hands over to the installer, which for an update (`build/installer.nsh`) asks nothing, shows its progress and starts the app again. A release needs `Critter-Setup.exe`, `Critter-Setup.exe.blockmap` and `latest.yml` from `dist/`; put the five most important changes first in its notes. Testing: `UPDATE_TEST_FEED=<url of a folder with latest.yml>`, `UPDATE_TEST_VERSION=<x.y.z>`.

## Critter Sounds (the desktop music player)

**`music/`** is a separate Windows app for whoever runs the music. It plays from this computer, live, to everyone in a lobby. Nothing is uploaded, so there are no size or track limits. Install it with `music/dist/Critter Sounds Setup 1.0.0.exe`.

**Connecting:** the lobby owner copies the **music code** from Critter's Music window, like `4TBCEF-EMJQE-SQSW5`: the lobby code, then the key. Paste it into the app and press Connect. Critter only plays a music app that has the right key.

**The screen:** an empty canvas of windows, with the queue on the right.

**Getting started:**
- **Setup:** the first start shows a short setup wizard. It asks where the group listens (Critter, Discord or Fluxer, or only here), where the music is (a folder, the online library, or later) and which layout to use, then offers a tour. Every step can be skipped, and Help › Setup runs it again. People who already have music in the app don't see it.
- **Empty canvas:** with no windows, the canvas shows the logo, "Nothing here", and buttons for Windows and Layouts.
- **Tours:** Help in the top bar, the title bar menu and the Help window all have both tours. They spotlight the real screen and change the layout as they go; at the end you keep the new layout or go back to yours, and stopping early puts yours back.
  - The quick tour (13 steps) covers the canvas, windows, layouts, playlists, the queue, playing, the volumes, connecting, and arranging windows.
  - The full tour (30 steps) also demonstrates splitting, resizing, swapping, docking and saving a layout, and explains every window.
- **Layouts:** grouped by purpose.
  - During a game: Run a game, Simple player, Voice chat game, Ambience, Web pages and scenes, Focus.
  - Preparing: Build playlists, Make sound pads, Build soundscapes.
  - Each layout and each window in the Windows menu has a one-line description.
- **Soundscape editor:** the first time it opens on an empty soundscape, a guided first loop builds the sound of the sea and renders it as a loop. The steps: add Noise, set it to Brown, cable it to the Output, play it, add an LFO, cable it to the Volume, set the Depth, and render. Each step waits for you, with "Do it for me" as a way out. It can be skipped, and comes back through the editor's Help › Guided first loop.
- **The engine:** `src/tour.js` drives both windows.

**Language, settings, tips and cover art:**
- **Language:** German and English. "System language" is the default: German when Windows is set to any German, English otherwise. Settings › Language overrides it, and both windows reload in the new language.
  - How it works: the interface is written in English, and `src/i18n.js` translates what's shown through a MutationObserver. The words are in `i18n-de.js` and `i18n-de2.js`, as exact texts plus patterns for texts with numbers or names. Untranslated text stays English, and user data (track and pad names) is left alone.
  - The main process's menu and file dialogs follow too, through `set-lang`.
- **Settings** (gear in the top bar, the title-bar menu, or Ctrl+,):
  - General: language, your name at the table, connect on start, confirm before quitting, media keys.
  - Sound: how far music dips under pads, the pause fade, preview volume, notes in Critter's chat.
  - Folders: where Critter Sounds keeps its files (it can be moved; `prefs.json`), the data folder, a library backup.
  - Also: Homebase; tips, setup and tour; reset all settings, which keeps playlists, pads, scenes, soundscapes and layouts.
- **Folder button:** next to Help, it opens Music › Critter Sounds.
- **Tips:** the light blue boxes have an ✕ that hides them for good. Help › Show all tips again (or Settings) brings them back.
- **Cover art:** the bottom-left square shows the playing track's picture, and the bar takes on its colour as a blurred glow.
  - Where it comes from, in order: the file's own picture (ID3, FLAC or M4A tags), a cover image in its folder, the YouTube thumbnail for a YouTube download, or the online library's picture.
  - Without one, the colour comes from the title.
  - Served at `app://music/cover?p=`.
- **Windows:** Playlists, Playlist, Online library, Web source, Sound pads, Scenes, Effects, Fades and Help.
- **Arranging them:**
  - ◫ splits a window to the right and ⊟ splits it below.
  - Dragging a divider resizes the windows; it snaps to halves, thirds and quarters (hold Alt to place it freely), and no window gets smaller than about 180 px.
  - Dragging a window by its title onto another docks it at that edge, or swaps the two when dropped in the middle.
- **Layouts:** **▦ Layout** offers suggested layouts (Playlists, Game night, Explorer, Atmosphere, Focus) and saves your own.
- **The queue:** plays before the playlist you last played from, which carries on afterwards.
  - Each track leaves the queue when it starts.
  - Tracks can be dragged in and reordered, removed, played now, or added by searching your playlists.

**What it does:**
- **Playlists from folders:** drop folders on the window, rescan them for new files, search, sort, drag to reorder.
- **Web sources:** opens any page (YouTube, an ambience mixer) in its own window and sends that page's sound to the table.
- **Fades:** set fade in, fade out and crossfade. Stop always fades out; press stop again to cut the sound at once.
- **Playback:** shuffle, repeat the playlist or one track, table volume, and an optional "Here" monitor with its own output device.
- **Effects:**
  - **What there is:** reverb, convolution spaces (built in, or your own impulse WAV), echo, old radio, vinyl crackle, tape warble, muffled, lo-fi, tremolo, even out loudness (a gentle compressor), overdrive, chorus, flanger, auto-pan, stereo width (mono to extra wide), bass and treble.
  - **Presets:** one click sets up Tavern next door, Underwater, Old gramophone, Radio broadcast, Distant memory, Cave, Cathedral, Dream, Haunted, Boss fight or Even and quiet.
  - **Where they run:** on each player's computer. They never make the music louder than it is, and each player can switch them off in Critter's Music window.
- **Sound pads:**
  - **Icons:** each pad gets an icon from [game-icons.net](https://game-icons.net) (CC BY 3.0), chosen by a keyword list matched against its name and the tags it came with. No AI is involved. For example, "Sword clash" gets crossed swords.
  - **Groups and tags:** at most two per pad, both guessed the same way and changeable by right-click:
    - a colourless group (Weapons, Weather, Atmosphere, Objects…);
    - a coloured tag (sword, rain, tavern, glass…). Changing a tag's colour recolours every pad with that tag.
  - **Finding pads:** search by name, group or tag, and filter with the group and tag chips.
  - **Looping:** ⟳ loops a pad until you stop it.
  - **Playing pads** are listed under the queue. Stop all fades them out; a second press stops them at once.
  - **Mini player:** expandable "Up next" (drag to reorder) and pad tabs.
- **Session log:**
  - **Sessions:** connecting to a table starts a session, and the log records every track, web page, pad and stop with its time.
  - **In Critter's chat:** the same notes appear as small side notes, through `lobbies/<code>/soundlog` (the newest 100 are kept). Switch it off in the log window.
  - **Earlier sessions** stay in the log window, and Copy gives the text.
- **YouTube:**
  - **Finding videos:** search, or paste a video or playlist link.
  - **Listening first:** preview plays on this computer only.
  - **Downloading:** only the sound is downloaded, into `Music\Critter Sounds\YouTube`, and added to a "YouTube" playlist. From there it can go to the queue, another playlist or a pad.
  - **yt-dlp:** it uses [yt-dlp](https://github.com/yt-dlp/yt-dlp), fetched on request from its official GitHub releases into the app's data folder. Update fetches its newest version, which helps when YouTube changes something.
  - **Permission:** only download what you may use.
- **Look:** a dark, rounded design with line icons.
  - **Colours:** Look (or the title bar menu › Appearance) changes the highlight, a second highlight and the background tone. Pick a swatch or any colour, and it applies live and is remembered.
  - **Default:** the Critter Sounds purple.
- **Soundscapes:** a window of tiles, each a living background (rain that comes and goes, a tavern with the odd clatter) built from nodes.
  - **Tiles:** name a new one and it picks an icon from the name, once. Change the icon by clicking it. ▶ plays it to the table; only one plays at a time, and switching fades from one to the next. A soundscape's Macro nodes become sliders on its tile.
  - **Editor:** ✎ Edit opens a node canvas in a window of its own. Drag from an output dot to an input dot to patch a cable: blue for sound, amber for control (slow numbers, about −1 to 1), pink for triggers. Let go of a cable on empty space to pick a node that plugs in there. While it plays, every change is heard at once and triggers blink as they fire. Changes save on their own; Ctrl+Z undoes them.
  - **Nodes:**
    - Sources: Sample, Bed, Noise and Tone.
    - Control: LFO, Drift (random wandering), Value, Macro and Script (your own JavaScript).
    - Triggers: Clock, Sometimes, Sequencer, Chance, Wait, Every Nth and Pick one.
    - Signal maths: Merge, Level, Boost, Add, Subtract, Invert, Multiply, Range, Cutout, Smooth and Absolute.
    - Effects: Filter, Echo, Reverb, Pan, Distort, Even out, and all of the music effects as presets.
  - **How it runs:** all sound and control maths runs as native Web Audio nodes, and only triggers run in JavaScript, scheduled 50 ms ahead. The engine is `music/src/scape.js`.
  - **Render a loop:** up to 10 minutes, rendered on this computer faster than real time (about 70 seconds for 10 minutes). The end is crossfaded into the start so it loops without a seam, and it's saved as a WAV in `Music\Critter Sounds\Loops`.
  - **Your own nodes:** `.js` files in `Music\Critter Sounds\Nodes` add node types; a README and an example are put there the first time.
  - **Files:** each soundscape is a readable `<name>.soundscape.json` in `Music\Critter Sounds\Soundscapes`, so it can be shared and brought in with ⋯ › Bring in.
- **Discord & Fluxer:** for groups that meet in a voice channel instead of Critter, or alongside it. A bot of your own joins the channel and plays the same mix the table hears, with the effects applied.
  - **Setup:** make a bot (Discord Developer Portal, or Fluxer's developer portal), paste its token, press Connect, then pick the server and voice channel and press Join. "? How" in the window walks through it; on Discord, "Invite it to a server" makes the invite link with the Connect, Speak and Send Messages permissions.
  - **Options:** post what plays (with its credit) in the voice channel's chat, and join the last channel again when the app starts.
  - **How it works:** this is the way Kenku FM does it.
    - An AudioWorklet (`src/pcmtap.js`) taps the mix after the effects as 48 kHz 16-bit stereo PCM in 60 ms chunks. Nothing is sent while no bot is in a channel.
    - `bots/bot.js` runs in an Electron utility process.
    - **Discord:** discord.js and `@discordjs/voice`, with DAVE end-to-end encryption via `@snazzah/davey`, encoding to Opus with opusscript.
    - **Fluxer:** `@fluxerjs/core` and `@fluxerjs/voice` join the channel's LiveKit room, and the PCM is published there as a stereo track with `@livekit/rtc-node`. A self-hosted Fluxer works too: enter its address.
  - **Tokens:** stored encrypted with Windows' own protection (Electron `safeStorage`) in `bots.json` in the app's data folder. The page never reads them back.
- **Folders:** `Music\Critter Sounds` holds `YouTube`, `Soundscapes`, `Loops`, `Nodes` and one folder per online source. `CBM_MUSICDIR=<folder>` puts it elsewhere, for testing.
- **Extras:**
  - Sound pads (keys 1 to 9), with the music dipping under them.
  - Scenes: a playlist plus its effects and volume, started with a crossfade.
  - Media keys, a mini player that stays on top, and a sleep timer.
  - Remembers the last lobby.

**Online library:** free music and sound effects, browsed and searched inside the app.

| Source | What's there | License | Needs |
|---|---|---|---|
| [Tabletop Audio](https://tabletopaudio.com) | ~520 ten-minute ambiences and music, by category | CC BY-NC-ND 4.0 | nothing |
| [Incompetech](https://incompetech.com) | ~1,440 pieces by Kevin MacLeod, by mood | CC BY 4.0 | nothing |
| [Openverse](https://openverse.org) | Freesound effects, Jamendo, ccMixter and Wikimedia music | varies; shown on each result | nothing (200 searches a day) |
| [Freesound](https://freesound.org) | 600,000+ sound effects, filtered by length | varies; shown on each result | a free API key |

- **Per result:**
  - 🎧 Preview plays it on this computer only, at its own volume.
  - ▶ Play now sends it to the table straight away.
  - + Queue queues it; the button shows Queued, then Playing, and resets after it has played.
  - Playlist ▾ adds it to the playlist you choose, Pad makes it a sound pad, and ⭳ saves it to `Music\Critter Sounds\<source>\` with a `credits.txt`.
- **Several at once:** tick results (or Select all shown) to queue them, add them to a playlist, make them pads or save them, all in one go.
- **Streaming:** online tracks stream from the site until saved. They pass through the app (`app://music/remote`), so fades and effects work on them too.
- **Credits:** each track keeps its credit. Players see it in Critter's Music window, and Copy credits in a playlist gives the text for a stream or video.
- **Catalogues:** cached in the app's data folder, Tabletop Audio for a day and Incompetech for three.
- **Not included:** Tabletop Audio's SoundPad sounds, which its license keeps on its own site.

**How it works:**
- **Signaling:** the app joins the lobby's room with presence `{ dj: 1, ... }` and the topic `music-live`, as described in the `MUSICLIVE` block of `critboard.html`.
- **Streaming:** it streams to each page over WebRTC (stereo Opus).
- **Effects code:** lives only in the `MUSICFX` block of `critboard.html`; `music/build.mjs` copies it in.
- **Network:** players behind very strict networks may not connect, because there's no TURN relay, only STUN.

**Building:** `cd music`, `npm install`, `npm run dist`. It uses `app/homebase.config.json` for its Homebase. `CBM_USERDATA=<folder>` keeps a separate library, for testing.
