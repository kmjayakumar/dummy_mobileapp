/**
 * conflict.js
 * Pure function — no storage, no UI dependencies.
 * The core feature: checks a time request against the day's blocks.
 */

import { getBlocksForDate } from './dayBlocks';

/** @param {string} time "HH:MM" @returns {number} minutes from midnight */
function toMinutes(time) {
  const [h, m] = time.split(':').map(Number);
  return h * 60 + m;
}

/**
 * Duration presets for the "Someone's asking" screen.
 * "whole day" maps to 06:00–23:00 (waking hours — avoids always conflicting with Sleep).
 */
export const DURATION_PRESETS = {
  '30m': 30,
  '1h': 60,
  '2h': 120,
  '3h': 180,
  'whole day': null,
};

export const WHOLE_DAY_START = '06:00';
export const WHOLE_DAY_END   = '23:00';

/**
 * Computes end time given start and duration in minutes.
 * @param {string} startTime "HH:MM"
 * @param {number} durationMinutes
 * @returns {string} "HH:MM"
 */
export function computeEndTime(startTime, durationMinutes) {
  const total = toMinutes(startTime) + durationMinutes;
  const h = Math.floor(total / 60) % 24;
  const m = total % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

/**
 * Core conflict check (§2.4).
 * Protected always outranks soft regardless of discovery order.
 * Sleep category display treatment is handled at UI layer — not here.
 *
 * @param {string} dateStr - YYYY-MM-DD
 * @param {string} requestStart - "HH:MM"
 * @param {string} requestEnd - "HH:MM"
 * @param {string} anchorDateStr - YYYY-MM-DD
 * @param {Array} customBlocks
 * @returns {{ block: object|null, count: number }}
 *   block = null  → slot is open
 *   block         → highest-priority colliding block
 *   count         → total overlapping blocks (UI: "also overlaps N other blocks")
 */
export function findConflict(dateStr, requestStart, requestEnd, anchorDateStr, customBlocks = []) {
  const blocks   = getBlocksForDate(dateStr, anchorDateStr, customBlocks);
  const reqStart = toMinutes(requestStart);
  const reqEnd   = toMinutes(requestEnd);

  let best           = null;
  let totalConflicts = 0;

  for (const block of blocks) {
    const bStart   = toMinutes(block.start);
    const bEnd     = toMinutes(block.end);
    const overlaps = reqStart < bEnd && reqEnd > bStart;

    if (overlaps) {
      totalConflicts++;
      if (best === null || (block.type === 'protected' && best.type !== 'protected')) {
        best = block;
      }
    }
  }

  return { block: best, count: totalConflicts };
}
