# BACKROOMS — No-Clip

Roguelike 2D contextual basado en la [wiki de las Backrooms](https://backrooms.fandom.com),
fiel al lore: niveles, entidades, salidas y mecánicas salen de las páginas reales de la wiki.

## Cómo jugar

**Doble clic en `game/index.html`.** No hace falta servidor, ni internet, ni instalar nada.

- **WASD / flechas**: moverte (cada paso = 1 turno; el mundo solo avanza cuando tú lo haces)
- **E**: interactuar — cruzar salidas y **registrar muebles** (taquillas, archivadores… con tirada de dado)
- **Espacio**: esperar · **F**: linterna · **R**: volver al nivel anterior
- **J**: diario de ruta · **C**: Códice del Errante · **1-6**: usar objeto del inventario
- **Perfiles**: crea tu usuario en el título; el Códice registra para siempre los niveles
  que transitas (con su descripción), veces visitados, mejores marcas y escapes.
  Exportable/importable como JSON.
- Escribe una **semilla** en el título para partidas reproducibles (compártela con el chat).
- **Sprites personalizados**: cualquier PNG en `game/assets/sprites/` sustituye al pixel-art
  integrado (ver `LEEME.txt` en esa carpeta).

Objetivo: encontrar una de las rarísimas rutas de escape de vuelta a la realidad.
La muerte es permanente: despiertas otra vez en Level 0.

Parámetros de URL útiles para el directo: `?seed=misemilla&autostart=1`

## Estructura

```
pipeline/   Scripts Node (descarga de la wiki, parseo, fichas, mapa, empaquetado)
data/raw/       La wiki entera en local (1.113 páginas, descargada 2026-07)
data/parsed/    Grafo estructurado: 734 niveles, 182 entidades, 82 objetos
data/game/      Fichas jugables en español del piloto (30 niveles) + mapa-piloto.html
game/       El juego (HTML/JS/Canvas puro, cero dependencias)
```

## Comandos del pipeline (Node)

```
node pipeline/download.js    # re-descargar la wiki (incremental)
node pipeline/parse.js       # wikitext -> data/parsed/*.json
node pipeline/select-pilot.js# elegir niveles del piloto (BFS desde Level 0)
node pipeline/make-map.js    # regenerar data/game/mapa-piloto.html
node pipeline/build-data.js  # OBLIGATORIO tras editar data/game/*.json -> game/js/data.js
```

## El mapa para el autor

`data/game/mapa-piloto.html` — diagrama con los 30 niveles del piloto y flechas
de qué nivel conduce a cuál, coloreado por peligro, con la ruta de escape marcada (⭐).

## Escalar más allá del piloto

Las 734 páginas de niveles ya están en `data/parsed/levels.json`. Para añadir niveles:
crear su ficha en `data/game/levels.es.json` (bioma, paleta, reglas, entidades, salidas)
y ejecutar `build-data.js`. El motor los acepta sin tocar código.

## Contribuir

Los Pull Requests son bienvenidos — lee [CONTRIBUTING.md](CONTRIBUTING.md) antes.
Solo el autor acepta cambios en este repositorio.

## Licencia

- **Código y juego**: [PolyForm Noncommercial 1.0.0](LICENSE.md) — © 2026 MeltStudio.
  Puedes usarlo, estudiarlo y modificarlo libremente **sin fines comerciales**.
  Cualquier uso comercial queda reservado al autor.
- **Lore y textos derivados de la wiki**: el contenido descriptivo procede de
  [backrooms.fandom.com](https://backrooms.fandom.com) y pertenece a sus autores
  bajo [CC BY-SA 3.0](https://creativecommons.org/licenses/by-sa/3.0/); cada ficha
  del juego conserva la `url` de su página original como atribución.
- **Terceros vendorizados**: [Three.js](https://threejs.org) r147 (licencia MIT)
  y fuentes tipográficas bajo [SIL OFL](https://openfontlicense.org/) en
  `game/assets/fonts/`.
