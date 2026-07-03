// Campo de visión estilo Darkwood: raycasting por tiles — las paredes
// bloquean la línea de visión; lo no visto queda negro, lo explorado en penumbra.
(function () {
  const { T } = MapGen;

  function blocks(g, x, y) {
    const v = (x < 0 || y < 0 || x >= g.w || y >= g.h) ? T.PARED : g.t[y * g.w + x];
    return v === T.PARED;
  }

  // línea de Bresenham: ¿hay visión directa de (x0,y0) a (x1,y1)?
  function los(g, x0, y0, x1, y1) {
    let dx = Math.abs(x1 - x0), dy = Math.abs(y1 - y0);
    const sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
    let err = dx - dy, x = x0, y = y0;
    while (!(x === x1 && y === y1)) {
      if (!(x === x0 && y === y0) && blocks(g, x, y)) return false;
      const e2 = err * 2;
      if (e2 > -dy) { err -= dy; x += sx; }
      if (e2 < dx) { err += dx; y += sy; }
    }
    return true;
  }

  // calcula visibilidad: devuelve Float32Array con intensidad de luz 0..1 por tile
  function compute(g, px, py, radius) {
    const light = new Float32Array(g.w * g.h);
    const r2 = radius * radius;
    const x0 = Math.max(0, px - radius - 1), x1 = Math.min(g.w - 1, px + radius + 1);
    const y0 = Math.max(0, py - radius - 1), y1 = Math.min(g.h - 1, py + radius + 1);
    for (let y = y0; y <= y1; y++)
      for (let x = x0; x <= x1; x++) {
        const d2 = (x - px) ** 2 + (y - py) ** 2;
        if (d2 > r2 * 1.4) continue;
        if (!los(g, px, py, x, y)) continue;
        // atenuación suave con la distancia
        const d = Math.sqrt(d2);
        light[y * g.w + x] = Math.max(0, Math.min(1, 1.15 - (d / radius) * 0.95));
      }
    light[py * g.w + px] = 1;
    return light;
  }

  window.FOV = { compute, los };
})();
