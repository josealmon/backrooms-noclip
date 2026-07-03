// Texturas de tiles generadas por código a partir de la paleta de cada nivel.
(function () {
  const TILE = 32;

  function shade(hex, f) {
    const n = parseInt(hex.slice(1), 16);
    let r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
    r = Math.max(0, Math.min(255, Math.round(r * f)));
    g = Math.max(0, Math.min(255, Math.round(g * f)));
    b = Math.max(0, Math.min(255, Math.round(b * f)));
    return `rgb(${r},${g},${b})`;
  }

  function canvas() {
    const c = document.createElement('canvas');
    c.width = TILE; c.height = TILE;
    return c;
  }

  function speckle(ctx, rng, color, n, size = 1) {
    ctx.fillStyle = color;
    for (let i = 0; i < n; i++)
      ctx.fillRect(rng.int(0, TILE - 1), rng.int(0, TILE - 1), size, size);
  }

  // suelo según bioma
  function floorTile(pal, bioma, rng, variant) {
    const c = canvas(), ctx = c.getContext('2d');
    ctx.fillStyle = shade(pal.suelo, 0.92 + variant * 0.06);
    ctx.fillRect(0, 0, TILE, TILE);
    if (bioma === 'pasillos') {              // moqueta: motas densas
      speckle(ctx, rng, shade(pal.suelo, 0.78), 90);
      speckle(ctx, rng, shade(pal.suelo, 1.14), 60);
      if (variant === 2) speckle(ctx, rng, shade(pal.detalle, 0.9), 26); // mancha de humedad
    } else if (bioma === 'garaje' || bioma === 'tuneles') { // hormigón: grietas
      speckle(ctx, rng, shade(pal.suelo, 0.82), 40);
      ctx.strokeStyle = shade(pal.suelo, 0.68);
      ctx.beginPath();
      let x = rng.int(0, TILE), y = 0;
      ctx.moveTo(x, y);
      while (y < TILE) { x += rng.int(-3, 3); y += rng.int(3, 7); ctx.lineTo(x, y); }
      if (variant > 0) ctx.stroke();
    } else if (bioma === 'hospital' || bioma === 'oficinas') { // baldosas
      speckle(ctx, rng, shade(pal.suelo, 1.08), 24);
      ctx.strokeStyle = shade(pal.suelo, 0.75);
      ctx.lineWidth = 1;
      ctx.strokeRect(0.5, 0.5, TILE - 1, TILE - 1);
    } else if (bioma === 'bosque' || bioma === 'exterior') { // tierra/hierba
      speckle(ctx, rng, shade(pal.suelo, 0.8), 55);
      speckle(ctx, rng, shade(pal.detalle, 1.0), 18, 2);
    } else if (bioma === 'ciudad') {         // adoquín
      speckle(ctx, rng, shade(pal.suelo, 0.85), 30);
      ctx.strokeStyle = shade(pal.suelo, 0.72);
      ctx.beginPath();
      ctx.moveTo(0, TILE / 2); ctx.lineTo(TILE, TILE / 2);
      ctx.moveTo(TILE / 2, (variant % 2) * TILE / 2); ctx.lineTo(TILE / 2, (variant % 2) * TILE / 2 + TILE / 2);
      ctx.stroke();
    } else if (bioma === 'torres') {         // paneles nítidos
      ctx.strokeStyle = shade(pal.suelo, 0.85);
      ctx.strokeRect(1.5, 1.5, TILE - 3, TILE - 3);
      speckle(ctx, rng, shade(pal.suelo, 1.06), 10);
    }
    return c;
  }

  function wallTile(pal, bioma, rng) {
    const c = canvas(), ctx = c.getContext('2d');
    ctx.fillStyle = pal.pared;
    ctx.fillRect(0, 0, TILE, TILE);
    if (bioma === 'bosque') { // árbol: tronco sobre suelo oscuro
      ctx.fillStyle = shade(pal.suelo, 0.55);
      ctx.fillRect(0, 0, TILE, TILE);
      ctx.fillStyle = shade(pal.pared, 0.9);
      ctx.beginPath();
      ctx.arc(TILE / 2, TILE / 2, 12, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = shade(pal.pared, 1.2);
      ctx.beginPath();
      ctx.arc(TILE / 2 - 3, TILE / 2 - 3, 6, 0, Math.PI * 2);
      ctx.fill();
    } else {
      speckle(ctx, rng, shade(pal.pared, 0.85), 30);
      speckle(ctx, rng, shade(pal.pared, 1.12), 18);
      // cara inferior más oscura: sensación 2.5D
      ctx.fillStyle = shade(pal.pared, 0.62);
      ctx.fillRect(0, TILE - 7, TILE, 7);
      ctx.fillStyle = shade(pal.pared, 1.25);
      ctx.fillRect(0, 0, TILE, 2);
      if (bioma === 'tuneles') { // hiladas de ladrillo
        ctx.strokeStyle = shade(pal.pared, 0.7);
        for (let y = 6; y < TILE - 8; y += 7) {
          ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(TILE, y); ctx.stroke();
        }
      }
    }
    return c;
  }

  function aguaTile(pal, rng) {
    const c = canvas(), ctx = c.getContext('2d');
    ctx.fillStyle = shade(pal.detalle, 0.7);
    ctx.fillRect(0, 0, TILE, TILE);
    ctx.strokeStyle = shade(pal.detalle, 1.3);
    for (let i = 0; i < 3; i++) {
      const y = rng.int(4, TILE - 4);
      ctx.beginPath();
      ctx.moveTo(rng.int(0, 8), y);
      ctx.quadraticCurveTo(TILE / 2, y + rng.int(-3, 3), TILE - rng.int(0, 8), y);
      ctx.stroke();
    }
    return c;
  }

  function vacioTile(pal) {
    const c = canvas(), ctx = c.getContext('2d');
    const grad = ctx.createLinearGradient(0, 0, 0, TILE);
    grad.addColorStop(0, pal.fondo);
    grad.addColorStop(1, '#000');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, TILE, TILE);
    return c;
  }

  function decorTile(pal, bioma, rng) {
    const base = floorTile(pal, bioma, rng, 1);
    const ctx = base.getContext('2d');
    ctx.fillStyle = shade(pal.detalle, 1.1);
    if (bioma === 'garaje') { // mancha de aceite / charco
      ctx.globalAlpha = 0.5;
      ctx.beginPath();
      ctx.ellipse(TILE / 2, TILE / 2, 9, 6, 0.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
    } else if (bioma === 'torres') { // viga
      ctx.fillStyle = pal.pared;
      ctx.fillRect(TILE / 2 - 4, 0, 8, TILE);
      ctx.fillStyle = shade(pal.pared, 1.3);
      ctx.fillRect(TILE / 2 - 4, 0, 2, TILE);
    } else {
      speckle(ctx, rng, shade(pal.detalle, 1.05), 14, 2);
    }
    return base;
  }

  window.Tiles = {
    TILE,
    shade,
    build(levelDef, rng) {
      const pal = levelDef.paleta, b = levelDef.bioma;
      return {
        suelo: [0, 1, 2].map((v) => floorTile(pal, b, rng, v)),
        pared: wallTile(pal, b, rng),
        agua: aguaTile(pal, rng),
        vacio: vacioTile(pal),
        decor: decorTile(pal, b, rng),
      };
    },
  };
})();
