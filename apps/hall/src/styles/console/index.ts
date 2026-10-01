import './fonts';
import './console.css';
import type { StyleModule } from '../../core/style-module';
import { previewConsole, startConsole } from './shell';

/** Console Home: big living art for every game, one row to browse, one button to play. */
const consoleHome: StyleModule = {
  id: 'console',
  start: startConsole,
  preview: previewConsole,
};

export default consoleHome;
