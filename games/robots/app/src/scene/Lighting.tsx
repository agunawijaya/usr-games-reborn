// Light: a warm "sun" key light with real shadows (robots hover, so their
// shadows sit apart from them), a cool magenta-cyan rim from behind, a
// hemisphere fill, and an environment map built at load from a few light
// panels (drei Lightformers, no image files) so the paint and chrome have
// something to reflect.

import { Environment, Lightformer } from '@react-three/drei';

export function Lighting({ shadows, level }: Readonly<{ shadows: boolean; level: number }>) {
  // rising pressure: the key light cools and dims a little as levels fill up
  const p = Math.min(level, 4) - 1;
  return (
    <>
      <hemisphereLight args={['#6cc4e8', '#0a1520', 0.75 - p * 0.06]} />
      <directionalLight
        position={[22, 34, 14]}
        intensity={2.4 - p * 0.18}
        color="#fff0dc"
        castShadow={shadows}
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
        shadow-camera-left={-40}
        shadow-camera-right={40}
        shadow-camera-top={30}
        shadow-camera-bottom={-30}
        shadow-camera-near={1}
        shadow-camera-far={140}
        shadow-bias={-0.0004}
        shadow-normalBias={0.03}
      />
      <directionalLight position={[-26, 12, -30]} intensity={0.5} color="#9a6bff" />
      <directionalLight position={[-30, 8, 20]} intensity={0.35} color="#4cc9f0" />
      <Environment resolution={128} frames={1}>
        <Lightformer form="rect" intensity={3} color="#8fe6ff" position={[0, 6, -10]} scale={[20, 4, 1]} />
        <Lightformer form="rect" intensity={2} color="#ffffff" position={[10, 8, 8]} scale={[8, 8, 1]} />
        <Lightformer form="rect" intensity={1.5} color="#ff4fa3" position={[-12, 3, 4]} scale={[4, 10, 1]} />
        <Lightformer form="circle" intensity={4} color="#fff2d6" position={[14, 14, -6]} scale={3} />
      </Environment>
    </>
  );
}
