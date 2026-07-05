/**
 * app/tabs/timeguardian/settings.jsx
 * Settings — anchor date, work hours, rotation schedule, custom blocks.
 * Edit is intentionally non-trivial — all schedule editing lives here only.
 */

import React, { useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  TextInput, StyleSheet, Alert, Switch,
} from 'react-native';
import { useTimeGuardian } from '../../../context/TimeGuardianContext';
import { TGColors, DAY_LABELS_FULL } from '../../../timeguardian/theme/tokens';

const DAY_SHORT   = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
const CATEGORIES  = ['work', 'karmayoga', 'family', 'self', 'sleep'];
const BLOCK_TYPES = ['protected', 'soft'];

// ─── Small reusable components ────────────────────────────────────────────────

function SectionTitle({ title, subtitle }) {
  return (
    <View style={styles.sectionHead}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {subtitle ? <Text style={styles.sectionSub}>{subtitle}</Text> : null}
    </View>
  );
}

function FieldRow({ label, value, onChangeText, placeholder }) {
  return (
    <View style={styles.fieldGroup}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        style={styles.input}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder || 'HH:MM'}
        placeholderTextColor={TGColors.muted}
      />
    </View>
  );
}

// ─── Section: Rotation Anchor ─────────────────────────────────────────────────

function AnchorSection({ anchorDate, onSave }) {
  const [editing,    setEditing]    = useState(false);
  const [newAnchor,  setNewAnchor]  = useState('');

  const handleSave = () => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(newAnchor)) {
      Alert.alert('Invalid format', 'Use YYYY-MM-DD.');
      return;
    }
    if (new Date(newAnchor + 'T00:00:00').getDay() !== 0) {
      Alert.alert('Not a Sunday', 'Anchor must be a Sunday.');
      return;
    }
    onSave(newAnchor);
    setEditing(false);
    setNewAnchor('');
  };

  return (
    <>
      <SectionTitle title="Rotation Anchor"
        subtitle="A known Sunday — Mother's home visit. The 4-week cycle is computed from this date." />
      <View style={styles.card}>
        <Text style={styles.fieldLabel}>Current anchor</Text>
        <Text style={styles.valueText}>{anchorDate ?? 'Not set'}</Text>
        {!editing ? (
          <TouchableOpacity style={styles.outlineBtn} onPress={() => setEditing(true)}>
            <Text style={styles.outlineBtnText}>Change anchor date</Text>
          </TouchableOpacity>
        ) : (
          <>
            <TextInput style={[styles.input, { marginTop: 10 }]}
              placeholder="YYYY-MM-DD (a Sunday)"
              placeholderTextColor={TGColors.muted}
              value={newAnchor} onChangeText={setNewAnchor} />
            <View style={styles.btnRow}>
              <TouchableOpacity style={[styles.goldBtn, { flex: 1 }]} onPress={handleSave}>
                <Text style={styles.goldBtnText}>Save</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.outlineBtn, { flex: 1 }]} onPress={() => setEditing(false)}>
                <Text style={styles.outlineBtnText}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </>
        )}
      </View>
    </>
  );
}

// ─── Section: Work Hours ──────────────────────────────────────────────────────

