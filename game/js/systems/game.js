// Núcleo del juego: estado del mundo, sistema por turnos, transiciones,
// estadísticas, muerte permanente y victoria.
(function () {
  const { T, walkable } = MapGen;

  const world = {
    data: null,
    runSeed: '',
    rng: null,
    level: null,
    map: null,
    tiles: null,
    entities: [],
    player: null,
    turn: 0,
    turnTotal: 0,
    explored: null,
    light: null,
    dmap: null,
    camera: { x: 0, y: 0 },
    journal: [],
    visited: [],
    prevStack: [],
    entryCount: {},
    busy: false,
    over: false,
    visionMod: 0,
    luzBloqueada: false,
    extraWorldStep: false,
    moving: false,
    ui: null, // inyectado por ui.js
  };

  // ---------- utilidades de estado ----------
  world.log = (msg, cls) => world.ui.log(msg, cls);

  world.visionActual = function () {
    let v = world.level.vision + world.visionMod;
    if (world.player.luz) v += 3;
    return Math.max(2, v);
  };

  world.hurt = function (n, causa, ambiental) {
    if (world.over) return;
    world.player.salud = Math.max(0, world.player.salud - n);
    world.ui.updateHUD();
    world.ui.flashDamage();
    if (world.player.salud <= 0) die(`Has muerto: ${causa} acabó contigo.`);
  };
  world.sanity = function (n) {
    if (world.over) return;
    world.player.cordura = Math.max(0, Math.min(100, world.player.cordura + n));
    world.ui.updateHUD();
    if (world.player.cordura <= 0)
      die('Tu mente se ha quebrado. Te has convertido en una cosa más de las Backrooms.');
  };
  world.thirst = (n) => { world.player.sed = Math.max(0, Math.min(100, world.player.sed + n)); };
  world.hunger = (n) => { world.player.hambre = Math.max(0, Math.min(100, world.player.hambre + n)); };
  world.hasItem = (id) => world.player.inv.includes(id);

  world.forgetExplored = function (frac) {
    const g = world.map.grid;
    const r = world.rng;
    for (let i = 0; i < world.explored.length; i++)
      if (world.explored[i] && world.light[i] <= 0 && r.chance(frac)) world.explored[i] = 0;
  };

  world.rollDice = function (texto, cb) {
    world.busy = true;
    world.ui.showDice(texto, (d) => {
      world.busy = false;
      cb(d);
      world.ui.updateHUD();
    });
  };

  // ---------- inicio de partida ----------
  function startRun(seed) {
    world.runSeed = seed || RNG.randomSeed();
    world.player = {
      x: 0, y: 0, rx: 0, ry: 0,
      salud: 100, cordura: 100, sed: 100, hambre: 100,
      inv: [], luz: false, viva: true,
    };
    world.journal = [];
    world.visited = [];
    world.prevStack = [];
    world.entryCount = {};
    world.turnTotal = 0;
    world.over = false;
    enterLevel('level-0', 'Despertaste aquí tras atravesar la realidad.');
  }

  // ---------- transición de nivel ----------
  function enterLevel(id, via) {
    const def = world.data.levels[id];
    if (!def) { world.log('Ese camino no lleva a ninguna parte.', 'event'); return; }

    // cierra el diario del nivel anterior
    if (world.level) {
      world.journal.push({
        nivel: world.level.id,
        nombre: world.level.wikiTitle,
        turnos: world.turn,
        salida: via,
      });
    }

    world.entryCount[id] = (world.entryCount[id] || 0) + 1;
    const levelSeed = `${world.runSeed}::${id}::${world.entryCount[id]}`;
    world.rng = RNG.create(levelSeed);
    world.level = def;
    world.turn = 0;
    world.visionMod = 0;
    world.luzBloqueada = false;
    if (!world.visited.includes(id)) world.visited.push(id);

    world.map = MapGen.generate(def, world.rng);
    world.tiles = Tiles.build(def, world.rng);
    world.entities = Entities.create(world.map.entitySpawns, world.data.entities, world.rng);

    const g = world.map.grid;
    world.explored = new Uint8Array(g.w * g.h);
    world.light = new Float32Array(g.w * g.h);
    world.player.x = world.map.spawn[0];
    world.player.y = world.map.spawn[1];
    world.player.rx = world.player.x;
    world.player.ry = world.player.y;

    Rules.aplicarEntrada(world);
    recomputeFov();
    recomputeDmap();
    save();

    world.ui.showLevelCard(def, () => {
      world.ui.updateHUD();
      world.log(`— ${def.nombre} —`, 'event');
      if (via) world.log(via, 'event');
    });
  }

  // ---------- FOV y pathfinding ----------
  function recomputeFov() {
    const g = world.map.grid;
    world.light = FOV.compute(g, world.player.x, world.player.y, world.visionActual());
    for (let i = 0; i < world.light.length; i++)
      if (world.light[i] > 0.06) world.explored[i] = 1;
  }

  function recomputeDmap() {
    world.dmap = MapGen.bfsDist(world.map.grid, world.player.x, world.player.y);
  }

  // ---------- turno del mundo ----------
  function worldStep() {
    world.turn++;
    world.turnTotal++;

    // recogida de objetos
    for (const it of world.map.items) {
      if (!it.taken && it.x === world.player.x && it.y === world.player.y) {
        if (world.player.inv.length >= 6) {
          world.log('Inventario lleno. Lo dejas atrás.', 'event');
        } else {
          it.taken = true;
          world.player.inv.push(it.id);
          world.log(`Recoges: ${world.data.objects[it.id].nombre}.`, 'good');
        }
      }
    }

    // salida bajo los pies
    const ex = world.map.exits.find((e) => e.x === world.player.x && e.y === world.player.y);
    if (ex) world.ui.showExitModal(ex.def);

    // reglas del nivel + necesidades
    Rules.aplicarTurno(world, world.rng);
    if (world.turn % 9 === 0) world.thirst(-1);
    if (world.turn % 15 === 0) world.hunger(-1);
    if (world.player.sed <= 0 && world.turn % 3 === 0) world.hurt(2, 'la deshidratación', true);
    if (world.player.hambre <= 0 && world.turn % 5 === 0) world.hurt(1, 'la inanición', true);
    if (world.player.sed === 20) world.log('Tienes muchísima sed.', 'danger');
    if (world.player.hambre === 20) world.log('El hambre te retuerce el estómago.', 'danger');

    // entidades
    recomputeDmap();
    Entities.stepAll(world, world.rng);
    if (world.extraWorldStep) {
      world.extraWorldStep = false;
      Entities.stepAll(world, world.rng);
    }

    recomputeFov();
    world.ui.updateHUD();
  }

  // ---------- acciones del jugador ----------
  function tryMove(dx, dy) {
    if (world.busy || world.over) return;
    const reglas = world.level.reglas || [];
    if (reglas.includes('controles_invertidos')) { dx = -dx; dy = -dy; }
    const pasos = reglas.includes('gravedad_baja') ? 2 : 1;

    for (let i = 0; i < pasos; i++) {
      const nx = world.player.x + dx, ny = world.player.y + dy;
      const g = world.map.grid;
      const v = (nx < 0 || ny < 0 || nx >= g.w || ny >= g.h) ? T.PARED : g.t[ny * g.w + nx];
      if (v === T.PARED) { if (i === 0) return; else break; }
      if (v === T.VACIO) {
        world.log('El abismo se abre a tus pies. Retrocedes con el corazón desbocado.', 'danger');
        world.sanity(-2);
        break;
      }
      if (v === T.AGUA) { world.log('El agua no parece segura.', 'event'); break; }
      // no puedes atravesar entidades
      const ent = world.entities.find((e) => e.viva && e.x === nx && e.y === ny);
      if (ent) {
        world.log(`${ent.def.nombre} te corta el paso.`, 'danger');
        break;
      }
      world.player.x = nx;
      world.player.y = ny;
    }
    worldStep();
  }

  function wait() {
    if (world.busy || world.over) return;
    worldStep();
  }

  function interact() {
    if (world.busy || world.over) return;
    const ex = world.map.exits.find((e) => e.x === world.player.x && e.y === world.player.y);
    if (ex) world.ui.showExitModal(ex.def);
    else world.log('No hay nada con lo que interactuar aquí.', 'event');
  }

  function toggleLuz() {
    if (world.busy || world.over) return;
    if (world.luzBloqueada) { world.log('Ninguna luz funciona en este nivel.', 'danger'); return; }
    if (!world.hasItem('linterna')) { world.log('No tienes linterna.', 'event'); return; }
    world.player.luz = !world.player.luz;
    world.log(world.player.luz ? 'Enciendes la linterna. Su luz puede atraer cosas.' : 'Apagas la linterna.', 'event');
    recomputeFov();
    world.ui.updateHUD();
  }

  function useItem(slot) {
    if (world.busy || world.over) return;
    const id = world.player.inv[slot];
    if (!id) return;
    const def = world.data.objects[id];
    if (def.efecto?.toggle === 'luz') { toggleLuz(); return; }
    if (def.efecto?.pasivo) { world.log(`${def.nombre}: su efecto es pasivo, basta con llevarlo.`, 'event'); return; }
    if (def.efecto) {
      if (def.efecto.salud) world.player.salud = Math.min(100, world.player.salud + def.efecto.salud);
      if (def.efecto.cordura) world.sanity(def.efecto.cordura);
      if (def.efecto.sed) world.thirst(def.efecto.sed);
      world.player.inv.splice(slot, 1);
      world.log(`Usas: ${def.nombre}.`, 'good');
      world.ui.updateHUD();
      worldStep();
    }
  }

  function volver() {
    if (world.busy || world.over) return;
    if (!world.prevStack.length) {
      world.log('No recuerdas por dónde llegaste. No hay vuelta atrás.', 'event');
      return;
    }
    const prev = world.prevStack.pop();
    world.sanity(-6);
    world.log('Vuelves sobre tus pasos, con la sensación de haber perdido algo.', 'event');
    enterLevel(prev, 'Volviste sobre tus pasos.');
  }

  // ---------- cruzar salidas ----------
  function crossExit(def) {
    const tipo = def.tipo;

    if (tipo === 'sellada') {
      world.log('El camino se difumina: ese nivel aún no está cartografiado en el piloto.', 'event');
      world.sanity(-2);
      return;
    }
    if (tipo === 'escape') {
      win();
      return;
    }
    if (tipo === 'llave') {
      if (!world.hasItem('llave_nivel')) {
        world.log('Las puertas de acero no tienen pomo. Necesitas una Llave de Nivel.', 'event');
        return;
      }
      world.ui.showLevelPicker(world.visited.filter((v) => v !== world.level.id), (destino) => {
        world.player.inv.splice(world.player.inv.indexOf('llave_nivel'), 1);
        world.prevStack.push(world.level.id);
        enterLevel(destino, 'Abriste una puerta de acero con la Llave.');
      });
      return;
    }

    const go = () => {
      let destino = def.destino;
      if (destino === '*aleatoria') {
        const ids = Object.keys(world.data.levels).filter((i) => i !== world.level.id);
        destino = world.rng.pick(ids);
      } else if (destino === '*visitada') {
        destino = world.rng.pick(world.visited);
      }
      world.prevStack.push(world.level.id);
      enterLevel(destino, def.texto);
    };

    if (tipo === 'arriesgada' && def.riesgoVoid > 0) {
      world.rollDice('El camino es inestable. Tira el dado…', (d) => {
        const umbral = Math.round(def.riesgoVoid * 20);
        if (d <= umbral) {
          world.log(`Dado: ${d}. El suelo cede.`, 'danger');
          die('Caíste al Vacío. El Vacío no devuelve nada.');
        } else {
          world.log(`Dado: ${d}. Cruzas por los pelos.`, 'good');
          go();
        }
      });
      return;
    }
    go();
  }

  // ---------- fin de partida ----------
  function die(causa) {
    if (world.over) return;
    world.over = true;
    world.journal.push({
      nivel: world.level.id,
      nombre: world.level.wikiTitle,
      turnos: world.turn,
      salida: '☠ ' + causa,
    });
    localStorage.removeItem('backrooms-save');
    world.ui.showEnd(false, causa);
  }

  function win() {
    world.over = true;
    world.journal.push({
      nivel: world.level.id,
      nombre: world.level.wikiTitle,
      turnos: world.turn,
      salida: '⭐ Escapaste de las Backrooms.',
    });
    localStorage.removeItem('backrooms-save');
    world.ui.showEnd(true, 'Atravesaste el edificio imposible y despertaste en una acera cualquiera, bajo un sol de verdad.');
  }

  // ---------- guardado ----------
  function save() {
    try {
      localStorage.setItem('backrooms-save', JSON.stringify({
        runSeed: world.runSeed,
        levelId: world.level.id,
        player: {
          salud: world.player.salud, cordura: world.player.cordura,
          sed: world.player.sed, hambre: world.player.hambre,
          inv: world.player.inv,
        },
        journal: world.journal,
        visited: world.visited,
        prevStack: world.prevStack,
        entryCount: world.entryCount,
        turnTotal: world.turnTotal,
      }));
    } catch (e) { /* almacenamiento no disponible */ }
  }

  function loadSave() {
    try { return JSON.parse(localStorage.getItem('backrooms-save')); }
    catch (e) { return null; }
  }

  function continueRun(s) {
    world.runSeed = s.runSeed;
    world.player = {
      x: 0, y: 0, rx: 0, ry: 0,
      salud: s.player.salud, cordura: s.player.cordura,
      sed: s.player.sed, hambre: s.player.hambre,
      inv: s.player.inv, luz: false, viva: true,
    };
    world.journal = s.journal;
    world.visited = s.visited.slice(0, -0) || [];
    world.visited = s.visited;
    world.prevStack = s.prevStack;
    world.entryCount = s.entryCount;
    // repite la entrada al nivel guardado sin duplicar el diario
    world.entryCount[s.levelId] = Math.max(0, (world.entryCount[s.levelId] || 1) - 1);
    world.turnTotal = s.turnTotal;
    world.over = false;
    world.level = null;
    enterLevel(s.levelId, 'Retomas la marcha donde lo dejaste.');
  }

  window.Game = {
    world, startRun, continueRun, loadSave,
    tryMove, wait, interact, toggleLuz, useItem, volver, crossExit,
  };
})();
