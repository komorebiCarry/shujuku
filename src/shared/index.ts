/**
 * shared/ 层统一出口
 */

// ── constants ──
export {
  DEBUG_MODE_ACU,
  UNIQUE_SCRIPT_ID,
  SCRIPT_ID_PREFIX_ACU,
  POPUP_ID_ACU,
  MENU_ITEM_ID_ACU,
} from './constants';

// ── env ──
export {
  topLevelWindow_ACU,
  FORBID_BROWSER_LOCAL_STORAGE_FOR_CONFIG_ACU,
  ALLOW_LEGACY_LOCALSTORAGE_MIGRATION_ACU,
  legacyLocalStorage_ACU,
  storage_ACU,
} from './env';

// ── service-locator ──
export { ACU_Services } from './service-locator';

// ── utils ──
export {
  cleanChatName_ACU,
  deepMerge_ACU,
  lightenDarkenColor_ACU,
  getContrastYIQ_ACU,
  escapeRegExp_ACU,
  hashUserInput_ACU,
  isSummaryOrOutlineTable_ACU,
  isStandardTable_ACU,
  normalizeNonNegativeInteger_ACU,
  normalizePositiveInteger_ACU,
} from './utils';

// ── json-helpers ──
export {
  safeJsonParse_ACU,
  safeJsonStringify_ACU,
} from './json-helpers';

// ── html-helpers ──
export {
  escapeHtml_ACU,
} from './html-helpers';

// ── text-optimization ──
export {
  removePunctuation_ACU,
  extractKeywords_ACU,
  findParagraphMatch_ACU,
  mapCleanPositionToOriginal_ACU,
  trimPunctuation_ACU,
  processSingleQuotes_ACU,
  applyOptimizations_ACU,
} from './text-optimization';
