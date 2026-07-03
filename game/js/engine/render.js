// Render: tiles, entidades, jugador, oscuridad estilo Darkwood y postprocesado.
(function () {
  const TILE = Tiles.TILE;
  const { T } = MapGen;

  let canvas, ctx, W, H;
  let grain; // textura de grano pre-generada

  function init(c) {
    canvas = c;
    ctx = c.getContext('2d');
    W = c.width; H = c.height;
    // grano de película
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

  // ---------- sprites procedurales ----------
  function drawEntity(e, x, y, lit, t) {
    const def = e.def;
    const cx = x + TILE / 2, cy = y + TILE / 2;
    ctx.save();

    if (def.glyph === 'smiler') {
      // en la oscuridad solo se ven los ojos y la sonrisa
      const glow = lit < 0.45 ? 1 : 0.25;
      ctx.globalAlpha = Math.max(0.15, glow);
      ctx.shadowColor = def.color; ctx.shadowBlur = 12 * glow;
      ctx.fillStyle = def.color;
      ctx.beginPath(); ctx.arc(cx - 6, cy - 5, 2.6, 0, 7); ctx.fill();
      ctx.beginPath(); ctx.arc(cx + 6, cy - 5, 2.6, 0, 7); ctx.fill();
      ctx.strokeStyle = def.color; ctx.lineWidth = 2.4;
      ctx.beginPath(); ctx.arc(cx, cy + 1, 9, 0.15 * Math.PI, 0.85 * Math.PI); ctx.stroke();
      ctx.restore();
      return;
    }

    if (!e.revelada && def.comportamiento === 'imita') {
      // parece un superviviente: figura humana quieta
      drawHumanoid(cx, cy, '#c8b89a', '#7a6a50', t, true);
      ctx.restore();
      return;
    }
    if (!e.revelada && def.comportamiento === 'emboscada') {
      // bulto apenas visible
      ctx.globalAlpha = 0.55;
      ctx.fillStyle = def.color;
      ctx.beginPath(); ctx.ellipse(cx, cy + 6, 10, 6, 0, 0, 7); ctx.fill();
      ctx.restore();
      return;
    }

    ctx.globalAlpha = Math.max(0.25, Math.min(1, lit + 0.25));
    const bob = Math.sin(t / 300 + e.uid) * 1.5;
    switch (def.glyph) {
      case 'hound':
        ctx.fillStyle = def.color;
        ctx.beginPath(); ctx.ellipse(cx, cy + 4 + bob * 0.4, 11, 6, 0, 0, 7); ctx.fill();
        ctx.beginPath(); ctx.arc(cx + 9, cy + bob * 0.4, 5, 0, 7); ctx.fill();
        ctx.fillStyle = '#e8d0c0';
        ctx.fillRect(cx + 10, cy - 1 + bob * 0.4, 2, 2);
        break;
      case 'faceling':
        drawHumanoid(cx, cy + bob * 0.3, def.color, Tiles.shade(def.color, 0.7), t, false);
        // sin rostro: óvalo liso
        ctx.fillStyle = Tiles.shade(def.color, 1.15);
        ctx.beginPath(); ctx.ellipse(cx, cy - 8, 4.5, 5.5, 0, 0, 7); ctx.fill();
        break;
      case 'deathmoth': {
        ctx.fillStyle = def.color;
        const flap = Math.sin(t / 90 + e.uid) * 6;
        ctx.beginPath(); ctx.ellipse(cx - 7, cy + bob, 8, 4 + flap, -0.4, 0, 7); ctx.fill();
        ctx.beginPath(); ctx.ellipse(cx + 7, cy + bob, 8, 4 + flap, 0.4, 0, 7); ctx.fill();
        ctx.fillStyle = Tiles.shade(def.color, 0.6);
        ctx.beginPath(); ctx.ellipse(cx, cy + bob, 3, 7, 0, 0, 7); ctx.fill();
        break;
      }
      case 'clump':
        ctx.fillStyle = def.color;
        for (let i = 0; i < 7; i++) {
          const a = (i / 7) * Math.PI * 2 + t / 700;
          ctx.beginPath();
          ctx.ellipse(cx + Math.cos(a) * 6, cy + Math.sin(a) * 6, 5, 3, a, 0, 7);
          ctx.fill();
        }
        break;
      case 'duller':
        ctx.fillStyle = def.color;
        ctx.fillRect(cx - 3, cy - 14 + bob, 6, 26);
        ctx.beginPath(); ctx.arc(cx, cy - 14 + bob, 5, 0, 7); ctx.fill();
        break;
      case 'skinstealer':
        drawHumanoid(cx, cy + bob * 0.3, def.color, Tiles.shade(def.color, 0.65), t, false);
        ctx.strokeStyle = '#804030'; ctx.lineWidth = 1; // costuras
        ctx.beginPath(); ctx.moveTo(cx - 4, cy - 12); ctx.lineTo(cx + 4, cy - 4); ctx.stroke();
        break;
      case 'window':
        ctx.fillStyle = Tiles.shade(def.color, 0.5);
        ctx.fillRect(cx - 9, cy - 11, 18, 22);
        ctx.fillStyle = def.color;
        ctx.fillRect(cx - 7, cy - 9, 14, 18);
        ctx.strokeStyle = Tiles.shade(def.color, 0.4);
        ctx.beginPath(); ctx.moveTo(cx, cy - 9); ctx.lineTo(cx, cy + 9);
        ctx.moveTo(cx - 7, cy); ctx.lineTo(cx + 7, cy); ctx.stroke();
        break;
      case 'anethika':
        ctx.fillStyle = def.color;
        ctx.fillRect(cx - 4, cy - 16 + bob, 8, 28);
        ctx.beginPath(); ctx.arc(cx + 3, cy - 17 + bob, 6, 0, 7); ctx.fill(); // cuello torcido
        break;
      case 'spine':
        ctx.strokeStyle = def.color; ctx.lineWidth = 2;
        for (let i = 0; i < 4; i++) {
          ctx.beginPath();
          ctx.moveTo(cx - 6 + i * 4, cy + 8);
          ctx.quadraticCurveTo(cx - 8 + i * 5 + bob, cy - 6, cx - 2 + i * 3, cy - 10);
          ctx.stroke();
        }
        break;
      case 'needlelimb':
        ctx.fillStyle = def.color;
        ctx.fillRect(cx - 2, cy - 15 + bob, 4, 24);
        ctx.beginPath(); ctx.ellipse(cx, cy - 16 + bob, 3.5, 6, 0, 0, 7); ctx.fill();
        ctx.strokeStyle = def.color; ctx.lineWidth = 1;
        for (let i = 0; i < 5; i++) {
          ctx.beginPath();
          ctx.moveTo(cx + 2, cy - 4 + bob);
          ctx.lineTo(cx + 10, cy - 8 + i * 3 + bob);
          ctx.stroke();
        }
        break;
      case 'silverslime':
        ctx.fillStyle = def.color;
        ctx.beginPath(); ctx.ellipse(cx, cy + 7, 11, 5, 0, 0, 7); ctx.fill();
        ctx.fillStyle = '#ffffff';
        ctx.globalAlpha *= 0.6;
        ctx.beginPath(); ctx.ellipse(cx - 3, cy + 6, 3, 1.5, 0, 0, 7); ctx.fill();
        break;
      case 'aranea':
        ctx.strokeStyle = def.color; ctx.lineWidth = 2.5;
        for (const s of [-1, 1]) {
          ctx.beginPath(); ctx.moveTo(cx, cy - 2); ctx.lineTo(cx + 12 * s, cy - 10 + bob); ctx.lineTo(cx + 16 * s, cy + 8); ctx.stroke();
          ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx + 10 * s, cy + 4); ctx.lineTo(cx + 13 * s, cy + 12); ctx.stroke();
        }
        ctx.fillStyle = def.color;
        ctx.beginPath(); ctx.ellipse(cx, cy - 2, 7, 5, 0, 0, 7); ctx.fill();
        ctx.fillStyle = '#e8e0d0';
        ctx.beginPath(); ctx.ellipse(cx, cy - 4, 4, 3, 0, 0, 7); ctx.fill(); // cráneo
        break;
      case 'predatorydoor':
        ctx.fillStyle = Tiles.shade(def.color, 0.8);
        ctx.fillRect(cx - 8, cy - 13, 16, 26);
        ctx.fillStyle = def.color;
        ctx.fillRect(cx - 6, cy - 11, 12, 22);
        ctx.fillStyle = '#e0c040';
        ctx.beginPath(); ctx.arc(cx + 3, cy, 1.5, 0, 7); ctx.fill();
        break;
      case 'cell':
        ctx.fillStyle = '#e8f0ea';
        ctx.beginPath(); ctx.arc(cx, cy + bob, 9, 0, 7); ctx.fill();
        ctx.fillStyle = def.color;
        ctx.beginPath(); ctx.arc(cx, cy + bob, 5, 0, 7); ctx.fill();
        ctx.fillStyle = '#101010';
        ctx.beginPath(); ctx.arc(cx, cy + bob, 2.2, 0, 7); ctx.fill();
        break;
      case 'hunter':
        ctx.shadowColor = def.color; ctx.shadowBlur = 10;
        drawHumanoid(cx, cy + bob * 0.3, '#2a1516', def.color, t, false);
        ctx.fillStyle = def.color;
        ctx.fillRect(cx - 5, cy - 11, 2.5, 2.5);
        ctx.fillRect(cx + 2.5, cy - 11, 2.5, 2.5);
        break;
      default:
        ctx.fillStyle = def.color;
        ctx.beginPath(); ctx.arc(cx, cy, 8, 0, 7); ctx.fill();
    }
    ctx.restore();
  }

  function drawHumanoid(cx, cy, cuerpo, ropa, t, quieto) {
    const step = quieto ? 0 : Math.sin(t / 200) * 2;
    ctx.fillStyle = ropa;
    ctx.fillRect(cx - 4, cy - 4, 8, 12);           // torso
    ctx.fillStyle = cuerpo;
    ctx.beginPath(); ctx.arc(cx, cy - 9, 5, 0, 7); ctx.fill(); // cabeza
    ctx.fillStyle = ropa;
    ctx.fillRect(cx - 4, cy + 8, 3, 6 + step);     // piernas
    ctx.fillRect(cx + 1, cy + 8, 3, 6 - step);
  }

  function drawPlayer(px, py, t, world) {
    const cx = px + TILE / 2, cy = py + TILE / 2;
    ctx.save();
    // sombra en el suelo y contorno para que siempre se lea
    ctx.fillStyle = 'rgba(0,0,0,0.45)';
    ctx.beginPath(); ctx.ellipse(cx, cy + 13, 8, 3, 0, 0, 7); ctx.fill();
    ctx.shadowColor = '#000'; ctx.shadowBlur = 5;
    drawHumanoid(cx, cy, '#e8c9a0', '#5a6e50', world.moving ? t : 0, !world.moving);
    ctx.restore();
  }

  function drawExit(ex, x, y, t) {
    const cx = x + TILE / 2, cy = y + TILE / 2;
    ctx.save();
    const pulse = 0.6 + Math.sin(t / 400) * 0.25;
    const col = ex.def.tipo === 'escape' ? '#6ae86a' : ex.def.tipo === 'sellada' ? '#666666' : '#e8c95a';
    ctx.shadowColor = col; ctx.shadowBlur = 14 * pulse;
    ctx.fillStyle = Tiles.shade(col, 0.35);
    ctx.fillRect(cx - 9, cy - 13, 18, 26);
    ctx.strokeStyle = col; ctx.lineWidth = 2;
    ctx.strokeRect(cx - 9, cy - 13, 18, 26);
    ctx.globalAlpha = pulse;
    ctx.fillStyle = col;
    ctx.fillRect(cx - 6, cy - 10, 12, 20);
    ctx.restore();
  }

  function drawItem(it, x, y, t, objects) {
    const def = objects[it.id];
    const cx = x + TILE / 2, cy = y + TILE / 2 + Math.sin(t / 350 + cx) * 2;
    ctx.save();
    ctx.shadowColor = def.color; ctx.shadowBlur = 8;
    ctx.fillStyle = def.color;
    if (it.id === 'agua_almendras') {
      ctx.fillRect(cx - 3, cy - 6, 6, 12);
      ctx.fillStyle = Tiles.shade(def.color, 0.6);
      ctx.fillRect(cx - 3, cy - 6, 6, 3);
    } else if (it.id === 'botiquin') {
      ctx.fillRect(cx - 6, cy - 4, 12, 9);
      ctx.fillStyle = '#fff';
      ctx.fillRect(cx - 1, cy - 3, 2, 7); ctx.fillRect(cx - 4, cy, 8, 2);
    } else if (it.id === 'linterna') {
      ctx.fillRect(cx - 6, cy - 2, 10, 5);
      ctx.fillStyle = '#fff8d0';
      ctx.beginPath(); ctx.arc(cx + 5, cy, 3, 0, 7); ctx.fill();
    } else if (it.id === 'llave_nivel') {
      ctx.beginPath(); ctx.arc(cx - 3, cy, 3.5, 0, 7); ctx.stroke();
      ctx.strokeStyle = def.color; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx + 7, cy); ctx.moveTo(cx + 5, cy); ctx.lineTo(cx + 5, cy + 3); ctx.stroke();
    } else {
      ctx.beginPath(); ctx.arc(cx, cy, 5, 0, 7); ctx.fill();
    }
    ctx.restore();
  }

  // ---------- frame ----------
  function frame(world, t) {
    const g = world.map.grid;
    const cam = world.camera;
    ctx.fillStyle = world.level.paleta.fondo;
    ctx.fillRect(0, 0, W, H);

    const x0 = Math.floor(cam.x / TILE), y0 = Math.floor(cam.y / TILE);
    const x1 = x0 + Math.ceil(W / TILE) + 1, y1 = y0 + Math.ceil(H / TILE) + 1;

    // parpadeo fluorescente global
    let flicker = 1;
    if (Math.random() < 0.012) flicker = 0.72;
    world._flicker = world._flicker === undefined ? 1 : world._flicker * 0.85 + flicker * 0.15;
    const fl = world._flicker;

    // tiles
    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        if (x < 0 || y < 0 || x >= g.w || y >= g.h) continue;
        const idx = y * g.w + x;
        const seen = world.explored[idx];
        const light = world.light[idx];
        if (!seen && light <= 0) continue;
        const v = g.t[idx];
        const sx = x * TILE - cam.x, sy = y * TILE - cam.y;
        let img;
        if (v === T.PARED) img = world.tiles.pared;
        else if (v === T.AGUA) img = world.tiles.agua;
        else if (v === T.VACIO) img = world.tiles.vacio;
        else if (v === T.DECOR) img = world.tiles.decor;
        else img = world.tiles.suelo[(x * 7 + y * 13) % 3];
        ctx.drawImage(img, sx, sy);
      }
    }

    // salidas, objetos y entidades (solo si iluminadas)
    for (const ex of world.map.exits) {
      const idx = ex.y * g.w + ex.x;
      if (world.light[idx] > 0.05 || world.explored[idx])
        drawExit(ex, ex.x * TILE - cam.x, ex.y * TILE - cam.y, t);
    }
    for (const it of world.map.items) {
      if (it.taken) continue;
      const idx = it.y * g.w + it.x;
      if (world.light[idx] > 0.05)
        drawItem(it, it.x * TILE - cam.x, it.y * TILE - cam.y, t, world.data.objects);
    }
    for (const e of world.entities) {
      if (!e.viva) continue;
      const idx = e.y * g.w + e.x;
      const lit = world.light[idx];
      // los smilers se ven en la oscuridad aunque el tile no esté iluminado
      const esSmiler = e.def.glyph === 'smiler';
      if (lit > 0.05 || (esSmiler && world.explored[idx]) ||
          (esSmiler && Math.hypot(e.x - world.player.x, e.y - world.player.y) < 9))
        drawEntity(e, e.rx * TILE - cam.x, e.ry * TILE - cam.y, lit, t);
    }

    drawPlayer(world.player.rx * TILE - cam.x, world.player.ry * TILE - cam.y, t, world);

    // ---------- oscuridad Darkwood ----------
    const dark = world.level.oscuridad;
    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        if (x < 0 || y < 0 || x >= g.w || y >= g.h) continue;
        const idx = y * g.w + x;
        const light = world.light[idx];
        const seen = world.explored[idx];
        let a;
        if (light > 0) a = (1 - light * fl) * (0.2 + dark * 0.72);
        else if (seen) a = 0.9;
        else a = 1;
        if (a > 0.01) {
          ctx.fillStyle = `rgba(0,0,0,${a.toFixed(3)})`;
          ctx.fillRect(x * TILE - cam.x, y * TILE - cam.y, TILE, TILE);
        }
      }
    }

    // halo cálido alrededor del jugador
    if (!window.NOFX) {
      const pcx = world.player.rx * TILE - cam.x + TILE / 2;
      const pcy = world.player.ry * TILE - cam.y + TILE / 2;
      const halo = ctx.createRadialGradient(pcx, pcy, 10, pcx, pcy, TILE * (world.visionActual() + 1));
      halo.addColorStop(0, `rgba(255,240,190,${0.09 * fl})`);
      halo.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = halo;
      ctx.fillRect(0, 0, W, H);
    }

    // cordura baja: el mundo tiembla y se estrecha
    if (world.player.cordura < 30) {
      const s = (30 - world.player.cordura) / 30;
      ctx.fillStyle = `rgba(60,0,20,${0.12 * s})`;
      ctx.fillRect(0, 0, W, H);
    }

    if (!window.NOFX) {
      // viñeta
      const vin = ctx.createRadialGradient(W / 2, H / 2, H * 0.36, W / 2, H / 2, H * 0.78);
      vin.addColorStop(0, 'rgba(0,0,0,0)');
      vin.addColorStop(1, 'rgba(0,0,0,0.62)');
      ctx.fillStyle = vin;
      ctx.fillRect(0, 0, W, H);

      // grano de película animado
      ctx.globalAlpha = 0.5;
      ctx.drawImage(grain, Math.random() * -80, Math.random() * -80, W + 160, H + 160);
      ctx.globalAlpha = 1;
    }
  }

  window.Render = { init, frame, TILE, _drawEntity: drawEntity };
})();
