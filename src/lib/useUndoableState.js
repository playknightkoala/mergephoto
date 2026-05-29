import { useCallback, useState } from 'react';

const HISTORY_LIMIT = 100;

// Single combined-state undo/redo. Keeps past + present + future inside one
// useState so all updates are atomic — no torn states between past/present.
//
// setState(updater, { skipHistory: true }) lets callers skip the history push
// (e.g., for ephemeral UI-only updates that should not be undoable).
export function useUndoableState(initial) {
  const [s, setS] = useState({
    present: initial,
    past: [],
    future: []
  });

  const setState = useCallback((updater, opts = {}) => {
    setS((d) => {
      const next =
        typeof updater === 'function' ? updater(d.present) : updater;
      if (next === d.present) return d;
      if (opts.skipHistory) {
        return { ...d, present: next };
      }
      const past = d.past.length >= HISTORY_LIMIT
        ? [...d.past.slice(1), d.present]
        : [...d.past, d.present];
      return { present: next, past, future: [] };
    });
  }, []);

  const undo = useCallback(() => {
    setS((d) => {
      if (d.past.length === 0) return d;
      const prev = d.past[d.past.length - 1];
      return {
        present: prev,
        past: d.past.slice(0, -1),
        future: [d.present, ...d.future].slice(0, HISTORY_LIMIT)
      };
    });
  }, []);

  const redo = useCallback(() => {
    setS((d) => {
      if (d.future.length === 0) return d;
      const next = d.future[0];
      return {
        present: next,
        past: [...d.past, d.present].slice(-HISTORY_LIMIT),
        future: d.future.slice(1)
      };
    });
  }, []);

  return {
    state: s.present,
    setState,
    undo,
    redo,
    canUndo: s.past.length > 0,
    canRedo: s.future.length > 0
  };
}
