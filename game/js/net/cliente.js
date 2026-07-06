// BACKROOMS MMO — cliente de red.
// Se conecta al servidor de salas, construye el MISMO mapa que él a partir de
// la semilla (idéntico código MapGen/RNG a ambos lados) y a partir de ahí solo
// intercambia intenciones y eventos: por la red nunca viaja un mapa.
(function () {
  let ws = null;
  let miId = null;
  let listo = false;        // bienvenida recibida y mundo construido
  let ultPaso = 0;          // cooldown local de paso (170 ms; el servidor pide 165)
  let reintento = null;
  let inputChat = null;

  const COOLDOWN = 170;
  const ROT_VEC = [[0, -1], [1, 0], [0, 1], [-1, 0]]; // N E S O

  function urlServidor() {
    const params = new URLSearchParams(location.search);
    if (params.get('ws')) return params.get('ws');
    if (location.protocol === 'http:' || location.protocol === 'https:')
      return (location.protocol === 'https:' ? 'wss://' : 'ws://') + location.host + '/ws';
    return 'ws://localhost:8080/ws'; // desarrollo desde file://
  }

  // token persistente: tu identidad anónima (códice/stats en M3 cuelgan de él)
  function token() {
    try {
      let t = localStorage.getItem('mmo-token');
      if (!t) {
        t = Array.from(crypto.getRandomValues(new Uint8Array(16)),
          (b) => b.toString(16).padStart(2, '0')).join('');
        localStorage.setItem('mmo-token', t);
      }
      return t;
    } catch (e) { return 'sin-token'; }
  }

  function enviar(msg) {
    if (ws && ws.readyState === 1) ws.send(JSON.stringify(msg));
  }

  function iniciar(nombre) {
    const w = Game.world;
    ws = new WebSocket(urlServidor());
    ws.onopen = () => enviar({ t: 'hola', nombre, token: token(), v: 1 });
    ws.onmessage = (ev) => {
      let m;
      try { m = JSON.parse(ev.data); } catch (e) { return; }
      recibir(m, w);
    };
    ws.onclose = () => {
      listo = false;
      if (w.level) w.log('Conexión perdida con las Backrooms… reintentando.', 'danger');
      clearTimeout(reintento);
      reintento = setTimeout(() => iniciar(nombre), 3000);
    };
    ws.onerror = () => {};
  }

  function recibir(m, w) {
    switch (m.t) {
      case 'bienvenida': construirMundo(m, w); break;
      case 'entra': if (listo) Otros.entra(m); break;
      case 'sale': if (listo) Otros.sale(m.id); break;
      case 'mueve':
        if (!listo) return;
        if (m.id === miId) {
          // corrección autoritativa: solo si el servidor discrepa de la predicción
          if (m.x !== w.player.x || m.y !== w.player.y) {
            w.player.x = m.x; w.player.y = m.y;
            fov(w);
          }
        } else Otros.mueve(m.id, m.x, m.y);
        break;
      case 'gira': if (listo) Otros.gira(m.id, m.rot); break;
      case 'chat':
        if (!listo) return;
        Otros.chat(m.id, m.txt, performance.now());
        // el chat también queda en el registro pequeño
        w.log(`${m.id === miId ? 'Tú' : nombreDe(m.id)}: ${m.txt}`, 'event');
        break;
      case 'aviso': w.log(m.txt, 'event'); break;
      case 'error': w.log(m.txt, 'danger'); break;
    }
  }

  function nombreDe(id) {
    const o = Otros.lista.find((x) => x.id === id);
    return o ? o.nombre : '???';
  }

  // Construye el mundo compartido: jugador/HUD por el camino de siempre
  // (startRun) y encima el mapa determinista de la sala.
  function construirMundo(m, w) {
    miId = m.id;
    Game.startRun(m.semilla);               // jugador, HUD, tarjeta del nivel
    const def = w.data.levels[m.nivel];
    w.online = true;
    w.level = def;
    w.map = MapGen.generate(def, RNG.create(m.semilla));
    w.tiles = Tiles.build(def, RNG.create(m.semilla + '::tiles'));
    w.entities = [];        // M2: llegarán del servidor
    w.map.items = [];       // M2: ídem
    w.map.caminatas = [];   // la caminata online (M3) será personal, no local
    w.player.x = m.x; w.player.y = m.y;
    w.player.rx = m.x; w.player.ry = m.y;
    w.player.rot = m.rot ?? 2;
    w._ignoraExit = null;
    fov(w);
    Otros.reset(miId);
    for (const j of m.jugadores) Otros.entra(j);
    listo = true;
    w.log(`Estás en ${def.nombre} · instancia ${m.inst}. Pulsa T para hablar.`, 'good');
    crearChatUI();
  }

  function fov(w) {
    const g = w.map.grid;
    w.light = FOV.compute(g, w.player.x, w.player.y, w.visionActual());
    for (let i = 0; i < w.light.length; i++) if (w.light[i] > 0) w.explored[i] = 1;
  }

  // ---------- movimiento con predicción local ----------
  function mover(dx, dy) {
    const w = Game.world;
    if (!listo || w.escondido) return;
    const ahora = performance.now();
    if (ahora - ultPaso < COOLDOWN) return;
    ultPaso = ahora;
    const nx = w.player.x + dx, ny = w.player.y + dy;
    if (MapGen.walkable(MapGen.at(w.map.grid, nx, ny))) {
      w.player.x = nx; w.player.y = ny;   // predicción: el servidor confirma o corrige
      fov(w);
    }
    enviar({ t: 'mover', dx, dy });
  }

  // en tercera persona W avanza y S retrocede según la rotación (giro gratis)
  function avanzar(s) {
    const w = Game.world;
    const [dx, dy] = ROT_VEC[w.player.rot];
    // el sprite/cámara del retroceso no gira (mismo criterio que Game.avanzar)
    mover(dx * s, dy * s);
  }

  function girar(d) {
    const w = Game.world;
    w.player.rot = ((w.player.rot + d) % 4 + 4) % 4;
    enviar({ t: 'rot', rot: w.player.rot });
  }

  // movimiento 2D directo (flechas en ?render=2d / cámara alta)
  function moverPantalla(dx, dy) {
    const w = Game.world;
    if (dy > 0) w.player.dir = 'down';
    else if (dy < 0) w.player.dir = 'up';
    else if (dx !== 0) { w.player.dir = 'side'; w.player.flip = dx < 0; }
    mover(dx, dy);
  }

  // ---------- chat ----------
  function crearChatUI() {
    if (inputChat) return;
    inputChat = document.createElement('input');
    inputChat.id = 'chat-input';
    inputChat.maxLength = 120;
    inputChat.placeholder = 'Di algo… (Enter envía, ESC cierra)';
    inputChat.autocomplete = 'off';
    inputChat.style.cssText =
      'position:fixed;left:50%;bottom:12%;transform:translateX(-50%);width:min(480px,80vw);' +
      'display:none;padding:8px 12px;background:rgba(14,12,9,.94);color:#e8dcae;' +
      'border:1px solid #d8c98a;border-radius:4px;font:18px VT323,monospace;z-index:60;outline:none;';
    document.body.appendChild(inputChat);
    inputChat.addEventListener('keydown', (ev) => {
      ev.stopPropagation();
      if (ev.key === 'Enter') {
        const txt = inputChat.value.trim();
        if (txt) enviar({ t: 'chat', txt });
        cerrarChat();
      } else if (ev.key === 'Escape') cerrarChat();
    });
  }

  function abrirChat() {
    if (!inputChat) return;
    inputChat.style.display = 'block';
    inputChat.value = '';
    inputChat.focus();
  }

  function cerrarChat() {
    inputChat.value = '';
    inputChat.style.display = 'none';
    inputChat.blur();
  }

  function chatAbierto() {
    return !!inputChat && inputChat.style.display !== 'none';
  }

  window.Net = {
    iniciar, mover, avanzar, girar, moverPantalla,
    abrirChat, chatAbierto,
    get activo() { return listo; },
    get id() { return miId; },
  };
})();
