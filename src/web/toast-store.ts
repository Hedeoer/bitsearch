import { useSyncExternalStore } from "react";
import type { ToastItem, ToastTone } from "./components/Feedback";

const TOAST_DURATION_MS = 4500;

let toastCounter = 0;
let toasts: ToastItem[] = [];

const listeners = new Set<() => void>();
const timers = new Map<string, number>();

function emitChange() {
  listeners.forEach((listener) => listener());
}

function nextToastId(): string {
  toastCounter += 1;
  return `toast-${toastCounter}`;
}

export function enqueueToast(type: ToastTone, message: string) {
  const id = nextToastId();
  toasts = [...toasts, { id, type, message }];
  emitChange();

  const timer = window.setTimeout(() => {
    dismissToast(id);
  }, TOAST_DURATION_MS);
  timers.set(id, timer);
}

export function dismissToast(id: string) {
  const timer = timers.get(id);
  if (typeof timer === "number") {
    window.clearTimeout(timer);
    timers.delete(id);
  }
  const nextToasts = toasts.filter((item) => item.id !== id);
  if (nextToasts.length === toasts.length) {
    return;
  }
  toasts = nextToasts;
  emitChange();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function getSnapshot() {
  return toasts;
}

export function useToastStore() {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}
