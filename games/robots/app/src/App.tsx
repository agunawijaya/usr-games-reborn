import { Game } from './Game';
import { quality } from './fx/store';

// Without WebGL there is no scene to draw: say so, and say how to fix it,
// instead of leaving a blank page.
function NoWebGL() {
  return (
    <div className="rr-root rr-nogl">
      <div className="rr-card">
        <div className="rr-logo">ROBOTS</div>
        <p>This version draws a 3D scene and needs <b>WebGL</b>, which this browser has switched off or cannot provide.</p>
        <p>Turn on <i>hardware acceleration</i> (or <i>use graphics acceleration when available</i>) in the browser settings and reload, or try another browser.</p>
      </div>
    </div>
  );
}

export function App() {
  return quality.webgl ? <Game /> : <NoWebGL />;
}
