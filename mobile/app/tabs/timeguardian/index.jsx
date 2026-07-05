/**
 * app/tabs/timeguardian/index.jsx
 * Home — week view with navigation, energy check-in, check-request modal, exception modal.
 *
 * Fixes:
 * 1. Week navigation — prev/next week arrows
 * 2. Date info visible on every day card
 * 3. CTA bar uses useSafeAreaInsets so it never overlaps the tab bar
 */

import React, { useState, useMemo } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  Modal, TextInput, Alert, ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTimeGuardian } from '../../../context/TimeGuardianContext';
import { getBlocksForDate, todayStr, nowTimeStr } from '../../../timeguardian/logic/dayBlocks';
import { findConflict, DURATION_PRESETS, WHOLE_DAY_START, WHOLE_DAY_END, computeEndTime } from '../../../timeguardian/logic/conflict';
import {
  TGColors, TGCategoryColors, TGEnergyColors, TGEnergyLabels, DAY_LABELS_FULL,
} from '../../../timeguardian/theme/tokens';

// ─── Week helpers ─────────────────────────────────────────────────────────────

/** Returns the Sunday of the week containing the given Date object */
function getSundayOf(date) {
  const d = new Date(date);
  d.setDate(d.getDate() - d.getDay());
  d.setHours(0, 0, 0, 0);
  return d;
}

/** Returns 7 YYYY-MM-DD strings for the week starting at sundayDate */
function getWeekDates(sundayDate) {
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(sundayDate);
    d.setDate(sundayDate.getDate() + i);
    return d.toISOString().split('T')[0];
  });
}

/** Formats a Sunday date as "Jun 29 – Jul 5" style range label */
function weekRangeLabel(sundayDate) {
  const saturday = new Date(sundayDate);
  saturday.setDate(sundayDate.getDate() + 6);
  const fmt = (d) => d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
  return `${fmt(sundayDate)} – ${fmt(saturday)}`;
}

// ─── First-launch anchor prompt ───────────────────────────────────────────────

function AnchorPrompt({ onSave }) {
  const [date, setDate] = useState('');
  const handleSave = () => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      Alert.alert('Invalid format', 'Enter a date as YYYY-MM-DD.');
      return;
    }
    if (new Date(date + 'T00:00:00').getDay() !== 0) {
      Alert.alert('Not a Sunday', 'The anchor date must be a Sunday.');
      return;
    }
    onSave(date);
  };
  return (
    <View style={styles.anchorWrap}>
      <Text style={styles.anchorTitle}>Welcome to Time Guardian</Text>
      <Text style={styles.anchorBody}>
        To set up your 4-week rotation, enter a Sunday when you visited your mother's home.
        You only need to do this once.
      </Text>
      <TextInput style={styles.input} placeholder="YYYY-MM-DD  (a Sunday)"
        placeholderTextColor={TGColors.muted} value={date} onChangeText={setDate} />
      <TouchableOpacity style={styles.goldBtn} onPress={handleSave}>
        <Text style={styles.goldBtnText}>Set anchor & begin</Text>
      </TouchableOpacity>
    </View>
  );
}

// ─── Energy check-in ─────────────────────────────────────────────────────────