function WorkHoursSection({ workHours, onSave }) {
  const [editing, setEditing]   = useState(false);
  const [form,    setForm]      = useState({ ...workHours });
  const setF = (k, v) => setForm((p) => ({ ...p, [k]: v }));

  const handleSave = () => {
    const timeRe = /^\d{2}:\d{2}$/;
    if (!timeRe.test(form.workStart) || !timeRe.test(form.workEnd) || !timeRe.test(form.overtimeEnd)) {
      Alert.alert('Invalid time', 'All times must be in HH:MM format.');
      return;
    }
    onSave(form);
    setEditing(false);
  };

  const handleCancel = () => {
    setForm({ ...workHours });
    setEditing(false);
  };

  return (
    <>
      <SectionTitle title="Work Hours"
        subtitle="Applies Mon–Fri. Overtime buffer runs from work end to overtime end — it's soft, not protected." />
      <View style={styles.card}>
        {!editing ? (
          <>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Work</Text>
              <Text style={styles.summaryValue}>{workHours.workStart} – {workHours.workEnd}</Text>
            </View>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Overtime buffer</Text>
              <Text style={styles.summaryValue}>{workHours.workEnd} – {workHours.overtimeEnd}</Text>
            </View>
            <TouchableOpacity style={styles.outlineBtn} onPress={() => { setForm({ ...workHours }); setEditing(true); }}>
              <Text style={styles.outlineBtnText}>Edit work hours</Text>
            </TouchableOpacity>
          </>
        ) : (
          <>
            <FieldRow label="Work starts" value={form.workStart} onChangeText={(v) => setF('workStart', v)} />
            <FieldRow label="Work ends" value={form.workEnd} onChangeText={(v) => setF('workEnd', v)} />
            <FieldRow label="Overtime buffer ends" value={form.overtimeEnd} onChangeText={(v) => setF('overtimeEnd', v)} />
            <View style={styles.btnRow}>
              <TouchableOpacity style={[styles.goldBtn, { flex: 1 }]} onPress={handleSave}>
                <Text style={styles.goldBtnText}>Save</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.outlineBtn, { flex: 1 }]} onPress={handleCancel}>
                <Text style={styles.outlineBtnText}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </>
        )}
      </View>
    </>
  );
}

// ─── Section: Rotation Schedule ───────────────────────────────────────────────

function RotationSlotCard({ slot, onSave, onReset }) {
  const [editing, setEditing] = useState(false);
  const [form,    setForm]    = useState({ ...slot });
  const setF = (k, v) => setForm((p) => ({ ...p, [k]: v }));

  const weekLabels = ['Week A', 'Week B', 'Week C', 'Week D'];

  const handleSave = () => {
    const timeRe = /^\d{2}:\d{2}$/;
    if (!form.sundayLabel.trim()) { Alert.alert('Sunday label required'); return; }
    if (!timeRe.test(form.sundayStart) || !timeRe.test(form.sundayEnd)) {
      Alert.alert('Invalid time', 'Sunday times must be HH:MM.'); return;
    }
    if (form.hasSaturday) {
      if (!form.saturdayLabel?.trim()) { Alert.alert('Saturday label required'); return; }
      if (!timeRe.test(form.saturdayStart) || !timeRe.test(form.saturdayEnd)) {
        Alert.alert('Invalid time', 'Saturday times must be HH:MM.'); return;
      }
    }
    onSave(slot.index, form);
    setEditing(false);
  };

  return (
    <View style={styles.slotCard}>
      <View style={styles.slotHeader}>
        <Text style={styles.slotWeekLabel}>{weekLabels[slot.index]}</Text>
        {!editing && (
          <TouchableOpacity onPress={() => { setForm({ ...slot }); setEditing(true); }}>
            <Text style={styles.editLink}>Edit</Text>
          </TouchableOpacity>
        )}
      </View>

      {!editing ? (
        <>
          <Text style={styles.slotLine}>
            Sunday: <Text style={styles.slotValue}>{slot.sundayLabel}</Text>
            {'  '}{slot.sundayStart}–{slot.sundayEnd}
          </Text>
          {slot.hasSaturday && (
            <Text style={styles.slotLine}>
              Saturday: <Text style={styles.slotValue}>{slot.saturdayLabel}</Text>
              {'  '}{slot.saturdayStart}–{slot.saturdayEnd}
            </Text>
          )}
          {!slot.hasSaturday && (
            <Text style={[styles.slotLine, { color: TGColors.faint }]}>Saturday: open</Text>
          )}
        </>
      ) : (
        <>
          <Text style={styles.subHead}>Sunday</Text>
          <FieldRow label="Label" value={form.sundayLabel}
            onChangeText={(v) => setF('sundayLabel', v)} placeholder="e.g. Family visit" />
          <View style={styles.timeRow}>
            <View style={{ flex: 1, marginRight: 8 }}>
              <FieldRow label="Start" value={form.sundayStart} onChangeText={(v) => setF('sundayStart', v)} />
            </View>
            <View style={{ flex: 1 }}>
              <FieldRow label="End" value={form.sundayEnd} onChangeText={(v) => setF('sundayEnd', v)} />
            </View>
          </View>

          <View style={styles.toggleRow}>
            <Text style={styles.fieldLabel}>Saturday also blocked?</Text>
            <Switch
              value={form.hasSaturday}
              onValueChange={(v) => setF('hasSaturday', v)}
              trackColor={{ false: TGColors.line, true: TGColors.goldDim }}
              thumbColor={form.hasSaturday ? TGColors.gold : TGColors.faint}
            />
          </View>

          {form.hasSaturday && (
            <>
              <Text style={styles.subHead}>Saturday</Text>
              <FieldRow label="Label" value={form.saturdayLabel || ''}
                onChangeText={(v) => setF('saturdayLabel', v)} placeholder="e.g. Karmayoga" />
              <View style={styles.timeRow}>
                <View style={{ flex: 1, marginRight: 8 }}>
                  <FieldRow label="Start" value={form.saturdayStart || ''} onChangeText={(v) => setF('saturdayStart', v)} />
                </View>
                <View style={{ flex: 1 }}>
                  <FieldRow label="End" value={form.saturdayEnd || ''} onChangeText={(v) => setF('saturdayEnd', v)} />
                </View>
              </View>
            </>
          )}

          <View style={styles.btnRow}>
            <TouchableOpacity style={[styles.goldBtn, { flex: 1 }]} onPress={handleSave}>
              <Text style={styles.goldBtnText}>Save</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.outlineBtn, { flex: 1 }]} onPress={() => setEditing(false)}>
              <Text style={styles.outlineBtnText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </>
      )}
    </View>
  );
}

