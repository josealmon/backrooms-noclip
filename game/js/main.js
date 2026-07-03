// Arranque: input, bucle de animación y pantalla de título.
(function () {
  const world = Game.world;
  world.data = window.GAME_DATA;

  const canvas = document.getElementById('game-canvas');
  Render.init(canvas);

  // ---------- input ----------
  const KEYS = {
    ArrowUp: [0, -1], KeyW: [0, -1],
    ArrowDown: [0, 1], KeyS: [0, 1],
    ArrowLeft: [-1, 0], KeyA: [-1, 0],
    ArrowRight: [1, 0], KeyD: [1, 0],
  };

  document.addEventListener('keydown', (ev) => {
    if (!world.level || world.over) return;
    if (document.getElementById('screen-card').style.display !== 'none') return;
    if (KEYS[ev.code]) {
      ev.preventDefault();
      Game.tryMove(...KEYS[ev.code]);
    } else if (ev.code === 'Space') {
      ev.preventDefault();
      Game.wait();
    } else if (ev.code === 'KeyE') Game.interact();
    else if (ev.code === 'KeyF') Game.toggleLuz();
    else if (ev.code === 'KeyR') Game.volver();
    else if (ev.code === 'KeyJ') world.ui.toggleJournal();
    else if (/^Digit[1-6]$/.test(ev.code)) Game.useItem(parseInt(ev.code.slice(5), 10) - 1);
  });

  // ---------- bucle de animación (solo visual; la lógica es por turnos) ----------
  function lerp(a, b, f) { return a + (b - a) * f; }

  function loop(t) {
    requestAnimationFrame(loop);
    if (!world.level || !world.player) return;
    const p = world.player;
    // desliza la posición visual hacia la lógica
    p.rx = lerp(p.rx, p.x, 0.28);
    p.ry = lerp(p.ry, p.y, 0.28);
    world.moving = Math.abs(p.rx - p.x) + Math.abs(p.ry - p.y) > 0.02;
    for (const e of world.entities) {
      if (e.rx === undefined) { e.rx = e.x; e.ry = e.y; }
      e.rx = lerp(e.rx, e.x, 0.2);
      e.ry = lerp(e.ry, e.y, 0.2);
    }
    // cámara centrada con límites del mapa
    const TILE = Render.TILE;
    const g = world.map.grid;
    world.camera.x = Math.max(0, Math.min(g.w * TILE - canvas.width, p.rx * TILE - canvas.width / 2 + TILE / 2));
    world.camera.y = Math.max(0, Math.min(g.h * TILE - canvas.height, p.ry * TILE - canvas.height / 2 + TILE / 2));
    if (g.w * TILE < canvas.width) world.camera.x = (g.w * TILE - canvas.width) / 2;
    if (g.h * TILE < canvas.height) world.camera.y = (g.h * TILE - canvas.height) / 2;

    Render.frame(world, t);

    // destello rojo al recibir daño
    const dt = t - world.ui.flashT;
    if (dt < 220) {
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = `rgba(160,20,20,${0.35 * (1 - dt / 220)})`;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }
  }
  requestAnimationFrame(loop);

  // ---------- arranque rápido por URL: ?seed=foo&autostart=1&nivel=level-14 ----------
  const params = new URLSearchParams(location.search);
  if (params.get('nofx')) window.NOFX = true;
  if (params.get('autostart')) {
    Game.startRun(params.get('seed') || undefined);
    if (params.get('nivel') && world.data.levels[params.get('nivel')]) {
      // salto directo para pruebas
      const btn = document.getElementById('btn-enter');
      Game.world.prevStack.push('level-0');
      const id = params.get('nivel');
      setTimeout(() => {
        const enter = document.getElementById('btn-enter');
        window.Game.crossExit({ texto: 'salto de prueba', destino: id, tipo: 'normal' });
        enter.click();
      }, 50);
    } else {
      setTimeout(() => document.getElementById('btn-enter').click(), 50);
    }
  }
  window.DEBUG_GAME = Game; // consola de depuración

  // ---------- autoprueba: ?selftest=200 juega N acciones aleatorias ----------
  if (params.get('selftest')) {
    const errores = [];
    window.onerror = (msg, src, line) => { errores.push(`${msg} @${(src || '').split('/').pop()}:${line}`); };
    const N = parseInt(params.get('selftest'), 10) || 100;
    Game.startRun(params.get('seed') || 'selftest');
    setTimeout(() => document.getElementById('btn-enter')?.click(), 30);
    let acciones = 0;
    const dirs = [[0, -1], [0, 1], [-1, 0], [1, 0]];
    const iv = setInterval(() => {
      try {
        if (acciones >= N || world.over) {
          clearInterval(iv);
          const div = document.createElement('div');
          div.id = 'selftest-result';
          div.textContent = JSON.stringify({
            acciones,
            nivel: world.level?.id,
            visitados: world.visited,
            turnoTotal: world.turnTotal,
            salud: world.player?.salud,
            cordura: world.player?.cordura,
            inv: world.player?.inv,
            entidadesVivas: world.entities.filter((e) => e.viva).length,
            over: world.over,
            diario: world.journal.map((j) => j.nombre),
            errores,
          });
          document.body.appendChild(div);
          document.title = errores.length ? 'SELFTEST-ERRORES' : 'SELFTEST-OK';
          return;
        }
        // si hay tarjeta de nivel a la vista, entra
        const card = document.getElementById('screen-card');
        if (card.style.display !== 'none') { document.getElementById('btn-enter').click(); return; }
        // si hay modal de salida, cruza (70%) o quédate
        const modal = document.getElementById('exit-modal');
        if (modal.style.display !== 'none') {
          const btn = Math.random() < 0.7 ? document.getElementById('btn-cross') : document.getElementById('btn-stay');
          if (btn && btn.style.display !== 'none') btn.click(); else document.getElementById('btn-stay').click();
          acciones++;
          return;
        }
        if (world.busy) return; // dado en marcha
        // camina hacia la salida más cercana (con algo de ruido)
        let d = dirs[Math.floor(Math.random() * 4)];
        if (Math.random() < 0.85 && world.map.exits.length) {
          const g = world.map.grid;
          let best = null, bestD = Infinity;
          for (const ex of world.map.exits) {
            const dist = MapGen.bfsDist(g, ex.x, ex.y);
            const v = dist[world.player.y * g.w + world.player.x];
            if (v >= 0 && v < bestD) { bestD = v; best = dist; }
          }
          if (best) {
            for (const [dx, dy] of dirs) {
              const nx = world.player.x + dx, ny = world.player.y + dy;
              if (nx < 0 || ny < 0 || nx >= g.w || ny >= g.h) continue;
              const v = best[ny * g.w + nx];
              if (v >= 0 && v < bestD) { d = [dx, dy]; break; }
            }
          }
        }
        Game.tryMove(d[0], d[1]);
        acciones++;
      } catch (e) {
        errores.push(String(e && e.message || e));
        acciones++;
      }
    }, 5);
  }

  // ---------- título ----------
  const saveData = Game.loadSave();
  if (saveData) {
    const btn = document.getElementById('btn-continue');
    btn.style.display = 'inline-block';
    btn.textContent = `Continuar partida (${saveData.levelId}, semilla ${saveData.runSeed})`;
    btn.onclick = () => Game.continueRun(saveData);
  }

  document.getElementById('btn-start').onclick = () => {
    const seed = document.getElementById('seed-input').value.trim();
    Game.startRun(seed || undefined);
  };
  document.getElementById('btn-again').onclick = () => {
    Game.startRun();
  };
  document.getElementById('btn-journal-close').onclick = () => world.ui.toggleJournal();
})();
