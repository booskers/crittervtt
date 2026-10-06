/* Critter design system: the font choices. Three roles, each user-pickable:
   ui (controls, lists), display (titles, numbers), read (long text: notes, rules, sheets).
   All from Google Fonts (free, OFL) except "System", which uses Windows' Segoe UI / Sitka. */
const FONTS = {
  ui: [
    ['Atkinson Hyperlegible Next', 'Atkinson+Hyperlegible+Next:wght@200..800', 'sans'],
    ['Zalando Sans', 'Zalando+Sans:ital,wght@0,200..900;1,200..900', 'sans'],
    ['Alegreya Sans', 'Alegreya+Sans:ital,wght@0,400;0,500;0,700;0,800;1,400', 'sans'],
    ['Bricolage Grotesque', 'Bricolage+Grotesque:opsz,wght@12..96,300..800', 'sans'],
    ['Figtree', 'Figtree:wght@300..900', 'sans'],
    ['Lexend', 'Lexend:wght@300..800', 'sans'],
    ['Nunito', 'Nunito:wght@300..900', 'sans'],
    ['Onest', 'Onest:wght@300..800', 'sans'],
    ['Outfit', 'Outfit:wght@300..800', 'sans'],
    ['Rubik', 'Rubik:wght@300..900', 'sans'],
    ['System', '', 'sys']
  ],
  display: [
    ['Atkinson Hyperlegible Next', 'Atkinson+Hyperlegible+Next:wght@200..800', 'sans', 750],
    ['Zalando Sans Expanded', 'Zalando+Sans+Expanded:wght@200..900', 'sans', 700],
    ['Zalando Sans SemiExpanded', 'Zalando+Sans+SemiExpanded:wght@200..900', 'sans', 700],
    ['Zalando Sans', 'Zalando+Sans:ital,wght@0,200..900;1,200..900', 'sans', 750],
    ['Grenze', 'Grenze:wght@400;500;600;700', 'serif', 700],
    ['Fraunces', 'Fraunces:opsz,wght@9..144,300..900', 'serif', 650],
    ['Bricolage Grotesque', 'Bricolage+Grotesque:opsz,wght@12..96,300..800', 'sans', 750],
    ['Young Serif', 'Young+Serif', 'serif', 400],
    ['Cinzel', 'Cinzel:wght@400..900', 'serif', 700],
    ['Texturina', 'Texturina:opsz,wght@12..72,300..900', 'serif', 650],
    ['Cormorant Garamond', 'Cormorant+Garamond:wght@400..700', 'serif', 700],
    ['Instrument Serif', 'Instrument+Serif', 'serif', 400],
    ['Syne', 'Syne:wght@400..800', 'sans', 750],
    ['Unbounded', 'Unbounded:wght@300..900', 'sans', 650],
    ['Pirata One', 'Pirata+One', 'serif', 400],
    ['System', '', 'sys', 700]
  ],
  read: [
    ['Atkinson Hyperlegible Next', 'Atkinson+Hyperlegible+Next:wght@200..800', 'sans'],
    ['Literata', 'Literata:opsz,wght@7..72,200..900', 'serif'],
    ['Newsreader', 'Newsreader:opsz,wght@6..72,200..800', 'serif'],
    ['Spectral', 'Spectral:wght@400;500;600;700', 'serif'],
    ['Alegreya', 'Alegreya:wght@400..900', 'serif'],
    ['Fraunces', 'Fraunces:opsz,wght@9..144,300..900', 'serif'],
    ['Zalando Sans', 'Zalando+Sans:ital,wght@0,200..900;1,200..900', 'sans'],
    ['System', '', 'sys']
  ]
};
// ready-made pairings: [name, display, ui, read]; "Easy reading" is the base for all three apps
const FONT_SETS = [
  ['Easy reading', 'Atkinson Hyperlegible Next', 'Atkinson Hyperlegible Next', 'Atkinson Hyperlegible Next'],
  ['Zalando', 'Zalando Sans Expanded', 'Zalando Sans', 'Literata'],
  ['Critter classic', 'Grenze', 'Alegreya Sans', 'Spectral'],
  ['Storybook', 'Fraunces', 'Nunito', 'Literata'],
  ['Arcane', 'Cinzel', 'Alegreya Sans', 'Alegreya'],
  ['Inkwell', 'Young Serif', 'Figtree', 'Newsreader'],
  ['Pulp', 'Texturina', 'Rubik', 'Spectral'],
  ['Neon', 'Unbounded', 'Onest', 'Atkinson Hyperlegible Next'],
  ['Jolly Roger', 'Pirata One', 'Outfit', 'Alegreya'],
  ['Studio', 'Syne', 'Bricolage Grotesque', 'Newsreader']
];
const SYS_STACK = { ui: '"Segoe UI Variable Text","Segoe UI",system-ui,sans-serif', display: '"Segoe UI Variable Display","Segoe UI",system-ui,sans-serif', read: '"Sitka Text",Georgia,serif' };
const fontDef = (role, name) => FONTS[role].find(f => f[0] === name) || (role === 'display' && FONTS.ui.find(f => f[0] === name) && [name, FONTS.ui.find(f => f[0] === name)[1], 'sans', 700]);
function loadFont(q) {
  if (!q || document.querySelector(`link[data-font="${q}"]`)) return;
  const l = document.createElement('link'); l.rel = 'stylesheet'; l.dataset.font = q;
  l.href = `https://fonts.googleapis.com/css2?family=${q}&display=swap`; document.head.append(l);
}
// the CSS for one role: the face, then a sensible fallback
function fontStack(role, name) {
  const d = fontDef(role, name);
  if (!d || d[2] === 'sys') return SYS_STACK[role];
  loadFont(d[1]);
  return `"${d[0]}",${d[2] === 'serif' ? 'Georgia,serif' : '"Segoe UI",system-ui,sans-serif'}`;
}
// sets --font-ui/--font-display/--font-read (+ the display weight) on an element
function applyFonts(el, { display, ui, read }) {
  const d = fontDef('display', display);
  el.style.setProperty('--font-display', fontStack('display', display));
  el.style.setProperty('--fw-display', d ? d[3] : 700);
  el.style.setProperty('--font-ui', fontStack('ui', ui));
  el.style.setProperty('--font-read', fontStack('read', read));
}
