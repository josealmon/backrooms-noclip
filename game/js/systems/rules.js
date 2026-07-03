// Reglas ambientales por nivel, derivadas de las descripciones de la wiki.
// Cada regla es un hook que se ejecuta al entrar al nivel y/o cada turno.
(function () {
  const RULES = {
    zumbido: {
      nombre: 'Zumbido fluorescente',
      icono: '〰',
      desc: 'El zumbido constante de las luces erosiona tu cordura.',
      turno(world, rng) {
        if (world.turn % 10 === 0) world.sanity(-1);
      },
    },
    no_euclidiano: {
      nombre: 'Espacio no euclidiano',
      icono: '♾',
      desc: 'La topología cambia a tu espalda: lo explorado puede dejar de existir.',
      turno(world, rng) {
        if (world.turn > 0 && world.turn % 45 === 0) {
          world.forgetExplored(0.55);
          world.log('Los pasillos ya no están donde los dejaste.', 'event');
          world.sanity(-3);
        }
      },
    },
    calor: {
      nombre: 'Calor extremo',
      icono: '🔥',
      desc: 'El vapor y el calor duplican tu sed.',
      turno(world) {
        if (world.turn % 4 === 0) world.thirst(-1);
      },
    },
    frio: {
      nombre: 'Frío glacial',
      icono: '❄',
      desc: 'El frío te daña lentamente. Una chaqueta térmica lo anula.',
      turno(world) {
        if (world.turn % 8 === 0 && !world.hasItem('chaqueta')) world.hurt(1, 'el frío', true);
      },
    },
    oscuridad_total: {
      nombre: 'Oscuridad devoradora',
      icono: '●',
      desc: 'Ninguna fuente de luz funciona aquí. La visión se reduce al mínimo.',
      entrar(world) {
        world.player.luz = false;
        world.luzBloqueada = true;
      },
    },
    lluvia_acida: {
      nombre: 'Lluvia ácida',
      icono: '☔',
      desc: 'Aguaceros corrosivos barren el nivel en oleadas.',
      turno(world, rng) {
        if (world.turn % 30 === 15) {
          world.log('La lluvia ácida arrecia. Te quema la piel.', 'danger');
          world.hurt(6, 'la lluvia ácida', true);
        }
      },
    },
    hambre_extrema: {
      nombre: 'Hambre voraz',
      icono: '🍖',
      desc: 'Este nivel devora tus reservas: el hambre avanza el doble de rápido.',
      turno(world) {
        if (world.turn % 7 === 0) world.hunger(-1);
      },
    },
    alucinaciones: {
      nombre: 'Alucinaciones',
      icono: '👁',
      desc: 'Oyes y ves cosas que no existen. Tu cordura se resiente.',
      turno(world, rng) {
        if (world.turn % 12 === 0) world.sanity(-1);
        if (rng.chance(0.02)) {
          world.log(rng.pick([
            'Crujidos a tu espalda. No hay nada.',
            'Alguien susurra tu nombre.',
            'Por el rabillo del ojo, algo se mueve.',
            'Pasos. ¿Tuyos?',
          ]), 'event');
          world.sanity(-1);
        }
      },
    },
    aislamiento: {
      nombre: 'Aislamiento',
      icono: '⌀',
      desc: 'Este nivel te separa de todo ser vivo. La soledad pesa.',
      turno(world) {
        if (world.turn % 14 === 0) world.sanity(-1);
      },
    },
    tiempo_raro: {
      nombre: 'Tiempo fracturado',
      icono: '🕰',
      desc: 'Los segundos avanzan y retroceden: a veces el mundo juega dos turnos.',
      turno(world, rng) {
        if (rng.chance(0.12)) {
          world.extraWorldStep = true;
          if (rng.chance(0.3)) world.log('El reloj retrocede. O avanza. Da igual.', 'event');
        }
      },
    },
    gravedad_baja: {
      nombre: 'Gravedad reducida',
      icono: '🪶',
      desc: 'Gravedad de 2 m/s²: te desplazas a saltos de dos casillas.',
      // implementado en el movimiento del jugador
    },
    pierdes_inventario: {
      nombre: 'Despojo',
      icono: '∅',
      desc: 'Tus pertenencias no cruzan a este nivel: entras con las manos vacías.',
      entrar(world) {
        if (world.player.inv.length) {
          world.player.inv = [];
          world.log('Tu equipo ha desaparecido. Solo quedas tú.', 'danger');
        }
      },
    },
    controles_invertidos: {
      nombre: 'Reflejo invertido',
      icono: '🪞',
      desc: 'El espacio está espejado: tus movimientos se invierten.',
      // implementado en el input
    },
    niebla: {
      nombre: 'Niebla persistente',
      icono: '🌫',
      desc: 'Una niebla espesa reduce tu campo de visión.',
      entrar(world) {
        world.visionMod = -2;
      },
    },
    equipo_asesino: {
      nombre: 'Equipamiento hostil',
      icono: '⚙',
      desc: 'El instrumental del nivel cobra vida y ataca sin aviso. Tirada de dado.',
      turno(world, rng) {
        if (world.turn % 26 === 13) {
          world.rollDice('El instrumental oxidado tiembla…', (d) => {
            if (d <= 8) {
              world.hurt(10, 'un bisturí volador', true);
              world.log(`Dado: ${d}. Un bisturí cruza el aire y te alcanza.`, 'danger');
            } else {
              world.log(`Dado: ${d}. El instrumental cae inerte. Esta vez.`, 'good');
            }
          });
        }
      },
    },
    agua_traicionera: {
      nombre: 'Charcos sirena',
      icono: '💧',
      desc: 'El agua de este nivel atrae con fuerza gravitatoria a quien se acerca.',
      turno(world, rng) {
        const g = world.map.grid, p = world.player;
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const v = MapGen.at(g, p.x + dx, p.y + dy);
          if (v === 3 && rng.chance(0.25)) {
            world.hurt(8, 'un charco sirena', true);
            world.log('El agua tira de ti. Escapas empapado y magullado.', 'danger');
            break;
          }
        }
      },
    },
    vigilado: {
      nombre: 'Escopofobia',
      icono: '👀',
      desc: 'Todo en este nivel te observa. La cordura se desangra.',
      turno(world) {
        if (world.turn % 6 === 0) world.sanity(-1);
      },
    },
  };

  window.Rules = {
    get: (id) => RULES[id],
    aplicarEntrada(world) {
      for (const id of world.level.reglas || []) RULES[id]?.entrar?.(world);
    },
    aplicarTurno(world, rng) {
      for (const id of world.level.reglas || []) RULES[id]?.turno?.(world, rng);
    },
  };
})();
