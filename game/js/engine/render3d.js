// Render 3D (Three.js local): mundo con volumen real y cámara inclinada estilo
// Octopath. Reutiliza TODAS las texturas procedurales existentes (tiles.js,
// sprites.js, render.js→exitToCanvas) como CanvasTexture. La lógica del juego
// (FOV, turnos, entidades) no cambia: esto es solo presentación.
(function () {
  if (!window.THREE) { window.Render3D = null; return; }

  // ---- constantes de cámara y escena (afinables) ----
  const CAM = { fov: 46, dy: 5.2, dz: 6.8, lookY: 0.4, lookAhead: 1.4, suavidad: 0.12, bob: 0.05 };
  const WALL_H = 1.2;      // altura de los muros en unidades-tile (referencia Octopath)
  const SPRITE_H = 1.05;   // alto del billboard de actores

  let renderer, scene, camera, amb, plight;
  let glCanvas, overlay, octx, W, H;
  let levelKey = null;
  let levelGroup = null;
  let entitySprites = new Map(); // uid -> THREE.Sprite
  let itemSprites = new Map();   // index -> sprite
  let playerSprite = null;
  let texCache = new Map();      // clave -> THREE.Texture
  let grain = null;
  let camBobT = 0;

  function tex(canvas, key) {
    if (key && texCache.has(key)) return texCache.get(key);
    const t = new THREE.CanvasTexture(canvas);
    t.magFilter = THREE.NearestFilter;
    t.minFilter = THREE.NearestFilter;
    t.generateMipmaps = false;
    t.encoding = THREE.sRGBEncoding;
    if (key) texCache.set(key, t);
    return t;
  }

  function init(gl, ov) {
    glCanvas = gl; overlay = ov;
    W = gl.width; H = gl.height;
    octx = ov.getContext('2d');
    renderer = new THREE.WebGLRenderer({ canvas: gl, antialias: false });
    renderer.setSize(W, H, false);
    renderer.outputEncoding = THREE.sRGBEncoding;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.BasicShadowMap;

    scene = new THREE.Scene();
    camera = new THREE.PerspectiveCamera(CAM.fov, W / H, 0.1, 60);
    amb = new THREE.AmbientLight(0xffffff, 0.4);
    plight = new THREE.PointLight(0xffffff, 1.7, 12, 1.8);
    plight.castShadow = true;
    plight.shadow.mapSize.set(512, 512);
    plight.shadow.bias = -0.01;
    scene.add(amb, plight);

    // grano para el overlay
    grain = document.createElement('canvas');
    grain.width = 256; grain.height = 256;
    const gctx = grain.getContext('2d');
    const img = gctx.createImageData(256, 256);
    for (let i = 0; i < img.data.length; i += 4) {
      const v = Math.random() * 255;
      img.data[i] = img.data[i + 1] = img.data[i + 2] = v;
      img.data[i + 3] = 22;
    }
    gctx.putImageData(img, 0, 0);
  }

  // ---------- construcción de la escena del nivel ----------
  function disposeLevel() {
    if (!levelGroup) return;
    levelGroup.traverse((o) => {
      if (o.geometry) o.geometry.dispose();
      if (o.material) {
        const mats = Array.isArray(o.material) ? o.material : [o.material];
        for (const m of mats) { if (m.map) m.map.dispose(); m.dispose(); }
      }
    });
    scene.remove(levelGroup);
    levelGroup = null;
    entitySprites.clear();
    itemSprites.clear();
    playerSprite = null;
    texCache.clear();
  }

  function quad(pos, uv, idx, corners, uvRect) {
    const base = pos.length / 3;
    for (const c of corners) pos.push(c[0], c[1], c[2]);
    const [u0, v0, u1, v1] = uvRect;
    uv.push(u0, v1, u1, v1, u1, v0, u0, v0);
    idx.push(base, base + 1, base + 2, base, base + 2, base + 3);
  }

  function buildLevel(world) {
    disposeLevel();
    const g = world.map.grid;
    const T = MapGen.T;
    const tiles = world.tiles;
    const pal = world.level.paleta;
    levelGroup = new THREE.Group();

    // --- atlas de suelo: [suelo0, suelo1, suelo2, agua, decor] ---
    const atlas = document.createElement('canvas');
    atlas.width = 48 * 5; atlas.height = 48;
    const actx = atlas.getContext('2d');
    const slots = [tiles.suelo[0], tiles.suelo[1], tiles.suelo[2], tiles.agua, tiles.decor];
    slots.forEach((c, i) => actx.drawImage(c, i * 48, 0));
    const floorPos = [], floorUv = [], floorIdx = [];
    const U = 1 / 5;
    for (let y = 0; y < g.h; y++)
      for (let x = 0; x < g.w; x++) {
        const v = g.t[y * g.w + x];
        if (v === T.VACIO || v === T.PARED) continue;
        const slot = v === T.AGUA ? 3 : v === T.DECOR ? 4 : (x * 7 + y * 13) % 3;
        quad(floorPos, floorUv, floorIdx,
          [[x, 0, y + 1], [x + 1, 0, y + 1], [x + 1, 0, y], [x, 0, y]],
          [slot * U, 0, (slot + 1) * U, 1]);
      }
    const floorGeom = new THREE.BufferGeometry();
    floorGeom.setAttribute('position', new THREE.Float32BufferAttribute(floorPos, 3));
    floorGeom.setAttribute('uv', new THREE.Float32BufferAttribute(floorUv, 2));
    floorGeom.setIndex(floorIdx);
    floorGeom.computeVertexNormals();
    const floorMesh = new THREE.Mesh(floorGeom,
      new THREE.MeshLambertMaterial({ map: tex(atlas, 'atlas-suelo') }));
    floorMesh.receiveShadow = true;
    levelGroup.add(floorMesh);

    // --- muros ---
    const esWall = (x, y) => MapGen.at(g, x, y) === T.PARED;
    if (tiles.wallStyle === 'tabique') {
      const sidePos = [], sideUv = [], sideIdx = [];
      const topPos = [], topUv = [], topIdx = [];
      for (let y = 0; y < g.h; y++)
        for (let x = 0; x < g.w; x++) {
          if (!esWall(x, y)) continue;
          const h = WALL_H;
          // caras laterales solo hacia espacios abiertos (culling interior)
          if (!esWall(x, y + 1)) quad(sidePos, sideUv, sideIdx,
            [[x, 0, y + 1], [x + 1, 0, y + 1], [x + 1, h, y + 1], [x, h, y + 1]], [0, 0, 1, 1]);
          if (!esWall(x, y - 1)) quad(sidePos, sideUv, sideIdx,
            [[x + 1, 0, y], [x, 0, y], [x, h, y], [x + 1, h, y]], [0, 0, 1, 1]);
          if (!esWall(x - 1, y)) quad(sidePos, sideUv, sideIdx,
            [[x, 0, y], [x, 0, y + 1], [x, h, y + 1], [x, h, y]], [0, 0, 1, 1]);
          if (!esWall(x + 1, y)) quad(sidePos, sideUv, sideIdx,
            [[x + 1, 0, y + 1], [x + 1, 0, y], [x + 1, h, y], [x + 1, h, y + 1]], [0, 0, 1, 1]);
          quad(topPos, topUv, topIdx,
            [[x, h, y + 1], [x + 1, h, y + 1], [x + 1, h, y], [x, h, y]], [0, 0, 1, 1]);
        }
      const mkMesh = (pos, uv, idx, canvas, key, sombra) => {
        const geo = new THREE.BufferGeometry();
        geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
        geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
        geo.setIndex(idx);
        geo.computeVertexNormals();
        const m = new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ map: tex(canvas, key) }));
        m.castShadow = sombra;
        m.receiveShadow = true;
        return m;
      };
      // cara sin la franja de techo (solo el muro): recorte del caraFull
      const caraSolo = document.createElement('canvas');
      caraSolo.width = 48; caraSolo.height = 48;
      caraSolo.getContext('2d').drawImage(tiles.caraFull[1], 0, Tiles.RF, 48, Tiles.FH, 0, 0, 48, 48);
      levelGroup.add(mkMesh(sidePos, sideUv, sideIdx, caraSolo, 'muro-lado', true));
      levelGroup.add(mkMesh(topPos, topUv, topIdx, tiles.techo, 'muro-techo', false));
    } else {
      // bosque/exterior: árboles y rocas como billboards verticales
      const canvas = tiles.wallStyle === 'arbol' ? tiles.arbol : tiles.roca;
      const mat = new THREE.SpriteMaterial({ map: tex(canvas, 'muro-organico'), transparent: true });
      for (let y = 0; y < g.h; y++)
        for (let x = 0; x < g.w; x++) {
          if (!esWall(x, y)) continue;
          const s = new THREE.Sprite(mat);
          const escala = tiles.wallStyle === 'arbol' ? 1.5 : 1.25;
          s.scale.set(escala, escala * (canvas.height / canvas.width), 1);
          s.position.set(x + 0.5, escala * 0.48, y + 0.5);
          levelGroup.add(s);
        }
    }

    // --- salidas ---
    for (const ex of world.map.exits) {
      const c = Render.exitToCanvas(ex.def);
      const estilo = ex.def.ritual ? 'ritual' : Render.exitStyle(ex.def);
      if (estilo === 'trampilla' || estilo === 'escalera') {
        // plano tumbado sobre el suelo
        const m = new THREE.Mesh(
          new THREE.PlaneGeometry(0.95, 0.95),
          new THREE.MeshBasicMaterial({ map: tex(c), transparent: true })
        );
        m.rotation.x = -Math.PI / 2;
        m.position.set(ex.x + 0.5, 0.02, ex.y + 0.5);
        levelGroup.add(m);
        ex._mesh3d = m;
      } else {
        const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex(c), transparent: true }));
        s.scale.set(1, 1.5, 1);
        s.position.set(ex.x + 0.5, 0.72, ex.y + 0.5);
        levelGroup.add(s);
        ex._mesh3d = s;
      }
    }

    // --- props ---
    for (const pr of world.map.props || []) {
      const c = Render.propToCanvas(pr.id);
      const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex(c, 'prop-' + pr.id), transparent: true }));
      s.scale.set(1, 1.5, 1);
      s.position.set(pr.x + 0.5, 0.62, pr.y + 0.5);
      levelGroup.add(s);
      pr._mesh3d = s;
    }

    // --- objetos del suelo ---
    for (let i = 0; i < world.map.items.length; i++) {
      const it = world.map.items[i];
      const c = Render.itemToCanvas(it.id, world.data.objects);
      const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex(c, 'item-' + it.id), transparent: true }));
      s.scale.set(0.7, 0.76, 1);
      s.position.set(it.x + 0.5, 0.32, it.y + 0.5);
      levelGroup.add(s);
      itemSprites.set(i, s);
    }

    // --- jugador ---
    playerSprite = new THREE.Sprite(new THREE.SpriteMaterial({ transparent: true }));
    playerSprite.scale.set(1, SPRITE_H, 1);
    levelGroup.add(playerSprite);

    scene.add(levelGroup);

    // --- atmósfera del nivel ---
    const fondo = new THREE.Color(pal.fondo);
    scene.background = fondo;
    scene.fog = new THREE.FogExp2(fondo, 0.062 + world.level.oscuridad * 0.16);
    amb.intensity = Math.max(0.12, 0.55 - world.level.oscuridad * 0.4);
    plight.color = new THREE.Color(pal.luz);
    plight.distance = (world.visionActual() + 3) * 1.6;

    // posición inicial de cámara sin lerp
    const p = world.player;
    camera.position.set(p.rx + 0.5, CAM.dy, p.ry + 0.5 + CAM.dz);
  }

  function spriteTex(glyph, frame) {
    const key = 'ent-' + glyph + '-' + frame;
    if (texCache.has(key)) return texCache.get(key);
    const c = Sprites.get(glyph, frame);
    return c ? tex(c, key) : null;
  }

  function entVisible(world, e) {
    const g = world.map.grid;
    const idx = e.y * g.w + e.x;
    const lit = world.light[idx];
    const esSmiler = e.def.glyph === 'smiler';
    return lit > 0.05 ||
      (esSmiler && (world.explored[idx] || Math.hypot(e.x - world.player.x, e.y - world.player.y) < 9));
  }

  // fallback: entidades vectoriales (sin matriz de píxeles) → snapshot del dibujo 2D
  function entCanvas(e, frame) {
    const key = 'entvec-' + e.def.glyph + '-' + frame;
    if (texCache.has(key)) return texCache.get(key);
    const c = document.createElement('canvas');
    c.width = 48; c.height = 48;
    const o = c.getContext('2d');
    // usa el dibujante 2D existente sobre este canvas
    const fake = Object.create(e);
    fake.revelada = true;
    const octxOld = o; // Render._drawEntity dibuja en su ctx interno: usamos exportador
    // Render._drawEntity no acepta ctx externo: replicamos con sprites.get o círculo
    const spr = Sprites.get(e.def.glyph, frame);
    if (spr) o.drawImage(spr, 0, 0);
    else {
      o.fillStyle = e.def.color;
      o.beginPath(); o.arc(24, 24, 12, 0, 7); o.fill();
      o.strokeStyle = 'rgba(0,0,0,0.6)'; o.stroke();
    }
    return tex(c, key);
  }

  // ---------- frame ----------
  function frame(world, t) {
    if (!world.level || !world.map) return;
    const key = world.level.id + '::' + (world.entryCount?.[world.level.id] ?? 0);
    if (key !== levelKey) { levelKey = key; buildLevel(world); }

    const p = world.player;
    const px = p.rx + 0.5, pz = p.ry + 0.5;

    // jugador
    const dir = p.dir || 'down';
    const sid = dir === 'side' ? 'player_side' : 'player_' + dir;
    const pframe = world.moving ? Math.floor(t / 160) % 2 : 0;
    playerSprite.material.map = spriteTex(sid, pframe);
    playerSprite.material.needsUpdate = true;
    playerSprite.scale.x = p.flip ? -1 : 1;
    playerSprite.position.set(px, SPRITE_H / 2 + 0.02, pz);

    // entidades (crear bajo demanda, ocultar si no visibles)
    for (const e of world.entities) {
      let s = entitySprites.get(e.uid);
      if (!e.viva) { if (s) s.visible = false; continue; }
      if (!s) {
        s = new THREE.Sprite(new THREE.SpriteMaterial({ transparent: true }));
        s.scale.set(1, SPRITE_H, 1);
        if (e.def.glyph === 'smiler') s.material.fog = false; // brilla en la oscuridad
        levelGroup.add(s);
        entitySprites.set(e.uid, s);
      }
      const visible = entVisible(world, e);
      s.visible = visible;
      if (!visible) continue;
      const frame2 = Math.floor(t / 280) % 2;
      const tx = spriteTex(e.def.glyph, frame2) || entCanvas(e, frame2);
      s.material.map = tx;
      s.material.needsUpdate = true;
      // embestida de ataque
      let ox = 0, oz = 0;
      if (e._atkT !== undefined) {
        const k = (t - e._atkT) / 240;
        if (k >= 0 && k <= 1) {
          const amp = Math.sin(Math.PI * k) * 0.38;
          ox = (world.player.x - e.x) * amp;
          oz = (world.player.y - e.y) * amp;
        }
      }
      // tinte de estado
      s.material.color.setHex(e.paralizada > 0 ? 0x77ccff : 0xffffff);
      if (e._hitT && t - e._hitT < 170) s.material.color.setHex(0xffaaaa);
      s.position.set(e.rx + 0.5 + ox, SPRITE_H / 2 + 0.02, e.ry + 0.5 + oz);
    }

    // objetos recogidos
    for (const [i, s] of itemSprites) s.visible = !world.map.items[i].taken;

    // luz del jugador con flicker fluorescente
    let flicker = 1;
    if (Math.random() < 0.015) flicker = 0.7;
    plight.intensity = plight.intensity * 0.85 + (1.7 * flicker) * 0.15;
    plight.position.set(px, 1.6, pz);
    if (p.luz) plight.distance = (world.visionActual() + 3) * 1.6;

    // cámara Octopath: baja, cercana, con inercia y bob
    if (world.moving) camBobT += 0.16;
    const bob = Math.sin(camBobT) * CAM.bob * (world.moving ? 1 : 0.2);
    const target = new THREE.Vector3(px, CAM.dy + bob, pz + CAM.dz);
    camera.position.lerp(target, CAM.suavidad);
    camera.lookAt(px, CAM.lookY, pz - CAM.lookAhead);

    renderer.render(scene, camera);
    drawOverlay(world, t);
  }

  function project(wx, wy) {
    const v = new THREE.Vector3(wx + 0.5, 0.8, wy + 0.5).project(camera);
    return [(v.x * 0.5 + 0.5) * W, (-v.y * 0.5 + 0.5) * H];
  }

  function drawOverlay(world, t) {
    octx.clearRect(0, 0, W, H);
    if (!window.NOFX) Effects.draw(octx, 0, 0, t, 48, project);

    // flash de daño
    const dt = t - world.ui.flashT;
    if (dt < 220) {
      octx.fillStyle = `rgba(160,20,20,${0.35 * (1 - dt / 220)})`;
      octx.fillRect(0, 0, W, H);
    }
    // cordura baja
    if (world.player.cordura < 30) {
      const sc = (30 - world.player.cordura) / 30;
      octx.fillStyle = `rgba(60,0,20,${0.14 * sc})`;
      octx.fillRect(0, 0, W, H);
    }
    if (!window.NOFX) {
      // viñeta + grano
      const vin = octx.createRadialGradient(W / 2, H / 2, H * 0.38, W / 2, H / 2, H * 0.8);
      vin.addColorStop(0, 'rgba(0,0,0,0)');
      vin.addColorStop(1, 'rgba(0,0,0,0.55)');
      octx.fillStyle = vin;
      octx.fillRect(0, 0, W, H);
      octx.globalAlpha = 0.45;
      octx.drawImage(grain, Math.random() * -80, Math.random() * -80, W + 160, H + 160);
      octx.globalAlpha = 1;
    }
  }

  window.Render3D = { init, frame, project, TILE: 48 };
})();
