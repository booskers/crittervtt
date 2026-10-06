# Critter design system (draft 3)

One look for **Critter VTT**, **Critter Sounds** and **Critter Notes**. This folder holds only the look, so it stays easy to change before any app adopts it.

| File | What it is |
|---|---|
| `tokens.css` | Every colour, surface, font, radius, spacing, shadow, artwork-effect and motion value. **Tweak the look here.** |
| `components.css` | Reference rules: buttons, inputs, selects, checkboxes, radios, switches, sliders, tabs, chips, menus, dialogs, toasts, window headers, the see-through title bar, character avatars, Critter's chat entries and dice, and the artwork effects (bleed, glow on hover, banner). |
| `icons.js` | The icons, taken from the apps: Sounds' and Notes' line icons for the interface, Critter's game-icons.net glyphs for game content. |
| `fonts.js` | The font catalogue (titles, interface, reading) and ten ready-made pairings. |
| `art.js` | Painted demo pictures (scenes, and flat portraits for the sheet-header bleed) for the specimen, made from SVG. |
| `check/` | The two contrast checkers used below (`allcheck.mjs`, `bleedcheck.mjs`); usage is at the top of each. |
| `index.html` | The specimen: surface-only mock-ups of all three apps with a "Your look" panel (dark/light, fonts, surface tint, picture colour, grain), a font pairing and two colour pickers per app, colour-theme suggestions for Notes, an artwork picker, the font gallery, the component sheet and an accent stress test. No app functionality. |

