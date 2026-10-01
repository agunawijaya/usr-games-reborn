import type { CSSProperties } from 'react';

type Props = Readonly<{ onClose: () => void }>;

export function HelpPanel({ onClose }: Props) {
  return (
    <div style={backdropStyle} onClick={onClose}>
      <div style={panelStyle} onClick={(e) => e.stopPropagation()}>
        <button style={closeButtonStyle} onClick={onClose} aria-label="Close">
          ×
        </button>

        <h2 style={h2Style}>How to Play Robots</h2>

        <section style={sectionStyle}>
          <h3 style={h3Style}>Goal</h3>
          <p style={pStyle}>
            You cannot win. Survive as long as possible; every cleared level
            adds more robots (up to 40). Robots move one cell toward you every
            turn — outmaneuver them.
          </p>
        </section>

        <section style={sectionStyle}>
          <h3 style={h3Style}>Movement (one step per turn)</h3>
          <table style={tableStyle}>
            <tbody>
              <tr>
                <td style={keyCellStyle}>
                  <kbd style={kbdStyle}>7</kbd> <kbd style={kbdStyle}>8</kbd>{' '}
                  <kbd style={kbdStyle}>9</kbd>
                </td>
                <td rowSpan={3} style={{ verticalAlign: 'middle' }}>
                  numpad / number-row — 8 directions.{' '}
                  <kbd style={kbdStyle}>5</kbd> = skip turn.
                </td>
              </tr>
              <tr>
                <td style={keyCellStyle}>
                  <kbd style={kbdStyle}>4</kbd> <kbd style={kbdStyle}>5</kbd>{' '}
                  <kbd style={kbdStyle}>6</kbd>
                </td>
              </tr>
              <tr>
                <td style={keyCellStyle}>
                  <kbd style={kbdStyle}>1</kbd> <kbd style={kbdStyle}>2</kbd>{' '}
                  <kbd style={kbdStyle}>3</kbd>
                </td>
              </tr>
              <tr>
                <td style={keyCellStyle}>
                  <kbd style={kbdStyle}>h</kbd>{' '}
                  <kbd style={kbdStyle}>j</kbd>{' '}
                  <kbd style={kbdStyle}>k</kbd>{' '}
                  <kbd style={kbdStyle}>l</kbd>
                </td>
                <td>west / south / north / east (vi-style)</td>
              </tr>
              <tr>
                <td style={keyCellStyle}>
                  <kbd style={kbdStyle}>y</kbd>{' '}
                  <kbd style={kbdStyle}>u</kbd>{' '}
                  <kbd style={kbdStyle}>b</kbd>{' '}
                  <kbd style={kbdStyle}>n</kbd>
                </td>
                <td>diagonals (vi-style)</td>
              </tr>
              <tr>
                <td style={keyCellStyle}>
                  <kbd style={kbdStyle}>↑</kbd>{' '}
                  <kbd style={kbdStyle}>↓</kbd>{' '}
                  <kbd style={kbdStyle}>←</kbd>{' '}
                  <kbd style={kbdStyle}>→</kbd>
                </td>
                <td>arrow keys, cardinal only</td>
              </tr>
              <tr>
                <td style={keyCellStyle}>
                  <kbd style={kbdStyle}>.</kbd> /{' '}
                  <kbd style={kbdStyle}>space</kbd>
                </td>
                <td>skip turn (robots still advance)</td>
              </tr>
            </tbody>
          </table>
        </section>

        <section style={sectionStyle}>
          <h3 style={h3Style}>Special commands</h3>
          <table style={tableStyle}>
            <tbody>
              <tr>
                <td style={keyCellStyle}>
                  <kbd style={kbdStyle}>t</kbd>
                </td>
                <td>
                  <b>Teleport</b> to a random empty cell — risky, you may land
                  right next to a robot.
                </td>
              </tr>
              <tr>
                <td style={keyCellStyle}>
                  <kbd style={kbdStyle}>w</kbd> / <kbd style={kbdStyle}>&gt;</kbd>
                </td>
                <td>
                  <b>Auto-wait</b> — starts a running wait. Each turn plays out
                  visibly (~190 ms per turn) with robots stepping one cell at a
                  time. The wait ends when: (a) the level clears, (b) a robot
                  would land on you next turn (safe-stop keeps you alive), or
                  (c) you press any other key to interrupt. Wait-bonus points
                  accrue for every robot destroyed during the wait.
                </td>
              </tr>
              <tr>
                <td style={keyCellStyle}>
                  <kbd style={kbdStyle}>p</kbd>
                </td>
                <td>
                  <b>Danger preview</b> on / off — red squares where a robot
                  can reach next turn (dimmer on scrap piles), and an arrow
                  toward each robot's next step.
                </td>
              </tr>
              <tr>
                <td style={keyCellStyle}>
                  <kbd style={kbdStyle}>m</kbd>
                </td>
                <td>sound on / off (off until you switch it on)</td>
              </tr>
              <tr>
                <td style={keyCellStyle}>
                  <kbd style={kbdStyle}>+</kbd> <kbd style={kbdStyle}>−</kbd>
                </td>
                <td>zoom in / out (also mouse wheel) — out far enough and the stadium is a star; zoomed in, the camera follows you</td>
              </tr>
              <tr>
                <td style={keyCellStyle}>
                  <kbd style={kbdStyle}>Enter</kbd>
                </td>
                <td>
                  after a level is cleared: go on to the next level (or
                  stay and watch the fireworks as long as you like)
                </td>
              </tr>
              <tr>
                <td style={keyCellStyle}>
                  <kbd style={kbdStyle}>?</kbd>
                </td>
                <td>toggle this help</td>
              </tr>
            </tbody>
          </table>
        </section>

        <section style={sectionStyle}>
          <h3 style={h3Style}>Scoring</h3>
          <ul style={ulStyle}>
            <li>
              <b style={{ color: '#4cc9f0' }}>+10</b> every time a robot is
              destroyed.
            </li>
            <li>
              <b style={{ color: '#ffbe0b' }}>+1 extra</b> per robot killed
              while <kbd style={kbdStyle}>w</kbd>-waiting. This "wait bonus"
              accumulates during a level and is added to your score when the
              level clears.
            </li>
            <li>
              There is no win condition — the score at time of death is your
              result.
            </li>
          </ul>
        </section>

        <section style={sectionStyle}>
          <h3 style={h3Style}>How robots die</h3>
          <ul style={ulStyle}>
            <li>
              Two robots landing on the same cell → both destroyed, forms a
              scrap pile.
            </li>
            <li>
              Robot walking onto an existing scrap pile → robot destroyed, pile
              persists.
            </li>
            <li>
              A pile is a permanent obstacle for the rest of the level.
            </li>
          </ul>
        </section>

        <section style={sectionStyle}>
          <h3 style={h3Style}>How you die</h3>
          <ul style={ulStyle}>
            <li>Stepping onto a robot or a scrap pile — instant death.</li>
            <li>
              A robot moving onto your cell during its turn — instant death.
            </li>
          </ul>
        </section>

        <section style={sectionStyle}>
          <h3 style={h3Style}>Strategy tips</h3>
          <ul style={ulStyle}>
            <li>
              Use piles as walls — line multiple robots up so they crash into
              the same cell.
            </li>
            <li>
              <kbd style={kbdStyle}>w</kbd>-wait is powerful when robots are
              already committed to a fatal path.
            </li>
            <li>
              Teleport is a last resort — the destination is uniformly random
              among empty cells.
            </li>
          </ul>
        </section>

        <button style={primaryButtonStyle} onClick={onClose} autoFocus>
          Got it
        </button>
      </div>
    </div>
  );
}

