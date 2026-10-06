/* Demo artwork for the specimen: small painted scenes and token portraits, made from SVG so they ship with the page.
   ART.scene(name) and ART.portrait(gameIcon, colourA, colourB) return a CSS url() for --art. */
const ART = (() => {
  const url = svg => `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;
  const wrap = (defs, body) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 260" preserveAspectRatio="xMidYMid slice"><defs>${defs}<filter id="s"><feGaussianBlur stdDeviation="6"/></filter><filter id="b"><feGaussianBlur stdDeviation="18"/></filter></defs>${body}</svg>`;
  const sky = (id, stops) => `<linearGradient id="${id}" x1="0" y1="0" x2="0" y2="1">${stops.map(([o, c]) => `<stop offset="${o}" stop-color="${c}"/>`).join('')}</linearGradient>`;
  const S = {
    tavern: wrap(sky('g', [[0, '#2a1208'], [.55, '#7a3412'], [1, '#d9822b']]),
      `<rect width="400" height="260" fill="url(#g)"/><circle cx="300" cy="190" r="90" fill="#ffb347" opacity=".55" filter="url(#b)"/>
       <path d="M0 150 L70 95 L140 150 V260 H0Z M120 160 L210 80 L300 160 V260 H120Z" fill="#1d0b05"/>
       <rect x="40" y="170" width="22" height="26" rx="3" fill="#ffcf6b"/><rect x="170" y="175" width="26" height="30" rx="3" fill="#ffd27a"/><rect x="232" y="180" width="22" height="26" rx="3" fill="#ffc35c"/>
       <rect x="0" y="236" width="400" height="24" fill="#120603"/><circle cx="350" cy="60" r="3" fill="#ffe2a8"/><circle cx="90" cy="40" r="2" fill="#ffe2a8"/>`),
    harbour: wrap(sky('g', [[0, '#071526'], [.6, '#164a63'], [1, '#2f8f9d']]),
      `<rect width="400" height="260" fill="url(#g)"/><circle cx="90" cy="70" r="70" fill="#7fd6e6" opacity=".35" filter="url(#b)"/>
       <path d="M250 0 L235 70 L255 72 L232 150" stroke="#e8fbff" stroke-width="4" fill="none" filter="url(#s)"/><path d="M250 0 L235 70 L255 72 L232 150" stroke="#fff" stroke-width="1.5" fill="none"/>
       <rect x="320" y="110" width="16" height="70" fill="#0c2533"/><path d="M328 112 L420 80 L420 140Z" fill="#fff6c4" opacity=".35"/>
       <path d="M0 190 Q50 170 100 190 T200 190 T300 190 T400 190 V260 H0Z" fill="#0b3346"/><path d="M0 215 Q60 195 120 215 T240 215 T400 212 V260 H0Z" fill="#06202d"/>`),
    forest: wrap(sky('g', [[0, '#04140f'], [.6, '#0f3b2c'], [1, '#3f8a5a']]),
      `<rect width="400" height="260" fill="url(#g)"/><circle cx="290" cy="70" r="26" fill="#f2f5d0"/><circle cx="290" cy="70" r="70" fill="#d9f2b4" opacity=".3" filter="url(#b)"/>
       ${Array.from({ length: 11 }, (_, i) => `<path d="M${i * 40 - 10} 260 L${i * 40 + 15} ${120 + (i * 37) % 50} L${i * 40 + 40} 260Z" fill="#06261b"/>`).join('')}
       ${Array.from({ length: 9 }, (_, i) => `<path d="M${i * 50 - 20} 260 L${i * 50 + 10} ${170 + (i * 23) % 40} L${i * 50 + 40} 260Z" fill="#021009"/>`).join('')}`),
    dungeon: wrap(sky('g', [[0, '#0d0718'], [.7, '#2b1650'], [1, '#4a2470']]),
      `<rect width="400" height="260" fill="url(#g)"/><path d="M120 260 V120 A80 80 0 0 1 280 120 V260Z" fill="#07030f"/>
       <circle cx="85" cy="130" r="40" fill="#ff8a2a" opacity=".55" filter="url(#b)"/><circle cx="315" cy="130" r="40" fill="#ff8a2a" opacity=".55" filter="url(#b)"/>
       <path d="M80 120 q5 -16 5 -22 q6 10 5 22Z M310 120 q5 -16 5 -22 q6 10 5 22Z" fill="#ffd27a"/>
       <circle cx="200" cy="170" r="50" fill="#9d6bff" opacity=".4" filter="url(#b)"/>`),
    desert: wrap(sky('g', [[0, '#3b0d3a'], [.5, '#c2436b'], [1, '#ffb15c']]),
      `<rect width="400" height="260" fill="url(#g)"/><circle cx="200" cy="150" r="46" fill="#ffe08a"/><circle cx="200" cy="150" r="110" fill="#ffcc70" opacity=".35" filter="url(#b)"/>
       <path d="M0 190 Q100 150 200 185 T400 175 V260 H0Z" fill="#7a2a3a"/><path d="M0 225 Q120 195 250 222 T400 215 V260 H0Z" fill="#3d1220"/>`),
    arcane: wrap(sky('g', [[0, '#05101f'], [1, '#141a46']]),
      `<rect width="400" height="260" fill="url(#g)"/><circle cx="200" cy="130" r="90" fill="#36e0ff" opacity=".35" filter="url(#b)"/><circle cx="240" cy="110" r="60" fill="#c45cff" opacity=".45" filter="url(#b)"/>
       <circle cx="200" cy="130" r="60" fill="none" stroke="#b8f4ff" stroke-width="2" opacity=".8"/><circle cx="200" cy="130" r="42" fill="none" stroke="#e7c8ff" stroke-width="1.5" stroke-dasharray="4 6"/>
       <path d="M200 70 L214 130 L200 190 L186 130Z" fill="#e8fbff" opacity=".85"/>`)
  };
  return {
    scene: n => url(S[n] || S.arcane),
    portrait: (gi, a, b) => {
      const g = (typeof GAME_ICONS !== 'undefined' && GAME_ICONS[gi]) || ['0 0 512 512', ''];
      return url(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120"><defs><radialGradient id="r" cx=".35" cy=".3" r=".9"><stop offset="0" stop-color="${a}"/><stop offset="1" stop-color="${b}"/></radialGradient></defs><rect width="120" height="120" fill="url(#r)"/><svg x="22" y="20" width="76" height="76" viewBox="${g[0]}" fill="#fff" fill-opacity=".92">${g[1]}</svg></svg>`);
    }
  };
})();
