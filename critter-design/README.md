# Critter design system (draft)

One look for **Critter**, **Critter Sounds** and **Critter Notes**. This folder holds only the look, so it stays easy to change before any app adopts it:

| File | What it is |
|---|---|
| `tokens.css` | Every colour, surface, type, radius, spacing, shadow and motion value. **Tweak the look here.** |
| `components.css` | Reference rules for buttons, inputs, selects, checkboxes, radios, switches, sliders, tabs, chips, menus, dialogs, toasts and window headers. |
| `index.html` | The specimen: surface-only mock-ups of all three apps, a dark/light switch, two colour pickers per app, the component sheet and an accent stress test. No app functionality. |

Open `index.html` in a browser (serve the folder; it has no build step). Change a value in `tokens.css`, reload, and see all three apps follow.

## Principles

1. **Elevation, not outlines.** Surfaces get lighter as they lift (dark), or whiter with a soft shadow (light). Space and background change separate things; a 1px border is the last resort.
2. **Two colours drive everything.** The user picks `--accent` and `--accent-2` (and optionally a background tone). Soft fills, accent text, focus rings and text-on-fill colours are all derived from them.
3. **Every text token is AA** (4.5:1) on every surface, in both schemes, for any picked colour.
4. **Each app keeps its identity** through its default colours and tone. The structure is shared.
5. **Never a default OS widget.** Checkboxes, radios, switches, selects, sliders and scrollbars are drawn with tokens.
6. **Calm motion.** Short fades and lifts; with `prefers-reduced-motion` everything is instant.

## Inputs (what an app or the user sets)

```css
:root{
  --accent:#8800ff;       /* main colour: primary buttons, active states, focus */
  --accent-2:#4cc9f0;     /* second colour: callouts, previews, meters, the title-bar flourish */
  --tone-dark:#0b0a12;    /* the dark background (a near-black with a hint of hue) */
  --tone-light:#f3f2f8;   /* the light background */
}
<html data-theme="dark">  <!-- or "light"; any element can switch scheme for its subtree -->
```

