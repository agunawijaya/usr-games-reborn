import { useFrame } from '@react-three/fiber';
import { createContext, useLayoutEffect, useRef } from 'react';
import type { MutableRefObject, ReactNode } from 'react';
import { Group, Vector3 } from 'three';
import { nowMs } from '../fx/clock';

// AnimatedGroup wraps its children and drives three runtime behaviors:
//
//   1. **Time-based step animation.** Each new grid target starts a step
//      that plays out over a fixed duration (`stepDurationMs`). Position
//      lerps linearly from step-start to target over that duration.
//   2. **Facing rotation.** The group rotates around Y so children's +Z
//      face points in the movement direction.
//   3. **Step arc.** The group's Y coordinate traces a parabolic hop.
//
// Also exposes `StepAnimationContext` so children (e.g. PlayerMesh) can
// synchronize their own sub-animations to the walk state.
//
// Ordering: state updates for the current step happen in
// `useLayoutEffect` so they are committed BEFORE the next useFrame runs.
// The useFrame callback here also uses `renderPriority = -1` so it
// runs before children's useFrames — children read fresh step state.

export type StepState = {
  /** Progress within the current step, 0..1. Stays at 1 when idle. */
  progress: number;
  /** True while a step is actively playing out. */
  isMoving: boolean;
  /** Monotonic counter — increments once per new step. */
  stepIndex: number;
  /** Length of the current step in squares (1, or 1.41 on a diagonal). */
  length?: number;
};

const defaultStepRef: MutableRefObject<StepState> = {
  current: { progress: 1, isMoving: false, stepIndex: 0 },
};

export const StepAnimationContext =
  createContext<MutableRefObject<StepState>>(defaultStepRef);

type Props = Readonly<{
  target: [number, number, number];
  /** Duration of a single step in milliseconds. */
  stepDurationMs?: number;
  /** Rotation lerp responsiveness. Higher = catches up faster. */
  rotationSpeed?: number;
  /** Peak Y offset at the midpoint of a step arc, in world units. */
  stepHeight?: number;
  /** When this changes, jump to the target without a step (teleport,
   *  new level). */
  snapKey?: number | string;
  /** Longer moves (diagonals) take longer: duration × √length. */
  lengthScaled?: boolean;
  children: ReactNode;
}>;

export function AnimatedGroup({
  target,
  stepDurationMs = 320,
  rotationSpeed = 15,
  stepHeight = 0.15,
  snapKey,
  lengthScaled = false,
  children,
}: Props) {
  const groupRef = useRef<Group>(null);
  const current = useRef(new Vector3(target[0], target[1], target[2]));
  const stepStart = useRef(new Vector3(target[0], target[1], target[2]));
  const stepStartTime = useRef(-Infinity); // "no step started yet"
  const rotationY = useRef(0);
  const targetRotationY = useRef(0);
  const stepRef = useRef<StepState>({
    progress: 1,
    isMoving: false,
    stepIndex: 0,
  });

  // Snap to initial position on mount.
  useLayoutEffect(() => {
    if (!groupRef.current) return;
    groupRef.current.position.set(target[0], target[1], target[2]);
    current.current.set(target[0], target[1], target[2]);
    stepStart.current.set(target[0], target[1], target[2]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Snap (teleport / new level): no step, no turn.
  const lastSnap = useRef(snapKey);
  useLayoutEffect(() => {
    if (snapKey === lastSnap.current) return;
    lastSnap.current = snapKey;
    current.current.set(target[0], target[1], target[2]);
    stepStart.current.set(target[0], target[1], target[2]);
    stepStartTime.current = -Infinity;
    if (groupRef.current) groupRef.current.position.set(target[0], target[1], target[2]);
  }, [snapKey, target[0], target[2]]);

  // On target change (new step), record starting position/time and new
  // facing angle. useLayoutEffect fires synchronously after commit and
  // BEFORE the next useFrame — so useFrame reads fresh state.
  useLayoutEffect(() => {
    const dx = target[0] - current.current.x;
    const dz = target[2] - current.current.z;
    if (dx * dx + dz * dz < 0.0001) return;

    stepStart.current.copy(current.current);
    stepStartTime.current = nowMs();
    stepRef.current.stepIndex += 1;
    stepRef.current.length = Math.sqrt(dx * dx + dz * dz);

    let angle = Math.atan2(dx, dz);
    const diff = angle - rotationY.current;
    if (diff > Math.PI) angle -= Math.PI * 2;
    else if (diff < -Math.PI) angle += Math.PI * 2;
    targetRotationY.current = angle;
  }, [target[0], target[2]]);

  // renderPriority = -1 → this useFrame runs before children's useFrames
  // (which use default priority 0). Children reading stepRef.current get
  // this frame's updated values, not last frame's.
  useFrame((_, delta) => {
    if (!groupRef.current) return;

    // Linear progress over stepDurationMs.
    const elapsedMs = nowMs() - stepStartTime.current;
    const dur = lengthScaled ? stepDurationMs * Math.sqrt(Math.max(1, stepRef.current.length ?? 1)) : stepDurationMs;
    const progress = Math.min(1, elapsedMs / dur);
    stepRef.current.progress = progress;
    stepRef.current.isMoving = progress < 1;

    // Position: linear interpolation from step origin to target.
    current.current.x =
      stepStart.current.x + (target[0] - stepStart.current.x) * progress;
    current.current.z =
      stepStart.current.z + (target[2] - stepStart.current.z) * progress;

    // Parabolic step arc.
    const arc = progress < 1 ? 4 * progress * (1 - progress) * stepHeight : 0;
    current.current.y = target[1] + arc;
    groupRef.current.position.copy(current.current);

    // Facing rotation — shortest-path lerp.
    const rotLerpT = Math.min(1, delta * rotationSpeed);
    rotationY.current += (targetRotationY.current - rotationY.current) * rotLerpT;
    groupRef.current.rotation.y = rotationY.current;
  }, -1);

  return (
    <StepAnimationContext.Provider value={stepRef}>
      <group ref={groupRef}>{children}</group>
    </StepAnimationContext.Provider>
  );
}
