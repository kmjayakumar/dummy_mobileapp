import React from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Colors from '../../../constants/colors';

const TOOLS = [
  {
    id: 'audio-converter',
    icon: 'musical-notes-outline',
    iconColor: Colors.primary,
    title: 'Audio Converter',
    description: 'Opus → WAV → MP3',
    route: '/tabs/tools/audio-converter',
    available: true,
  },
  {
    id: 'converted-files',
    icon: 'folder-open-outline',
    iconColor: Colors.info,
    title: 'Converted Files',
    description: 'Browse, share and manage your files',
    route: '/tabs/tools/converted-files',
    available: true,
  },
];

const COMING_SOON = [
  {
    id: 'coming-soon-1',
    icon: 'construct-outline',
    title: 'More Tools',
    description: 'Coming soon',
  },
];

export default function ToolsScreen() {
  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.container}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.pageTitle}>App Tools</Text>
        <Text style={styles.pageSubtitle}>Everything you need, in one place.</Text>

        {/* Available tools */}
        <Text style={styles.sectionLabel}>Available</Text>
        <View style={styles.list}>
          {TOOLS.map((tool, index) => (
            <TouchableOpacity
              key={tool.id}
              style={[
                styles.item,
                index < TOOLS.length - 1 && styles.itemBorder,
              ]}
              onPress={() => router.push(tool.route)}
              activeOpacity={0.7}
            >
              <View style={[styles.iconWrap, { backgroundColor: tool.iconColor + '20' }]}>
                <Ionicons name={tool.icon} size={22} color={tool.iconColor} />
              </View>
              <View style={styles.itemText}>
                <Text style={styles.itemTitle}>{tool.title}</Text>
                <Text style={styles.itemDesc}>{tool.description}</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={Colors.textMuted} />
            </TouchableOpacity>
          ))}
        </View>

        {/* Coming soon */}
        <Text style={styles.sectionLabel}>Coming Soon</Text>
        <View style={styles.list}>
          {COMING_SOON.map((tool, index) => (
            <View
              key={tool.id}
              style={[
                styles.item,
                styles.itemDisabled,
                index < COMING_SOON.length - 1 && styles.itemBorder,
              ]}
            >
              <View style={[styles.iconWrap, { backgroundColor: Colors.border }]}>
                <Ionicons name={tool.icon} size={22} color={Colors.textMuted} />
              </View>
              <View style={styles.itemText}>
                <Text style={[styles.itemTitle, styles.textMuted]}>{tool.title}</Text>
                <Text style={styles.itemDesc}>{tool.description}</Text>
              </View>
              <View style={styles.badge}>
                <Text style={styles.badgeText}>Soon</Text>
              </View>
            </View>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  scroll: { flex: 1 },
  container: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 40,
  },
  pageTitle: {
    fontSize: 26,
    fontWeight: '700',
    color: Colors.text,
    letterSpacing: -0.5,
    marginBottom: 4,
  },
  pageSubtitle: {
    fontSize: 14,
    color: Colors.textSecondary,
    marginBottom: 32,
  },
  sectionLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 10,
  },
  list: {
    backgroundColor: Colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: 28,
    overflow: 'hidden',
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
    gap: 14,
  },
  itemBorder: {
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  itemDisabled: {
    opacity: 0.5,
  },
  iconWrap: {
    width: 42,
    height: 42,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  itemText: { flex: 1 },
  itemTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.text,
    marginBottom: 2,
  },
  itemDesc: {
    fontSize: 13,
    color: Colors.textSecondary,
  },
  textMuted: {
    color: Colors.textMuted,
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    backgroundColor: Colors.surfaceElevated,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: Colors.textMuted,
  },
});
