/**
 * withShareIntentAndroid.js  —  Expo Config Plugin
 *
 * Ensures the AndroidManifest.xml always contains the correct intent filters
 * for the Android Share Intent feature, even after running `expo prebuild`.
 *
 * What it does:
 *   1. Adds READ_MEDIA_AUDIO permission (needed on Android 13+ for audio access)
 *   2. Injects the full set of ACTION_SEND + ACTION_VIEW intent filters into
 *      the MainActivity entry.
 *
 * Usage: listed in app.json plugins array as "./plugins/withShareIntentAndroid"
 *
 * Reference: https://docs.expo.dev/config-plugins/introduction/
 */

const { withAndroidManifest } = require('@expo/config-plugins');

const SHARE_INTENT_FILTERS = [
  // ── ACTION_SEND ──────────────────────────────────────────────────────────────
  {
    $: {},
    'action': [{ $: { 'android:name': 'android.intent.action.SEND' } }],
    'category': [{ $: { 'android:name': 'android.intent.category.DEFAULT' } }],
    'data': [{ $: { 'android:mimeType': 'audio/*' } }],
  },
  {
    $: {},
    'action': [{ $: { 'android:name': 'android.intent.action.SEND' } }],
    'category': [{ $: { 'android:name': 'android.intent.category.DEFAULT' } }],
    'data': [{ $: { 'android:mimeType': 'application/octet-stream' } }],
  },
  // ── ACTION_VIEW ──────────────────────────────────────────────────────────────
  {
    $: {},
    'action': [{ $: { 'android:name': 'android.intent.action.VIEW' } }],
    'category': [{ $: { 'android:name': 'android.intent.category.DEFAULT' } }],
    'data': [{ $: { 'android:mimeType': 'audio/*' } }],
  },
  {
    $: {},
    'action': [{ $: { 'android:name': 'android.intent.action.VIEW' } }],
    'category': [{ $: { 'android:name': 'android.intent.category.DEFAULT' } }],
    'data': [{ $: { 'android:mimeType': 'audio/opus' } }],
  },
  {
    $: {},
    'action': [{ $: { 'android:name': 'android.intent.action.VIEW' } }],
    'category': [{ $: { 'android:name': 'android.intent.category.DEFAULT' } }],
    'data': [{ $: { 'android:mimeType': 'audio/ogg' } }],
  },
  {
    $: {},
    'action': [{ $: { 'android:name': 'android.intent.action.VIEW' } }],
    'category': [{ $: { 'android:name': 'android.intent.category.DEFAULT' } }],
    'data': [{ $: { 'android:mimeType': 'audio/aac' } }],
  },
  {
    $: {},
    'action': [{ $: { 'android:name': 'android.intent.action.VIEW' } }],
    'category': [{ $: { 'android:name': 'android.intent.category.DEFAULT' } }],
    'data': [{ $: { 'android:mimeType': 'audio/mpeg' } }],
  },
  {
    $: {},
    'action': [{ $: { 'android:name': 'android.intent.action.VIEW' } }],
    'category': [{ $: { 'android:name': 'android.intent.category.DEFAULT' } }],
    'data': [{ $: { 'android:mimeType': 'audio/mp4' } }],
  },
];

/**
 * Returns true if the manifest already has a matching intent filter so we
 * don't duplicate on repeated prebuild runs.
 */
function hasIntentFilter(existingFilters, actionName, mimeType) {
  if (!existingFilters) return false;
  return existingFilters.some((f) => {
    const actions = f['action'] || [];
    const data    = f['data'] || [];
    const matchesAction = actions.some(
      (a) => a?.$?.['android:name'] === actionName
    );
    const matchesMime = data.some(
      (d) => d?.$?.['android:mimeType'] === mimeType
    );
    return matchesAction && matchesMime;
  });
}

/**
 * Ensure READ_MEDIA_AUDIO permission exists (Android 13+).
 */
function addMediaAudioPermission(manifest) {
  const permissions = manifest['uses-permission'] || [];
  const already = permissions.some(
    (p) => p?.$?.['android:name'] === 'android.permission.READ_MEDIA_AUDIO'
  );
  if (!already) {
    permissions.push({ $: { 'android:name': 'android.permission.READ_MEDIA_AUDIO' } });
    manifest['uses-permission'] = permissions;
  }
  return manifest;
}

module.exports = function withShareIntentAndroid(config) {
  return withAndroidManifest(config, (mod) => {
    const manifest = mod.modResults.manifest;

    // 1. Add READ_MEDIA_AUDIO permission
    addMediaAudioPermission(manifest);

    // 2. Find the MainActivity entry
    const app = manifest.application?.[0];
    if (!app) return mod;

    const activities = app.activity || [];
    const mainActivity = activities.find(
      (a) => a?.$?.['android:name'] === '.MainActivity'
    );
    if (!mainActivity) return mod;

    // 3. Inject missing intent filters
    if (!mainActivity['intent-filter']) {
      mainActivity['intent-filter'] = [];
    }
    const existingFilters = mainActivity['intent-filter'];

    for (const filter of SHARE_INTENT_FILTERS) {
      const actionName = filter['action']?.[0]?.$?.['android:name'];
      const mimeType   = filter['data']?.[0]?.$?.['android:mimeType'];

      if (!hasIntentFilter(existingFilters, actionName, mimeType)) {
        existingFilters.push(filter);
      }
    }

    return mod;
  });
};
