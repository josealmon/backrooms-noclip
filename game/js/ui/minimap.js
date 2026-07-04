// Minimapa: dibuja SOLO lo explorado (se actualiza cuando el nivel cambia,
// porque forgetExplored borra la memoria). Clic o tecla N para ampliar.
// Con el detector (Object 30) en el inventario, muestra entidades cercanas.
(function () {
  const small = document.getElementById('minimap');
  const bigWrap = document.getElementById('minimap-big');
  const big = document.getElementById('minimap-big-canvas');

  function render(canvas, world, t) {
    const ctx = canvas.getContext('2d');
    const g = world.map.grid;
    const S = Math.max(1, Math.floor(Math.min(canvas.width / g.w, canvas.height / g.h)));
    const ox = Math.floor((canvas.width - g.w * S) / 2);
    const oy = Math.floor((canvas.height - g.h * S) / 2);
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const T = MapGen.T;
    for (let y = 0; y < g.h; y++)
      for (let x = 0; x < g.w; x++) {
        const idx = y * g.w + x;
        if (!world.explored[idx]) continue;
        const v = g.t[idx];
        if (v === T.VACIO) continue;
        ctx.fillStyle = v === T.PARED ? 'rgba(190,178,140,0.85)'
          : v === T.AGUA ? 'rgba(70,110,150,0.7)'
          : 'rgba(90,84,66,0.55)';
        ctx.fillRect(ox + x * S, oy + y * S, S, S);
      }

    // (las salidas NO se muestran: hay que encontrarlas explorando)

    // entidades (solo con el detector)
    if (world.hasItem && world.hasItem('detector')) {
      const parp = Math.sin(t / 200) > 0;
      if (parp) {
        ctx.fillStyle = '#e04040';
        for (const e of world.entities) {
          if (!e.viva) continue;
          if (Math.abs(e.x - world.player.x) + Math.abs(e.y - world.player.y) > 12) continue;
          ctx.fillRect(ox + e.x * S - 1, oy + e.y * S - 1, S + 2, S + 2);
        }
      }
    }

    // jugador (pulso)
    const p = world.player;
    const pulso = 1.5 + Math.sin(t / 300) * 0.8;
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(ox + p.x * S + S / 2, oy + p.y * S + S / 2, Math.max(2, S / 2 + pulso), 0, 7);
    ctx.fill();
  }

  let bigVisible = false;
  function toggleBig(force) {
    bigVisible = force !== undefined ? force : !bigVisible;
    bigWrap.style.display = bigVisible ? 'flex' : 'none';
  }

  small.addEventListener('click', () => toggleBig(true));
  bigWrap.addEventListener('click', () => toggleBig(false));

  window.Minimap = {
    frame(world, t) {
      if (!world.level || !world.map) return;
      render(small, world, t);
      if (bigVisible) render(big, world, t);
    },
    toggleBig,
    get visible() { return bigVisible; },
  };
})();
