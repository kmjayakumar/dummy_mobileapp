/**
 * repository.js
 * Local-first storage using AsyncStorage.
 * All reads/writes for the 4 Time Guardian entities live here.
 * Logic and UI never touch AsyncStorage directly — always go through this file.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

// Namespaced keys — won't collide with any other module
const KEYS = {
  ROTATION_ANCHOR : 'tg:rotationAnchor',
  CUSTOM_BLOCKS   : 'tg:customBlocks',
  LOG_ENTRIES     : 'tg:logEntries',
  ENERGY_ENTRIES  : 'tg:energyEntries',
};

// ─── Seed data (first launch only) ───────────────────────────────────────────

const DEFAULT_CUSTOM_BLOCKS = [
  {
    id: 'tg_default_1',
    label: 'Health check-in / exercise',
    category: 'self',
    type: 'protected',
    days: [1, 3, 5],
    start: '07:00',
    end: '07:45',
    active: true,
  },
  {
    id: 'tg_default_2',
    label: 'Reading / course work',
    category: 'self',
    type: 'soft',
    days: [2, 4],
    start: '20:30',
    end: '21:15',
    active: true,
  },
  {
    id: 'tg_default_3',
    label: 'Finance and digital tidy-up',
    category: 'self',
    type: 'soft',
    days: [6],
    start: '08:00',
    end: '08:45',
    active: true,
  },
];

// ─── RotationAnchor ───────────────────────────────────────────────────────────

export async function getRotationAnchor() {
  try {
    const v = await AsyncStorage.getItem(KEYS.ROTATION_ANCHOR);
    return v ? JSON.parse(v) : null;
  } catch { return null; }
}

export async function setRotationAnchor(anchorDate) {
  try {
    await AsyncStorage.setItem(KEYS.ROTATION_ANCHOR, JSON.stringify({ anchor_date: anchorDate }));
    return true;
  } catch { return false; }
}

// ─── CustomBlocks ─────────────────────────────────────────────────────────────

export async function getCustomBlocks() {
  try {
    const v = await AsyncStorage.getItem(KEYS.CUSTOM_BLOCKS);
    if (v) return JSON.parse(v);
    await AsyncStorage.setItem(KEYS.CUSTOM_BLOCKS, JSON.stringify(DEFAULT_CUSTOM_BLOCKS));
    return DEFAULT_CUSTOM_BLOCKS;
  } catch { return DEFAULT_CUSTOM_BLOCKS; }
}

export async function saveCustomBlocks(blocks) {
  try {
    await AsyncStorage.setItem(KEYS.CUSTOM_BLOCKS, JSON.stringify(blocks));
    return true;
  } catch { return false; }
}

export async function addCustomBlock(block) {
  const blocks  = await getCustomBlocks();
  const updated = [...blocks, { ...block, id: `tg_cb_${Date.now()}`, active: true }];
  return saveCustomBlocks(updated);
}

export async function updateCustomBlock(id, changes) {
  const blocks  = await getCustomBlocks();
  const updated = blocks.map((b) => (b.id === id ? { ...b, ...changes } : b));
  return saveCustomBlocks(updated);
}

export async function deleteCustomBlock(id) {
  const blocks  = await getCustomBlocks();
  const updated = blocks.filter((b) => b.id !== id);
  return saveCustomBlocks(updated);
}

export async function toggleCustomBlockActive(id) {
  const blocks  = await getCustomBlocks();
  const updated = blocks.map((b) => (b.id === id ? { ...b, active: !b.active } : b));
  return saveCustomBlocks(updated);
}

// ─── LogEntries ───────────────────────────────────────────────────────────────

export async function getLogEntries() {
  try {
    const v = await AsyncStorage.getItem(KEYS.LOG_ENTRIES);
    return v ? JSON.parse(v) : [];
  } catch { return []; }
}

export async function addLogEntry(entry) {
  try {
    const entries  = await getLogEntries();
    const newEntry = { id: `tg_log_${Date.now()}`, createdAt: new Date().toISOString(), ...entry };
    await AsyncStorage.setItem(KEYS.LOG_ENTRIES, JSON.stringify([newEntry, ...entries]));
    return newEntry;
  } catch { return null; }
}

export async function getRecentLogEntries(limit = 40) {
  const entries = await getLogEntries();
  return entries.slice(0, limit);
}

// ─── EnergyEntries ────────────────────────────────────────────────────────────

export async function getEnergyEntries() {
  try {
    const v = await AsyncStorage.getItem(KEYS.ENERGY_ENTRIES);
    return v ? JSON.parse(v) : [];
  } catch { return []; }
}

export async function upsertEnergyEntry(date, time, level, cause = null) {
  try {
    const entries  = await getEnergyEntries();
    const newEntry = { date, time, level, cause, updatedAt: new Date().toISOString() };
    const idx      = entries.findIndex((e) => e.date === date && e.time === time);
    const updated  = idx >= 0
      ? entries.map((e, i) => (i === idx ? newEntry : e))
      : [newEntry, ...entries];
    await AsyncStorage.setItem(KEYS.ENERGY_ENTRIES, JSON.stringify(updated));
    return newEntry;
  } catch { return null; }
}

/**
 * Returns one entry per day for the last N days (last check-in of day wins).
 * Used by the energy bar chart.
 */
export async function getEnergyChartData(days = 7) {
  const entries = await getEnergyEntries();
  const byDate  = {};
  entries.forEach((e) => {
    if (!byDate[e.date] || e.time > byDate[e.date].time) byDate[e.date] = e;
  });
  return Object.values(byDate)
    .sort((a, b) => (a.date < b.date ? -1 : 1))
    .slice(-days);
}
