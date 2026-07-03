// Empaqueta los JSON de data/game/ en game/js/data.js para que el juego
// funcione abriendo index.html directamente (file:// bloquea fetch de JSON).
// Uso: node pipeline/build-data.js  (re-ejecutar tras editar las fichas)

const fs = require('fs');
const path = require('path');

const G = (f) => require(path.join(__dirname, '..', 'data', 'game', f));
const data = {
  levels: G('levels.es.json'),
  entities: G('entities.es.json'),
  objects: G('objects.es.json'),
};

const out = '// GENERADO por pipeline/build-data.js — no editar a mano\nwindow.GAME_DATA = ' +
  JSON.stringify(data) + ';\n';
fs.writeFileSync(path.join(__dirname, '..', 'game', 'js', 'data.js'), out);
console.log('game/js/data.js generado:',
  Object.keys(data.levels).length, 'niveles,',
  Object.keys(data.entities).length, 'entidades,',
  Object.keys(data.objects).length, 'objetos');
