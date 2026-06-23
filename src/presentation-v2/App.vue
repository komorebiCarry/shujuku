<template>
  <div class="acu-v2-app" :style="appScaleStyle">
    <div v-show="rootShell.isOpen" class="acu-v2-app__shell">
      <div class="acu-v2-app__body">
        <Sidebar v-if="!visualizer.isActive" class="acu-v2-app__desktop-sidebar" />
        <div class="acu-v2-app__content">
          <header v-if="!visualizer.isActive" class="acu-v2-app__header">
            <div class="acu-v2-app__header-left">
              <AcuIconButton
                v-if="!visualizer.isActive"
                class="acu-v2-app__menu"
                icon="fa-solid fa-bars"
                title="打开导航"
                :aria-expanded="isMobileNavOpen"
                @click="openMobileNav"
              />
              <h1 class="acu-v2-app__page-title">{{ shellTitle }}</h1>
            </div>
            <div class="acu-v2-app__header-right">
              <div class="acu-v2-app__appearance-switcher">
                <AcuIconButton
                  class="acu-v2-app__appearance-btn"
                  icon="fa-solid fa-gear"
                  :title="'外观：' + themeStore.activeTheme.name + '，界面缩放 ' + appearanceStore.uiScaleLabel"
                  :aria-expanded="isAppearanceMenuOpen"
                  aria-label="打开外观菜单"
                  @click="toggleAppearanceMenu"
                />
                <div
                  v-if="isAppearanceMenuRendered"
                  class="acu-v2-app__appearance-menu"
                  :class="{ 'is-closing': isAppearanceMenuClosing }"
                  role="dialog"
                  aria-label="外观设置"
                >
                  <section class="acu-v2-app__appearance-section" aria-labelledby="acu-v2-theme-section-title">
                    <div id="acu-v2-theme-section-title" class="acu-v2-app__appearance-section-title">主题</div>
                    <ul class="acu-v2-app__theme-list" role="listbox" aria-label="选择主题">
                      <li
                        v-for="t in themeStore.themes"
                        :key="t.id"
                        role="option"
                        :aria-selected="t.id === themeStore.activeId"
                        class="acu-v2-app__theme-option"
                        :class="{ 'is-active': t.id === themeStore.activeId }"
                        @click="selectTheme(t.id)"
                      >
                        <span class="acu-v2-app__theme-option-main">
                          <span
                            class="acu-v2-app__theme-swatch"
                            :style="{
                              '--acu-theme-swatch-bg': t.tokens.bg0,
                              '--acu-theme-swatch-accent': t.tokens.accent,
                            }"
                          ></span>
                          <span class="acu-v2-app__theme-name">{{ t.name }}</span>
                          <span v-if="isCustomThemeId(t.id)" class="acu-v2-app__theme-tag">自定义</span>
                        </span>
                        <span class="acu-v2-app__theme-tools" @click.stop>
                          <AcuIconButton
                            icon="fa-solid fa-upload"
                            size="sm"
                            :title="'导出主题：' + t.name"
                            @click="exportTheme(t.id)"
                          />
                          <AcuIconButton
                            v-if="isCustomThemeId(t.id)"
                            icon="fa-solid fa-trash"
                            size="sm"
                            variant="danger"
                            :title="'删除自定义主题：' + t.name"
                            @click="deleteTheme(t.id)"
                          />
                        </span>
                      </li>
                    </ul>
                    <div class="acu-v2-app__theme-menu-footer">
                      <AcuFileButton size="sm" accept="application/json,.json" @file="importThemeFile">
                        <i class="fa-solid fa-download"></i>
                        导入主题
                      </AcuFileButton>
                    </div>
                  </section>
                  <section class="acu-v2-app__appearance-section" aria-labelledby="acu-v2-scale-section-title">
                    <div class="acu-v2-app__scale-heading">
                      <span id="acu-v2-scale-section-title" class="acu-v2-app__appearance-section-title">界面缩放</span>
                      <span class="acu-v2-app__scale-current">{{ appearanceStore.uiScaleLabel }}</span>
                    </div>
                    <AcuSegmentedControl
                      class="acu-v2-app__scale-control"
                      :options="uiScaleOptions"
                      :model-value="appearanceStore.uiScale"
                      size="sm"
                      aria-label="界面缩放"
                      @update:model-value="setUiScale"
                    />
                  </section>
                </div>
              </div>
              <AcuIconButton
                class="acu-v2-app__close"
                icon="fa-solid fa-xmark"
                :title="visualizer.isActive ? '关闭数据库编辑器' : '关闭新 UI'"
                :aria-label="visualizer.isActive ? '关闭数据库编辑器' : '关闭新 UI'"
                @click="closeApp"
              />
            </div>
          </header>
          <VisualizerSurface v-if="visualizer.isActive" @close="closeApp" />
          <MainArea v-else />
        </div>
      </div>

      <div
        v-if="isMobileNavRendered"
        class="acu-v2-app__mobile-nav-layer"
        :class="{ 'is-closing': isMobileNavClosing }"
        @click.self="closeMobileNav"
      >
        <aside
          class="acu-v2-app__mobile-nav"
          :style="mobileNavDrawerStyle"
          role="dialog"
          aria-modal="true"
          aria-label="一级页导航"
          data-acu-mobile-nav-width="360px"
          @click.stop
        >
          <Sidebar variant="drawer" @navigate="closeMobileNav" />
        </aside>
      </div>

      <AcuDialogHost />
      <AcuToastViewport />
    </div>

  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch, watchEffect } from "vue";