function RotationScheduleSection({ rotationSchedule, onSaveSlot, onReset }) {
  return (
    <>
      <SectionTitle title="Rotation Schedule"
        subtitle="4-week Sunday/Saturday cycle. Each slot maps to one week in the rotation. Changes take effect immediately on the week view." />
      {rotationSchedule.map((slot) => (
        <RotationSlotCard key={slot.index} slot={slot} onSave={onSaveSlot} />
      ))}
      <TouchableOpacity style={styles.resetBtn} onPress={() =>
        Alert.alert('Reset rotation?', 'This will restore the original 4 slots.', [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Reset', style: 'destructive', onPress: onReset },
        ])
      }>
        <Text style={styles.resetBtnText}>Reset to defaults</Text>
      </TouchableOpacity>
    </>
  );
}

// ─── Section: Custom Blocks ───────────────────────────────────────────────────

function BlockCard({ block, onToggle, onDelete }) {
  const days = block.days.map((d) => DAY_SHORT[d]).join(' ');
  return (
    <View style={styles.blockCard}>
      <View style={{ flex: 1 }}>
        <Text style={[styles.blockLabel, !block.active && { color: TGColors.faint }]}>
          {block.label}
        </Text>
        <Text style={styles.blockMeta}>
          {days}  ·  {block.start}–{block.end}  ·  {block.category}  ·  {block.type}
        </Text>
      </View>
      <Switch
        value={block.active}
        onValueChange={() => onToggle(block.id)}
        trackColor={{ false: TGColors.line, true: TGColors.sageDim }}
        thumbColor={block.active ? TGColors.sage : TGColors.faint}
      />
      <TouchableOpacity style={{ marginLeft: 10, padding: 6 }}
        onPress={() =>
          Alert.alert('Delete block', `Remove "${block.label}"?`, [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Delete', style: 'destructive', onPress: () => onDelete(block.id) },
          ])
        }>
        <Text style={{ color: TGColors.clay, fontSize: 16 }}>✕</Text>
      </TouchableOpacity>
    </View>
  );
}

