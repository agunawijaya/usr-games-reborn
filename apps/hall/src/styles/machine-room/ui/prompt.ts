import type { RankId } from '@usr-games/kit/progression';
import { type Child, h } from '../../../ui/h';

/**
 * The prompt line at the top of the room: `staff@usr-games:~$ ps aux`. The user part is the
 * player's rank, so ranking up literally rewrites the prompt; the command echoes the screen.
 */
export interface PromptOptions {
  rank: RankId;
  cwd: string;
  command: string;
}

/** Pixel fonts draw `~` as a raised mark; wrapping it lets a theme swap in a clearer face. */
function withTildes(text: string): Child[] {
  return text
    .split(/(~)/)
    .map((part) => (part === '~' ? h('span', { class: 'prompt__tilde' }, '~') : part));
}

export function promptLine({ rank, cwd, command }: PromptOptions): HTMLElement {
  return h(
    'div',
    { class: 'prompt', 'aria-hidden': 'true' },
    h('span', { class: 'prompt__user', dataset: { rank } }, rank),
    h('span', { class: 'prompt__punct' }, '@'),
    h('span', { class: 'prompt__host' }, 'usr-games'),
    h('span', { class: 'prompt__punct' }, ':'),
    h('span', { class: 'prompt__cwd' }, withTildes(cwd)),
    h('span', { class: 'prompt__punct' }, '$'),
    h('span', { class: 'prompt__cmd' }, withTildes(command)),
    h('span', { class: 'cursor' }),
  );
}
