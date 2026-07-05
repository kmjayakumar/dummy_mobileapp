/**
 * dayBlocks.js
 * Pure function — no storage, no UI dependencies.
 * Assembles the full ordered list of blocks for any given date.
 * Result is always derived fresh — never persisted.
 */

import { rotationIndex, getRotationBlock } from './rotation';

// ─── Fixed rules §2.1 ────────────────────────────────────────────────────────
// Not user-editable in v1. Defined as constants so they're easy to expose later.

const FIXED_BLOCKS = {
  sleep: {
    label: 'Sleep',
    start: '00:00',
    end: '06:00',
    category: 'sleep',
    type: 'protected',
  },
  windDown: {
    label: 'Wind-down',
    start: '23:00',
    end: '23:59',
    category: 'sleep',
    type: 'protected',
  },
  work: {
    label: 'Work',
    start: '10:00',
    end: '19:00',
    category: 'work',
    type: 'protected',
  },
  overtimeBuffer: {
    label: 'Work overtime buffer',
    start: '19:00',
    end: '23:00',
    category: 'work',
    type: 'soft',
  },
};

/**
 * Returns the day-of-week integer for a date string.
 * 0 = Sunday … 6 = Saturday
 * @param {string} dateStr - YYYY-MM-DD
 * @returns {number}
 */
export function getDayOfWeek(dateStr) {
  return new Date(dateStr + 'T00:00:00').getDay();
}

/**
 * Assembles all blocks for a given date (§2.3).
 * Order: fixed sleep → weekday work → rotation block → active CustomBlocks.
 * Returns blocks sorted by start time.
 *
 * @param {string} dateStr - YYYY-MM-DD
 * @param {string} anchorDateStr - YYYY-MM-DD
 * @param {Array} customBlocks - only active ones are included
 * @returns {Array<{ label, start, end, category, type }>}
 */
export function getBlocksForDate(dateStr, anchorDateStr, customBlocks = []) {
  const dayOfWeek = getDayOfWeek(dateStr);
  const isWeekday  = dayOfWeek >= 1 && dayOfWeek <= 5;
  const isSunday   = dayOfWeek === 0;
  const isSaturday = dayOfWeek === 6;

  const blocks = [
    { ...FIXED_BLOCKS.sleep },
    { ...FIXED_BLOCKS.windDown },
  ];

  if (isWeekday) {
    blocks.push({ ...FIXED_BLOCKS.work });
    blocks.push({ ...FIXED_BLOCKS.overtimeBuffer });
  }

  const idx = rotationIndex(dateStr, anchorDateStr);

  if (isSunday) {
    const rb = getRotationBlock(idx, 'sunday');
    if (rb) blocks.push({ ...rb });
  }

  if (isSaturday) {
    const rb = getRotationBlock(idx, 'saturday');
    if (rb) blocks.push({ ...rb });
  }

  // Active CustomBlocks for this weekday only
  customBlocks
    .filter((b) => b.active && Array.isArray(b.days) && b.days.includes(dayOfWeek))
    .forEach((b) => blocks.push({ label: b.label, start: b.start, end: b.end, category: b.category, type: b.type }));

  return blocks.sort((a, b) => (a.start < b.start ? -1 : a.start > b.start ? 1 : 0));
}

/**
 * Returns Sun–Sat dates of the current calendar week.
 * "This week" = Sun–Sat of the current calendar week, not a rolling 7-day window.
 * @returns {string[]} 7 YYYY-MM-DD strings, Sunday first
 */
export function getCurrentWeekDates() {
  const today = new Date();
  const sunday = new Date(today);
  sunday.setDate(today.getDate() - today.getDay());
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(sunday);
    d.setDate(sunday.getDate() + i);
    return d.toISOString().split('T')[0];
  });
}

/** @returns {string} today as YYYY-MM-DD */
export function todayStr() {
  return new Date().toISOString().split('T')[0];
}

/** @returns {string} current time as HH:MM */
export function nowTimeStr() {
  return new Date().toTimeString().slice(0, 5);
}
