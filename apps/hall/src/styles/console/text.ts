import { type Child, h } from '../../ui/h';

/**
 * Big display titles, with hyphenated words kept whole: "Age-of-sail" should never break
 * after "Age-of-" when the type is a hundred pixels tall.
 */
export function displayTitle(title: string): Child[] {
  return title
    .split(/(\s+)/)
    .map((part) => (part.includes('-') ? h('span', { class: 'ch-nowrap' }, part) : part));
}
