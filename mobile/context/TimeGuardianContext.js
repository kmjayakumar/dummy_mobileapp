/**
 * TimeGuardianContext.js
 * Global state for Time Guardian.
 * Added: scheduleChangeLog, saveWorkHoursWithReason, updateRotationSlotWithReason.
 */

import React, { createContext, useContext, useReducer, useCallback, useEffect } from 'react';
import {
  getRotationAnchor, setRotationAnchor,
  getWorkHours, saveWorkHours,
  getRotationSchedule, saveRotationSchedule, updateRotationSlot,
  getScheduleChangeLog, addScheduleChangeLog,
  getCustomBlocks, addCustomBlock, updateCustomBlock, deleteCustomBlock, toggleCustomBlockActive,
  addLogEntry, getRecentLogEntries,
  getEnergyEntries, getEnergyChartData, upsertEnergyEntry,
  DEFAULT_WORK_HOURS, DEFAULT_ROTATION_SCHEDULE,
} from '../timeguardian/storage/repository';
import { todayStr, nowTimeStr } from '../timeguardian/logic/dayBlocks';

const TimeGuardianContext = createContext(null);

const initialState = {
  isLoading          : true,
  anchorDate         : null,
  workHours          : DEFAULT_WORK_HOURS,
  rotationSchedule   : DEFAULT_ROTATION_SCHEDULE,
  scheduleChangeLog  : [],
  customBlocks       : [],
  logEntries         : [],
  energyEntries      : [],
  energyChartData    : [],
  todayEnergy        : null,
};

const A = {
  BOOTSTRAP         : 'BOOTSTRAP',
  SET_ANCHOR        : 'SET_ANCHOR',
  SET_WORK_HOURS    : 'SET_WORK_HOURS',
  SET_ROTATION      : 'SET_ROTATION',
  SET_CHANGE_LOG    : 'SET_CHANGE_LOG',
  SET_BLOCKS        : 'SET_BLOCKS',
  SET_LOGS          : 'SET_LOGS',
  SET_ENERGY        : 'SET_ENERGY',
};

function reducer(state, action) {
  switch (action.type) {
    case A.BOOTSTRAP      : return { ...state, isLoading: false, ...action.payload };
    case A.SET_ANCHOR     : return { ...state, anchorDate: action.payload };
    case A.SET_WORK_HOURS : return { ...state, workHours: action.payload };
    case A.SET_ROTATION   : return { ...state, rotationSchedule: action.payload };
    case A.SET_CHANGE_LOG : return { ...state, scheduleChangeLog: action.payload };
    case A.SET_BLOCKS     : return { ...state, customBlocks: action.payload };
    case A.SET_LOGS       : return { ...state, logEntries: action.payload };
    case A.SET_ENERGY     : return { ...state, ...action.payload };
    default               : return state;
  }
}

