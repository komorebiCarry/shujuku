<template>
  <Teleport v-if="portalTarget" :to="portalTarget">
    <Transition name="acu-dialog">
      <div
        v-if="dialog.active"
        class="acu-dialog-layer"
        role="presentation"
        @click.self="dialog.cancelActive"
      >
        <section
          class="acu-dialog"
          role="dialog"
          aria-modal="true"
          :aria-labelledby="titleId"
          @click.stop
        >
          <header class="acu-dialog__header">
            <h2 :id="titleId">{{ dialog.active.title }}</h2>
            <AcuBadge
              v-if="dialog.active.badge"
              :variant="dialog.active.badge.variant || 'neutral'"
            >
              {{ dialog.active.badge.label }}
            </AcuBadge>
          </header>

          <p class="acu-dialog__message">{{ dialog.active.message }}</p>

          <label v-if="dialog.active.kind === 'prompt'" class="acu-dialog__field">
            <span>{{ dialog.active.label }}</span>
            <AcuInput
              v-model="dialog.inputValue"
              autocomplete="off"
              :placeholder="dialog.active.placeholder"
              @keyup.enter="dialog.submitActive()"
            />
          </label>

          <footer
            class="acu-dialog__actions"
            :class="{ 'acu-dialog__actions--stacked': isChoiceDialog }"
          >
            <template v-if="isChoiceDialog">
              <AcuButton
                v-for="action in dialog.active.actions"
                :key="action.value"
                :variant="action.variant || 'default'"
                @click="dialog.submitActive(action.value)"
              >
                {{ action.label }}
              </AcuButton>
              <AcuButton @click="dialog.cancelActive">
                {{ dialog.active.cancelLabel || "取消" }}
              </AcuButton>
            </template>
            <template v-else>
              <AcuButton @click="dialog.cancelActive">
                {{ dialog.active.cancelLabel || "取消" }}
              </AcuButton>
              <AcuButton
                :variant="dialog.active.confirmVariant || 'primary'"
                :disabled="dialog.promptConfirmDisabled"
                @click="dialog.submitActive()"
              >
                {{ dialog.active.confirmLabel || "确认" }}
              </AcuButton>
            </template>
          </footer>
        </section>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { getAcuHostDocument } from "../../bootstrap/host-document";
import { useDialogStore } from "../../stores/dialog-store";
import AcuBadge from "./AcuBadge.vue";
import AcuButton from "./AcuButton.vue";
import AcuInput from "./AcuInput.vue";

const dialog = useDialogStore();
const titleId = "acu-dialog-title";
const isChoiceDialog = computed(() => dialog.active?.kind === "choice");
const portalTarget = ref<HTMLElement | null>(null);

onMounted(() => {
  const doc = getAcuHostDocument();
  portalTarget.value = doc.getElementById("acu-app-v2") ?? doc.body;
});
</script>

<style scoped>
.acu-dialog-layer {
  position: fixed;
  inset: 0;
  z-index: 9600;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100vw;
  width: 100dvw;
  height: 100vh;
  height: 100dvh;
  padding: 18px;
  background: rgba(0, 0, 0, 0.52);
  pointer-events: auto;
}

.acu-dialog {
  width: min(440px, 100%);
  max-height: min(560px, calc(100vh - 36px));
  max-height: min(560px, calc(100dvh - 36px));
  display: flex;
  flex-direction: column;
  gap: 14px;
  padding: 16px;
  border: 1px solid var(--acu-border);
  border-radius: var(--acu-radius-md);
  background: var(--acu-bg-1);
  color: var(--acu-text-1);
  box-shadow: var(--acu-shadow);
  overflow: auto;
}

.acu-dialog__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.acu-dialog__header h2 {
  min-width: 0;
  margin: 0;
  color: var(--acu-text-1);
  font-size: var(--acu-font-size-panel-title, 15px);
  line-height: 1.35;
  font-weight: 700;
}

.acu-dialog__message {
  margin: 0;
  color: var(--acu-text-2);
  font-size: var(--acu-font-size-body, 12px);
  line-height: 1.55;
  white-space: pre-wrap;
}

.acu-dialog__field {
  display: flex;
  flex-direction: column;
  gap: 6px;
  color: var(--acu-text-2);
  font-size: var(--acu-font-size-body, 12px);
  line-height: 1.4;
}

.acu-dialog__actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  flex-wrap: wrap;
  padding-top: 2px;
}

.acu-dialog__actions--stacked :deep(.acu-btn) {
  flex: 1 1 128px;
}

.acu-dialog-enter-active,
.acu-dialog-leave-active {
  transition: opacity 0.16s ease;
}

.acu-dialog-enter-active .acu-dialog,
.acu-dialog-leave-active .acu-dialog {
  transition:
    opacity 0.16s ease,
    transform 0.16s ease;
}

.acu-dialog-enter-from,
.acu-dialog-leave-to {
  opacity: 0;
}

.acu-dialog-enter-from .acu-dialog,
.acu-dialog-leave-to .acu-dialog {
  opacity: 0;
  transform: translateY(6px);
}

@media (max-width: 520px) {
  .acu-dialog-layer {
    align-items: flex-end;
    padding: 12px;
  }

  .acu-dialog {
    width: 100%;
    max-height: calc(100vh - 24px);
    max-height: calc(100dvh - 24px);
  }

  .acu-dialog__actions,
  .acu-dialog__actions--stacked {
    display: grid;
    grid-template-columns: 1fr;
  }
}
</style>
