/**
 * app/tabs/timeguardian/settings.jsx
 * Settings — rotation anchor, custom blocks list with pause/delete, add block form.
 */

import React, { useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, TextInput,
  StyleSheet, Alert, Switch,
} from 'react-native';
import { useTimeGuardian } from '../../../context/TimeGuardianContext';
import { TGColors, DAY_LABELS_FULL } from '../../../timeguardian/theme/tokens';

const DAY_SHORT = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

const CATEGORIES = ['work', 'karmayoga', 'family', 'self', 'sleep'];
const TYPES      = ['protected', 'soft'];

function SectionTitle({ title }) {
  return <Text style={styles.sectionTitle}>{title}</Text>;
}

function BlockCard({ block, onToggle, onDelete }) {
  const days = block.days.map((d) => DAY_SHORT[d]).join(' ');
  return (
    <View style={styles.blockCard}>
      <View style={{ flex: 1 }}>
        <Text style={[styles.blockLabel, !block.active && styles.blockLabelMuted]}>
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
      <TouchableOpacity
        style={styles.deleteBtn}
        onPress={() =>
          Alert.alert('Delete block', `Remove "${block.label}"?`, [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Delete', style: 'destructive', onPress: () => onDelete(block.id) },
          ])
        }
      >
        <Text style={styles.deleteBtnText}>✕</Text>
      </TouchableOpacity>
    </View>
  );
}