function EnergyCheckIn({ todayEnergy, onCheckIn }) {
  const [pendingLevel, setPendingLevel] = useState(null);
  const causes = ['Work', 'Family', 'Karmayoga', 'Health', 'Other'];
  const handleLevel = (level) => {
    setPendingLevel(level);
    if (level >= 3) { onCheckIn(level, null); setPendingLevel(null); }
  };
  return (
    <View style={styles.energyCard}>
      <Text style={styles.energyHeading}>
        How are you today?
        {todayEnergy
          ? <Text style={{ color: TGEnergyColors[todayEnergy.level], fontWeight: '600' }}>
              {'  '}{TGEnergyLabels[todayEnergy.level]}
            </Text>
          : null}
      </Text>
      <View style={styles.chipRow}>
        {[1, 2, 3, 4, 5].map((l) => (
          <TouchableOpacity key={l}
            style={[styles.energyBtn, { borderColor: TGEnergyColors[l] }]}
            onPress={() => handleLevel(l)}>
            <Text style={[styles.energyBtnText, { color: TGEnergyColors[l] }]}>
              {TGEnergyLabels[l]}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
      {pendingLevel !== null && pendingLevel <= 2 && (
        <View style={{ marginTop: 10 }}>
          <Text style={styles.fieldLabel}>What's causing this?</Text>
          <View style={styles.chipRow}>
            {causes.map((c) => (
              <TouchableOpacity key={c} style={styles.causeChip}
                onPress={() => { onCheckIn(pendingLevel, c); setPendingLevel(null); }}>
                <Text style={styles.causeChipText}>{c}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      )}
    </View>
  );
}

// ─── Block row ────────────────────────────────────────────────────────────────

function BlockRow({ block }) {
  const color = TGCategoryColors[block.category] || TGColors.muted;
  return (
    <View style={styles.blockRow}>
      <View style={[styles.blockBar, { backgroundColor: color }]} />
      <View style={{ flex: 1 }}>
        <Text style={styles.blockLabel}>{block.label}</Text>
        <Text style={styles.blockTime}>{block.start} – {block.end}</Text>
      </View>
      {block.type === 'soft' && (
        <View style={styles.softTag}>
          <Text style={styles.softTagText}>soft</Text>
        </View>
      )}
    </View>
  );
}

// ─── Day section ─────────────────────────────────────────────────────────────

function DaySection({ dateStr, anchorDate, customBlocks }) {
  const isToday = dateStr === todayStr();
  const blocks  = useMemo(
    () => getBlocksForDate(dateStr, anchorDate, customBlocks),
    [dateStr, anchorDate, customBlocks]
  );
  const visible = blocks.filter((b) => b.category !== 'sleep');
  const d       = new Date(dateStr + 'T00:00:00');

  // Full date display: "Monday, 30 Jun"
  const dayName   = DAY_LABELS_FULL[d.getDay()];
  const dateLabel = d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });

  return (
    <View style={[styles.dayCard, isToday && styles.dayCardToday]}>
      <View style={styles.dayHeader}>
        <View>
          <Text style={[styles.dayName, isToday && { color: TGColors.gold }]}>
            {dayName}
            {isToday ? <Text style={styles.todayTag}>  Today</Text> : null}
          </Text>
          <Text style={styles.dayDate}>{dateLabel}</Text>
        </View>
      </View>
      {visible.length === 0
        ? <Text style={styles.openText}>open — nothing claimed yet</Text>
        : visible.map((b, i) => <BlockRow key={i} block={b} />)}
    </View>
  );
}

// ─── Check Request Modal ──────────────────────────────────────────────────────

function CheckRequestModal({ visible, onClose, anchorDate, customBlocks, onLog }) {
  const [label,    setLabel]    = useState('');
  const [date,     setDate]     = useState(todayStr());
  const [start,    setStart]    = useState('');
  const [duration, setDuration] = useState('1h');
  const [result,   setResult]   = useState(null);
  const [movedTo,  setMovedTo]  = useState('');

  const durations = Object.keys(DURATION_PRESETS);

  const reset = () => {
    setLabel(''); setDate(todayStr()); setStart('');
    setDuration('1h'); setResult(null); setMovedTo('');
  };

  const handleCheck = () => {
    if (!label.trim() || !date || !start) {
      Alert.alert('Missing fields', 'Fill in label, date, and start time.');
      return;
    }
    const reqStart = duration === 'whole day' ? WHOLE_DAY_START : start;
    const reqEnd   = duration === 'whole day'
      ? WHOLE_DAY_END
      : computeEndTime(start, DURATION_PRESETS[duration]);
    setResult({ ...findConflict(date, reqStart, reqEnd, anchorDate, customBlocks), reqStart, reqEnd });
  };

  const handleLog = async (outcome) => {
    await onLog({
      date, start: result.reqStart, end: result.reqEnd,
      requestLabel: label, outcome,
      displaced: result.block?.label ?? null,
      movedTo: movedTo || null,
    });
    reset(); onClose();
  };

  const isSleep = result?.block?.category === 'sleep';

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={styles.modal}>
        <View style={styles.modalHeader}>
          <Text style={styles.modalTitle}>Someone's asking for my time</Text>
          <TouchableOpacity onPress={() => { reset(); onClose(); }}>
            <Text style={styles.modalClose}>✕</Text>
          </TouchableOpacity>
        </View>
        <ScrollView contentContainerStyle={styles.modalScroll}>
          {result === null ? (
            <>
              <Text style={styles.fieldLabel}>What's being asked?</Text>
              <TextInput style={styles.input} placeholderTextColor={TGColors.muted}
                placeholder="Label" value={label} onChangeText={setLabel} />
              <Text style={styles.fieldLabel}>Date</Text>
              <TextInput style={styles.input} placeholderTextColor={TGColors.muted}
                placeholder="YYYY-MM-DD" value={date} onChangeText={setDate} />
              <Text style={styles.fieldLabel}>Start time</Text>
              <TextInput style={styles.input} placeholderTextColor={TGColors.muted}
                placeholder="HH:MM" value={start} onChangeText={setStart} />
              <Text style={styles.fieldLabel}>Duration</Text>
              <View style={styles.chipRow}>
                {durations.map((d) => (
                  <TouchableOpacity key={d}
                    style={[styles.chip, duration === d && styles.chipActive]}
                    onPress={() => setDuration(d)}>
                    <Text style={[styles.chipText, duration === d && styles.chipTextActive]}>{d}</Text>
                  </TouchableOpacity>
                ))}
              </View>
              <TouchableOpacity style={styles.goldBtn} onPress={handleCheck}>
                <Text style={styles.goldBtnText}>Check this slot</Text>
              </TouchableOpacity>
            </>
          ) : result.block === null ? (
            <View>
              <Text style={[styles.resultTitle, { color: TGColors.sage }]}>This slot is open</Text>
              <Text style={styles.resultSub}>{label} fits without conflict.</Text>
              <TouchableOpacity style={[styles.goldBtn, { backgroundColor: TGColors.sage }]}
                onPress={() => handleLog('open')}>
                <Text style={styles.goldBtnText}>Log it as booked</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.ghostBtn} onPress={() => setResult(null)}>
                <Text style={styles.ghostBtnText}>Back</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View>
              <Text style={[styles.resultTitle, { color: isSleep ? TGColors.night : TGColors.clay }]}>
                {isSleep ? 'This eats into sleep' : 'Conflict found'}
              </Text>
              <View style={[styles.conflictCard, { borderLeftColor: isSleep ? TGColors.night : TGColors.clay }]}>
                <Text style={styles.conflictLabel}>{result.block.label}</Text>
                <Text style={styles.conflictTime}>{result.block.start} – {result.block.end}</Text>
              </View>
              {result.count > 1 && (
                <Text style={styles.conflictExtra}>
                  Also overlaps {result.count - 1} other block{result.count - 1 > 1 ? 's' : ''}.
                </Text>
              )}
              <Text style={styles.conflictWarning}>
                Saying yes here means that gets moved, shortened, or dropped.
              </Text>
              <Text style={styles.fieldLabel}>Where does it move to? (optional)</Text>
              <TextInput style={styles.input} placeholderTextColor={TGColors.muted}
                placeholder="e.g. tomorrow morning" value={movedTo} onChangeText={setMovedTo} />
              <TouchableOpacity style={[styles.goldBtn, { backgroundColor: TGColors.sage }]}
                onPress={() => handleLog('protected')}>
                <Text style={styles.goldBtnText}>Protect it</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.goldBtn, { backgroundColor: TGColors.clay }]}
                onPress={() => handleLog('yielded')}>
                <Text style={styles.goldBtnText}>Yield this time</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.ghostBtn} onPress={() => setResult(null)}>
                <Text style={styles.ghostBtnText}>Back</Text>
              </TouchableOpacity>
            </View>
          )}
        </ScrollView>
      </View>
    </Modal>
  );
}

