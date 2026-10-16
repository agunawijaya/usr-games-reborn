import { page } from './pages';

/**
 * Settings: the game's own switches. Volume and mute are the Hall's, so the page points there
 * rather than keeping a second slider that could disagree with it.
 */

export interface SettingsView {
  readonly effects: boolean;
  readonly music: boolean;
  readonly cinematics: boolean;
  readonly mapView: boolean;
  readonly quality: 'auto' | 'full' | 'light';
  readonly coach: boolean;
  readonly reducedMotion: boolean;
}

function choice(
  name: string,
  value: string,
  chosen: string,
  title: string,
  detail: string,
): string {
  return `<label class="dd-choice"><input type="radio" name="${name}" data-field="${name}" value="${value}" ${value === chosen ? 'checked' : ''}/><span><strong>${title}</strong><small>${detail}</small></span></label>`;
}

function toggle(field: string, on: boolean, title: string, detail: string): string {
  return `<label class="dd-choice"><input type="checkbox" data-field="${field}" ${on ? 'checked' : ''}/><span><strong>${title}</strong><small>${detail}</small></span></label>`;
}

export function renderSettings(root: HTMLElement, view: SettingsView): HTMLElement {
  const motion = view.reducedMotion
    ? '<p class="dd-setup-note">Your system asks for reduced motion, so the camera cuts instead of gliding and buildings appear without their stop-motion, whatever the switches say.</p>'
    : '';
  const body = `<header class="dd-sheet-head"><p class="dd-moment-kicker">Settings</p><h2>The way the table feels</h2></header>
    <div class="dd-settings">
      <fieldset><legend>Sound</legend>
        ${toggle('effects', view.effects, 'Sound effects', 'Dice, coins, cards and the board’s own sounds: surf and gulls, the colony’s hum, a quiet study.')}
        ${toggle('music', view.music, 'Music', 'Each board’s tune: a waltz on the quay, slow light over the ring, a music box on the desk.')}
        <p class="dd-setup-note">Volume and mute are the Hall’s. <button type="button" class="dd-link" data-act="hall-settings">Open the Hall’s settings</button></p>
      </fieldset>
      <fieldset><legend>Picture</legend>
        ${toggle('cinematics', view.cinematics, 'Cinematics', 'The camera follows the tokens and swings to each building and celebration. Off, it stays on the whole board.')}
        ${toggle('mapView', view.mapView, 'Map view', 'Play on a flat map of the board instead of the miniature town: quicker to read, and kind to slower machines. V switches during a game.')}
      </fieldset>
      <fieldset><legend>Graphics</legend>
        ${choice('quality', 'auto', view.quality, 'Automatic', 'Full detail, stepping down to light if the town cannot keep a smooth pace.')}
        ${choice('quality', 'full', view.quality, 'Full', 'Shadows, the miniature’s soft focus and the glow of lights at night.')}
        ${choice('quality', 'light', view.quality, 'Light', 'No shadows or soft focus: flatter, and much easier on the machine.')}
      </fieldset>
      <fieldset><legend>Help</legend>
        ${toggle('coach', view.coach, 'Coach in new games', 'Landing heat, payback times and a trade meter. Your best worth counts only from games without it; the Daily Deal never has it.')}
      </fieldset>
      ${motion}
    </div>`;
  return page(root, 'dd-settings-page', 'Settings', body);
}
