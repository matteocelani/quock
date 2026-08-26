// Bounds of a measured element, in the coordinate space of the overlay that consumes them (see anchorRelativeTo).

// Anchors an overlay to the element it belongs to: above or below its edges, leading-aligned to its left.
// `width` lets a dimming overlay spare the element instead of darkening it with everything else.
export interface AnchorRect {
  top: number;
  bottom: number;
  left: number;
  width: number;
}

// The spotlight the excerpt menu cuts out of its dim: the anchor plus its padding, resolved to a drawable box.
export interface SpotlightRect {
  top: number;
  left: number;
  width: number;
  height: number;
}
