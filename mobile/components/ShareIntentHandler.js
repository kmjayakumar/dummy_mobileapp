/**
 * ShareIntentHandler.js
 *
 * Renderless component that lives in the root layout.
 * It mounts the useShareIntent hook at the top of the navigation tree,
 * ensuring share intents are detected regardless of which screen is
 * currently active (cold-start, foreground, background-wake).
 *
 * Returns null — no UI is rendered here.  All UI feedback is handled
 * inside the audio-converter screen via useShareIntentContext().
 */

import { useShareIntent } from '../hooks/useShareIntent';

export default function ShareIntentHandler() {
  // All logic is in the hook; this component just mounts it at the root.
  useShareIntent();
  return null;
}