export function TimeGuardianProvider({ children }) {
  const [state, dispatch] = useReducer(reducer, initialState);

  useEffect(() => {
    (async () => {
      const [
        anchor, workHours, rotationSchedule, scheduleChangeLog,
        blocks, logs, energyEntries, energyChartData,
      ] = await Promise.all([
        getRotationAnchor(),
        getWorkHours(),
        getRotationSchedule(),
        getScheduleChangeLog(),
        getCustomBlocks(),
        getRecentLogEntries(),
        getEnergyEntries(),
        getEnergyChartData(7),
      ]);

      const today       = todayStr();
      const todayList   = energyEntries.filter((e) => e.date === today);
      const todayEnergy = todayList.length > 0
        ? todayList.sort((a, b) => (a.time > b.time ? -1 : 1))[0]
        : null;

      dispatch({
        type: A.BOOTSTRAP,
        payload: {
          anchorDate: anchor?.anchor_date ?? null,
          workHours,
          rotationSchedule,
          scheduleChangeLog,
          customBlocks: blocks,
          logEntries: logs,
          energyEntries,
          energyChartData,
          todayEnergy,
        },
      });
    })();
  }, []);

  // ── Anchor ────────────────────────────────────────────────────────────────

  const saveAnchorDate = useCallback(async (dateStr, reason = '') => {
    const old = state.anchorDate;
    await setRotationAnchor(dateStr);
    if (reason) await addScheduleChangeLog('anchor_date', old, dateStr, reason);
    dispatch({ type: A.SET_ANCHOR, payload: dateStr });
    const log = await getScheduleChangeLog();
    dispatch({ type: A.SET_CHANGE_LOG, payload: log });
  }, [state.anchorDate]);

  // ── Work Hours ────────────────────────────────────────────────────────────

  const updateWorkHours = useCallback(async (hours, reason) => {
    const old = state.workHours;
    await saveWorkHours(hours);
    await addScheduleChangeLog('work_hours', old, hours, reason);
    dispatch({ type: A.SET_WORK_HOURS, payload: hours });
    const log = await getScheduleChangeLog();
    dispatch({ type: A.SET_CHANGE_LOG, payload: log });
  }, [state.workHours]);

  // ── Rotation Schedule ─────────────────────────────────────────────────────

  const updateRotationSlotById = useCallback(async (index, changes, reason) => {
    const old = state.rotationSchedule.find((s) => s.index === index);
    await updateRotationSlot(index, changes);
    await addScheduleChangeLog('rotation_slot', old, { ...old, ...changes }, reason);
    const updated = await getRotationSchedule();
    dispatch({ type: A.SET_ROTATION, payload: updated });
    const log = await getScheduleChangeLog();
    dispatch({ type: A.SET_CHANGE_LOG, payload: log });
  }, [state.rotationSchedule]);

  const resetRotationSchedule = useCallback(async (reason) => {
    await saveRotationSchedule(DEFAULT_ROTATION_SCHEDULE);
    await addScheduleChangeLog('rotation_slot', state.rotationSchedule, DEFAULT_ROTATION_SCHEDULE, reason || 'Reset to defaults');
    dispatch({ type: A.SET_ROTATION, payload: DEFAULT_ROTATION_SCHEDULE });
    const log = await getScheduleChangeLog();
    dispatch({ type: A.SET_CHANGE_LOG, payload: log });
  }, [state.rotationSchedule]);

  // ── Custom Blocks ─────────────────────────────────────────────────────────

  const refreshBlocks = useCallback(async () => {
    dispatch({ type: A.SET_BLOCKS, payload: await getCustomBlocks() });
  }, []);

  const createBlock = useCallback(async (b)           => { await addCustomBlock(b);              await refreshBlocks(); }, [refreshBlocks]);
  const editBlock   = useCallback(async (id, changes)  => { await updateCustomBlock(id, changes); await refreshBlocks(); }, [refreshBlocks]);
  const removeBlock = useCallback(async (id)           => { await deleteCustomBlock(id);          await refreshBlocks(); }, [refreshBlocks]);
  const toggleBlock = useCallback(async (id)           => { await toggleCustomBlockActive(id);    await refreshBlocks(); }, [refreshBlocks]);

  // ── Log ───────────────────────────────────────────────────────────────────

  const logEntry = useCallback(async (entry) => {
    const saved = await addLogEntry(entry);
    dispatch({ type: A.SET_LOGS, payload: await getRecentLogEntries() });
    return saved;
  }, []);

  // ── Energy ────────────────────────────────────────────────────────────────

  const checkInEnergy = useCallback(async (level, cause = null) => {
    const today = todayStr();
    await upsertEnergyEntry(today, nowTimeStr(), level, cause);
    const [energyEntries, energyChartData] = await Promise.all([getEnergyEntries(), getEnergyChartData(7)]);
    const todayList   = energyEntries.filter((e) => e.date === today);
    const todayEnergy = todayList.length > 0 ? todayList.sort((a, b) => (a.time > b.time ? -1 : 1))[0] : null;
    dispatch({ type: A.SET_ENERGY, payload: { energyEntries, energyChartData, todayEnergy } });
  }, []);

  return (
    <TimeGuardianContext.Provider value={{
      ...state,
      saveAnchorDate,
      updateWorkHours,
      updateRotationSlotById,
      resetRotationSchedule,
      createBlock, editBlock, removeBlock, toggleBlock,
      logEntry,
      checkInEnergy,
    }}>
      {children}
    </TimeGuardianContext.Provider>
  );
}

export function useTimeGuardian() {
  const ctx = useContext(TimeGuardianContext);
  if (!ctx) throw new Error('useTimeGuardian must be used within TimeGuardianProvider');
  return ctx;
}
