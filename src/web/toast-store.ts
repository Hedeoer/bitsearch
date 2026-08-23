import { toast as sonnerToast } from "sonner";

export type ToastTone = "success" | "error" | "warning" | "info";

export function enqueueToast(type: ToastTone, message: string) {
  const toastMethod =
    type === "success"
      ? sonnerToast.success
      : type === "error"
        ? sonnerToast.error
        : type === "warning"
          ? sonnerToast.warning
          : sonnerToast.info;

  toastMethod(message);
}

export function dismissToast(id: string) {
  sonnerToast.dismiss(id);
}