| App | `--accent` | `--accent-2` | `--tone-dark` | `--tone-light` |
|---|---|---|---|---|
| Critter | `#c9a45c` gold (follows the player's colour) | `#3cc4c4` teal | `#0b0c0f` | `#f2f1ee` |
| Critter Sounds | `#8800ff` purple | `#4cc9f0` ice | `#0b0a12` | `#f3f2f8` |
| Critter Notes | `#10b39b` teal | `#f5a524` amber | `#0c0e0e` | `#f1f4f3` |

## Tokens

### Surfaces (elevation)

| Token | Use | Dark | Light |
|---|---|---|---|
| `--surface-0` | window, canvas, board | the tone | the tone |
| `--surface-1` | docked panels, sidebars, tiles, transport | tone + 3.5% white | tone + 55% white |
| `--surface-2` | cards and items inside panels, floating rails | + 6.5% | white |
| `--surface-3` | menus, dialogs, popovers, floating windows | + 9.5% | white + shadow |
| `--surface-4` | hover on 3, toasts, the active segment | + 13% | tone + 30% white |
| `--sunken` | wells: inputs, slider tracks, segmented rails | translucent black 24% | translucent 5.5% |

`--sunken` is translucent so a well looks right on whatever surface holds it.

### Ink (text)

| Token | Use |
|---|---|
| `--ink` | primary text, titles |
| `--ink-2` | body copy, secondary labels, inactive tabs |
| `--ink-3` | captions, counts, placeholders, caps labels. **The faintest text allowed.** |
| `--ink-4` | icons and decoration only (never words) |

### Accents

| Token | Use |
|---|---|
| `--accent`, `--accent-2` | solid fills (primary button, checked box, slider fill, active tool) |
| `--on-accent`, `--on-accent-2` | text/icons on those fills: black or white, chosen from the colour's lightness |
| `--accent-text`, `--accent-2-text` | the accent used **as text** on surfaces; lightness is clamped (`oklch(from …)`) so any colour stays AA |
| `--accent-soft`, `--accent-softer`, `--accent-2-soft` | tinted fills: selected rows, secondary buttons, chips, callouts |
| `--focus` | focus ring colour (= `--accent-text`) |

### Overlays and lines

`--hover` (6% ink), `--hover-2` (10%), `--press` (14%): tints that work on any surface, in both schemes.
`--line` (9%), `--line-strong` (16%): hairlines, only where space can't separate (a menu separator, a table grid).
`--field-ring` (12%): the one outline kept on purpose, the inset ring of input wells.

### Status

`--ok`, `--warn`, `--bad` (AA as text in each scheme) with `--ok-soft`, `--warn-soft`, `--bad-soft` fills; `--danger` / `--on-danger` for destructive solid buttons.

### Elevation

| Token | Use |
|---|---|
| `--sheen` | dark: a 1px inner top highlight; light: a 5% ring. It replaces the border on raised things. |
| `--shadow-1` | small lifts: the active segment, slider thumb, tiles |
| `--shadow-2` | docked-but-floating things: tool rail, chat panel, dock bar |
| `--shadow-3` | floating windows, menus, dialogs, toasts |
| `--scrim` | behind dialogs (with `backdrop-filter:blur(6px)`) |

### Type

`--font-ui` (Segoe UI Variable Text), `--font-display`, `--font-mono` (Cascadia Mono). Critter keeps its per-game-system fonts; Notes keeps a serif reading face for page bodies.

| Token | Size | Use |
|---|---|---|
| `--fs-2xs` | 10.5px | caps labels (700, `letter-spacing:.09em`, `--ink-3`) |
| `--fs-xs` | 11.5px | counts, meta lines |
| `--fs-sm` | 12.5px | small buttons, tabs, chips, hints |
| `--fs-md` | 13.5px | UI body (Critter uses 15px for its chat) |
| `--fs-lg` | 15px | large buttons, reading text |
| `--fs-xl` / `--fs-2xl` / `--fs-3xl` | 18 / 22 / 28px | section, dialog and page titles |

Weights: `--fw-regular` 450, `--fw-medium` 560 (buttons, tabs), `--fw-bold` 680 (titles). Line heights: `--lh-tight` 1.2, `--lh` 1.45, `--lh-read` 1.6.

### Shape, space, sizes, motion

- Radius: `--r-xs` 4 · `--r-sm` 6 (small buttons, menu items) · `--r-md` 8 (buttons, inputs) · `--r-lg` 12 (cards, list items) · `--r-xl` 16 (panels, windows, dialogs) · `--r-2xl` 22 (app frames, sheets) · `--r-pill`.
- Spacing: 4px steps, `--sp-1` 4 … `--sp-10` 40.
- Control heights: `--h-sm` 26, `--h-md` 32, `--h-lg` 40.
- Motion: `--dur-fast` 120ms (hover, press), `--dur` 180ms (switches, popovers), `--dur-slow` 280ms (panels); `--ease-out` for entering, `--ease-in-out` for moving. `prefers-reduced-motion` makes all of them instant.

## Component rules

**Buttons.** Tonal by default (`--hover-2` fill, no border). One `primary` per area: solid `--accent` with `--on-accent` text and a soft accent glow. `secondary` = `--accent-soft` + `--accent-text`. `ghost` = no fill until hover. Icon buttons are square, transparent, `--ink-2`, `--hover-2` on hover; their "on" state is `--accent-soft` + `--accent-text`. Press moves 1px down. Disabled = 45% opacity.

**Inputs.** A `--sunken` well, radius 8, inset `--field-ring`. Hover strengthens the ring; focus = 1px accent ring + 3px `--accent-soft` halo. Placeholder `--ink-3`.

**Selects.** Same well with a drawn chevron. Where the engine supports `appearance:base-select` (Chromium 135+, so all three Electron apps), the open list is themed too: `--surface-3`, radius 12, `--shadow-3`, rows with `--hover-2` and the chosen one in `--accent-soft`.

**Checkboxes, radios, switches.** Drawn: a sunken 16px box with a 1.5px `--ink-4` ring; checked = solid accent with an `--on-accent` tick or dot; switches 32×18 with a sliding knob. Labels are `--ink-2` and part of the hit area.

**Sliders.** 4px track; filled part `--accent`, rest `--press`; white 14px thumb with a 3px accent ring.

**Tabs.** Two kinds. *Segmented* (switching views in place): a `--sunken` rail, the active segment lifted to `--surface-4` with `--shadow-1`. *Underline* (panel sections): `--ink-3` labels, the active one `--ink` with a 2px accent bar. **No rule under the tab row.**

**Chips.** Pills, 24px tall, `--hover-2` fill; selected = `--accent-soft` + `--accent-text`; status chips use the status soft fills.

**Menus and popovers.** `--surface-3`, radius 16, `--shadow-3` + `--sheen`, 4px padding, 32px rows with radius 6, `--hover-2` on hover/focus. Separators are `--line` hairlines inset 8px. Shortcuts right-aligned in `--ink-3`.

**Dialogs.** `--surface-3`, radius 16, 20px padding, over a blurred `--scrim`. No header or footer rules: the title, spacing and the right-aligned button row (ghost, then primary) do the separating.

**Toasts.** `--surface-4`, radius 12, `--shadow-3`, a small accent dot leading.

**Side panels and sidebars.** `--surface-1` against the `--surface-0` window, no divider line. Items inside are `--surface-2` cards or plain rows; the selected row gets `--hover-2` and a 3px accent bar on its left edge.

**Floating windows** (Critter's Library, GM tools; Sounds' tiles). `--surface-3` (floating) or `--surface-1` (tiled), radius 16, no border. The header is just a row (title + actions) with no rule under it.

**Window headers that run out of room.** Headers are size containers (`container-type:inline-size`). Below **300px** wide, the action buttons (split, pop out, swap, close and any panel extras) hide and a single **⋯** button appears, opening a menu (the menu rules above) that lists the same actions with their labels. Titles truncate with an ellipsis before anything wraps.

**Lists and tables.** No row dividers: 7–8px row padding, `--hover` on hover, `--accent-soft` for the current item. Use `--line` only for real data grids.

**Scrollbars.** Thin, `--hover-2` thumb, transparent track.

## Accessibility check

Checked with axe-core 4.10 (from cdnjs), `color-contrast` rule, on `index.html` in headless Edge:

- **Dark:** 0 violations, 371 passing nodes.
- **Light:** 0 violations, 371 passing nodes.

Both runs cover all three apps' mock-ups and component sheets, plus 24 accent colours as text, solid fill and chip (every preset from the three apps, plus `#3d2f7a`, `#1a1a1a` and `#ffffff`). The 17 "incomplete" nodes are glyph icons and the Notes page's faint accent gradient. The same text also passes on the plain surface.

## Adopting it in each app (for the session that applies it)

Add `tokens.css` first, set the four inputs, then alias the old names so existing rules keep working while they're migrated:

**Critter Sounds** (`src/style.css`, `applyTheme()` in `src/app.js`)
- `applyTheme()` sets `--accent`, `--accent-2` (keep `--accent2` as an alias) and `--tone-dark` from `TONES[t.tone].bg`. Add a scheme choice (Dark / Light) to `appearance()` that sets `data-theme` on `<html>`, with German strings.
- Map: `--bg` → `--surface-0`, `--panel` → `--surface-1`, `--panel2` → `--surface-2`, `--muted` → `--ink-2`, `--faint` → `--ink-3` (today's `#6d6b7e` fails AA at 3.6:1), `--accent-hi` → `--accent-text`, `--accent-ink` → `--on-accent`.
- Drop the 1px borders on `.tile`, `.th`, `.btn`, `.chip`, `.connhint`, `.hint.note`; style `select` and `input[type=checkbox]` per the rules (the sleep-timer, output and "Here" controls are OS widgets today). Replace `rgba(255,255,255,x)` literals with `--hover`/`--press` so light mode works.

**Critter** (`critboard/critboard.html`)
- Game-system THEMES set `--bg/--panel/--panel-2/--ink/--muted/--line/--hover` per system. Keep that: map `--tone-dark` ← the system's `--bg` and let surfaces derive, or keep the system values and alias `--surface-1` → `--panel`, `--surface-2` → `--panel-2`. Systems' own decorative borders (pbta's 2px, blades' double rule, daggerheart's gold inset) are intentional identity and stay.
- `applyAccent()` keeps setting `--accent` from the player's colour; add `--accent-2` (default teal) and a colour section in the Critter menu (Esc), which is the app's settings area.
- Leave alone: paper sheets (`.entwin.paper`, their own `--pp-*` light palette), the loader (`.crload`, fixed Critter colours), the system-switch screen (`.sysveil`).
- About 130 `1px solid var(--line)` borders: containers (`#tools`, `#panel`, `.menu`, `.card`, `.fwin`) become elevation, section rules (`.ph`, `.table`, `.roller`, `.fwhead`, `.rtabs`, `.dmtabs`) become spacing, and controls (`.btn`, `.chip`, `.seg`, `.ctab`, `.rtab`) become tonal fills. Keep borders transparent rather than removed while migrating so nothing shifts.
- Some hint text fails AA today (`#686c74` on `#13161a` is 3.4:1 in the Critter menu); `--ink-3` fixes that.
- The page has no `<meta charset>`, so a plain static server shows mojibake (`Â·`); worth adding `<meta charset="utf-8">`.

**Critter Notes** (`src/style.css`; already token-based with `:root[data-theme=light]`)
- Closest already. Rename `--panel/--panel2/--panel3` → `--surface-1/2/3`, `--muted` → `--ink-2`, `--faint` → `--ink-3`, `--accent2` → `--accent-2`, `--accent-hi` → `--accent-text`, `--accent-ink` → `--on-accent`.
- Remove `border-right`/`border-left` on `#side`/`#right` and the `border-bottom` under `.rtabs` (use the underline-tab rule); remove borders on `.btn`, `.chip`, `.campbtn`, `.findbtn`, `.linkbox`, `.tstat`, `.blink`.
- Replace `accent-color` checkboxes and native selects with the drawn controls.

## Changing the look

- A whole app's feel: its four inputs.
- How strongly surfaces separate: the white percentages in `--surface-1…4` (dark) or the shadows (light).
- How faint secondary text may get: `--ink-2`/`--ink-3` mix percentages. Re-run the axe check after lowering them.
- Roundness: the `--r-*` scale. Density: `--h-*` and `--sp-*`.
