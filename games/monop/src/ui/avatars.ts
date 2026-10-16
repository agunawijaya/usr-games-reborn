import type { PersonalityId } from '../engine/rivals';

/**
 * The rivals' portraits: flat badges drawn in SVG on a 64 × 64 grid. Each has one thing you
 * remember them by: Marlowe's hard hat, Ottilie's round glasses, Colette's beret, Dex's flat
 * cap and bow tie, Stella's headband.
 */

interface Look {
  backdrop: string;
  skin: string;
  hair: string;
  details: string;
}

const face = (skin: string) =>
  `<circle cx="32" cy="35" r="15" fill="${skin}"/><circle cx="26.5" cy="34" r="1.8" fill="#1d2230"/><circle cx="37.5" cy="34" r="1.8" fill="#1d2230"/><path d="M26 41c3.5 3 8.5 3 12 0" stroke="#1d2230" stroke-width="2" fill="none" stroke-linecap="round"/><circle cx="23" cy="39" r="2.4" fill="#ff8f8f" opacity="0.45"/><circle cx="41" cy="39" r="2.4" fill="#ff8f8f" opacity="0.45"/>`;

const LOOKS: Readonly<Record<PersonalityId, Look>> = {
  builder: {
    backdrop: '#ffb84a',
    skin: '#e8b48f',
    hair: '#5a3a24',
    details:
      '<path d="M15 27a17 15 0 0 1 34 0z" fill="#ffd23f" stroke="#c8961a" stroke-width="1.5"/><rect x="12" y="26" width="40" height="4" rx="2" fill="#f2b21b"/><rect x="30" y="13" width="4" height="13" rx="2" fill="#e3a30f"/><path d="M25 44c4 -2 10 -2 14 0" stroke="#5a3a24" stroke-width="3.5" stroke-linecap="round"/>',
  },
  saver: {
    backdrop: '#9ad0c2',
    skin: '#f1cfb4',
    hair: '#c9c9d4',
    details:
      '<circle cx="32" cy="14" r="7" fill="#c9c9d4"/><path d="M17 32c0-12 30-12 30 0c-4-6-26-6-30 0z" fill="#c9c9d4"/><circle cx="26.5" cy="34" r="4.6" fill="none" stroke="#3a3a4a" stroke-width="1.8"/><circle cx="37.5" cy="34" r="4.6" fill="none" stroke="#3a3a4a" stroke-width="1.8"/><path d="M31 34h2" stroke="#3a3a4a" stroke-width="1.8"/><circle cx="24" cy="52" r="1.8" fill="#fff"/><circle cx="29" cy="53.5" r="1.8" fill="#fff"/><circle cx="35" cy="53.5" r="1.8" fill="#fff"/><circle cx="40" cy="52" r="1.8" fill="#fff"/>',
  },
  collector: {
    backdrop: '#c9a7ff',
    skin: '#c98f6a',
    hair: '#2b1d2e',
    details:
      '<path d="M16 38c-2-14 6-22 16-22s18 8 16 22c-2-6-4-10-8-12-6 4-14 4-24 12z" fill="#2b1d2e"/><ellipse cx="34" cy="18" rx="15" ry="5.5" fill="#e0384a"/><circle cx="34" cy="13" r="2" fill="#e0384a"/><circle cx="17.5" cy="41" r="2" fill="#ffd23f"/><circle cx="46.5" cy="41" r="2" fill="#ffd23f"/>',
  },
  dealmaker: {
    backdrop: '#7fc8ff',
    skin: '#d9a07a',
    hair: '#3a2a1e',
    details:
      '<path d="M16 26c2-9 9-13 16-13s14 4 16 13z" fill="#4a5a6e"/><rect x="14" y="24" width="30" height="4" rx="2" fill="#3a4658"/><path d="M27 41c3 4.5 7 4.5 10 0" stroke="#1d2230" stroke-width="2.2" fill="#fff" stroke-linecap="round"/><path d="M25 52l7 3 7-3-7-3z" fill="#e0384a"/><circle cx="32" cy="52" r="1.6" fill="#a8202f"/>',
  },
  steady: {
    backdrop: '#9fe08a',
    skin: '#a9714f',
    hair: '#1d1a24',
    details:
      '<path d="M17 34c-1-13 7-19 15-19s16 6 15 19c-3-6-6-9-15-10-9 1-12 4-15 10z" fill="#1d1a24"/><path d="M47 26c6 2 8 10 4 16" stroke="#1d1a24" stroke-width="5" fill="none" stroke-linecap="round"/><path d="M17.5 25.5c8-6 21-6 29 0" stroke="#2fae64" stroke-width="3.5" fill="none" stroke-linecap="round"/>',
  },
};

/** A rival's portrait as an SVG string, `size` pixels square. */
export function portrait(id: PersonalityId, size = 48): string {
  const look = LOOKS[id];
  return `<svg class="dd-portrait" viewBox="0 0 64 64" width="${size}" height="${size}" aria-hidden="true"><circle cx="32" cy="32" r="31" fill="${look.backdrop}"/><path d="M14 64c2-10 9-14 18-14s16 4 18 14z" fill="#ffffff" opacity="0.85"/>${face(look.skin)}${look.details}</svg>`;
}
