/**
 * TimeGuardianContext.js
 * Global state for Time Guardian — matches existing AuthContext pattern.
 * Now includes workHours and rotationSchedule loaded from storage.
 */

import React, { createContext, useContext, useReducer, useCallback, useEffect } from 'react';
import {
  getRotationAnchor, setRotationAnchor,
  getWorkHours, saveWorkHours,
  getRotationSchedule, saveRotationSchedule, updateRotationSlot,
  getCustomBlocks, addCustomBlock, updateCustomBlock, deleteCustomBlock, toggleCustomBlockActive,
  addLogEntry, getRecentLogEntries,
  getEnergyEntries, getEnergyChartData, upsertEnergyEntry,
  DEFAULT_WORK_HOURS, DEFAULT_ROTATION_SCHEDULE,
} from '../timeguardian/storage/repository';
import { todayStr, nowTimeStr } from '../timeguardian/logic/dayBlocks';

const TimeGuardianContext = createContext(null);

const initialState = {
  isLoading        : true,
  anchorDate       : null,
  workHours        : DEFAULT_WORK_HOURS,
  rotationSchedule : DEFAULT_ROTATION_SCHEDULE,
  customBlocks     : [],
  logEntries       : [],
  energyEntries    : [],
  energyChartData  : [],
  todayEnergy      : null,
};

const A = {
  SET_LOADING       : 'SET_LOADING',
  BOOTSTRAP         : 'BOOTSTRAP',
  SET_ANCHOR        : 'SET_ANCHOR',
  SET_WORK_HOURS    : 'SET_WORK_HOURS',
  SET_ROTATION      : 'SET_ROTATION',
  SET_BLOCKS        : 'SET_BLOCKS',
  SET_LOGS          : 'SET_LOGS',
  SET_ENERGY        : 'SET_ENERGY',
};

function reducer(state, action) {
  switch (action.type) {
    case A.SET_LOADING    : return { ...state, isLoading: action.payload };
    case A.BOOTSTRAP      : return { ...state, isLoading: false, ...action.payload };
    case A.SET_ANCHOR     : return { ...state, anchorDate: action.payload };
    case A.SET_WORK_HOURS : return { ...state, workHours: action.payload };
    case A.SET_ROTATION   : return { ...state, rotationSchedule: action.payload };
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
        anchor, workHours, rotationSchedule,
        blocks, logs, energyEntries, energyChartData,
      ] = await Promise.all([
        getRotationAnchor(),
        getWorkHours(),
        getRotationSchedule(),
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

  const saveAnchorDate = useCallback(async (dateStr) => {
    await setRotationAnchor(dateStr);
    dispatch({ type: A.SET_ANCHOR, payload: dateStr });
  }, []);

  // ── Work Hours ────────────────────────────────────────────────────────────

  const updateWorkHours = useCallback(async (hours) => {
    await saveWorkHours(hours);
    dispatch({ type: A.SET_WORK_HOURS, payload: hours });
  }, []);

  // ── Rotation Schedule ─────────────────────────────────────────────────────

  const updateRotationSlotById = useCallback(async (index, changes) => {
    await updateRotationSlot(index, changes);
    const updated = await getRotationSchedule();
    dispatch({ type: A.SET_ROTATION, payload: updated });
  }, []);

  const resetRotationSchedule = useCallback(async () => {
    await saveRotationSchedule(DEFAULT_ROTATION_SCHEDULE);
    dispatch({ type: A.SET_ROTATION, payload: DEFAULT_ROTATION_SCHEDULE });
  }, []);

  // ── Custom Blocks ─────────────────────────────────────────────────────────

  const refreshBlocks = useCallback(async () => {
    const blocks = await getCustomBlocks();
    dispatch({ type: A.SET_BLOCKS, payload: blocks });
  }, []);

  const createBlock = useCallback(async (b)          => { await addCustomBlock(b);              await refreshBlocks(); }, [refreshBlocks]);
  const editBlock   = useCallback(async (id, changes) => { await updateCustomBlock(id, changes); await refreshBlocks(); }, [refreshBlocks]);
  const removeBlock = useCallback(async (id)          => { await deleteCustomBlock(id);          await refreshBlocks(); }, [refreshBlocks]);
  const toggleBlock = useCallback(async (id)          => { await toggleCustomBlockActive(id);    await refreshBlocks(); }, [refreshBlocks]);

  // ── Log ───────────────────────────────────────────────────────────────────

  const logEntry = useCallback(async (entry) => {
    const saved = await addLogEntry(entry);
    const logs  = await getRecentLogEntries();
    dispatch({ type: A.SET_LOGS, payload: logs });
    return saved;
  }, []);

  // ── Energy ────────────────────────────────────────────────────────────────

  const checkInEnergy = useCallback(async (level, cause = null) => {
    const today = todayStr();
    const time  = nowTimeStr();
    await upsertEnergyEntry(today, time, level, cause);

    const [energyEntries, energyChartData] = await Promise.all([
      getEnergyEntries(),
      getEnergyChartData(7),
    ]);

    const todayList   = energyEntries.filter((e) => e.date === today);
    const todayEnergy = todayList.length > 0
      ? todayList.sort((a, b) => (a.time > b.time ? -1 : 1))[0]
      : null;

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
