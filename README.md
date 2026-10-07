<p align="center">
  <img src="docs/img/critter-logo.svg" alt="Critter" height="72">
</p>

<p align="center"><b>A free virtual tabletop for your group, in the browser or on Windows.</b></p>

<p align="center">
  <a href="https://live.crittervtt.com">Play in your browser</a> ·
  <a href="https://booskers.github.io/crittervtt/">Website</a> ·
  <a href="https://github.com/booskers/crittervtt/releases/latest">Download for Windows</a>
</p>

![Critter's table](docs/img/critter-table.png)

## Critter

Critter is a virtual tabletop that opens in a browser. Share a lobby code and your group sits down at the same table, with the same map and dice and every roll as it happens.

- **Battle map** with tokens, drawing tools and live cursors.
- **Dice** from d4 to d100, with modifiers, hidden rolls and typed rolls like `2d6+3`.
- **Character sheets and items**, plus D&D Beyond import.
- **Rules compendium** for D&D 5e, Pathfinder 2e, Daggerheart, Blades in the Dark and Fate.
- **Autosaves and Rewind** on the server, and the GM's own saves folder.
- Runs in any modern browser, on phones, or as a Windows app.

## Critter Sounds

<img src="docs/img/sounds-logo.svg" alt="Critter Sounds" height="40">

The companion app for whoever runs the music: playlists, sound pads and soundscapes, streamed live to every player. It has its own repository, site and downloads: **[github.com/booskers/critter-sounds](https://github.com/booskers/critter-sounds)** · [booskers.github.io/critter-sounds](https://booskers.github.io/critter-sounds/). It uses Critter's music effects (the `MUSICFX` block of `crittervtt.html`) and Homebase client, which its build copies in.

## What's in this repository

| Folder | What it is |
|---|---|
| [`crittervtt/`](crittervtt) | The Critter page itself (`crittervtt.html`) and the rules compendium data (`srd/`). |
| [`crittervtt-desktop/app`](crittervtt-desktop/app) | The Critter Windows app (Electron). |
| [`crittervtt-desktop/homebase-cloudflare`](crittervtt-desktop/homebase-cloudflare) | Homebase, the server, as a Cloudflare Worker (free plan). |
| [`crittervtt-desktop/homebase-server`](crittervtt-desktop/homebase-server) | Homebase as a self-hosted Node server. |
| [`docs/`](docs) | This project's website (GitHub Pages). |

Critter VTT was called *Critboard* at first. Everything is named Critter VTT now, except a few identities that existing tables, saves and installs depend on, which keep the old name on purpose:

- the app ids `app.critboard.desktop`, `app.critboard.music`, `app.critboard.notes` and Android's `app.critboard.player` (a new id would be a different app: no updates, a second install);
- `app://critboard/`, the desktop app's own address (its browser saves and settings live there);
- `critboard-player:` in player password hashes, the `critboard-music` database, and the Homebase Worker `critboard-homebase` (its stored tables);
- reading old exports (`"critboard": "table-export"`) and the old `Critboard` data folders, so nothing made before the rename is lost.

Setup, building, the Homebase protocol and the full feature notes are in **[crittervtt-desktop/README.md](crittervtt-desktop/README.md)**.

### Quick start

```bash
cd crittervtt-desktop/app
npm install
npm start
```

## License

Critter VTT, Critter Sounds and Critter Notes are released under the [MIT License](LICENSE): use, change and share them freely, as long as you keep the copyright notice and give credit. Made with love by booskers / Polychrome. What changed in each version: [CHANGELOG.md](CHANGELOG.md).

The third-party content below keeps its own license.

## Credits

- Icons from [game-icons.net](https://game-icons.net), CC BY 3.0.
- Online library tracks keep their own licenses, shown with each track.
- Uses [yt-dlp](https://github.com/yt-dlp/yt-dlp), downloaded on request.
- Rules compendium content comes from each game's published SRD under its own license.