import AcuDialogHost from "./components/_lib/AcuDialogHost.vue";
import AcuFileButton from "./components/_lib/AcuFileButton.vue";
import AcuIconButton from "./components/_lib/AcuIconButton.vue";
import AcuSegmentedControl from "./components/_lib/AcuSegmentedControl.vue";
import AcuToastViewport from "./components/_lib/AcuToastViewport.vue";
import MainArea from "./components/MainArea.vue";
import Sidebar from "./components/Sidebar.vue";
import { useChatChangedListener } from "./composables/useChatChangedListener";
import { useDevOptions } from "./composables/useDevOptions";
import { canCloseUi } from "./composables/useUiCloseGuard";
import { useDialogStore } from "./stores/dialog-store";
import { useRootShellStore } from "./stores/root-shell-store";
import { useRouterStore } from "./stores/router-store";
import { isCustomThemeId, useThemeStore } from "./stores/theme-store";
import { useToastStore } from "./stores/toast-store";
import { useUiModeStore } from "./stores/ui-mode-store";
import { useVisualizerStore } from "./stores/visualizer-store";
import VisualizerSurface from "./surfaces/visualizer/VisualizerSurface.vue";
import type { AcuV2ThemeId } from "./theme/theme-types";
import { getAcuHostDocument } from "./bootstrap/host-document";
import { acuClearTimeout, acuSetTimeout, type AcuTimerHandle } from "./bootstrap/host-env";
import {
  ACU_UI_SCALE_OPTIONS,
  useAppearanceStore,
  type AcuUiScale,
} from "./stores/appearance-store";

const emit = defineEmits<{ (event: "close"): void }>();
const rootShell = useRootShellStore();
const router = useRouterStore();
const dialogStore = useDialogStore();
const appearanceStore = useAppearanceStore();
const themeStore = useThemeStore();
const toastStore = useToastStore();
const uiMode = useUiModeStore();
const visualizer = useVisualizerStore();
const isMobileNavOpen = ref(false);
const isMobileNavRendered = ref(false);
const isMobileNavClosing = ref(false);
const isAppearanceMenuOpen = ref(false);
const isAppearanceMenuRendered = ref(false);
const isAppearanceMenuClosing = ref(false);
const APPEARANCE_MENU_LEAVE_MS = 120;
const MOBILE_NAV_LEAVE_MS = 150;
const mobileNavDrawerStyle = {
  width: "360px",
  maxWidth: "calc(100% - 24px)",
  flex: "0 0 360px",
};
let appearanceMenuCloseTimer: AcuTimerHandle | undefined;
let mobileNavCloseTimer: AcuTimerHandle | undefined;

const shellTitle = computed(() =>
  visualizer.isActive ? "数据库编辑器" : router.activePage?.title || "SP·数据库 V",
);

