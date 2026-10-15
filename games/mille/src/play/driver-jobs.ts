import { type Driver, driverDecide } from '../ai/players';
import type { Action, HandState } from '../engine/hand';

/** One question for a driver: its move from this hand. The answer carries the driver back, with its stream and memory moved on. */
export interface DriverRequest {
  id: number;
  state: HandState;
  seat: number;
  driver: Driver;
}

export interface DriverAnswer {
  id: number;
  action: Action;
  driver: Driver;
}

export function answer(request: DriverRequest): DriverAnswer {
  const driver = request.driver;
  const action = driverDecide(request.state, request.seat, driver);
  return { id: request.id, action, driver };
}
