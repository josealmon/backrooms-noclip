# Contribuir a BACKROOMS — No-Clip

¡Gracias por querer aportar! Este proyecto nació en directo en Twitch y las mejoras
de la comunidad son bienvenidas. Aquí va lo que necesitas saber.

## Cómo funciona (importante)

- **Nadie puede subir cambios directamente a este repositorio.** Todas las
  contribuciones pasan por *Pull Request* y **solo el autor decide qué se acepta**.
- No pasa nada si tu PR no se acepta o se pide cambiarlo: el juego tiene una
  dirección de diseño muy marcada (fidelidad al lore de la wiki, determinismo,
  cero dependencias).

## Pasos para contribuir

1. Haz un **fork** de este repositorio (botón «Fork» arriba a la derecha).
2. Clona tu fork y crea una rama: `git checkout -b mi-mejora`
3. Haz tus cambios y pruébalos abriendo `game/index.html` en el navegador.
4. Sube la rama a tu fork y abre un **Pull Request** contra `main`.
5. Explica en el PR **qué** cambia y **por qué** (capturas o clips ayudan mucho).

## Reglas del código

- **JavaScript vanilla + Canvas. Sin dependencias, sin build tools, sin npm.**
  (La única excepción, ya vendorizada, es Three.js r147.)
- Todo el contenido, la interfaz y los comentarios van en **español**
  (los títulos de la wiki como `Level 0` o `Faceling` quedan en inglés).
- Nada de `Math.random()` en lógica de juego: toda la aleatoriedad pasa por
  `RNG.create(seed)` para que las partidas sean reproducibles por semilla.
- Si tocas fichas en `data/game/*.es.json`, ejecuta `node pipeline/build-data.js`
  e incluye el `game/js/data.js` regenerado en el PR.
- El contenido nuevo (niveles, entidades, objetos) debe ser **fiel a la wiki**
  de backrooms.fandom.com y conservar su `url`.
- Lee `CLAUDE.md`: es la documentación técnica más completa de la arquitectura.

## Bugs e ideas

Abre un **Issue** describiendo el problema (con la semilla de la partida si
aplica: aparece en la pantalla de título) o la propuesta. Para ideas de diseño
grandes, mejor coméntalas primero en un Issue antes de programar nada.

## Licencia de tus contribuciones

Este proyecto usa la licencia **PolyForm Noncommercial 1.0.0** (ver `LICENSE.md`):
cualquiera puede usar y modificar el juego sin fines comerciales.

Al enviar un Pull Request **aceptas que tu contribución se licencia bajo esos
mismos términos** y, además, **concedes al autor del proyecto una licencia
perpetua, irrevocable, mundial y gratuita para usar, modificar, sublicenciar y
relicenciar tu contribución, incluidos usos comerciales**. En cristiano: si algún
día el juego se vende, el autor puede incluir tu aportación sin pedirte permiso
de nuevo (y tú sigues apareciendo como contribuidor en el historial).

Si no estás de acuerdo con esto, no envíes el PR.