const appScaleStyle = computed<Record<string, string>>(() => {
  const px = (base: number) => `${Math.round(base * Number(appearanceStore.uiScaleCssValue) * 100) / 100}px`;
  return {
    "--acu-ui-scale": appearanceStore.uiScaleCssValue,
    "--acu-font-size-micro": px(10),
    "--acu-font-size-caption": px(11),
    "--acu-font-size-body": px(12),
    "--acu-font-size-body-lg": px(13),
    "--acu-font-size-section-title": px(12),
    "--acu-font-size-list-title": px(13),
    "--acu-font-size-panel-title": px(15),
    "--acu-font-size-page-title": px(22),
    "--acu-icon-size-md": px(32),
    "--acu-icon-size-sm": px(22),
    "--acu-control-height-md": px(32),
    "--acu-control-height-sm": px(26),
    "--acu-button-height-md": px(32),
    "--acu-button-height-sm": px(28),
    "--acu-button-padding-y-md": px(6),
    "--acu-button-padding-x-md": px(9),
    "--acu-button-padding-y-sm": px(4),
    "--acu-button-padding-x-sm": px(10),
    "--acu-button-icon-padding-x-md": px(8),
    "--acu-button-icon-padding-x-sm": px(8),
    "--acu-button-gap": px(6),
    "--acu-control-padding-y-md": px(6),
    "--acu-control-padding-x-md": px(9),
    "--acu-control-padding-y-sm": px(3),
    "--acu-control-padding-x-sm": px(7),
    "--acu-control-number-padding-right-md": px(30),
    "--acu-control-number-padding-right-sm": px(25),
    "--acu-segmented-padding": px(3),
    "--acu-segmented-padding-total": px(6),
    "--acu-segmented-height-md": px(30),
    "--acu-segmented-height-sm": px(24),
    "--acu-segmented-padding-x-md": px(8),
    "--acu-segmented-padding-x-sm": px(7),
    "--acu-textarea-padding-y": px(8),
    "--acu-textarea-padding-x": px(10),
    "--acu-toggle-gap": px(8),
    "--acu-toggle-track-width": px(36),
    "--acu-toggle-track-height": px(20),
    "--acu-toggle-track-radius": px(10),
    "--acu-toggle-thumb-size": px(16),
    "--acu-toggle-thumb-offset": px(2),
    "--acu-toggle-thumb-translate": px(16),
    "--acu-panel-padding": px(16),
    "--acu-panel-header-gap": px(12),
    "--acu-panel-header-margin-bottom": px(12),
    "--acu-panel-header-open-margin-bottom": px(8),
    "--acu-panel-header-min-height": px(32),
    "--acu-panel-actions-gap": px(8),
    "--acu-panel-description-button-size": px(28),
    "--acu-panel-body-gap": px(12),
    "--acu-panel-description-padding-bottom": px(12),
    "--acu-info-banner-gap": px(10),
    "--acu-info-banner-padding-y": px(9),
    "--acu-info-banner-padding-x": px(10),
    "--acu-info-banner-icon-margin-top": px(2),
    "--acu-badge-padding-y": px(2),
    "--acu-badge-padding-x": px(8),
    "--acu-form-row-gap": px(5),
    "--acu-app-header-height": px(50),
    "--acu-app-header-padding-y": px(8),
    "--acu-app-header-padding-right": px(12),
    "--acu-app-header-padding-left": px(20),
    "--acu-app-header-gap": px(8),
    "--acu-app-header-actions-gap": px(4),
    "--acu-app-header-icon-size": px(30),
    "--acu-app-header-icon-font-size": px(14),
    "--acu-app-menu-offset": px(6),
    "--acu-app-menu-padding": px(6),
    "--acu-app-menu-width": px(340),
    "--acu-app-menu-min-width": px(280),
    "--acu-app-menu-section-gap": px(8),
    "--acu-app-theme-list-gap": px(2),
    "--acu-app-theme-list-max-height": px(300),
    "--acu-app-theme-list-margin-top": px(5),
    "--acu-app-theme-option-gap": px(8),
    "--acu-app-theme-option-padding-y": px(7),
    "--acu-app-theme-option-padding-x": px(10),
    "--acu-app-theme-tag-padding-y": px(1),
    "--acu-app-theme-tag-padding-x": px(5),
    "--acu-app-theme-tools-gap": px(4),
    "--acu-app-theme-swatch-size": px(18),
    "--acu-app-theme-footer-margin-top": px(4),
    "--acu-app-theme-footer-padding-y": px(7),
    "--acu-app-theme-footer-padding-x": px(6),
    "--acu-app-theme-footer-padding-bottom": px(4),
    "--acu-app-scale-heading-gap": px(8),
    "--acu-app-scale-heading-margin-bottom": px(7),
    "--acu-app-mobile-header-height": px(48),
    "--acu-app-mobile-header-padding-y": px(8),
    "--acu-app-mobile-header-padding-x": px(10),
    "--acu-app-mobile-header-gap": px(6),
    "--acu-app-mobile-title-size": px(18),
  };
});

