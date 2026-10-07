# Changelog

Critter VTT (the page, `critboard/critboard.html`, and the desktop app in `critboard-desktop/app`).
Critter Sounds keeps its own changelog in the critter-sounds repository.

## 1.3.1 (website and Android, 2026-10-07)
- On a phone, the start screens (Take a seat, Find your table) float as a card with margins that fit the screen, from small phones to large ones, and keep clear of notches. They were wider than the screen, with no margins. Every phone dialog now fits the screen's width.
- On a phone, the Critter VTT menu and the settings are available on the start screen, before joining a table (Menu and the gear above the card). Before joining, the menu leaves out the lobby and the walkthrough.
- Next stays in reach at the bottom of Take a seat.
- Android's back swipe goes back a step instead of leaving: it closes what's open (a menu, the settings, a dialog, a sheet), and Find your table goes back to Take a seat. With nothing left to go back to, the app says "Swipe back again to leave Critter VTT" (Android app 1.2.1).
- Your seat, opened on the start screen, no longer jumps back to Find your table after a second or two.
- Dialogs and menus open at their top on a phone (they opened scrolled to the bottom, where their focus went). Their buttons at the bottom stay in view while the rest scrolls.
- Drag a dialog or the menu down from its top to close it, as on iOS; a short or slow drag springs back. Dialogs have a handle on top.
- The Critter VTT menu shows the logo on a phone again, and tapping the logo at the top of the menu (☰) opens it again.
- Credits and Export open on a phone (they opened behind the menu).
- The walkthrough on a phone: in touch words, with the menu opened at the right tile for each step, and offered once you're at a table.
- The Android app (1.2.3) has Check for updates: in the gear's settings, the Critter VTT menu and Help. It says when you're up to date, and offers a version you skipped again. On its own it now checks every hour (was every 6), always reading the release's current version.
- The Android app (1.2.2) runs edge to edge: the table shows under the status bar and the gesture bar, with no black strips; Critter VTT keeps its own buttons clear of both.

## 1.3.0 (2026-10-07)
**Highlights**
- Critter VTT for Android, for players: join your group's table from your phone. It opens on Join a table, and takes you back to the same table next time. Download Critter-VTT-Player.apk from this release.
- Critter VTT can be installed from the browser (Chrome's Install app), with its own window and icon.
- The start screen fits phone screens: it was a little wider than the screen.

**On phones** (the website and the Android app)
- Swipe the dice panel up for the roll log and the table, and down to tuck them away, anywhere on the panel and not only on its handle.
- Hold a finger on a token, a note, a door or a drawing for its menu (as a right-click does); holding the empty board still pings. Menus fit the screen, with each explanation under its item.
- Bigger touch targets: the dots, boxes and pips on every game system's sheets, the chat modes, the roll box and the menu buttons. The sheet's top row (who plays it, level up, the gear) stays on one line.
- The menu's board tools: even tiles, readable names, real zoom buttons. "Join a table" stays in reach at the bottom of the start screen.
- Look, Accessibility and Your seat open over the menu, not behind it.
- The splash fits a phone; the Accessibility guide has a section on phone gestures.
- The Android app (1.2.0): the status and navigation bars take the table's colours (light or dark), it has an adaptive icon, and it follows the phone's font size (up to 130%).
- The Android app updates itself: when a newer version is released it offers to update, downloads it and Android asks to confirm (the first time, allow installing from Critter VTT). Install 1.2.0 by hand once; later versions arrive by themselves.

## 1.2.4 (2026-10-07)
- Pictures are kept in the saves folder again (the desktop app, or a browser with a saves folder). After every kept save, the tidy-up deleted every picture as unused, so a campaign reopened without its background maps, portraits and campaign picture. Saves in browser storage were not affected.

## 1.2.3 (2026-10-07)
- Campaign pictures stay on the start screen after a restart: the save made while starting up no longer runs before the picture has arrived.
- The "Your campaign" dialog has its margins back and no stray hover: it had picked up the start screen's card style.

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
