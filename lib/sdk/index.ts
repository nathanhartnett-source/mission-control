/**
 * AIOS SDK — stable export surface for Tier-2 extensions.
 *
 * Custom apps and user-built elements MUST import from "@/lib/sdk" only,
 * never from internal lib modules directly. The core platform reserves
 * the right to refactor anything not exported from here without notice.
 *
 * Versioning: declared in mc-version.json at repo root.
 *   - SDK major bump = removing or breaking an export here
 *   - SDK minor bump = adding a new export here
 *
 * See ~/wiki/concepts/mc-aios-core-spec.md for the full tier model.
 */

// --- AI runtime ----------------------------------------------------------
export { runUserClaude } from "../user-claude";
export type { UserClaudeOptions, UserClaudeResult } from "../user-claude";

// --- Per-user workspace + identity --------------------------------------
export {
  userWorkspaceDir,
  memoryDir,
  inboxDir,
  provisionWorkspace,
  writePersona,
} from "../workspace";
export type { Persona } from "../workspace";

// --- Inbox ---------------------------------------------------------------
export {
  listMessages,
  unreadCount,
  postMessage,
  markRead,
  markAllRead,
  deleteMessage,
  newMessageId,
} from "../inbox";
export type { InboxMessage } from "../inbox";

// --- Alert sources -------------------------------------------------------
export {
  ALERT_SOURCES,
  evaluateValue,
  evaluatePerBrand,
  compareValue,
} from "../alert-sources";
export type { AlertSourceId, AlertSourceMeta } from "../alert-sources";

// --- Nav prefs -----------------------------------------------------------
export { getNavPrefs, setNavPrefs } from "../nav-prefs";
export type { NavPrefs, NavFolder } from "../nav-prefs";

// --- Site config (Tier 3 branding) --------------------------------------
export { getSiteConfig } from "../site-config";
export type { SiteConfig } from "../site-config";

// --- Custom-app manifest types ------------------------------------------
export type { CustomAppManifest, LoadedCustomApp } from "../custom-apps";

// --- Version ------------------------------------------------------------
export { SDK_VERSION, SDK_VERSION_LABEL, checkMinSdk } from "./version";