const uiScaleOptions = computed(() =>
  ACU_UI_SCALE_OPTIONS.map(option => ({
    value: option.value,
    label: option.label,
  })),
);

watchEffect(() => {
  const root = getAcuHostDocument().getElementById("acu-app-v2");
  if (!root) return;
  for (const [key, value] of Object.entries(appScaleStyle.value)) {
    root.style.setProperty(key, value);
  }
});

function toggleAppearanceMenu(): void {
  if (isAppearanceMenuOpen.value) closeAppearanceMenu();
  else openAppearanceMenu();
}

function selectTheme(id: AcuV2ThemeId): void {
  themeStore.setTheme(id);
  closeAppearanceMenu();
}

function setUiScale(value: string): void {
  appearanceStore.setUiScale(value as AcuUiScale);
}

function readFileText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(new Error("主题文件读取失败。"));
    reader.readAsText(file, "utf-8");
  });
}

async function importThemeFile(file: File): Promise<void> {
  try {
    const text = await readFileText(file);
    themeStore.importCustomThemeFromJsonText(text);
    closeAppearanceMenu();
  } catch (error) {
    toastStore.error(error instanceof Error ? error.message : "主题导入失败。");
  }
}

function exportTheme(id: AcuV2ThemeId): void {
  try {
    const theme = themeStore.themes.find(t => t.id === id);
    const file = themeStore.buildThemeFile(id);
    const filename = `acu-v2-theme-${sanitizeFilename(theme?.name || "custom-theme")}.json`;
    downloadJson(filename, file);
  } catch {
    toastStore.error("主题导出失败。");
  }
}

async function deleteTheme(id: AcuV2ThemeId): Promise<void> {
  if (!isCustomThemeId(id)) {
    return;
  }
  const theme = themeStore.themes.find(t => t.id === id);
  const confirmed = await dialogStore.confirm({
    title: "删除自定义主题",
    message: `删除"${theme?.name || "自定义主题"}"后会从本浏览器移除；如果正在使用它，界面会切回默认深色主题。`,
    confirmLabel: "删除主题",
    confirmVariant: "danger",
  });
  if (!confirmed) return;
  themeStore.deleteCustomTheme(id);
  closeAppearanceMenu();
}