function CustomBlocksSection({ customBlocks, onToggle, onDelete, onCreate }) {
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    label: '', category: 'self', type: 'soft',
    days: [], start: '08:00', end: '09:00',
  });
  const setF = (k, v) => setForm((p) => ({ ...p, [k]: v }));
  const toggleDay = (d) =>
    setF('days', form.days.includes(d) ? form.days.filter((x) => x !== d) : [...form.days, d]);

  const handleAdd = async () => {
    if (!form.label.trim()) { Alert.alert('Label required'); return; }
    if (form.days.length === 0) { Alert.alert('Select at least one day'); return; }
    await onCreate({ ...form, days: form.days.sort() });
    setForm({ label: '', category: 'self', type: 'soft', days: [], start: '08:00', end: '09:00' });
    setShowForm(false);
  };

  return (
    <>
      <SectionTitle title="Your Blocks"
        subtitle="Personal recurring commitments. Toggle to pause without deleting." />
      {customBlocks.length === 0 && (
        <Text style={styles.emptyText}>No custom blocks yet.</Text>
      )}
      {customBlocks.map((b) => (
        <BlockCard key={b.id} block={b} onToggle={onToggle} onDelete={onDelete} />
      ))}

      {!showForm ? (
        <TouchableOpacity style={styles.addBtn} onPress={() => setShowForm(true)}>
          <Text style={styles.addBtnText}>+ Add block</Text>
        </TouchableOpacity>
      ) : (
        <View style={styles.card}>
          <Text style={styles.formTitle}>New Block</Text>
          <FieldRow label="Label" value={form.label}
            onChangeText={(v) => setF('label', v)} placeholder="e.g. Evening walk" />

          <Text style={styles.fieldLabel}>Days</Text>
          <View style={styles.dayRow}>
            {DAY_SHORT.map((d, i) => (
              <TouchableOpacity key={i}
                style={[styles.dayBtn, form.days.includes(i) && styles.dayBtnActive]}
                onPress={() => toggleDay(i)}>
                <Text style={[styles.dayBtnText, form.days.includes(i) && { color: TGColors.background }]}>
                  {d}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <View style={styles.timeRow}>
            <View style={{ flex: 1, marginRight: 8 }}>
              <FieldRow label="Start" value={form.start} onChangeText={(v) => setF('start', v)} />
            </View>
            <View style={{ flex: 1 }}>
              <FieldRow label="End" value={form.end} onChangeText={(v) => setF('end', v)} />
            </View>
          </View>

          <Text style={styles.fieldLabel}>Category</Text>
          <View style={styles.chipRow}>
            {CATEGORIES.map((c) => (
              <TouchableOpacity key={c}
                style={[styles.chip, form.category === c && styles.chipActive]}
                onPress={() => setF('category', c)}>
                <Text style={[styles.chipText, form.category === c && styles.chipTextActive]}>{c}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={styles.fieldLabel}>Type</Text>
          <View style={styles.chipRow}>
            {BLOCK_TYPES.map((t) => (
              <TouchableOpacity key={t}
                style={[styles.chip, form.type === t && styles.chipActive]}
                onPress={() => setF('type', t)}>
                <Text style={[styles.chipText, form.type === t && styles.chipTextActive]}>{t}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <View style={styles.btnRow}>
            <TouchableOpacity style={[styles.goldBtn, { flex: 1 }]} onPress={handleAdd}>
              <Text style={styles.goldBtnText}>Save block</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.outlineBtn, { flex: 1 }]} onPress={() => setShowForm(false)}>
              <Text style={styles.outlineBtnText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </>
  );
}

// ─── Settings Screen ──────────────────────────────────────────────────────────

export default function SettingsScreen() {
  const {
    anchorDate, workHours, rotationSchedule, customBlocks,
    saveAnchorDate, updateWorkHours,
    updateRotationSlotById, resetRotationSchedule,
    createBlock, removeBlock, toggleBlock,
  } = useTimeGuardian();

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.scroll}>

      <AnchorSection anchorDate={anchorDate} onSave={saveAnchorDate} />

      <WorkHoursSection workHours={workHours} onSave={updateWorkHours} />

      <RotationScheduleSection
        rotationSchedule={rotationSchedule}
        onSaveSlot={updateRotationSlotById}
        onReset={resetRotationSchedule}
      />

      <CustomBlocksSection
        customBlocks={customBlocks}
        onToggle={toggleBlock}
        onDelete={removeBlock}
        onCreate={createBlock}
      />

    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container : { flex: 1, backgroundColor: TGColors.background },
  scroll    : { padding: 16, paddingBottom: 60 },

  sectionHead : { marginTop: 24, marginBottom: 10 },
  sectionTitle: { color: TGColors.ink, fontSize: 15, fontWeight: '700' },
  sectionSub  : { color: TGColors.muted, fontSize: 12, marginTop: 4, lineHeight: 18 },

  card: { backgroundColor: TGColors.surface, borderRadius: 12, padding: 16, marginBottom: 10 },

  fieldGroup: { marginBottom: 12 },
  fieldLabel: { color: TGColors.muted, fontSize: 12, fontWeight: '500', marginBottom: 6 },
  input     : { backgroundColor: TGColors.surfaceRaised, borderRadius: 10, padding: 14, color: TGColors.ink, fontSize: 14, borderWidth: 1, borderColor: TGColors.line },

  valueText : { color: TGColors.ink, fontSize: 18, fontWeight: '600', marginBottom: 12 },

  summaryRow  : { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  summaryLabel: { color: TGColors.muted, fontSize: 13 },
  summaryValue: { color: TGColors.ink, fontSize: 13, fontWeight: '500' },

  btnRow    : { flexDirection: 'row', gap: 10, marginTop: 14 },
  goldBtn   : { backgroundColor: TGColors.gold, borderRadius: 10, padding: 14, alignItems: 'center' },
  goldBtnText: { color: TGColors.background, fontWeight: '700', fontSize: 14 },
  outlineBtn    : { borderWidth: 1, borderColor: TGColors.line, borderRadius: 10, padding: 14, alignItems: 'center' },
  outlineBtnText: { color: TGColors.muted, fontSize: 14 },

  // Rotation slot
  slotCard    : { backgroundColor: TGColors.surface, borderRadius: 12, padding: 16, marginBottom: 10 },
  slotHeader  : { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 },
  slotWeekLabel: { color: TGColors.gold, fontSize: 13, fontWeight: '700', letterSpacing: 0.5 },
  editLink    : { color: TGColors.gold, fontSize: 13 },
  slotLine    : { color: TGColors.muted, fontSize: 13, marginBottom: 4 },
  slotValue   : { color: TGColors.ink, fontWeight: '500' },
  subHead     : { color: TGColors.muted, fontSize: 11, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 1, marginTop: 12, marginBottom: 4 },
  timeRow     : { flexDirection: 'row' },
  toggleRow   : { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 12 },

  resetBtn    : { borderWidth: 1, borderColor: TGColors.clayDim, borderRadius: 10, padding: 14, alignItems: 'center', marginTop: 4, marginBottom: 8 },
  resetBtnText: { color: TGColors.clay, fontSize: 13 },

  // Custom blocks
  blockCard  : { backgroundColor: TGColors.surface, borderRadius: 12, padding: 14, marginBottom: 8, flexDirection: 'row', alignItems: 'center' },
  blockLabel : { color: TGColors.ink, fontSize: 14, fontWeight: '500', marginBottom: 4 },
  blockMeta  : { color: TGColors.muted, fontSize: 11 },

  addBtn    : { borderWidth: 1, borderColor: TGColors.gold, borderRadius: 12, padding: 16, alignItems: 'center', marginTop: 8 },
  addBtnText: { color: TGColors.gold, fontWeight: '600', fontSize: 14 },

  formTitle: { color: TGColors.ink, fontSize: 16, fontWeight: '700', marginBottom: 8 },
  dayRow   : { flexDirection: 'row', gap: 8, marginTop: 4, marginBottom: 4 },
  dayBtn   : { width: 36, height: 36, borderRadius: 18, borderWidth: 1, borderColor: TGColors.line, alignItems: 'center', justifyContent: 'center' },
  dayBtnActive: { backgroundColor: TGColors.gold, borderColor: TGColors.gold },
  dayBtnText: { color: TGColors.muted, fontSize: 12, fontWeight: '500' },

  chipRow      : { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 4, marginBottom: 4 },
  chip         : { borderWidth: 1, borderColor: TGColors.line, borderRadius: 20, paddingHorizontal: 14, paddingVertical: 8 },
  chipActive   : { backgroundColor: TGColors.gold, borderColor: TGColors.gold },
  chipText     : { color: TGColors.muted, fontSize: 13 },
  chipTextActive: { color: TGColors.background, fontWeight: '600' },

  emptyText: { color: TGColors.muted, fontSize: 13, fontStyle: 'italic', marginBottom: 10 },
});
