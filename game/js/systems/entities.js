// Entidades: IA por turnos según el comportamiento de su ficha.
(function () {
  const { walkable } = MapGen;

  function create(spawns, defs, rng) {
    return spawns.map((s, i) => {
      const def = defs[s.id];
      return {
        uid: i,
        id: s.id,
        def,
        x: s.x, y: s.y,
        estado: 'latente',       // latente | alerta | caza
        revelada: def.comportamiento !== 'imita' && def.comportamiento !== 'emboscada',
        dormida: def.comportamiento === 'cazador' ? 22 + rng.int(0, 8) : 0,
        pasoExtra: 0,
        viva: true,
      };
    });
  }

  const dist2 = (a, b, x, y) => (a - x) ** 2 + (b - y) ** 2;

  function occupied(world, x, y, self) {
    if (world.player.x === x && world.player.y === y) return true;
    return world.entities.some((e) => e.viva && e !== self && e.x === x && e.y === y);
  }

  function tileWalkable(world, x, y) {
    const g = world.map.grid;
    if (x < 0 || y < 0 || x >= g.w || y >= g.h) return false;
    return walkable(g.t[y * g.w + x]);
  }

  // un paso hacia el jugador usando el mapa de Dijkstra precalculado
  function stepToward(world, e) {
    const g = world.map.grid, dm = world.dmap;
    let best = null, bestV = dm[e.y * g.w + e.x];
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = e.x + dx, ny = e.y + dy;
      if (!tileWalkable(world, nx, ny) || occupied(world, nx, ny, e)) continue;
      const v = dm[ny * g.w + nx];
      if (v >= 0 && v < bestV) { bestV = v; best = [nx, ny]; }
    }
    if (best) { e.x = best[0]; e.y = best[1]; return true; }
    return false;
  }

  function stepRandom(world, e, rng) {
    const dirs = rng.shuffle([[1, 0], [-1, 0], [0, 1], [0, -1], [0, 0]]);
    for (const [dx, dy] of dirs) {
      const nx = e.x + dx, ny = e.y + dy;
      if (dx === 0 && dy === 0) return;
      if (tileWalkable(world, nx, ny) && !occupied(world, nx, ny, e)) {
        e.x = nx; e.y = ny;
        return;
      }
    }
  }

  function adjacentToPlayer(world, e) {
    return Math.abs(e.x - world.player.x) + Math.abs(e.y - world.player.y) === 1;
  }

  function playerInDark(world) {
    // ¿está el jugador en penumbra? (nivel oscuro y sin linterna)
    const luzJugador = world.player.luz ? 1 : 0;
    return world.level.oscuridad >= 0.5 && !luzJugador;
  }

  function detecta(world, e, rng) {
    const d = e.def.deteccion;
    const dd = Math.sqrt(dist2(e.x, e.y, world.player.x, world.player.y));
    const ver = () => FOV.los(world.map.grid, e.x, e.y, world.player.x, world.player.y);
    switch (d.tipo) {
      case 'vista': return dd <= d.radio && ver();
      case 'oscuridad': return dd <= d.radio && ver() && playerInDark(world);
      case 'luz': return world.player.luz && dd <= d.radio;
      case 'adyacente': return dd <= (d.radio || 1);
      case 'sigilo': return dd <= d.radio && ver();
      case 'global': return true;
      default: return dd <= 6 && ver();
    }
  }

  function atacar(world, e) {
    const p = world.player;
    const def = e.def;
    world.hurt(def.dano, def.nombre);
    if (def.danoCordura) world.sanity(-def.danoCordura);
    world.log(`¡${def.nombre} te ataca!`, 'danger');
    if (def.comportamiento === 'emboscada') e.revelada = true;
  }

  function stepEntity(world, e, rng) {
    const comp = e.def.comportamiento;

    // el Cazador duerme al principio: pasos lejanos que se acercan
    if (comp === 'cazador') {
      if (e.dormida > 0) {
        e.dormida--;
        if (e.dormida === 12) world.log('Oyes pasos lejanos entre los pasillos…', 'event');
        if (e.dormida === 4) world.log('Los pasos se aceleran. Vienen hacia ti.', 'event');
        if (e.dormida === 0) world.log('EL CAZADOR TE HA ENCONTRADO.', 'danger');
        return;
      }
      if (adjacentToPlayer(world, e)) return atacar(world, e);
      stepToward(world, e);
      // cada 3 turnos, un paso extra: es implacable
      if (++e.pasoExtra % 3 === 0 && !adjacentToPlayer(world, e)) stepToward(world, e);
      if (adjacentToPlayer(world, e)) atacar(world, e);
      return;
    }

    // trampas estáticas y emboscadas: no se mueven
    if (comp === 'estatica_trampa' || comp === 'emboscada') {
      if (detecta(world, e, rng) && adjacentToPlayer(world, e)) atacar(world, e);
      return;
    }

    // imitador: quieto hasta que estás cerca; entonces se revela y caza
    if (comp === 'imita') {
      if (!e.revelada) {
        if (detecta(world, e, rng)) {
          e.revelada = true;
          e.estado = 'caza';
          world.log(`Esa figura no era humana. ¡${e.def.nombre}!`, 'danger');
        }
        return;
      }
    }

    const detectado = detecta(world, e, rng);
    if (detectado) e.estado = 'caza';
    else if (e.estado === 'caza' && !detectado) {
      // pierde el rastro poco a poco
      if (rng.chance(0.25)) e.estado = 'alerta';
    }

    // smilers y acechadores no pueden cazar bajo la luz
    if (comp === 'acecho_oscuridad' && !playerInDark(world) && e.estado === 'caza') {
      e.estado = 'alerta';
    }

    const vel = e.def.velocidad;
    for (let paso = 0; paso < vel; paso++) {
      if (adjacentToPlayer(world, e)) { atacar(world, e); return; }
      if (e.estado === 'caza') stepToward(world, e);
      else if (comp === 'errante' || e.estado === 'alerta') {
        if (paso === 0) stepRandom(world, e, rng);
      } else if (comp === 'atraida_luz' && !world.player.luz) {
        if (paso === 0 && rng.chance(0.5)) stepRandom(world, e, rng);
      }
    }
    if (adjacentToPlayer(world, e) && e.estado === 'caza') atacar(world, e);

    // los errantes hostiles solo atacan si los tocas de cerca mucho tiempo
    if (comp === 'errante' && adjacentToPlayer(world, e) && rng.chance(0.25)) atacar(world, e);
  }

  function stepAll(world, rng) {
    for (const e of world.entities) if (e.viva) stepEntity(world, e, rng);
  }

  window.Entities = { create, stepAll };
})();
