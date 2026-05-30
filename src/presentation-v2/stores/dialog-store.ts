import { defineStore } from "pinia";

export type AcuDialogVariant = "default" | "primary" | "danger";
export type AcuDialogKind = "confirm" | "prompt" | "choice";

export interface AcuDialogAction {
  value: string;
  label: string;
  variant?: AcuDialogVariant;
}

export interface AcuDialogRequest {
  id: string;
  kind: AcuDialogKind;
  title: string;
  message: string;
  label?: string;
  initialValue?: string;
  placeholder?: string;
  cancelLabel?: string;
  confirmLabel?: string;
  confirmVariant?: AcuDialogVariant;
  actions?: AcuDialogAction[];
  badge?: {
    label: string;
    variant?: "neutral" | "accent" | "warning" | "success" | "danger";
  };
  requireNonEmpty?: boolean;
  resolve: (value: string | boolean | null) => void;
}

export interface ConfirmDialogOptions {
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  confirmVariant?: AcuDialogVariant;
}

export interface PromptDialogOptions {
  title: string;
  message: string;
  label: string;
  defaultValue?: string;
  placeholder?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  confirmVariant?: AcuDialogVariant;
  requireNonEmpty?: boolean;
}

export interface ChoiceDialogOptions<T extends string> {
  title: string;
  message: string;
  actions: Array<AcuDialogAction & { value: T }>;
  cancelLabel?: string;
  badge?: AcuDialogRequest["badge"];
}

let nextDialogId = 1;

function makeDialogId(): string {
  return `dialog-${nextDialogId++}`;
}

export const useDialogStore = defineStore("acu-v2-dialog", {
  state: () => ({
    active: null as AcuDialogRequest | null,
    queue: [] as AcuDialogRequest[],
    inputValue: "",
  }),
  getters: {
    promptConfirmDisabled(state): boolean {
      if (state.active?.kind !== "prompt") return false;
      if (state.active.requireNonEmpty === false) return false;
      return !String(state.inputValue || "").trim();
    },
  },
  actions: {
    confirm(options: ConfirmDialogOptions): Promise<boolean> {
      return this.enqueue({
        id: makeDialogId(),
        kind: "confirm",
        title: options.title,
        message: options.message,
        confirmLabel: options.confirmLabel || "确认",
        cancelLabel: options.cancelLabel || "取消",
        confirmVariant: options.confirmVariant || "primary",
        requireNonEmpty: false,
        resolve: () => {},
      }).then((value) => value === true);
    },
    prompt(options: PromptDialogOptions): Promise<string | null> {
      return this.enqueue({
        id: makeDialogId(),
        kind: "prompt",
        title: options.title,
        message: options.message,
        label: options.label,
        initialValue: String(options.defaultValue || ""),
        placeholder: options.placeholder,
        confirmLabel: options.confirmLabel || "确认",
        cancelLabel: options.cancelLabel || "取消",
        confirmVariant: options.confirmVariant || "primary",
        requireNonEmpty: options.requireNonEmpty !== false,
        resolve: () => {},
      }).then((value) => (typeof value === "string" ? value : null));
    },
    choose<T extends string>(options: ChoiceDialogOptions<T>): Promise<T | null> {
      return this.enqueue({
        id: makeDialogId(),
        kind: "choice",
        title: options.title,
        message: options.message,
        actions: options.actions,
        cancelLabel: options.cancelLabel || "取消",
        badge: options.badge,
        requireNonEmpty: false,
        resolve: () => {},
      }).then((value) => (typeof value === "string" ? (value as T) : null));
    },
    cancelActive(): void {
      const dialog = this.active;
      this.active = null;
      this.inputValue = "";
      dialog?.resolve(dialog.kind === "confirm" ? false : null);
      this.activateNext();
    },
    submitActive(value?: string): void {
      const dialog = this.active;
      if (!dialog) return;
      if (dialog.kind === "prompt") {
        const next = String(this.inputValue || "").trim();
        if (dialog.requireNonEmpty !== false && !next) return;
        this.active = null;
        this.inputValue = "";
        dialog.resolve(next);
        this.activateNext();
        return;
      }
      if (dialog.kind === "confirm") {
        this.active = null;
        this.inputValue = "";
        dialog.resolve(true);
        this.activateNext();
        return;
      }
      this.active = null;
      this.inputValue = "";
      dialog.resolve(value ?? null);
      this.activateNext();
    },
    __resetForTests(): void {
      if (this.active) this.active.resolve(null);
      for (const dialog of this.queue) dialog.resolve(null);
      this.active = null;
      this.queue = [];
      this.inputValue = "";
    },
    enqueue(request: AcuDialogRequest): Promise<string | boolean | null> {
      return new Promise((resolve) => {
        const next = { ...request, resolve };
        if (this.active) this.queue.push(next);
        else this.activateRequest(next);
      });
    },
    activateNext(): void {
      this.activateRequest(this.queue.shift() || null);
    },
    activateRequest(request: AcuDialogRequest | null): void {
      this.active = request;
      this.inputValue = request?.kind === "prompt" ? String(request.initialValue || "") : "";
    },
  },
});
