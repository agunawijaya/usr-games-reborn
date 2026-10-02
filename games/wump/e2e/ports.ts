/** The workbench's port, and the port of the Hall this game's browser runs start for themselves. */
export const WORKBENCH_PORT = 5274;
export const HALL_PORT = Number(process.env.WUMP_HALL_PORT ?? 5294);
