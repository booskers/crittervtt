# Changelog

Critter VTT (the page, `critboard/critboard.html`, and the desktop app in `critboard-desktop/app`).
Critter Sounds keeps its own changelog in the critter-sounds repository.

## 1.2.2 (2026-10-07)
- Colour pickers no longer make everything lag: the colour is taken when you close the picker, instead of recolouring everything on every move inside it.
- Campaign pictures fill the whole card on the start screen, cropped rather than squeezed, and are kept sharper.
- The Critter VTT menu: Back to the table spans the whole width, and the footer says "Made with love by booskers / Polychrome." like the other apps.

## 1.2.1 (2026-10-07)
- Deleting a scene works: the bin now asks "Delete this scene?" on the scene's card and waits for Delete or Keep. Before, its second click had to come within three seconds, or nothing happened.
- The bin on Main and on the scene the players see says why it can't delete them, instead of doing nothing.

## 1.2.0 (2026-10-07)
**Highlights**
- Your campaigns on the start screen: the five latest with a picture, the game system and when you last played. Click one to carry on; right-click (or its cog) to open an older save or give it a picture.
- A new table code every evening: opening a campaign starts a fresh lobby, and leaving or quitting saves and closes it. Players, passwords and who sits where come along in the save.
- A hands-on walkthrough for players and for GMs: try things as you go, and steps move on by themselves once you have.
- Critter Setup, a new installer in the Critter look; updates now download only what changed.
- Scenes: a delete button, drag to reorder, Undo (Ctrl+Z) for every scene change, and Reset the grid alignment.

**Campaigns and tables**
- Saves are named after the campaign (Documents › CritterVTT › Saves), and older saves under a lobby code join their campaign.
- Away from a table, "Find your table" stays open: Critter VTT is used at your own table or someone else's.
- A table from last time that's still open is saved and closed the next time you start.
- Players see "The GM closed this table" when the GM leaves.

**Writing and saving**
- Notes save as you type, a new note too, and anything still being typed is saved before Critter VTT closes or you leave a table.
- Closing the desktop app with unsaved changes asks whether to save first (an update saves without asking).

**Accessibility**
- A font for dyslexia (OpenDyslexic, Lexend where it can't load) in Accessibility and the Look.

**Fixes**
- "Who are you playing?" no longer pops up again when the GM's page reloads.
- The turn order's current turn stays in its place in the list.

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