export default function SettingsScreen() {
  const {
    anchorDate, customBlocks,
    saveAnchorDate, createBlock, removeBlock, toggleBlock,
  } = useTimeGuardian();

  // Anchor edit
  const [newAnchor, setNewAnchor] = useState('');
  const [editingAnchor, setEditingAnchor] = useState(false);

  // Add block form
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    label: '', category: 'self', type: 'soft',
    days: [], start: '08:00', end: '09:00',
  });

  const setF = (key, value) => setForm((p) => ({ ...p, [key]: value }));

  const toggleDay = (d) =>
    setF('days', form.days.includes(d) ? form.days.filter((x) => x !== d) : [...form.days, d]);

  const handleSaveAnchor = () => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(newAnchor)) {
      Alert.alert('Invalid format', 'Use YYYY-MM-DD.');
      return;
    }
    const d = new Date(newAnchor + 'T00:00:00');
    if (d.getDay() !== 0) {
      Alert.alert('Not a Sunday', 'Anchor must be a Sunday.');
      return;
    }
    saveAnchorDate(newAnchor);
    setEditingAnchor(false);
    setNewAnchor('');
  };

  const handleAddBlock = async () => {
    if (!form.label.trim()) { Alert.alert('Label required'); return; }
    if (form.days.length === 0) { Alert.alert('Select at least one day'); return; }
    await createBlock({ ...form, days: form.days.sort() });
    setForm({ label: '', category: 'self', type: 'soft', days: [], start: '08:00', end: '09:00' });
    setShowForm(false);
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.scroll}>

      {/* Rotation Anchor */}
      <SectionTitle title="Rotation Anchor" />
      <View style={styles.card}>
        <Text style={styles.fieldLabel}>Current anchor date</Text>
        <Text style={styles.anchorDate}>{anchorDate ?? 'Not set'}</Text>
        {!editingAnchor ? (
          <TouchableOpacity style={styles.outlineBtn} onPress={() => setEditingAnchor(true)}>
            <Text style={styles.outlineBtnText}>Change anchor</Text>
          </TouchableOpacity>
        ) : (
          <>
            <TextInput
              style={styles.input}
              placeholder="YYYY-MM-DD (a Sunday)"
              placeholderTextColor={TGColors.muted}
              value={newAnchor}
              onChangeText={setNewAnchor}
            />
            <View style={{ flexDirection: 'row', gap: 10, marginTop: 10 }}>
              <TouchableOpacity style={[styles.goldBtn, { flex: 1 }]} onPress={handleSaveAnchor}>
                <Text style={styles.goldBtnText}>Save</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.outlineBtn, { flex: 1 }]} onPress={() => setEditingAnchor(false)}>
                <Text style={styles.outlineBtnText}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </>
        )}
      </View>

      {/* Custom Blocks */}
      <SectionTitle title="Your Blocks" />
      {customBlocks.length === 0 ? (
        <Text style={styles.empty}>No custom blocks yet.</Text>
      ) : (
        customBlocks.map((b) => (
          <BlockCard key={b.id} block={b} onToggle={toggleBlock} onDelete={removeBlock} />
        ))
      )}

      {/* Add Block */}
      {!showForm ? (
        <TouchableOpacity style={styles.addBtn} onPress={() => setShowForm(true)}>
          <Text style={styles.addBtnText}>+ Add block</Text>
        </TouchableOpacity>
      ) : (
        <View style={styles.card}>
          <Text style={styles.formTitle}>New Block</Text>

          <Text style={styles.fieldLabel}>Label</Text>
          <TextInput style={styles.input} placeholderTextColor={TGColors.muted}
            placeholder="e.g. Evening walk" value={form.label} onChangeText={(v) => setF('label', v)} />

          <Text style={styles.fieldLabel}>Days</Text>
          <View style={styles.dayRow}>
            {DAY_SHORT.map((d, i) => (
              <TouchableOpacity key={i}
                style={[styles.dayBtn, form.days.includes(i) && styles.dayBtnActive]}
                onPress={() => toggleDay(i)}>
                <Text style={[styles.dayBtnText, form.days.includes(i) && styles.dayBtnTextActive]}>
                  {d}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <View style={{ flexDirection: 'row', gap: 10 }}>
            <View style={{ flex: 1 }}>
              <Text style={styles.fieldLabel}>Start</Text>
              <TextInput style={styles.input} placeholderTextColor={TGColors.muted}
                placeholder="HH:MM" value={form.start} onChangeText={(v) => setF('start', v)} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.fieldLabel}>End</Text>
              <TextInput style={styles.input} placeholderTextColor={TGColors.muted}
                placeholder="HH:MM" value={form.end} onChangeText={(v) => setF('end', v)} />
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
            {TYPES.map((t) => (
              <TouchableOpacity key={t}
                style={[styles.chip, form.type === t && styles.chipActive]}
                onPress={() => setF('type', t)}>
                <Text style={[styles.chipText, form.type === t && styles.chipTextActive]}>{t}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <View style={{ flexDirection: 'row', gap: 10, marginTop: 16 }}>
            <TouchableOpacity style={[styles.goldBtn, { flex: 1 }]} onPress={handleAddBlock}>
              <Text style={styles.goldBtnText}>Save block</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.outlineBtn, { flex: 1 }]} onPress={() => setShowForm(false)}>
              <Text style={styles.outlineBtnText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: TGColors.background },
  scroll   : { padding: 16, paddingBottom: 60 },

  sectionTitle: { color: TGColors.muted, fontSize: 11, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 10, marginTop: 20 },

  card: { backgroundColor: TGColors.surface, borderRadius: 12, padding: 16, marginBottom: 12 },

  fieldLabel : { color: TGColors.muted, fontSize: 12, fontWeight: '500', marginBottom: 6, marginTop: 12 },
  anchorDate : { color: TGColors.ink, fontSize: 18, fontWeight: '600', marginBottom: 12 },

  input: { backgroundColor: TGColors.surfaceRaised, borderRadius: 10, padding: 14, color: TGColors.ink, fontSize: 14, borderWidth: 1, borderColor: TGColors.line },

  goldBtn    : { backgroundColor: TGColors.gold, borderRadius: 10, padding: 14, alignItems: 'center' },
  goldBtnText: { color: TGColors.background, fontWeight: '700', fontSize: 14 },
  outlineBtn    : { borderWidth: 1, borderColor: TGColors.line, borderRadius: 10, padding: 14, alignItems: 'center' },
  outlineBtnText: { color: TGColors.muted, fontSize: 14 },

  blockCard    : { backgroundColor: TGColors.surface, borderRadius: 12, padding: 14, marginBottom: 8, flexDirection: 'row', alignItems: 'center' },
  blockLabel   : { color: TGColors.ink, fontSize: 14, fontWeight: '500', marginBottom: 4 },
  blockLabelMuted: { color: TGColors.faint },
  blockMeta    : { color: TGColors.muted, fontSize: 11 },
  deleteBtn    : { marginLeft: 10, padding: 6 },
  deleteBtnText: { color: TGColors.clay, fontSize: 16 },

  addBtn    : { borderWidth: 1, borderColor: TGColors.gold, borderRadius: 12, padding: 16, alignItems: 'center', marginTop: 8 },
  addBtnText: { color: TGColors.gold, fontWeight: '600', fontSize: 14 },

  formTitle: { color: TGColors.ink, fontSize: 16, fontWeight: '700', marginBottom: 4 },

  dayRow     : { flexDirection: 'row', gap: 8, marginTop: 4 },
  dayBtn     : { width: 36, height: 36, borderRadius: 18, borderWidth: 1, borderColor: TGColors.line, alignItems: 'center', justifyContent: 'center' },
  dayBtnActive: { backgroundColor: TGColors.gold, borderColor: TGColors.gold },
  dayBtnText : { color: TGColors.muted, fontSize: 12, fontWeight: '500' },
  dayBtnTextActive: { color: TGColors.background },

  chipRow      : { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 4 },
  chip         : { borderWidth: 1, borderColor: TGColors.line, borderRadius: 20, paddingHorizontal: 14, paddingVertical: 8 },
  chipActive   : { backgroundColor: TGColors.gold, borderColor: TGColors.gold },
  chipText     : { color: TGColors.muted, fontSize: 13 },
  chipTextActive: { color: TGColors.background, fontWeight: '600' },

  empty: { color: TGColors.muted, fontSize: 13, fontStyle: 'italic', marginBottom: 12 },
});
