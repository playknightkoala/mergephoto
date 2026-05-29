// Snap-to-align helper used while dragging an item on the canvas.
// Compares the active item's left/center/right and top/middle/bottom against
// the canvas edges/centers and the same lines on every other item, snapping
// to the nearest within SNAP_THRESHOLD pixels and reporting the matched
// lines so the canvas can render visual guides.

const SNAP_THRESHOLD = 6;
const EPSILON = 0.5;

// activeBox / otherBoxes: { x, y, width, height } in stage coordinates
// (axis-aligned bounding boxes — Konva's getClientRect is fine).
export function computeSnap(activeBox, otherBoxes, canvasWidth, canvasHeight) {
  const vTargets = [0, canvasWidth / 2, canvasWidth];
  const hTargets = [0, canvasHeight / 2, canvasHeight];
  for (const b of otherBoxes) {
    vTargets.push(b.x, b.x + b.width / 2, b.x + b.width);
    hTargets.push(b.y, b.y + b.height / 2, b.y + b.height);
  }

  const aXs = [
    activeBox.x,
    activeBox.x + activeBox.width / 2,
    activeBox.x + activeBox.width
  ];
  const aYs = [
    activeBox.y,
    activeBox.y + activeBox.height / 2,
    activeBox.y + activeBox.height
  ];

  const bestDelta = (sources, targets) => {
    let bestD = 0;
    let bestAbs = SNAP_THRESHOLD + 1;
    for (const s of sources) {
      for (const t of targets) {
        const d = t - s;
        const ad = Math.abs(d);
        if (ad < bestAbs) {
          bestAbs = ad;
          bestD = d;
        }
      }
    }
    return bestAbs <= SNAP_THRESHOLD ? bestD : null;
  };

  const dx = bestDelta(aXs, vTargets);
  const dy = bestDelta(aYs, hTargets);

  const guides = [];
  if (dx !== null) {
    const newXs = aXs.map((x) => x + dx);
    for (const t of vTargets) {
      if (newXs.some((x) => Math.abs(x - t) < EPSILON)) {
        guides.push({ orientation: 'V', position: t });
      }
    }
  }
  if (dy !== null) {
    const newYs = aYs.map((y) => y + dy);
    for (const t of hTargets) {
      if (newYs.some((y) => Math.abs(y - t) < EPSILON)) {
        guides.push({ orientation: 'H', position: t });
      }
    }
  }

  const seen = new Set();
  const dedupedGuides = guides.filter((g) => {
    const k = `${g.orientation}:${g.position.toFixed(2)}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });

  return {
    dx: dx ?? 0,
    dy: dy ?? 0,
    guides: dedupedGuides
  };
}

// Snap during transform/resize.
// Snaps the active edge(s) to other items' edges and the canvas edges/center,
// AND snaps the new width/height to match other items' widths/heights so the
// user can resize "to the same size as that one."
//
// anchor: Konva anchor name ('top-left', 'middle-right', etc.). Names containing
//   'left'/'right'/'top'/'bottom' indicate which edges are moving.
// otherSizes: [{ width, height }] — natural-rendered sizes of every other item
// otherBoxes: [{ x, y, width, height }] — AABB in stage coords for edge alignment
// rotation: of the active item; we skip edge alignment when rotated since x/y
//   in newBox no longer maps to the visual top-left.
export function computeResizeSnap({
  newBox,
  oldBox,
  anchor,
  otherSizes,
  otherBoxes,
  canvasWidth,
  canvasHeight,
  rotation = 0,
  keepRatio = false
}) {
  const movesLeft = anchor.includes('left');
  const movesRight = anchor.includes('right');
  const movesTop = anchor.includes('top');
  const movesBottom = anchor.includes('bottom');

  let { x, y, width, height } = newBox;
  const guides = [];

  const applyWidthChange = (newWidth) => {
    if (movesLeft && !movesRight) x = x + (width - newWidth);
    else if (movesLeft && movesRight) x = x + (width - newWidth) / 2;
    width = newWidth;
  };
  const applyHeightChange = (newHeight) => {
    if (movesTop && !movesBottom) y = y + (height - newHeight);
    else if (movesTop && movesBottom) y = y + (height - newHeight) / 2;
    height = newHeight;
  };

  // --- size match ---
  if (keepRatio && otherSizes.length > 0 && oldBox && oldBox.height > 0) {
    // Ratio-aware snap: snap to another item's width or height, and adjust
    // the perpendicular axis to preserve the original aspect ratio.
    const r = oldBox.width / oldBox.height;
    let best = null; // { w, h, dist }
    for (const s of otherSizes) {
      const wd = Math.abs(s.width - width);
      if (wd <= SNAP_THRESHOLD && (!best || wd < best.dist)) {
        best = { w: s.width, h: s.width / r, dist: wd };
      }
      // height snap: convert to width-equivalent for comparable distance
      const hd = Math.abs(s.height - height);
      const wEquiv = Math.abs(width - s.height * r);
      if (hd <= SNAP_THRESHOLD && (!best || wEquiv < best.dist)) {
        best = { w: s.height * r, h: s.height, dist: wEquiv };
      }
    }
    if (best) {
      applyWidthChange(best.w);
      applyHeightChange(best.h);
    }
  } else {
    // Independent-axis snap (default — Shift not held).
    if ((movesLeft || movesRight) && otherSizes.length > 0) {
      let bestD = 0;
      let bestAbs = SNAP_THRESHOLD + 1;
      for (const s of otherSizes) {
        const d = s.width - width;
        const ad = Math.abs(d);
        if (ad < bestAbs) {
          bestAbs = ad;
          bestD = d;
        }
      }
      if (bestAbs <= SNAP_THRESHOLD) applyWidthChange(width + bestD);
    }
    if ((movesTop || movesBottom) && otherSizes.length > 0) {
      let bestD = 0;
      let bestAbs = SNAP_THRESHOLD + 1;
      for (const s of otherSizes) {
        const d = s.height - height;
        const ad = Math.abs(d);
        if (ad < bestAbs) {
          bestAbs = ad;
          bestD = d;
        }
      }
      if (bestAbs <= SNAP_THRESHOLD) applyHeightChange(height + bestD);
    }
  }

  // --- edge alignment: only when not rotated and not in keepRatio mode ---
  // (edge snap moves a single axis, which would break the locked ratio)
  if (Math.abs(rotation) < 0.01 && !keepRatio) {
    const verticalLines = [0, canvasWidth / 2, canvasWidth];
    const horizontalLines = [0, canvasHeight / 2, canvasHeight];
    for (const b of otherBoxes) {
      verticalLines.push(b.x, b.x + b.width / 2, b.x + b.width);
      horizontalLines.push(b.y, b.y + b.height / 2, b.y + b.height);
    }

    const findClosest = (sourceVal, targets) => {
      let bestD = 0;
      let bestAbs = SNAP_THRESHOLD + 1;
      let bestT = null;
      for (const t of targets) {
        const d = t - sourceVal;
        const ad = Math.abs(d);
        if (ad < bestAbs) {
          bestAbs = ad;
          bestD = d;
          bestT = t;
        }
      }
      return bestAbs <= SNAP_THRESHOLD ? { d: bestD, target: bestT } : null;
    };

    if (movesLeft && !movesRight) {
      const r = findClosest(x, verticalLines);
      if (r) {
        x += r.d;
        width -= r.d;
        guides.push({ orientation: 'V', position: r.target });
      }
    } else if (movesRight && !movesLeft) {
      const r = findClosest(x + width, verticalLines);
      if (r) {
        width += r.d;
        guides.push({ orientation: 'V', position: r.target });
      }
    }

    if (movesTop && !movesBottom) {
      const r = findClosest(y, horizontalLines);
      if (r) {
        y += r.d;
        height -= r.d;
        guides.push({ orientation: 'H', position: r.target });
      }
    } else if (movesBottom && !movesTop) {
      const r = findClosest(y + height, horizontalLines);
      if (r) {
        height += r.d;
        guides.push({ orientation: 'H', position: r.target });
      }
    }
  }

  return {
    box: { ...newBox, x, y, width: Math.max(width, 10), height: Math.max(height, 10) },
    guides
  };
}
