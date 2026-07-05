/**
 * TimeGuardianContext.js
 * Global state for Time Guardian — matches existing AuthContext pattern.
 * All storage calls go through repository.js only.
 */

import React, { createContext, useContext, useReducer, useCallback, useEffect } from 'react';
import {
  getRotationAnchor, setRotationAnchor,
  getCustomBlocks, addCustomBlock, updateCustomBlock, deleteCustomBlock, toggleCustomBlockActive,
  addLogEntry, getRecentLogEntries,
  getEnergyEntries, getEnergyChartData, upsertEnergyEntry,
} from '../timeguardian/storage/repository';
import { todayStr, nowTimeStr } from '../timeguardian/logic/dayBlocks';

const TimeGuardianContext = createContext(null);

const initialState = {
  isLoading   : true,
  anchorDate  : null,
  customBlocks: [],
  logEntries  : [],
  energyEntries: [],
  energyChartData: [],
  todayEnergy : null,
};

const A = {
  SET_LOADING : 'SET_LOADING',
  BOOTSTRAP   : 'BOOTSTRAP',
  SET_ANCHOR  : 'SET_ANCHOR',
  SET_BLOCKS  : 'SET_BLOCKS',
  SET_LOGS    : 'SET_LOGS',
  SET_ENERGY  : 'SET_ENERGY',
};

function reducer(state, action) {
  switch (action.type) {
    case A.SET_LOADING : return { ...state, isLoading: action.payload };
    case A.BOOTSTRAP   : return { ...state, isLoading: false, ...action.payload };
    case A.SET_ANCHOR  : return { ...state, anchorDate: action.payload };
    case A.SET_BLOCKS  : return { ...state, customBlocks: action.payload };
    case A.SET_LOGS    : return { ...state, logEntries: action.payload };
    case A.SET_ENERGY  : return { ...state, ...action.payload };
    default            : return state;
  }
}

export function TimeGuardianProvider({ children }) {
  const [state, dispatch] = useReducer(reducer, initialState);

  useEffect(() => {
    (async () => {
      const [anchor, blocks, logs, energyEntries, energyChartData] = await Promise.all([
        getRotationAnchor(),
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

  // ── Custom Blocks ─────────────────────────────────────────────────────────

  const refreshBlocks = useCallback(async () => {
    const blocks = await getCustomBlocks();
    dispatch({ type: A.SET_BLOCKS, payload: blocks });
  }, []);

  const createBlock  = useCallback(async (b)         => { await addCustomBlock(b);           await refreshBlocks(); }, [refreshBlocks]);
  const editBlock    = useCallback(async (id, changes)=> { await updateCustomBlock(id, changes); await refreshBlocks(); }, [refreshBlocks]);
  const removeBlock  = useCallback(async (id)         => { await deleteCustomBlock(id);       await refreshBlocks(); }, [refreshBlocks]);
  const toggleBlock  = useCallback(async (id)         => { await toggleCustomBlockActive(id); await refreshBlocks(); }, [refreshBlocks]);

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
