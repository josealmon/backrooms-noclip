# BACKROOMS — No-Clip

Roguelike 2D contextual basado en la [wiki de las Backrooms](https://backrooms.fandom.com),
fiel al lore: niveles, entidades, salidas y mecánicas salen de las páginas reales de la wiki.

## Cómo jugar

**Doble clic en `game/index.html`.** No hace falta servidor, ni internet, ni instalar nada.

- **WASD / flechas**: moverte (cada paso = 1 turno; el mundo solo avanza cuando tú lo haces)
- **E**: interactuar · **Espacio**: esperar · **F**: linterna · **R**: volver al nivel anterior
- **J**: diario de ruta · **1-6**: usar objeto del inventario
- Escribe una **semilla** en el título para partidas reproducibles (compártela con el chat).

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