function sanitizeFilename(value: string): string {
  return value
    .trim()
    .replace(/[\\/:*?"<>|]+/g, "-")
    .replace(/\s+/g, "-")
    .slice(0, 48) || "custom-theme";
}

function downloadJson(filename: string, data: unknown): void {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = getAcuHostDocument().createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function onDocPointer(e: Event): void {
  if (!(e.target as HTMLElement)?.closest(".acu-v2-app__appearance-switcher")) {
    closeAppearanceMenu();
  }
}

onMounted(() => {
  const doc = getAcuHostDocument();
  doc.addEventListener("pointerdown", onDocPointer, true);
  doc.addEventListener("touchstart", onDocPointer, true);
  doc.addEventListener("click", onDocPointer, true);
});
onBeforeUnmount(() => {
  const doc = getAcuHostDocument();
  doc.removeEventListener("pointerdown", onDocPointer, true);
  doc.removeEventListener("touchstart", onDocPointer, true);
  doc.removeEventListener("click", onDocPointer, true);
  clearAppearanceMenuCloseTimer();
  clearMobileNavCloseTimer();
});

onMounted(() => {
  rootShell.markMounted();
});

useChatChangedListener();

// 关掉"启用开发者选项"且当前页是开发者一级页时，回退到默认页（plan §D24）
const devOptions = useDevOptions();
watch(() => devOptions.developerOptionsEnabled.value, () => {
  router.ensureActiveVisible();
});

onMounted(() => router.ensureActiveVisible());
watch(() => uiMode.mode, () => router.ensureActiveVisible());
watch(() => rootShell.isOpen, (isOpen) => {
  if (!isOpen) toastStore.clear();
});

function openMobileNav(): void {
  clearMobileNavCloseTimer();
  isMobileNavOpen.value = true;
  isMobileNavRendered.value = true;
  isMobileNavClosing.value = false;
}

function closeMobileNav(): void {
  if (!isMobileNavOpen.value && !isMobileNavRendered.value) return;
  isMobileNavOpen.value = false;
  if (!isMobileNavRendered.value) return;
  isMobileNavClosing.value = true;
  clearMobileNavCloseTimer();
  mobileNavCloseTimer = acuSetTimeout(() => {
    isMobileNavRendered.value = false;
    isMobileNavClosing.value = false;
    mobileNavCloseTimer = undefined;
  }, MOBILE_NAV_LEAVE_MS);
}

async function closeApp(): Promise<void> {
  if (!(await canCloseUi())) return;
  closeAppearanceMenu();
  closeMobileNav();
  if (visualizer.isActive) {
    const result = visualizer.closeSurface();
    if (result.previousPageId) router.setActivePage(result.previousPageId);
    if (result.shouldCloseShell) emit("close");
    return;
  }
  emit("close");
}

function openAppearanceMenu(): void {
  clearAppearanceMenuCloseTimer();
  isAppearanceMenuOpen.value = true;
  isAppearanceMenuRendered.value = true;
  isAppearanceMenuClosing.value = false;
}

function closeAppearanceMenu(): void {
  if (!isAppearanceMenuOpen.value && !isAppearanceMenuRendered.value) return;
  isAppearanceMenuOpen.value = false;
  if (!isAppearanceMenuRendered.value) return;
  isAppearanceMenuClosing.value = true;
  clearAppearanceMenuCloseTimer();
  appearanceMenuCloseTimer = acuSetTimeout(() => {
    isAppearanceMenuRendered.value = false;
    isAppearanceMenuClosing.value = false;
    appearanceMenuCloseTimer = undefined;
  }, APPEARANCE_MENU_LEAVE_MS);
}

function clearAppearanceMenuCloseTimer(): void {
  if (appearanceMenuCloseTimer === undefined) return;
  acuClearTimeout(appearanceMenuCloseTimer);
  appearanceMenuCloseTimer = undefined;
}

function clearMobileNavCloseTimer(): void {
  if (mobileNavCloseTimer === undefined) return;
  acuClearTimeout(mobileNavCloseTimer);
  mobileNavCloseTimer = undefined;
}
</script>

<style scoped>
:global(#acu-app-v2) {
  --acu-safe-top: max(env(safe-area-inset-top, 0px), var(--acu-native-safe-top, 0px));
  --acu-safe-right: max(env(safe-area-inset-right, 0px), var(--acu-native-safe-right, 0px));
  --acu-safe-bottom: max(env(safe-area-inset-bottom, 0px), var(--acu-native-safe-bottom, 0px));
  --acu-safe-left: max(env(safe-area-inset-left, 0px), var(--acu-native-safe-left, 0px));
  --acu-ui-scale: 1;
  --acu-font-size-micro: 10px;
  --acu-font-size-caption: 11px;
  --acu-font-size-body: 12px;
  --acu-font-size-body-lg: 13px;
  --acu-font-size-section-title: 12px;
  --acu-font-size-list-title: 13px;
  --acu-font-size-panel-title: 15px;
  --acu-font-size-page-title: 22px;
  --acu-icon-size-md: 32px;
  --acu-icon-size-sm: 22px;
  --acu-control-height-md: 32px;
  --acu-control-height-sm: 26px;
  --acu-button-height-md: 32px;
  --acu-button-height-sm: 28px;
  --acu-line-height-caption: 1.5;
  --acu-line-height-body: 1.45;
  --acu-line-height-readable: 1.55;
  box-sizing: border-box;
  color: var(--acu-text-1);
  font-family: var(--acu-font-ui);
  font-size: var(--acu-font-size-body);
}

:global(#acu-app-v2),
:global(#acu-app-v2 *) {
  box-sizing: border-box;
}

:global(#acu-app-v2 button) {
  appearance: none;
  -webkit-appearance: none;
  -webkit-tap-highlight-color: transparent;
}

:global(#acu-app-v2 button:focus:not(:focus-visible)) {
  outline: none;
  box-shadow: none;
}

.acu-v2-app {
  color: var(--acu-text-1);
  font-family: var(--acu-font-ui);
  font-size: var(--acu-font-size-body);
}

.acu-v2-app__shell {
  position: fixed;
  top: 0;
  right: 0;
  bottom: 0;
  left: 0;
  inset: 0;
  z-index: 9000;
  width: 100%;
  width: 100vw;
  width: 100dvw;
  height: 100%;
  height: 100vh;
  height: 100dvh;
  min-width: 0;
  min-height: 0;
  display: flex;
  flex-direction: column;
  padding: var(--acu-safe-top) var(--acu-safe-right) var(--acu-safe-bottom) var(--acu-safe-left);
  overflow: hidden;
  background: var(--acu-bg-0);
  color: var(--acu-text-1);
  font-family: var(--acu-font-ui);
  font-size: var(--acu-font-size-body);
}

.acu-v2-app__header {
  position: relative;
  z-index: 40;
  display: flex;
  align-items: center;
  justify-content: space-between;
  min-height: var(--acu-app-header-height, 50px);
  padding: var(--acu-app-header-padding-y, 8px) var(--acu-app-header-padding-right, 12px) var(--acu-app-header-padding-y, 8px) var(--acu-app-header-padding-left, 20px);
  background: var(--acu-bg-0);
  border-bottom: 1px solid var(--acu-border-2);
  flex: 0 0 auto;
}

.acu-v2-app__header-left {
  display: flex;
  align-items: center;
  min-width: 0;
  gap: var(--acu-app-header-gap, 8px);
  flex: 1 1 auto;
}

.acu-v2-app__menu {
  display: none;
  flex: 0 0 auto;
  font-size: var(--acu-app-header-icon-font-size, 14px);
  background: transparent;
  color: var(--acu-text-2);
  box-shadow: none;
}

.acu-v2-app__menu:hover:not(:disabled) {
  background: transparent;
  color: var(--acu-text-1);
}

.acu-v2-app__page-title {
  min-width: 0;
  margin: 0;
  overflow: hidden;
  color: var(--acu-text-1);
  font-size: var(--acu-font-size-page-title, 22px);
  font-weight: 700;
  line-height: 1.2;
  letter-spacing: 0;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.acu-v2-app__close {
  width: var(--acu-app-header-icon-size, 30px);
  height: var(--acu-app-header-icon-size, 30px);
  border: 0;
  background: transparent;
  color: var(--acu-text-2);
  font-size: var(--acu-font-size-page-title, 22px);
  line-height: 1;
  cursor: pointer;
  border-radius: var(--acu-radius-sm);
}

.acu-v2-app__close:hover {
  background: var(--acu-hover-overlay);
  color: var(--acu-text-1);
}

.acu-v2-app__body {
  flex: 1 1 auto;
  display: flex;
  min-width: 0;
  min-height: 0;
  overflow: hidden;
}

.acu-v2-app__content {
  flex: 1 1 auto;
  display: flex;
  flex-direction: column;
  min-width: 0;
  min-height: 0;
  overflow: hidden;
}

.acu-v2-app__mobile-nav-layer {
  position: fixed;
  top: 0;
  right: 0;
  bottom: 0;
  left: 0;
  inset: 0;
  width: 100%;
  width: 100vw;
  width: 100dvw;
  height: 100%;
  height: 100vh;
  height: 100dvh;
  min-height: 100vh;
  min-height: 100dvh;
  z-index: 9300;
  display: none;
  align-items: stretch;
  justify-content: flex-start;
  padding: var(--acu-safe-top) var(--acu-safe-right) var(--acu-safe-bottom) var(--acu-safe-left);
  overflow: hidden;
  background: rgba(0, 0, 0, 0.58);
  pointer-events: auto;
  overscroll-behavior: contain;
  animation: mobile-nav-layer-in 0.18s ease-out both;
}

.acu-v2-app__mobile-nav-layer.is-closing {
  pointer-events: auto;
  animation: mobile-nav-layer-out 0.15s ease-in both;
}

.acu-v2-app__mobile-nav {
  width: 360px;
  max-width: calc(100% - 24px - var(--acu-safe-left, 0px) - var(--acu-safe-right, 0px));
  height: 100%;
  max-height: 100%;
  min-width: 0;
  min-height: 0;
  align-self: stretch;
  flex: 0 1 360px;
  display: flex;
  flex-direction: column;
  background: var(--acu-sidebar-bg);
  border-right: 0;
  box-shadow: var(--acu-shadow);
  overflow: hidden;
  pointer-events: auto;
  animation: mobile-nav-drawer-in 0.18s ease-out both;
}

.acu-v2-app__mobile-nav-layer.is-closing .acu-v2-app__mobile-nav {
  animation: mobile-nav-drawer-out 0.15s ease-in both;
}

@supports (width: min(360px, calc(100% - 24px))) {
  .acu-v2-app__mobile-nav {
    width: min(360px, calc(100% - 24px - var(--acu-safe-left, 0px) - var(--acu-safe-right, 0px)));
    flex: 0 0 min(360px, calc(100% - 24px - var(--acu-safe-left, 0px) - var(--acu-safe-right, 0px)));
  }
}

@supports (width: 100dvw) {
  .acu-v2-app__mobile-nav {
    max-width: calc(100% - 24px - var(--acu-safe-left, 0px) - var(--acu-safe-right, 0px));
  }
}

@supports (height: 100dvh) {
  .acu-v2-app__mobile-nav {
    height: 100%;
    max-height: 100%;
  }
}

/* ── Appearance menu ── */
.acu-v2-app__header-right {
  display: flex;
  align-items: center;
  gap: var(--acu-app-header-actions-gap, 4px);
  flex: 0 0 auto;
}

.acu-v2-app__appearance-switcher {
  position: relative;
}

.acu-v2-app__appearance-btn {
  width: var(--acu-app-header-icon-size, 30px);
  height: var(--acu-app-header-icon-size, 30px);
  border: 0;
  background: transparent;
  color: var(--acu-text-2);
  font-size: var(--acu-app-header-icon-font-size, 14px);
  cursor: pointer;
  border-radius: var(--acu-radius-sm);
}

.acu-v2-app__appearance-btn:hover {
  background: var(--acu-hover-overlay);
  color: var(--acu-text-1);
}

.acu-v2-app__appearance-menu {
  position: absolute;
  top: calc(100% + var(--acu-app-menu-offset, 6px));
  right: 0;
  z-index: 10;
  margin: 0;
  padding: var(--acu-app-menu-padding, 6px);
  width: min(var(--acu-app-menu-width, 340px), calc(100vw - 24px));
  min-width: min(var(--acu-app-menu-min-width, 280px), calc(100vw - 24px));
  background: var(--acu-bg-1);
  border: 1px solid var(--acu-border);
  border-radius: var(--acu-radius-md);
  box-shadow: var(--acu-shadow);
  animation: appearance-menu-in 0.12s ease-out both;
}

.acu-v2-app__appearance-menu.is-closing {
  pointer-events: none;
  animation: appearance-menu-out 0.12s ease-in both;
}

.acu-v2-app__appearance-section {
  min-width: 0;
}

.acu-v2-app__appearance-section + .acu-v2-app__appearance-section {
  margin-top: var(--acu-app-menu-section-gap, 8px);
  padding-top: var(--acu-app-menu-section-gap, 8px);
  border-top: 1px solid var(--acu-border);
}

.acu-v2-app__appearance-section-title {
  color: var(--acu-text-3);
  font-size: var(--acu-font-size-caption, 11px);
  font-weight: 700;
  line-height: 1.3;
}

.acu-v2-app__theme-list {
  display: flex;
  flex-direction: column;
  gap: var(--acu-app-theme-list-gap, 2px);
  max-height: min(44vh, var(--acu-app-theme-list-max-height, 300px));
  margin: var(--acu-app-theme-list-margin-top, 5px) 0 0;
  padding: 0;
  overflow-y: auto;
  list-style: none;
}

.acu-v2-app__theme-option {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--acu-app-theme-option-gap, 8px);
  padding: var(--acu-app-theme-option-padding-y, 7px) var(--acu-app-theme-option-padding-x, 10px);
  font-size: var(--acu-font-size-body-lg, 13px);
  color: var(--acu-text-2);
  border-radius: var(--acu-radius-sm);
  cursor: pointer;
  user-select: none;
}

.acu-v2-app__theme-option:hover {
  background: var(--acu-hover-overlay);
  color: var(--acu-text-1);
}

.acu-v2-app__theme-option.is-active {
  color: var(--acu-on-accent);
  background: var(--acu-accent);
  font-weight: 600;
}

.acu-v2-app__theme-option-main {
  display: flex;
  align-items: center;
  gap: var(--acu-app-theme-option-gap, 8px);
  min-width: 0;
  flex: 1 1 auto;
}

.acu-v2-app__theme-name {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.acu-v2-app__theme-tag {
  flex: 0 0 auto;
  padding: var(--acu-app-theme-tag-padding-y, 1px) var(--acu-app-theme-tag-padding-x, 5px);
  border-radius: var(--acu-radius-sm);
  background: color-mix(in srgb, var(--acu-accent) 12%, transparent);
  color: var(--acu-accent);
  font-size: var(--acu-font-size-micro, 10px);
  font-weight: 600;
}

.acu-v2-app__theme-option.is-active .acu-v2-app__theme-tag {
  background: color-mix(in srgb, var(--acu-on-accent) 18%, transparent);
  color: var(--acu-on-accent);
}

.acu-v2-app__theme-tools {
  display: inline-flex;
  align-items: center;
  gap: var(--acu-app-theme-tools-gap, 4px);
  flex: 0 0 auto;
  opacity: 0.72;
}

.acu-v2-app__theme-tools :deep(.acu-icon-btn) {
  background: transparent;
  color: inherit;
}

.acu-v2-app__theme-tools :deep(.acu-icon-btn:hover:not(:disabled)) {
  background: var(--acu-hover-overlay);
  color: var(--acu-text-1);
}

.acu-v2-app__theme-option.is-active .acu-v2-app__theme-tools :deep(.acu-icon-btn:hover:not(:disabled)) {
  background: color-mix(in srgb, var(--acu-on-accent) 18%, transparent);
  color: var(--acu-on-accent);
}

.acu-v2-app__theme-tools :deep(.acu-icon-btn--danger:hover:not(:disabled)) {
  background: color-mix(in srgb, var(--acu-danger) 12%, transparent);
  color: var(--acu-danger);
}

.acu-v2-app__theme-option:hover .acu-v2-app__theme-tools,
.acu-v2-app__theme-option.is-active .acu-v2-app__theme-tools {
  opacity: 1;
}

.acu-v2-app__theme-swatch {
  display: block;
  width: var(--acu-app-theme-swatch-size, 18px);
  height: var(--acu-app-theme-swatch-size, 18px);
  border-radius: 999px;
  flex: 0 0 var(--acu-app-theme-swatch-size, 18px);
  background: linear-gradient(
    135deg,
    var(--acu-theme-swatch-bg) 0 56%,
    var(--acu-theme-swatch-accent) 56% 100%
  );
  box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--acu-border-2) 72%, transparent);
}

.acu-v2-app__theme-option.is-active .acu-v2-app__theme-swatch {
  box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--acu-on-accent) 62%, transparent);
}

.acu-v2-app__theme-menu-footer {
  display: flex;
  justify-content: stretch;
  margin-top: var(--acu-app-theme-footer-margin-top, 4px);
  padding: var(--acu-app-theme-footer-padding-y, 7px) var(--acu-app-theme-footer-padding-x, 6px) var(--acu-app-theme-footer-padding-bottom, 4px);
  border-top: 1px solid var(--acu-border);
}

.acu-v2-app__theme-menu-footer :deep(.acu-file-button),
.acu-v2-app__theme-menu-footer :deep(.acu-btn) {
  width: 100%;
}

.acu-v2-app__scale-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--acu-app-scale-heading-gap, 8px);
  margin-bottom: var(--acu-app-scale-heading-margin-bottom, 7px);
}

