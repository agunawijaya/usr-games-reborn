/**
 * The words at the end of a run, and the hints during one. Calm and kind: a full tank is only a
 * full tank, and the water always clears for the next dive.
 */

export interface EndingText {
  title: string;
  story: string;
}

export const ENDINGS = {
  diveRows: {
    title: 'Dive complete!',
    story: 'Every row you needed has burst into bubbles. The tank settles, bright and calm.',
  },
  diveCoral: {
    title: 'Coral cleared!',
    story: 'The last piece of coral has floated free. The floor of the tank shines again.',
  },
  tankFull: {
    title: 'The tank is full',
    story:
      'The sinkers reached the surface. The water clouds over for a moment, then clears for another go.',
  },
  marathon: {
    title: 'The tank is full',
    story:
      'A long dive, and the water still glows from it. Each starting level keeps its own record.',
  },
  classic: {
    title: 'The well is full',
    story:
      'Counted the way the 1992 program counted: every landing and every row dropped, times the level.',
  },
  daily: {
    title: 'A hundred sinkers down',
    story: 'Today’s hundred sinkers have all come to rest. Everyone dived the same ones.',
  },
  tutorial: {
    title: 'Ready to dive',
    story:
      'In a real dive the sinkers sink on their own, faster at every level. Plunge often: a burst pays more for every plunge before it.',
  },
} satisfies Record<string, EndingText>;

/** The keys, shown for a moment as a run begins. */
export const START_HINT = '← → slide · ↑ turn · ↓ sink · Space plunge';
export const CLASSIC_HINT = '← → or J L slide · ↑ or K turns left · Space drops';
