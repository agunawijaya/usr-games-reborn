// The Hall loads these faces for every game; the workbench borrows the Hall's copies.
import '../../../apps/hall/node_modules/@fontsource-variable/bricolage-grotesque/wght.css';
import '../../../apps/hall/node_modules/@fontsource-variable/fredoka/wght.css';
import '../../../apps/hall/node_modules/@fontsource-variable/fraunces/soft.css';
import '../../../apps/hall/node_modules/@fontsource/atkinson-hyperlegible-next/latin-400.css';
import '../../../apps/hall/node_modules/@fontsource/atkinson-hyperlegible-next/latin-700.css';
import '../../../apps/hall/node_modules/@fontsource/ibm-plex-mono/latin-500.css';
import '../../../apps/hall/node_modules/@fontsource/ibm-plex-mono/latin-600.css';

/** Resolves once every face a board's signs and panels draw with is ready for canvas text. */
export async function fontsReady(): Promise<void> {
  await Promise.all(
    [
      "700 40px 'Bricolage Grotesque Variable'",
      "600 40px 'Fredoka Variable'",
      "700 40px 'Fraunces Variable'",
      "400 20px 'Atkinson Hyperlegible Next'",
      "700 20px 'Atkinson Hyperlegible Next'",
      "500 20px 'IBM Plex Mono'",
    ].map((face) => document.fonts.load(face)),
  );
}
