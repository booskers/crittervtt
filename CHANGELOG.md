# Changelog

Critter VTT (the page, `critboard/critboard.html`, and the desktop app in `critboard-desktop/app`).
Critter Sounds keeps its own changelog in the critter-sounds repository.

## 1.1.0 (2026-10-07)
**Highlights**
- Updates inside the desktop app: it checks GitHub when it starts (Settings › Updates turns that off), shows the most important changes, and updates with one click: a progress bar for the download, then the installer's own, and Critter VTT opens again.
- Update now, Later, or Skip this version; Check for updates also sits in the settings gear, the Critter VTT menu and Help.
- The shared Critter look, and your own colour for the logo and the whole interface.
- Scene settings per scene, a chat that slides away with pop-up messages, and an Accessibility menu.
- A GitHub button in the Critter VTT menu and Help. The repository is now github.com/booskers/crittervtt.

**The shared Critter look** (one design with Critter Sounds and Critter Notes, specified in `critter-design/`)
- Critter is now called Critter VTT. New logo and app icons; the logo, its badge and the desktop title-bar mark follow your highlight colour.
- Surfaces lift by light instead of lines, glows only on hover, Atkinson Hyperlegible Next, and a Look dialog in the Critter VTT menu:
  colours (or your player colour), light or dark, surface tint, picture colour and font pairings.
- One flat button style; no background gradients or darker boxes inside windows, sheets and trackers; rounded dropdowns with dark option lists; tidier sheet fields.
- The board's background is the plain table surface with soft light from the two colours and a fine dot on every grid corner.
- Game systems no longer carry their own palettes, ornaments, fonts or paper sheets; each keeps its emblem.
- Sheet portraits spill their colour into the sheet's header. Narrow window headers fold every button but close into a menu.

**Playing**
- Your player colour drives the highlight; a separate interface colour can be picked when you take a seat.
- The chat slides away on a tab; new messages then pop up in the corner, as in the chat, and fade.
- Scene settings per scene (table colour, background, token movement) in GM tools › Map or a scene's ⋯ menu, no longer in Table rules.
- Top bar: a gear for settings (dice sound, music, your seat, Look, Accessibility) and a door for the lobby menu with Leave lobby.
- Quick rolls (Daggerheart's and every system's) sit in the Modifiers row as one button with a menu.
- Windows can't be shrunk into scrollbars; the turn order and trackers never scroll.
- Music effects: "Old radio" no longer sounds louder; loudness matching listens through a light hearing weighting.

**Accessibility**
- An Accessibility menu: motion, hide screen effects, stronger contrast, chat pop-up timing, read-aloud, with guidance.
- Tokens move by keyboard (Tab to a token, arrow keys move it); skip links; screen-reader names on every button; 12px minimum text; outlines that keep their contrast.

**Desktop app**
- Saves go to Documents\CritterVTT\Saves by default; saves in the old Documents\Critter Saves folder move there once.

**Fixes**
- Dice sound in the claude.ai copy; the walkthrough points at the right places; the build bar sits at the top of the screen.

## 1.0.0 (2026-10-06)
- First release: a shared battle-map table with dice, drawing, scenes, tokens, character sheets, notes and handouts, chat and whispers, Homebase lobbies, and live music from Critter Sounds.
