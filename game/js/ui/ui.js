// Interfaz: pantallas, HUD, registro, dados, modales y diario.
(function () {
  const $ = (id) => document.getElementById(id);
  const world = Game.world;

  const screens = {
    title: $('screen-title'),
    card: $('screen-card'),
    game: $('screen-game'),
    end: $('screen-end'),
  };

  function show(name) {
    for (const [k, el] of Object.entries(screens))
      el.style.display = k === name ? 'flex' : 'none';
    if (name === 'game') screens.game.style.display = 'flex';
  }

  // ---------- registro ----------
  function log(msg, cls) {
    const logEl = $('game-log');
    const p = document.createElement('p');
    p.textContent = msg;
    if (cls) p.className = cls;
    logEl.prepend(p);
    while (logEl.children.length > 5) logEl.removeChild(logEl.lastChild);
  }

  // ---------- HUD ----------
  function updateHUD() {
    if (!world.player || !world.level) return;
    $('bar-salud').style.width = world.player.salud + '%';
    $('bar-cordura').style.width = world.player.cordura + '%';
    $('bar-sed').style.width = world.player.sed + '%';
    $('bar-hambre').style.width = world.player.hambre + '%';
    $('hud-level').textContent = `${world.level.wikiTitle} · Peligro ${world.level.peligro}/5`;
    $('hud-turn').textContent = `Turno ${world.turn}`;
    $('hud-seed').textContent = `🎲 ${world.runSeed}`;

    const inv = $('hud-inv');
    inv.innerHTML = '';
    for (let i = 0; i < 6; i++) {
      const slot = document.createElement('div');
      slot.className = 'inv-slot';
      const id = world.player.inv[i];
      if (id) {
        const def = world.data.objects[id];
        const ic = { agua_almendras: '🥤', botiquin: '🩹', linterna: '🔦', chaqueta: '🧥', amuleto: '🖼', llave_nivel: '🗝' }[id] || '❓';
        slot.innerHTML = `<span class="k">${i + 1}</span><span class="n">${ic}</span>`;
        slot.title = `${def.nombre} — ${def.descripcion}`;
        if (id === 'linterna' && world.player.luz) slot.classList.add('active');
        slot.onclick = () => Game.useItem(i);
      } else {
        slot.innerHTML = `<span class="k">${i + 1}</span>`;
      }
      inv.appendChild(slot);
    }
  }

  let flashT = -99999;
  function flashDamage() { flashT = performance.now(); }

  // ---------- tarjeta de nivel ----------
  function showLevelCard(def, cb) {
    show('card');
    const colores = ['#3fae6a', '#8bb944', '#d9a531', '#e0742c', '#d94a35', '#a12744'];
    $('card-danger').style.background = colores[def.peligro] || '#888';
    $('card-name').textContent = def.nombre;
    $('card-class').textContent = `${def.clase} · Peligro ${def.peligro}/5 · ${def.bioma}`;
    $('card-desc').textContent = def.descripcion;
    $('card-quote').textContent = '«' + def.cita + '»';
    const rulesEl = $('card-rules');
    rulesEl.innerHTML = '';
    for (const rid of def.reglas || []) {
      const r = Rules.get(rid);
      if (!r) continue;
      const span = document.createElement('span');
      span.textContent = `${r.icono} ${r.nombre}`;
      span.title = r.desc;
      rulesEl.appendChild(span);
    }
    if (def.esEscape) {
      const span = document.createElement('span');
      span.textContent = '⭐ POSIBLE RUTA DE ESCAPE';
      span.style.borderColor = '#4ade80';
      span.style.color = '#8ae8a0';
      rulesEl.appendChild(span);
    }
    $('card-wiki').href = def.url;
    $('btn-enter').onclick = () => { show('game'); cb(); };
  }

  // ---------- dado ----------
  function showDice(texto, cb) {
    const ov = $('dice-overlay'), face = $('dice-face');
    $('dice-text').textContent = texto;
    ov.style.display = 'flex';
    face.classList.add('rolling');
    let ticks = 0;
    const iv = setInterval(() => {
      face.textContent = 1 + Math.floor(Math.random() * 20);
      if (++ticks > 14) {
        clearInterval(iv);
        const result = 1 + Math.floor(Math.random() * 20);
        face.textContent = result;
        face.classList.remove('rolling');
        setTimeout(() => { ov.style.display = 'none'; cb(result); }, 900);
      }
    }, 70);
  }

  // ---------- modal de salida ----------
  let exitDefShown = null;
  function showExitModal(def) {
    exitDefShown = def;
    world.busy = true;
    $('exit-modal').style.display = 'flex';
    $('exit-text').textContent = def.texto;
    const warn = $('exit-warn');
    const destinoNombre = def.destino && world.data.levels[def.destino]
      ? world.data.levels[def.destino].wikiTitle : null;
    if (def.tipo === 'escape') warn.textContent = '⭐ Parece un camino de vuelta a la realidad.';
    else if (def.tipo === 'sellada') warn.textContent = '⌀ El camino se pierde en niveles sin cartografiar.';
    else if (def.tipo === 'llave') warn.textContent = '🗝 Requiere una Llave de Nivel.';
    else if (def.tipo === 'arriesgada' && def.riesgoVoid > 0)
      warn.textContent = `⚠ Camino inestable (riesgo de caer al Vacío) → ${destinoNombre ?? '???'}`;
    else warn.textContent = destinoNombre ? `→ ${destinoNombre}` : '→ ¿?';
    $('btn-cross').onclick = () => { hideExitModal(); Game.crossExit(def); };
    $('btn-stay').onclick = hideExitModal;
  }
  function hideExitModal() {
    $('exit-modal').style.display = 'none';
    world.busy = false;
  }

  // ---------- selector de nivel (llave del Hub) ----------
  function showLevelPicker(ids, cb) {
    world.busy = true;
    const modal = $('exit-modal');
    modal.style.display = 'flex';
    $('exit-text').innerHTML = 'La Llave gira. ¿Qué puerta abres?<br><br>';
    const warn = $('exit-warn');
    warn.innerHTML = '';
    for (const id of ids) {
      const b = document.createElement('button');
      b.className = 'btn-small';
      b.style.margin = '3px';
      b.textContent = world.data.levels[id].wikiTitle;
      b.onclick = () => { modal.style.display = 'none'; world.busy = false; cb(id); };
      warn.appendChild(b);
    }
    $('btn-cross').onclick = null;
    $('btn-cross').style.display = 'none';
    $('btn-stay').onclick = () => {
      modal.style.display = 'none';
      $('btn-cross').style.display = '';
      world.busy = false;
    };
  }

  // ---------- diario ----------
  function renderJournal(listEl) {
    listEl.innerHTML = '';
    for (const j of world.journal) {
      const li = document.createElement('li');
      li.textContent = `${j.nombre} (${j.turnos} turnos) — ${j.salida}`;
      listEl.appendChild(li);
    }
    if (world.level && !world.over) {
      const li = document.createElement('li');
      li.textContent = `${world.level.wikiTitle} (${world.turn} turnos) — estás aquí`;
      li.style.color = '#d9c66e';
      listEl.appendChild(li);
    }
  }
  function toggleJournal() {
    const p = $('journal-panel');
    const visible = p.style.display !== 'none';
    p.style.display = visible ? 'none' : 'block';
    if (!visible) renderJournal($('journal-list'));
  }

  // ---------- fin ----------
  function showEnd(victoria, causa) {
    show('end');
    const t = $('end-title');
    t.textContent = victoria ? 'HAS ESCAPADO' : 'FIN DEL TRAYECTO';
    t.className = victoria ? 'victoria' : 'muerte';
    $('end-cause').textContent = causa;
    $('end-stats').innerHTML = `
      <div><b>${world.journal.length}</b>niveles</div>
      <div><b>${world.turnTotal}</b>turnos</div>
      <div><b>${world.runSeed}</b>semilla</div>`;
    renderJournal($('end-journal'));
  }

  world.ui = {
    log, updateHUD, flashDamage, showLevelCard, showDice,
    showExitModal, showLevelPicker, toggleJournal, showEnd, show,
    get flashT() { return flashT; },
  };
})();