// ─── Exception Modal ──────────────────────────────────────────────────────────

function ExceptionModal({ visible, onClose, onLog }) {
  const [category, setCategory] = useState(null);
  const [note,     setNote]     = useState('');
  const cats = ['rest', 'health', 'emergency', 'other'];
  const reset = () => { setCategory(null); setNote(''); };
  const handleSave = async () => {
    if (!category) { Alert.alert('Select a category'); return; }
    await onLog({
      date: todayStr(), start: nowTimeStr(), end: nowTimeStr(),
      requestLabel: `Exception — ${category}`,
      outcome: 'exception', category, note: note || null,
    });
    reset(); onClose();
  };
  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={styles.modal}>
        <View style={styles.modalHeader}>
          <Text style={styles.modalTitle}>Need an exception</Text>
          <TouchableOpacity onPress={() => { reset(); onClose(); }}>
            <Text style={styles.modalClose}>✕</Text>
          </TouchableOpacity>
        </View>
        <ScrollView contentContainerStyle={styles.modalScroll}>
          <Text style={styles.exceptionNote}>
            This is not the same as yielding to someone else's ask. Exceptions are never counted against you — they're your body or life requiring care.
          </Text>
          <View style={styles.chipRow}>
            {cats.map((c) => (
              <TouchableOpacity key={c}
                style={[styles.chip, { borderColor: TGColors.clay }, category === c && { backgroundColor: TGColors.clay }]}
                onPress={() => setCategory(c)}>
                <Text style={[styles.chipText, { color: category === c ? TGColors.background : TGColors.clay }]}>
                  {c === 'rest' ? 'Rest / burnout' : c.charAt(0).toUpperCase() + c.slice(1)}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
          <Text style={styles.fieldLabel}>Note (optional)</Text>
          <TextInput style={[styles.input, { height: 80, textAlignVertical: 'top' }]}
            multiline numberOfLines={3} placeholderTextColor={TGColors.muted}
            placeholder="Anything you want to remember..."
            value={note} onChangeText={setNote} />
          <TouchableOpacity style={[styles.goldBtn, { backgroundColor: TGColors.clay }]} onPress={handleSave}>
            <Text style={styles.goldBtnText}>Save exception</Text>
          </TouchableOpacity>
        </ScrollView>
      </View>
    </Modal>
  );
}

// ─── Home Screen ──────────────────────────────────────────────────────────────

export default function TimeGuardianHome() {
  const router   = useRouter();
  const insets   = useSafeAreaInsets();
  const { isLoading, anchorDate, customBlocks, todayEnergy, saveAnchorDate, logEntry, checkInEnergy } = useTimeGuardian();

  const [checkModal,     setCheckModal]     = useState(false);
  const [exceptionModal, setExceptionModal] = useState(false);

  // Week navigation state — starts on current week's Sunday
  const [weekSunday, setWeekSunday] = useState(() => getSundayOf(new Date()));
  const weekDates = useMemo(() => getWeekDates(weekSunday), [weekSunday]);

  const goToPrevWeek = () => {
    const prev = new Date(weekSunday);
    prev.setDate(weekSunday.getDate() - 7);
    setWeekSunday(prev);
  };

  const goToNextWeek = () => {
    const next = new Date(weekSunday);
    next.setDate(weekSunday.getDate() + 7);
    setWeekSunday(next);
  };

  const goToThisWeek = () => setWeekSunday(getSundayOf(new Date()));

  const isCurrentWeek = useMemo(() => {
    const thisWeekSunday = getSundayOf(new Date());
    return weekSunday.getTime() === thisWeekSunday.getTime();
  }, [weekSunday]);

  // CTA bar height: tab bar is ~60px + insets.bottom
  const TAB_BAR_HEIGHT = 60;
  const ctaBottom = insets.bottom + TAB_BAR_HEIGHT + 10;

  if (isLoading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={TGColors.gold} />
      </View>
    );
  }

  if (!anchorDate) return <AnchorPrompt onSave={saveAnchorDate} />;

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={[
          styles.scroll,
          { paddingBottom: ctaBottom + 70 },
        ]}
      >
        {/* Energy check-in — today only */}
        {isCurrentWeek && (
          <EnergyCheckIn todayEnergy={todayEnergy} onCheckIn={checkInEnergy} />
        )}

        {/* Week navigation header */}
        <View style={styles.weekNav}>
          <TouchableOpacity style={styles.navArrowBtn} onPress={goToPrevWeek}>
            <Text style={styles.navArrow}>‹</Text>
          </TouchableOpacity>

          <View style={styles.weekNavCenter}>
            <Text style={styles.weekRangeLabel}>{weekRangeLabel(weekSunday)}</Text>
            {!isCurrentWeek && (
              <TouchableOpacity onPress={goToThisWeek}>
                <Text style={styles.thisWeekLink}>Back to this week</Text>
              </TouchableOpacity>
            )}
          </View>

          <TouchableOpacity style={styles.navArrowBtn} onPress={goToNextWeek}>
            <Text style={styles.navArrow}>›</Text>
          </TouchableOpacity>
        </View>

        {/* Nav links */}
        <View style={styles.weekActions}>
          <TouchableOpacity onPress={() => router.push('/tabs/timeguardian/ledger')}>
            <Text style={styles.weekAction}>Ledger</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => router.push('/tabs/timeguardian/settings')} style={{ marginLeft: 16 }}>
            <Text style={styles.weekAction}>Settings</Text>
          </TouchableOpacity>
        </View>

        {/* Day cards */}
        {weekDates.map((d) => (
          <DaySection key={d} dateStr={d} anchorDate={anchorDate} customBlocks={customBlocks} />
        ))}
      </ScrollView>

      {/* CTA bar — positioned above tab bar using safe area insets */}
      <View style={[styles.ctaBar, { bottom: ctaBottom }]}>
        <TouchableOpacity style={styles.exceptionCta} onPress={() => setExceptionModal(true)}>
          <Text style={styles.exceptionCtaText}>Exception</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.checkCta} onPress={() => setCheckModal(true)}>
          <Text style={styles.checkCtaText}>Someone's asking for my time</Text>
        </TouchableOpacity>
      </View>

      <CheckRequestModal
        visible={checkModal} onClose={() => setCheckModal(false)}
        anchorDate={anchorDate} customBlocks={customBlocks} onLog={logEntry}
      />
      <ExceptionModal
        visible={exceptionModal} onClose={() => setExceptionModal(false)} onLog={logEntry}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: TGColors.background },
  centered : { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: TGColors.background },
  scroll   : { padding: 16 },

  anchorWrap : { flex: 1, backgroundColor: TGColors.background, padding: 28, justifyContent: 'center' },
  anchorTitle: { fontSize: 26, color: TGColors.ink, fontWeight: '700', marginBottom: 14 },
  anchorBody : { fontSize: 14, color: TGColors.muted, lineHeight: 22, marginBottom: 24 },

  energyCard   : { backgroundColor: TGColors.surface, borderRadius: 12, padding: 16, marginBottom: 16 },
  energyHeading: { color: TGColors.muted, fontSize: 13, marginBottom: 12 },
  energyBtn    : { borderWidth: 1, borderRadius: 20, paddingHorizontal: 12, paddingVertical: 6 },
  energyBtnText: { fontSize: 12, fontWeight: '500' },
  causeChip    : { backgroundColor: TGColors.surfaceRaised, borderRadius: 16, paddingHorizontal: 12, paddingVertical: 6 },
  causeChipText: { color: TGColors.ink, fontSize: 12 },

  // Week navigation
  weekNav       : { flexDirection: 'row', alignItems: 'center', marginBottom: 6 },
  navArrowBtn   : { padding: 10 },
  navArrow      : { color: TGColors.gold, fontSize: 28, fontWeight: '300', lineHeight: 32 },
  weekNavCenter : { flex: 1, alignItems: 'center' },
  weekRangeLabel: { color: TGColors.ink, fontSize: 15, fontWeight: '600' },
  thisWeekLink  : { color: TGColors.gold, fontSize: 12, marginTop: 4 },

  weekActions: { flexDirection: 'row', justifyContent: 'flex-end', marginBottom: 12 },
  weekAction : { color: TGColors.gold, fontSize: 13, fontWeight: '500' },

  // Day cards — date info now shown clearly
  dayCard     : { backgroundColor: TGColors.surface, borderRadius: 12, padding: 14, marginBottom: 10 },
  dayCardToday: { borderWidth: 1, borderColor: TGColors.gold },
  dayHeader   : { marginBottom: 10 },
  dayName     : { color: TGColors.ink, fontWeight: '700', fontSize: 15 },
  todayTag    : { color: TGColors.gold, fontSize: 12, fontWeight: '500' },
  dayDate     : { color: TGColors.muted, fontSize: 12, marginTop: 2 },
  openText    : { color: TGColors.faint, fontSize: 13, fontStyle: 'italic' },

  blockRow   : { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  blockBar   : { width: 3, borderRadius: 2, minHeight: 32, marginRight: 10 },
  blockLabel : { color: TGColors.ink, fontSize: 13, fontWeight: '500' },
  blockTime  : { color: TGColors.muted, fontSize: 11, marginTop: 2 },
  softTag    : { backgroundColor: TGColors.surfaceRaised, borderRadius: 8, paddingHorizontal: 6, paddingVertical: 2 },
  softTagText: { color: TGColors.faint, fontSize: 10 },

  // CTA bar — bottom is computed dynamically from insets
  ctaBar          : { position: 'absolute', left: 16, right: 16, flexDirection: 'row', gap: 10 },
  checkCta        : { flex: 1, backgroundColor: TGColors.gold, borderRadius: 12, padding: 16, alignItems: 'center' },
  checkCtaText    : { color: TGColors.background, fontWeight: '700', fontSize: 14 },
  exceptionCta    : { borderWidth: 1, borderColor: TGColors.clayDim, borderRadius: 12, padding: 16, alignItems: 'center', paddingHorizontal: 14 },
  exceptionCtaText: { color: TGColors.clay, fontWeight: '600', fontSize: 14 },

  modal      : { flex: 1, backgroundColor: TGColors.background },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, borderBottomWidth: 1, borderBottomColor: TGColors.line },
  modalTitle : { color: TGColors.ink, fontSize: 17, fontWeight: '700' },
  modalClose : { color: TGColors.muted, fontSize: 18 },
  modalScroll: { padding: 20, paddingBottom: 60 },

  fieldLabel: { color: TGColors.muted, fontSize: 12, fontWeight: '500', marginBottom: 6, marginTop: 14 },
  input     : { backgroundColor: TGColors.surfaceRaised, borderRadius: 10, padding: 14, color: TGColors.ink, fontSize: 14, borderWidth: 1, borderColor: TGColors.line },

  chipRow      : { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 4 },
  chip         : { borderWidth: 1, borderColor: TGColors.line, borderRadius: 20, paddingHorizontal: 14, paddingVertical: 8 },
  chipActive   : { backgroundColor: TGColors.gold, borderColor: TGColors.gold },
  chipText     : { color: TGColors.muted, fontSize: 13 },
  chipTextActive: { color: TGColors.background, fontWeight: '600' },

  goldBtn    : { backgroundColor: TGColors.gold, borderRadius: 10, padding: 16, alignItems: 'center', marginTop: 16 },
  goldBtnText: { color: TGColors.background, fontWeight: '700', fontSize: 15 },
  ghostBtn    : { padding: 14, alignItems: 'center', marginTop: 4 },
  ghostBtnText: { color: TGColors.muted, fontSize: 14 },

  resultTitle    : { fontSize: 20, fontWeight: '700', marginBottom: 8 },
  resultSub      : { color: TGColors.muted, fontSize: 14, marginBottom: 8 },
  conflictCard   : { backgroundColor: TGColors.surface, borderRadius: 10, padding: 14, borderLeftWidth: 4, marginBottom: 10 },
  conflictLabel  : { color: TGColors.ink, fontWeight: '600', fontSize: 15 },
  conflictTime   : { color: TGColors.muted, fontSize: 12, marginTop: 4 },
  conflictExtra  : { color: TGColors.muted, fontSize: 12, marginBottom: 8 },
  conflictWarning: { color: TGColors.clay, fontSize: 13, marginBottom: 12, lineHeight: 20 },

  exceptionNote: { color: TGColors.muted, fontSize: 13, lineHeight: 20, marginBottom: 20, fontStyle: 'italic' },
});