Open `index.html` through a local server (there's no build step). Change a value in `tokens.css`, reload, and all three apps follow.

## Principles

1. **A game table, not an office.** Warm ambient light from the two accents, a fine film grain, game icons on game things, artwork everywhere it exists.
2. **Elevation, not outlines.** Surfaces lift by light and soft shadow. Space and background separate things; a 1px line is the last resort.
3. **Pictures spill their colour; glows wait for the pointer.** Covers, portraits and scene pictures bleed their colours into the surface around them (the Sounds play bar is the model). Glows (around pictures, primary buttons, the play button, slider thumbs, pad icons, avatars) appear **only on hover**.
4. **Everything has an icon.** Buttons, tabs, menu items, section labels and window headers. Icon-only buttons always have a tooltip and an `aria-label`.
5. **Two colours drive everything.** The user picks `--accent` and `--accent-2`; soft fills, accent text, glows, focus rings and text-on-fill are derived.
6. **One set of fonts.** All three apps share the base fonts ("Easy reading": Atkinson Hyperlegible Next). Each app's settings offer the other pairings.
7. **Every text token is AA** (4.5:1, or 3:1 for large text) in both schemes, for any picked colour, at any surface tint, and over any artwork.
8. **Never a default OS widget.** Checkboxes, radios, switches, selects, sliders and scrollbars are drawn with tokens.
9. **Calm motion.** Short lifts and fades; with `prefers-reduced-motion` everything is instant.

## What the user can change

| Setting | Token | Range |
|---|---|---|
| Main colour | `--accent` | any colour |
| Second colour | `--accent-2` | any colour |
| Background tone | `--tone-dark`, `--tone-light` | any near-black / near-white |
| Dark or light | `data-theme` on `<html>` (or any element) | `dark`, `light` |
| Surface tint | `--hue` | `0%` (neutral grey) to `14%` (strongly tinted); default 4% |
| Picture colour (bleed) | `--bleed` | `0` off, `.6` soft, `1` full |
| Film grain | `--grain` | `0` or `1` |
| Fonts (per app, in its settings) | `--font-display`, `--font-ui`, `--font-read` (+ `--fw-display`) | a pairing from the list below, or custom; default "Easy reading" |

Each app's identity (its defaults). Fonts are the same for all three: Easy reading.

| App | `--accent` | `--accent-2` | `--tone-dark` | `--tone-light` |
|---|---|---|---|---|
| Critter VTT | `#ff5c00` orange (and still follows the player's colour) | `#3cc4c4` teal | `#0b0c0f` | `#f2f1ee` |
| Critter Sounds | `#8800ff` purple | `#4cc9f0` ice | `#0b0a12` | `#f3f2f8` |
| Critter Notes | `#ffbd00` logo yellow | `#7a8cff` ink | `#0b0d14` | `#f2f3f8` |

**Critter Notes colours.** Notes matches its logo's yellow (`#ffbd00`) with ink as the second colour; these themes stay available:

| Theme | `--accent` | `--accent-2` | Feel |
|---|---|---|---|
| **Saffron & ink** (default) | `#f0a020` | `#7a8cff` | old parchment and ink |
| Lapis & amber | `#4f7dff` | `#f5a524` | ink and lamplight; calm for long reading |
| Ember & ice | `#ff7a3d` | `#5ac8fa` | warm and lively; closer to Critter's coral |
| Rose & gold | `#e0568f` | `#f2c14e` | storybook |
| Cerulean & coral | `#2ea8ff` | `#ff8a6b` | bright sky; a nod to Critter |

Critter VTT's game systems no longer bring their own palettes, borders or fonts: every system uses this one look (each keeps its emblem).

## Fonts

All three apps use the same base: **Easy reading**, Atkinson Hyperlegible Next for titles, interface and reading text. Each app's settings offer a **font pairing** picker (shown in pairs, like the specimen's gallery), plus a custom option where each role is picked on its own. The specimen has that picker beside each app's name, and a "Fonts, all apps" control in "Your look". All are free Google Fonts (SIL OFL); "System" uses Windows' Segoe UI and Sitka.

- **Titles:** Atkinson Hyperlegible Next, Zalando Sans Expanded, Zalando Sans SemiExpanded, Zalando Sans, Grenze, Fraunces, Bricolage Grotesque, Young Serif, Cinzel, Texturina, Cormorant Garamond, Instrument Serif, Syne, Unbounded, Pirata One, System.
- **Interface:** Atkinson Hyperlegible Next, Zalando Sans, Alegreya Sans, Bricolage Grotesque, Figtree, Lexend, Nunito, Onest, Outfit, Rubik, System.
- **Reading:** Atkinson Hyperlegible Next, Literata, Newsreader, Spectral, Alegreya, Fraunces, Zalando Sans, System.

Pairings (titles + interface + reading): **Easy reading** (Atkinson Hyperlegible Next for all three; the base), **Zalando** (Zalando Sans Expanded + Zalando Sans + Literata), **Critter classic** (Grenze + Alegreya Sans + Spectral), **Storybook** (Fraunces + Nunito + Literata), **Arcane** (Cinzel + Alegreya Sans + Alegreya), **Inkwell** (Young Serif + Figtree + Newsreader), **Pulp** (Texturina + Rubik + Spectral), **Neon** (Unbounded + Onest + Atkinson Hyperlegible Next), **Jolly Roger** (Pirata One + Outfit + Alegreya), **Studio** (Syne + Bricolage Grotesque + Newsreader).

`fonts.js` has the exact Google Fonts queries and an `applyFonts(element, {display, ui, read})` helper that loads a face only when it's picked. The desktop apps should bundle at least Atkinson Hyperlegible Next, so the base works offline.

## Icons

- **Line icons** (24px grid, 1.8 stroke, round caps) for interface chrome: play, queue, split, close, search, settings, kinds of pages. They come from Critter Sounds' `ICONS` and Critter Notes' `ICON_PATHS`, so both apps already have them.
- **Game icons** (game-icons.net, filled, CC BY 3.0, already credited in Critter) for game content: tools on the board, dice, characters, GM tools, sound pads, windows in Critter's dock.
- Sizes: 16px in buttons and menus (13px in small buttons), 18–20px for game icons, 24px for dice.
- **Characters** (players, NPCs, tokens, seats, linked people) are a flat tinted circle in their colour with their game icon (`.av`): no gradients. The ring brightens into a glow on hover.
- **Badges:** a window or section icon sits in a 28px rounded square, tinted `--accent-soft` (or `--accent-2-soft`, or plain `--hover-2`).
- Active things light their icon in `--accent-text`: the active tab, the selected segment, a hovered menu item.
- In `index.html`, write `<i data-i="play"></i>` or `<i data-g="dragon-head"></i>` and `icons.js` swaps them for SVG.

## Artwork effects

| Effect | Class | Where |
|---|---|---|
| **Bleed:** a picture's colours spill outward into the surface it sits on | `.bleed` (sideways), `.bleed.down` (downward), `.bleed.full`, with `--art:url(…)` | Sounds' play bar (the cover), Critter's sheet header (the portrait), Notes' page (its picture), any scene card |
| **Glow on hover:** a blurred copy appears under a picture when you point at it | `.art`, with `--art` (strength `--art-glow`) | Covers, track thumbnails, soundscape tiles, scene thumbnails, campaign art |
| **Banner:** a wide picture fading into the surface below | `.banner`, with `--art` | Notes page headers, Critter scene cards |

How the bleed stays readable: the layer is blurred (44px), saturated, and **graded**. In dark it's dimmed (`brightness(.44)`, `saturate(2.8)`); in light it's lifted and compressed (`contrast(.5) brightness(1.55)`). It sits at `.72 × --bleed` opacity and is masked away from the picture. Rules for anything on a bleed:

- All text is `--ink`. Hierarchy comes from size and weight, not fainter ink (`components.css` maps `.t-2`, `.t-3`, `.cap`, `p` and `small` to `--ink` inside `.bleed`).
- Chips and tonal controls get a near-opaque backing (`--surface-3` at 90%).
- Content shouldn't overlap the still-visible part of a banner picture.
- Pictures update with a 280ms fade (`--dur-slow`); `--bleed:0` turns all of it off.

## Tokens

### Atmosphere

`--ambient` is two soft lights from `--accent` (top right) and `--accent-2` (bottom left) for window backgrounds. `--grain-img` with `--grain-opacity` is a fine noise overlay (`mix-blend-mode:overlay`). `.atmos` applies both.

### Surfaces (elevation)

The background tone is first tinted with the accent by `--hue`, then:

| Token | Use | Dark | Light |
|---|---|---|---|
| `--surface-0` | window, canvas, board | the tinted tone | the tinted tone |
| `--surface-1` | docked panels, sidebars, tiles, play bar | + 3.5% white | + 55% white |
| `--surface-2` | cards and items inside panels, floating rails | + 6.5% | white |
| `--surface-3` | menus, dialogs, popovers, floating windows | + 9.5% | white + shadow |
| `--surface-4` | hover on 3, toasts, the active segment | + 13% | tone + 30% white |
| `--sunken` | wells: inputs, slider tracks, segmented rails | translucent black 24% | translucent 5.5% |

### Ink (text)

| Token | Use |
|---|---|
| `--ink` | primary text, titles, and all text on artwork |
| `--ink-2` | body copy, secondary labels, inactive tabs |
| `--ink-3` | captions, counts, placeholders, caps labels. **The faintest text allowed.** |
| `--ink-4` | icons and decoration only (never words) |

### Accents

| Token | Use |
|---|---|
| `--accent`, `--accent-2` | solid fills: checked boxes, slider fill, active tool |
| `--accent-fill`, `--accent-lift`, `--accent-glow` | the primary button: the accent lit from above with a top highlight; `--accent-glow` is added on hover only |
| `--on-accent`, `--on-accent-2` | text/icons on those fills: black or white, chosen from the colour's lightness |
| `--accent-text`, `--accent-2-text` | the accent used **as text** on surfaces; lightness is clamped (`oklch(from …)`) so any colour stays AA |
| `--accent-soft`, `--accent-softer`, `--accent-2-soft` | tinted fills: selected rows, secondary buttons, chips, callouts, icon badges |
| `--focus` | focus ring colour |

### Overlays, lines, status, elevation

- `--hover` (6% ink), `--hover-2` (10%), `--press` (14%): tints that work on any surface.
- `--line` (9%), `--line-strong` (16%): hairlines only where space can't separate. `--field-ring` (12%): the inset ring on input wells.
- `--ok`, `--warn`, `--bad` and their `-soft` fills; `--danger` / `--on-danger`; `--crit`/`--crit-text` and `--fumble`/`--fumble-text` (+ `-soft`) for dice results.
- `--sheen` (dark: 1px inner top highlight; light: 5% ring) replaces borders on raised things. `--shadow-1/2/3` for small lifts, docked floating things, and floating windows. `--scrim` behind dialogs, with a 6px backdrop blur.

### Type, shape, space, motion

- Sizes: `--fs-2xs` 10.5 (caps labels) · `--fs-xs` 11.5 · `--fs-sm` 12.5 · `--fs-md` 13.5 · `--fs-lg` 15 (reading) · `--fs-xl` 18 · `--fs-2xl` 22 · `--fs-3xl` 28. Weights `--fw-regular` 450, `--fw-medium` 560, `--fw-bold` 680, `--fw-display` per title font.
- Radius (rounder than a business app): `--r-xs` 5 · `--r-sm` 7 · `--r-md` 10 (buttons, inputs) · `--r-lg` 14 (cards) · `--r-xl` 18 (panels, windows, dialogs) · `--r-2xl` 26 (app frames) · `--r-pill`.
- Spacing on a 4px grid (`--sp-1` 4 … `--sp-10` 40). Control heights `--h-sm` 26, `--h-md` 32, `--h-lg` 40.
- Motion: `--dur-fast` 120ms, `--dur` 180ms, `--dur-slow` 280ms; `--ease-out`, `--ease-in-out`. Reduced motion makes them instant.

## Component rules

**Buttons.** Every button has an icon. Tonal by default (`--hover-2`, no border). One **primary** per area: `--accent-fill`, `--on-accent`, `--accent-lift`; on hover it lifts 1px and gains `--accent-glow`. **Secondary** = `--accent-soft` + `--accent-text`. **Ghost** = no fill until hover. Icon buttons are transparent squares, `--ink-2`; their "on" state is `--accent-soft`. The **add tile** is a dashed `--line-strong` outline that turns accent on hover, the one dashed line we keep.

**Inputs.** A `--sunken` well, radius 10, inset `--field-ring`, with an optional leading icon (`.fieldicon`). Focus = accent ring + 3px soft halo.

**Selects.** Same well with a drawn chevron. With `appearance:base-select` (Chromium 135+, so all three Electron apps) the open list is themed too: `--surface-3`, radius 14, `--shadow-3`, the chosen row in `--accent-soft`. Long values end in an ellipsis.

**Checkboxes, radios, switches.** Drawn: a sunken 17px box with a `--ink-4` ring; checked = solid accent with an `--on-accent` tick or dot. Switches are 34×20.

**Sliders.** 4px track filled from `--accent` toward `--accent-2`; white thumb with an accent ring, glowing on hover.

**Tabs.** *Segmented* (views in place): a sunken rail, the active segment lifted to `--surface-4` with its icon in `--accent-text`. *Underline* (panel sections): the active tab gets a 2px accent→accent-2 bar. No rule under the tab row.

**Section labels.** Caps, `--fs-2xs`, `--ink-3`, with a leading icon in `--accent-text`; the `.orn` variant trails off into a fading accent line.

**Chips.** Pills with an icon; selected = `--accent-soft` + `--accent-text`; status chips use the status soft fills.

**Menus.** `--surface-3`, radius 18, `--shadow-3` + `--sheen`. Every item has an icon (`--ink-3`, accent on hover); shortcuts are right-aligned; destructive items are `--bad`.

**Dialogs.** `--surface-3` over a blurred scrim, with an icon badge beside the title. No header or footer rules; the button row is ghost, then primary.

**Toasts.** `--surface-4`, radius 14, `--shadow-3`, a leading icon badge.

**Side panels.** `--surface-1` against the window, no divider. The selected row gets `--hover-2` and a glowing 3px accent bar.

**Floating and tiled windows.** Radius 18, no border; the header is an icon badge, the title in the title font, then actions. **Below 300px wide, every button except ✕ folds into one ⋯ button** (split, swap, pop out, roll, and each window's extras such as "New"), which opens a menu with the same actions and their labels; ✕ always stays. Markup: `.wacts` holds the foldable actions, then `.wmore`, then the close button outside `.wacts`.

**Title bar (all three Electron apps).** See-through, like Critter's: it sits over the content, which runs underneath it, with a soft fade from the top (dark: black 70% → 45% → clear; light: white 92% → 78% → clear) and a text shadow, so its brand, title and window buttons stay readable over anything. No line under it. Brand (logo + caps name) on the left, the current page or scene in the middle, minimise/maximise/close on the right (close turns red on hover). `.titlebar` in `components.css`.

**Critter's chat** (kept from the original design). Entries sit straight on the panel, no cards; hover tints the row. A 38px character avatar, then the name (bold) and time (`--ink-3`). A roll shows its **total first and big** (title font, 38px; gold `--crit-text` on a critical, red `--fumble-text` on a fumble), then the label in `--accent-text`, the expression in mono, a result badge, and **every die that was rolled in its own shape** (d4 triangle, d6 rounded square, d8 diamond, d10 kite, d12 pentagon, d20 hexagon, others round) filled with the player's colour and showing its face; crit and fumble dice turn gold and red; a die that didn't count is grey and struck through. Messages are plain text. The log fades out at its top edge as it scrolls.

**Critter's scenes strip.** Scene thumbnails float beside the tool rail on the board (74×46, radius 10); the current scene has an accent outline with a gap; a small + adds one; thumbnails glow on hover.

**Lists.** No row dividers; artwork thumbnails (`.art`) lead rows where there's a picture.

**Sound pads** (and similar coloured tiles). Each has its own `--c`: a gradient of that colour over the surface, its game icon in it (glowing on hover), the label in `--ink`.

## Accessibility check

Two checks, both in headless Edge against `index.html`:

1. **axe-core 4.10** (from cdnjs), `color-contrast`: **0 violations** in dark and light. Because the backgrounds use gradients and pictures, axe leaves many nodes "incomplete", so a second check was added.
2. **A pixel check of every piece of text.** It hides the text (and its decorations), screenshots what's actually behind each text line box (the centre of it for shaped dice), and compares the text colour with the worst background pixel there.
   - All **468 text items** pass AA in dark and light, at surface tints of **0%, 6% and 14%**. The lowest ratio is 4.51:1. This includes the see-through title bars over the board and over the Notes banner, and the chat's dice faces.
   - All **25 text items on picture bleeds** pass AA in both schemes, with the real pictures and with the worst cases: pure white art (dark) and pure black art (light). The lowest is 6.63:1.

This covers all three mock-ups, the component sheets, and 27 accent colours as text, solid fill and chip (every preset and suggested theme from the three apps, plus `#3d2f7a`, `#1a1a1a` and `#ffffff`).

## Adopting it in each app (for the session that applies it)

Add `tokens.css` first, set the inputs, then alias the old names so existing rules keep working while they're migrated.

**Critter Sounds** (`src/style.css`, `applyTheme()`/`appearance()` in `src/app.js`)
- `applyTheme()` sets `--accent`, `--accent-2` (keep `--accent2` as an alias), `--tone-dark` from `TONES[t.tone].bg`, plus `--hue`, `--bleed`, `--grain` and the fonts. `appearance()` gains Dark/Light, the font pairing, surface tint and picture colour, with German strings.
- Map: `--bg` → `--surface-0`, `--panel` → `--surface-1`, `--panel2` → `--surface-2`, `--muted` → `--ink-2`, `--faint` → `--ink-3` (today's `#6d6b7e` is 3.6:1, which fails AA), `--accent-hi` → `--accent-text`, `--accent-ink` → `--on-accent`.
- The play bar's existing `#barGlow` becomes `.bleed` with the graded filter (today it uses `brightness(1)`, which can put white text on a bright cover). `.nowart` becomes `.art` (glow on hover).
- The title bar becomes see-through like Critter's: the page runs under it, `#titlebar` gets the `.titlebar` fade instead of its solid background and gradient line.
- Window headers: move the close button out of the foldable group; everything else folds into ⋯ below 300px.
- Drop the 1px borders on `.tile`, `.th`, `.btn`, `.chip`, `.connhint`, `.hint.note`; draw `select` and `input[type=checkbox]` (the sleep timer, output and "Here" controls are OS widgets today). Replace `rgba(255,255,255,x)` literals with `--hover`/`--press` so light mode works.

**Critter** (`critboard/critboard.html`)
- Game-system THEMES set `--bg/--panel/--panel-2/--ink/--muted/--line/--hover` and fonts per system. Keep that: either map `--tone-dark` from the system's `--bg` and let surfaces derive, or alias `--surface-1` → `--panel`. Systems' decorative borders and frames are identity and stay.
- The app is renamed **Critter VTT** in visible text. The default accent becomes `#ff5c00` (today `#c9a45c` gold). `applyAccent()` keeps setting `--accent` from the player's colour; add `--accent-2` and a "Look" section in the Critter menu (Esc), the app's settings area, with colours, scheme, the font pairing and picture colour.
- Keep the chat exactly as structured today (`renderEntryCore`: `.entry`, `.rres`, `.total`, `.rline`, `.dice`, `.die.d4…d20`); restyle it with the tokens as in `components.css`. Avatars stay flat (`.av`). Dropped dice change from faded (`opacity:.35`) to grey and struck through, which keeps the number readable.
- Pictures: the sheet window header gets `.bleed` from its portrait; scene thumbnails (the scenes strip) and scene cards get `.art` / `.banner`.
- Leave alone: paper sheets (`.entwin.paper`, their own `--pp-*` light palette), the loader (`.crload`), the system-switch screen (`.sysveil`).
- About 130 `1px solid var(--line)` borders: containers become elevation, section rules become spacing, controls become tonal fills. Keep borders transparent rather than removed while migrating, so nothing shifts.
- Some hint text fails AA today (`#686c74` on `#13161a` is 3.4:1 in the Critter menu).
- The page has no `<meta charset>`, so a plain static server shows mojibake (`Â·`). Worth adding `<meta charset="utf-8">`.

**Critter Notes** (`src/style.css`; already token-based with `:root[data-theme=light]`)
- Rename `--panel/--panel2/--panel3` → `--surface-1/2/3`, `--muted` → `--ink-2`, `--faint` → `--ink-3`, `--accent2` → `--accent-2`, `--accent-hi` → `--accent-text`, `--accent-ink` → `--on-accent`; `--read` → `--font-read`.
- New colours: Saffron & ink (`#f0a020` / `#7a8cff`).
- Pages with a picture get `.banner` + `.bleed.down`; the campaign button gets `.art`, linked people get `.av`.
- The title bar becomes see-through (the sidebar, page banner and side panel run under it), and window headers fold everything but ✕ into ⋯ when narrow.
- Remove `border-right`/`border-left` on `#side`/`#right` and the rule under `.rtabs`; remove borders on `.btn`, `.chip`, `.campbtn`, `.findbtn`, `.linkbox`, `.tstat`, `.blink`. Replace `accent-color` checkboxes and native selects with the drawn controls.

## Changing the look

- A whole app's feel: its colours, tone and font pairing.
- How much glows on hover: `--accent-glow` and `--art-glow`.
- More or less colour in the chrome: `--hue`, and `--ambient-amt` for the background lights.
- How strongly surfaces separate: the white percentages in `--surface-1…4` (dark) or the shadows (light).
- How loud artwork is: `--bleed` per user; the grading in `--bleed-filter` (re-run the bleed check after brightening it).
- Roundness: the `--r-*` scale. Density: `--h-*` and `--sp-*`.

## Logos

Each app has a logo (mark, "Critter" wordmark, coloured pill) drawn for dark backgrounds. In the apps:

- **Title bar (top left): the mark only**, in the app's colour; the app's name stays in the tooltip, the window title and the screen-reader label.
- **Large logos** (Critter VTT's chat panel, splash and menu; Critter Sounds' header) use the full logo inline: the wordmark follows the text colour (`currentColor`), so it turns dark in light mode; the mark and pill keep the brand colour.
- **Light mode:** Critter Notes' yellow deepens from `#ffbd00` to `#b27f00` for the mark (`icon-light.svg`) so it stays visible on white; orange and purple stay as they are.
- Icons (`.ico`, PNGs, favicons) are cut from the mark; `make-icons.cjs` in Sounds and Notes now draws them from `src/icon.svg`.
