// Control Room 1986 — the controller's settings: the order buttons, the radar's text size, the
// reference card and the first-shift tips. Pure: main.js loads and saves them (store.js). The
// sound, voice and subtitle switches keep the upstream game's own keys (see main.js).

export const TEXT_SIZES = ['standard', 'large', 'xlarge'];
export const TEXT_SIZE_LABELS = { standard: 'Standard', large: 'Large', xlarge: 'Extra large' };
/** How much larger than Standard the radar's lettering is drawn at each size. */
export const TEXT_SCALE = { standard: 1, large: 1.25, xlarge: 1.5 };

/**
 * A controller who has typed this many orders already speaks the language, so the order buttons
 * start switched off for them (the switch still turns them on).
 */
export const TYPED_ORDERS_FOR_BUTTONS_OFF = 50;

/** The three first-shift tips, in the order they appear. */
export const TIPS = ['select', 'press', 'watch'];

/**
 * @typedef {object} Settings
 * @property {boolean | null} orderButtons  null until the controller turns the switch
 * @property {'standard' | 'large' | 'xlarge'} textSize
 * @property {boolean} reference            the reference card is docked open
 * @property {string[]} tipsDone            tips dismissed or done; they never come back
 */

/** @returns {Settings} */
export function newSettings() {
  return { orderButtons: null, textSize: 'standard', reference: false, tipsDone: [] };
}

/** A saved settings object with anything missing or unknown put back to its default. */
export function withDefaults(saved) {
  const fresh = newSettings();
  const value = saved && typeof saved === 'object' ? saved : {};
  return {
    orderButtons: typeof value.orderButtons === 'boolean' ? value.orderButtons : fresh.orderButtons,
    textSize: TEXT_SIZES.includes(value.textSize) ? value.textSize : fresh.textSize,
    reference: typeof value.reference === 'boolean' ? value.reference : fresh.reference,
    tipsDone: Array.isArray(value.tipsDone) ? value.tipsDone.filter((tip) => TIPS.includes(tip)) : [],
  };
}

/** Orders the controller typed by hand over the whole service record. */
export function typedOrders(service) {
  return Math.max(0, (service.orders ?? 0) - (service.buttonOrders ?? 0));
}

/**
 * Whether the order buttons show: the controller's own choice once made; before that, on for a
 * new career and off for one whose record shows the typed language is already in hand.
 */
export function orderButtonsOn(settings, service) {
  if (settings.orderButtons !== null) return settings.orderButtons;
  return typedOrders(service) < TYPED_ORDERS_FOR_BUTTONS_OFF;
}

/** The next text size round the three, for the key that cycles them. */
export function nextTextSize(size) {
  return TEXT_SIZES[(TEXT_SIZES.indexOf(size) + 1) % TEXT_SIZES.length];
}
