// trek/fancy-web — Command grammar parser
//
// BSD trek grammar (partial, adapted for text input):
//
//   command := verb [args...]
//
// Verbs:
//   phaser <energy>            fire phasers with N units
//   torpedo <bearing>          fire torpedo at bearing 0..12
//   move <course> <warp>       move ship (course 0..12, warp 0.5..8)
//   warp <factor>              set warp factor (deprecated — use `move`)
//   srscan                     short-range scan (current quadrant)
//   lrscan                     long-range scan (adjacent quadrants)
//   damages                    damage report
//   dock                       dock at adjacent starbase
//   shields up / down          raise / lower shields
//   shields <n>                transfer N energy to shields
//   computer                   show trajectory calculator
//   help                       command list
//   quit                       end mission

export const PARSE = { OK: 'OK', ERROR: 'ERROR' };

const HELP_TOKENS = {
  phaser:   'phaser <energy>  — fire phasers with N units (e.g., phaser 500)',
  torpedo:  'torpedo <bearing 0..12>  — fire torpedo at clock bearing (0=E, 3=N, 6=W, 9=S)',
  move:     'move <course 0..12> <warp 0.5..8>  — move ship',
  warp:     'warp <factor>  — quick move at warp factor',
  impulse:  'impulse <course 0..12>  — impulse move (short-range within sector)',
  srscan:   'srscan  — short-range scan (current quadrant)',
  lrscan:   'lrscan  — long-range scan (adjacent quadrants)',
  damages:  'damages  — damage report',
  dock:     'dock  — dock at adjacent starbase',
  shields:  'shields up | shields down | shields <n>  — raise/lower or transfer energy',
  computer: 'computer  — trajectory calculator',
  quit:     'quit  — end mission',
  help:     'help [command]  — command list or specific command help',
};

export function parseCommand(input) {
  const s = input.trim().toLowerCase();
  if (s === '') return { status: PARSE.ERROR, error: 'Empty command' };

  const tokens = s.split(/\s+/);
  const verb = tokens[0];

  switch (verb) {
    case 'phaser':
    case 'phasers':
    case 'p': {
      const energy = parseFloat(tokens[1]);
      if (!Number.isFinite(energy) || energy <= 0) {
        return { status: PARSE.ERROR, error: 'phaser <energy> (positive number)' };
      }
      return { status: PARSE.OK, cmd: { action: 'phaser', energy: Math.floor(energy) } };
    }

    case 'torpedo':
    case 'torpedoes':
    case 'photon':
    case 't': {
      const bearing = parseFloat(tokens[1]);
      if (!Number.isFinite(bearing) || bearing < 0 || bearing > 12) {
        return { status: PARSE.ERROR, error: 'torpedo <bearing 0..12>' };
      }
      return { status: PARSE.OK, cmd: { action: 'torpedo', bearing } };
    }

    case 'move':
    case 'm': {
      const course = parseFloat(tokens[1]);
      const warp = parseFloat(tokens[2] ?? '1');
      if (!Number.isFinite(course) || course < 0 || course > 12) {
        return { status: PARSE.ERROR, error: 'move <course 0..12> <warp 0.5..8>' };
      }
      if (!Number.isFinite(warp) || warp < 0.1 || warp > 8) {
        return { status: PARSE.ERROR, error: 'warp factor 0.5 to 8' };
      }
      return { status: PARSE.OK, cmd: { action: 'move', course, warp } };
    }

    case 'warp':
    case 'w': {
      // shortcut for "warp N" — needs a course too. Accept course as 2nd arg.
      const warp = parseFloat(tokens[1]);
      const course = parseFloat(tokens[2] ?? '0');
      if (!Number.isFinite(warp)) return { status: PARSE.ERROR, error: 'warp <factor> [course]' };
      return { status: PARSE.OK, cmd: { action: 'move', course, warp } };
    }

    case 'impulse':
    case 'i': {
      const course = parseFloat(tokens[1]);
      if (!Number.isFinite(course)) return { status: PARSE.ERROR, error: 'impulse <course 0..12>' };
      return { status: PARSE.OK, cmd: { action: 'move', course, warp: 0.5 } };
    }

    case 'srscan':
    case 'sr':
      return { status: PARSE.OK, cmd: { action: 'srscan' } };

    case 'lrscan':
    case 'lr':
      return { status: PARSE.OK, cmd: { action: 'lrscan' } };

    case 'damages':
    case 'd':
    case 'damage':
      return { status: PARSE.OK, cmd: { action: 'damages' } };

    case 'dock':
      return { status: PARSE.OK, cmd: { action: 'dock' } };

    case 'shields':
    case 'sh':
    case 's': {
      const arg = tokens[1];
      if (arg === 'up' || arg === 'u') {
        return { status: PARSE.OK, cmd: { action: 'shieldUp' } };
      }
      if (arg === 'down' || arg === 'd') {
        return { status: PARSE.OK, cmd: { action: 'shieldDown' } };
      }
      const n = parseFloat(arg);
      if (Number.isFinite(n) && n > 0) {
        return { status: PARSE.OK, cmd: { action: 'shieldTransfer', amount: Math.floor(n) } };
      }
      return { status: PARSE.ERROR, error: 'shields up | shields down | shields <n>' };
    }

    case 'computer':
    case 'c':
      return { status: PARSE.OK, cmd: { action: 'computer' } };

    case 'quit':
    case 'q':
    case 'exit':
      return { status: PARSE.OK, cmd: { action: 'quit' } };

    case 'help':
    case 'h':
    case '?': {
      const which = tokens[1];
      if (which && HELP_TOKENS[which]) {
        return { status: PARSE.OK, cmd: { action: 'help', text: HELP_TOKENS[which] } };
      }
      const all = Object.values(HELP_TOKENS).join('\n');
      return { status: PARSE.OK, cmd: { action: 'help', text: all } };
    }

    default:
      return { status: PARSE.ERROR, error: `Unknown command: ${verb}. Type 'help' for list.` };
  }
}

export function describeCommand(cmd) {
  switch (cmd.action) {
    case 'phaser':    return `Fire phasers with ${cmd.energy} energy units`;
    case 'torpedo':   return `Fire torpedo, bearing ${cmd.bearing.toFixed(1)}`;
    case 'move':      return `Move — course ${cmd.course.toFixed(1)}, warp ${cmd.warp}`;
    case 'srscan':    return `Short-range scan`;
    case 'lrscan':    return `Long-range scan`;
    case 'damages':   return `Damage report`;
    case 'dock':      return `Dock at starbase`;
    case 'shieldUp':  return `Raise shields`;
    case 'shieldDown':return `Lower shields`;
    case 'shieldTransfer': return `Transfer ${cmd.amount} energy to shields`;
    case 'computer':  return `Compute trajectory`;
    case 'help':      return `Help`;
    case 'quit':      return `End mission`;
    default:          return cmd.action;
  }
}