// -----------------------------------------------------------------------------
// Styles

const backdropStyle: CSSProperties = {
  position: 'absolute',
  inset: 0,
  background: 'rgba(5, 9, 18, 0.82)',
  backdropFilter: 'blur(6px)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: '1rem',
  overflow: 'auto',
  zIndex: 10,
};

const panelStyle: CSSProperties = {
  background: '#0d1b2a',
  border: '1px solid #3a86a8',
  borderRadius: '0.75rem',
  padding: '2rem 2.25rem',
  maxWidth: '620px',
  width: '100%',
  color: '#e5eef7',
  fontSize: '0.9rem',
  lineHeight: 1.55,
  boxShadow: '0 20px 60px rgba(0, 0, 0, 0.6)',
  position: 'relative',
};

const closeButtonStyle: CSSProperties = {
  position: 'absolute',
  top: '0.75rem',
  right: '0.9rem',
  background: 'transparent',
  border: 'none',
  color: '#e5eef7',
  fontSize: '1.5rem',
  lineHeight: 1,
  cursor: 'pointer',
  padding: '0.25rem 0.5rem',
};

const h2Style: CSSProperties = {
  margin: '0 0 1.25rem 0',
  color: '#4cc9f0',
  fontSize: '1.35rem',
};

const sectionStyle: CSSProperties = {
  marginBottom: '1.15rem',
};

const h3Style: CSSProperties = {
  margin: '0 0 0.4rem 0',
  fontSize: '0.95rem',
  color: '#f72585',
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
};

const pStyle: CSSProperties = { margin: 0 };

const ulStyle: CSSProperties = {
  margin: 0,
  paddingLeft: '1.2rem',
};

const tableStyle: CSSProperties = {
  width: '100%',
  borderCollapse: 'collapse',
};

const keyCellStyle: CSSProperties = {
  padding: '0.15rem 0.4rem 0.15rem 0',
  whiteSpace: 'nowrap',
  width: '30%',
};

const kbdStyle: CSSProperties = {
  fontFamily: '"JetBrains Mono", ui-monospace, monospace',
  fontSize: '0.8em',
  background: '#1a2b3d',
  border: '1px solid #3a86a8',
  padding: '0.05rem 0.35rem',
  borderRadius: '0.25rem',
  color: '#4cc9f0',
};

const primaryButtonStyle: CSSProperties = {
  fontFamily: 'inherit',
  fontSize: '1rem',
  fontWeight: 600,
  color: '#0d1b2a',
  background: '#4cc9f0',
  border: 'none',
  borderRadius: '0.4rem',
  padding: '0.55rem 1.4rem',
  cursor: 'pointer',
  marginTop: '0.5rem',
};
