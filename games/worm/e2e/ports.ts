/** The workbench's port, and the port of the Hall this game's browser runs start for themselves. */
export const WORKBENCH_PORT = 5275;
export const HALL_PORT = Number(process.env.WORM_HALL_PORT ?? 5295);
