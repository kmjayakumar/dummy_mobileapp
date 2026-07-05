/**
 * dayBlocks.js
 * Pure function — no UI dependencies.
 * Assembles the full ordered list of blocks for any given date.
 * Work hours and rotation schedule are now passed in from context (loaded from storage)
 * instead of being hardcoded — making them user-editable via Settings.
 */

import { rotationIndex } from './rotation';
import { DEFAULT_WORK_HOURS, DEFAULT_ROTATION_SCHEDULE } from '../storage/repository';

// ─── Fixed rules (never editable — sleep is non-negotiable) ──────────────────

const SLEEP_BLOCK = {
  label: 'Sleep', start: '00:00', end: '06:00',
  category: 'sleep', type: 'protected',
};

const WIND_DOWN_BLOCK = {
  label: 'Wind-down', start: '23:00', end: '23:59',
  category: 'sleep', type: 'protected',
};

/**
 * Builds work and overtime blocks from stored work hours.
 * Falls back to defaults if not provided.
 * @param {{ workStart, workEnd, overtimeEnd }} workHours
 * @returns {Array}
 */
function buildWorkBlocks(workHours = DEFAULT_WORK_HOURS) {
  return [
    {
      label: 'Work',
      start: workHours.workStart,
      end: workHours.workEnd,
      category: 'work',
      type: 'protected',
    },
    {
      label: 'Work overtime buffer',
      start: workHours.workEnd,
      end: workHours.overtimeEnd,
      category: 'work',
      type: 'soft',
    },
  ];
}

/**
 * Builds rotation block(s) for a given index and day type from stored schedule.
 * @param {number} index 0..3
 * @param {'sunday'|'saturday'} dayType
 * @param {Array} rotationSchedule
 * @returns {{ label, start, end, category, type } | null}
 */
function getRotationBlockFromSchedule(index, dayType, rotationSchedule = DEFAULT_ROTATION_SCHEDULE) {
  const slot = rotationSchedule.find((s) => s.index === index);
  if (!slot) return null;

  if (dayType === 'sunday') {
    return {
      label   : slot.sundayLabel,
      start   : slot.sundayStart,
      end     : slot.sundayEnd,
      category: slot.sundayCategory,
      type    : 'protected',
    };
  }

  if (dayType === 'saturday' && slot.hasSaturday) {
    return {
      label   : slot.saturdayLabel,
      start   : slot.saturdayStart,
      end     : slot.saturdayEnd,
      category: slot.saturdayCategory,
      type    : 'protected',
    };
  }

  return null;
}

/**
 * Returns the day-of-week integer for a date string.
 * 0 = Sunday … 6 = Saturday
 * @param {string} dateStr YYYY-MM-DD
 * @returns {number}
 */
export function getDayOfWeek(dateStr) {
  return new Date(dateStr + 'T00:00:00').getDay();
}

/**
 * Assembles all blocks for a given date.
 * Now accepts workHours and rotationSchedule from context so they're user-editable.
 *
 * @param {string} dateStr - YYYY-MM-DD
 * @param {string} anchorDateStr - YYYY-MM-DD
 * @param {Array}  customBlocks - only active ones are included
 * @param {object} workHours - { workStart, workEnd, overtimeEnd }
 * @param {Array}  rotationSchedule - array of 4 rotation slot objects
 * @returns {Array<{ label, start, end, category, type }>}
 */
export function getBlocksForDate(
  dateStr,
  anchorDateStr,
  customBlocks      = [],
  workHours         = DEFAULT_WORK_HOURS,
  rotationSchedule  = DEFAULT_ROTATION_SCHEDULE
) {
  const dayOfWeek  = getDayOfWeek(dateStr);
  const isWeekday  = dayOfWeek >= 1 && dayOfWeek <= 5;
  const isSunday   = dayOfWeek === 0;
  const isSaturday = dayOfWeek === 6;

  const blocks = [{ ...SLEEP_BLOCK }, { ...WIND_DOWN_BLOCK }];

  if (isWeekday) {
    buildWorkBlocks(workHours).forEach((b) => blocks.push(b));
  }

  const idx = rotationIndex(dateStr, anchorDateStr);

  if (isSunday) {
    const rb = getRotationBlockFromSchedule(idx, 'sunday', rotationSchedule);
    if (rb) blocks.push({ ...rb });
  }

  if (isSaturday) {
    const rb = getRotationBlockFromSchedule(idx, 'saturday', rotationSchedule);
    if (rb) blocks.push({ ...rb });
  }

  customBlocks
    .filter((b) => b.active && Array.isArray(b.days) && b.days.includes(dayOfWeek))
    .forEach((b) => blocks.push({
      label: b.label, start: b.start, end: b.end,
      category: b.category, type: b.type,
    }));

  return blocks.sort((a, b) => (a.start < b.start ? -1 : a.start > b.start ? 1 : 0));
}

/** @returns {string} today as YYYY-MM-DD */
export function todayStr() {
  return new Date().toISOString().split('T')[0];
}

/** @returns {string} current time as HH:MM */
export function nowTimeStr() {
  return new Date().toTimeString().slice(0, 5);
}