.acu-v2-app__scale-current {
  color: var(--acu-text-2);
  font-size: var(--acu-font-size-caption, 11px);
  font-weight: 600;
  line-height: 1.3;
}

.acu-v2-app__scale-control {
  width: 100%;
}

@keyframes appearance-menu-in {
  from {
    opacity: 0;
    transform: translateY(-4px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@keyframes appearance-menu-out {
  from {
    opacity: 1;
    transform: translateY(0);
  }
  to {
    opacity: 0;
    transform: translateY(-4px);
  }
}

@keyframes mobile-nav-layer-in {
  from { opacity: 0; }
  to { opacity: 1; }
}

@keyframes mobile-nav-drawer-in {
  from { transform: translateX(-100%); }
  to { transform: translateX(0); }
}

@keyframes mobile-nav-layer-out {
  from { opacity: 1; }
  to { opacity: 0; }
}

@keyframes mobile-nav-drawer-out {
  from { transform: translateX(0); }
  to { transform: translateX(-100%); }
}

@media (max-width: 720px) {
  .acu-v2-app__header {
    min-height: var(--acu-app-mobile-header-height, 48px);
    padding: var(--acu-app-mobile-header-padding-y, 8px) var(--acu-app-mobile-header-padding-x, 10px);
  }

  .acu-v2-app__header-left {
    gap: var(--acu-app-mobile-header-gap, 6px);
  }

  .acu-v2-app__menu {
    display: inline-flex;
  }

  .acu-v2-app__page-title {
    font-size: var(--acu-app-mobile-title-size, 18px);
  }

  .acu-v2-app__desktop-sidebar {
    display: none;
  }

  .acu-v2-app__mobile-nav-layer {
    display: flex;
  }
}
</style>
