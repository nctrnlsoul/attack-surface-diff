// The single source of truth for how a graph element (node OR edge) is treated
// visually in a given side. Both branches of GraphView call this so the node and
// edge rules can never diverge again (they did: a green-fade fix once landed on
// the node branch but not the edge branch, so db-sg->rds rendered solid green in
// "after" even though it still exists there). Pure and unit-tested.

export type Side = "before" | "after";

export interface DiffFlags {
  inBefore: boolean;
  inAfter: boolean;
  /** On the active side's attack path (renders red). */
  onActivePath: boolean;
  /** On a newly opened (added) attack path. */
  onAddedPath: boolean;
  /** On a closed (removed) attack path. */
  onRemovedPath: boolean;
}

export interface DiffVisual {
  /** Present in the active side; drives opacity. */
  present: boolean;
  /** On the active attack path (red). */
  onPath: boolean;
  /** Newly opened path revealing on "after" (red glow). */
  glow: boolean;
  /** Actually leaving in "after" (green as it fades out). */
  fadeGreen: boolean;
}

export function elementVisual(flags: DiffFlags, side: Side): DiffVisual {
  const present = side === "before" ? flags.inBefore : flags.inAfter;
  return {
    present,
    onPath: flags.onActivePath,
    glow: flags.onAddedPath && side === "after" && present,
    // Green fade applies ONLY to elements that are actually gone in "after". An
    // element on a removed path that still exists (present) did not close and
    // must stay neutral, not green.
    fadeGreen: flags.onRemovedPath && side === "after" && !present,
  };
}
