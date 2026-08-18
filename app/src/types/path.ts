/** Shared types for the Path Planning (autonomous mode) feature. */

export interface Waypoint {
  id: string;
  x: number;
  y: number;
}

/** A single dead-reckoning leg derived from two consecutive waypoints. */
export interface Leg {
  headingDegrees: number;
  durationSeconds: number;
}

export interface SavedPath {
  name: string;
  waypoints: Waypoint[];
  savedAt: number;
}
