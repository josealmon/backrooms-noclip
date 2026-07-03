// RNG determinista con semilla (mulberry32) — partidas reproducibles.
(function () {
  function hashStr(s) {
    let h = 2166136261 >>> 0;
    for (let i = 0; i < s.length; i++) {
      h ^= s.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return h >>> 0;
  }

  function mulberry32(a) {
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  window.RNG = {
    create(seedStr) {
      const rnd = mulberry32(hashStr(String(seedStr)));
      return {
        f: () => rnd(),                                    // [0,1)
        int: (a, b) => a + Math.floor(rnd() * (b - a + 1)), // [a,b]
        pick: (arr) => arr[Math.floor(rnd() * arr.length)],
        chance: (p) => rnd() < p,
        shuffle(arr) {
          const a = arr.slice();
          for (let i = a.length - 1; i > 0; i--) {
            const j = Math.floor(rnd() * (i + 1));
            [a[i], a[j]] = [a[j], a[i]];
          }
          return a;
        },
      };
    },
    randomSeed() {
      const p = ['moqueta', 'zumbido', 'noclip', 'almendra', 'amarillo', 'vacio', 'nivel', 'pasillo', 'neon', 'niebla'];
      return p[Math.floor(Math.random() * p.length)] + '-' + Math.floor(Math.random() * 9999);
    },
  };
})();
