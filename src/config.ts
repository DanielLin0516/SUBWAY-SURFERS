// Gameplay constants. Units are metres and seconds.
export const LANE_W = 2.5;
export const LANE_COUNT = 3;
export const laneX = (lane: number) => (lane - 1) * LANE_W;

export const PLAYER = {
  halfW: 0.32,
  halfD: 0.3,
  height: 1.7,
  slideHeight: 0.8,
  laneTime: 0.15, // seconds for a lane change
  jumpHeight: 1.75,
  jumpApexTime: 0.34,
  superJumpHeight: 3.9,
  fastFallSpeed: 26,
  slideTime: 0.62,
  coyote: 0.11, // can still jump this long after running off an edge
  buffer: 0.16, // a jump pressed this long before landing still happens
  stepUp: 0.45, // climbs onto a surface whose top is at most this far above the feet
  grazeX: 0.85, // hitting a front corner with |dx| above this is a bounce, not a crash
  feetTol: 0.12, // the body box is a bit smaller than the drawn body
  headTol: 0.12,
  stumbleWindow: 4.5, // two stumbles inside this many seconds end the run
};
export const GRAVITY = (2 * PLAYER.jumpHeight) / (PLAYER.jumpApexTime * PLAYER.jumpApexTime);
export const JUMP_V = GRAVITY * PLAYER.jumpApexTime;
export const SUPER_JUMP_V = Math.sqrt(2 * GRAVITY * PLAYER.superJumpHeight);

export const SPEED = { start: 12, max: 27, ramp: 2600 };
export const speedAt = (d: number) => SPEED.start + (SPEED.max - SPEED.start) * (1 - Math.exp(-Math.max(0, d) / SPEED.ramp));
export const levelAt = (d: number) => Math.min(1, Math.max(0, d) / 4500);

// obstacle shapes: halfW across the lane, depth along the track, solid height range, walkable top
export const OB = {
  low: { halfW: 1.05, depth: 0.7, yb: 0, yt: 0.95, walk: true },
  hurdle: { halfW: 1.1, depth: 0.35, yb: 0.95, yt: 1.25, walk: false },
  overhead: { halfW: 1.15, depth: 0.35, yb: 1.1, yt: 2.65, walk: false },
  train: { halfW: 1.15, depth: 6.74, yb: 0, yt: 3.4, walk: true },
  ramp: { halfW: 1.15, depth: 7, yb: 0, yt: 3.4, walk: true },
  mtrain: { halfW: 1.15, depth: 6.74, yb: 0, yt: 3.4, walk: false },
} as const;
// Moving trains: position is a function of the runner's distance, not of time, so where they meet is fixed
// when the map is made (and the path search knows it). Until the runner is TRIGGER metres from the meeting
// point the train waits with its lights on; then it comes at RATIO x the runner's speed.
export const MOVER = { ratio: 0.6, trigger: 70 };
/** Front of a moving train when the runner is at d (meet = runner distance where the fronts touch). */
export const moverFront = (meet: number, d: number) => meet + MOVER.ratio * Math.min(MOVER.trigger, meet - d);
/** Stretch of runner distances during which a moving train of length len is beside the runner. */
export const moverSpan = (len: number) => len / (1 + MOVER.ratio);
export const CAR_LEN = 6.74;
export const CAR_GAP = 0.3;
export const trainLength = (cars: number) => cars * CAR_LEN + (cars - 1) * CAR_GAP;

export const POWER_TIME = { magnet: 10, shoes: 10, double: 12 };
export const MAGNET_RANGE = 16;
export const VIEW_AHEAD = 210;
