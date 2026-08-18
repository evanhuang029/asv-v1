let counter = 0;

/** Simple locally-unique id generator (no crypto.randomUUID dependency --
 * not guaranteed available across RN/Hermes versions). Good enough for
 * client-only identifiers like waypoint ids that never leave the device. */
export function generateId(prefix = 'id'): string {
  counter += 1;
  return `${prefix}-${Date.now()}-${counter}-${Math.floor(Math.random() * 1e6)}`;
}
