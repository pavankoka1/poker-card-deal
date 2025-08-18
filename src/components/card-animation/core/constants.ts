export const CANVAS_WIDTH_PX = 720;
export const CANVAS_HEIGHT_PX = 300;

export const DEFAULT_CARD_ASPECT_WH = 0.714; // width:height, matches BendCardRenderer default
export const CARD_WIDTH_PX = 30; // global adjustable width in pixels
export const CARD_HEIGHT_PX = 72; // global adjustable height in pixels
export const CARD_CORNER_RADIUS_UV = 0.04; // 0..0.5 in UV units
export const NO_BLUR = true; // if true, use NEAREST filters to avoid smoothing

export const PLAYER_COUNT = 7;
export const PLAYER_PADDING_LEFT_PX = 60;
export const PLAYER_PADDING_RIGHT_PX = 60;
export const PLAYER_GAP_X_PX = 50;
export const PLAYER_OFFSET_BOTTOM_PX = 0;
export const PLAYER_LIFT_Y_PER_STEP_PX = 22;
export const STACK_OVERLAP_RATIO = 0.8; // 80% covered; next card reveals 20%
export const PLAYER_TILT_Z_PER_STEP_DEG = 6; // roll per step from center

// Dealing setup
export const INITIAL_CARD_COUNT = 35;
export const INITIAL_STACK_OFFSET_RIGHT_PX = 100;
export const INITIAL_STACK_OFFSET_TOP_PX = 120;
export const INITIAL_STACK_DELTA_X_PX = 1; // small stagger so they're next to each other
export const INITIAL_ROTATION_DEGREES: [number, number, number] = [148, 42, -40];
export const DEAL_DELAY_PER_CARD_MS = 1000;

// Animation timings
export const MOVE_TO_CENTER_DURATION_MS = 600;
export const FLIP_PART_DURATION_MS = 400;
export const DEAL_DURATION_MS = 600;
export const FLIP_Y_PEAK_PX = 48;

// Scaling
export const CANVAS_SCALE = 2;

