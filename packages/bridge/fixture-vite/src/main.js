// The hosted-vite path: the bridge comes from the workspace package and is bundled by this
// game's own Vite build, which the Hall's build runs with `--base /play/fixture-vite/`.
import { connectToHall } from '@usr-games/bridge';
import '../../fixture/fixture.css';
import '../../fixture/fixture.js';

window.startFixtureGame(connectToHall, {
  id: 'fixture-vite',
  title: 'Bridge fixture (Vite build)',
});
