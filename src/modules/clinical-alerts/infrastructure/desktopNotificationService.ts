export function isDesktopNotificationAvailable(): boolean {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}

export async function requestDesktopNotificationPermission(): Promise<boolean> {
  if (!isDesktopNotificationAvailable()) return false;
  const { isPermissionGranted, requestPermission } = await import("@tauri-apps/plugin-notification");
  if (await isPermissionGranted()) return true;
  return (await requestPermission()) === "granted";
}

export async function sendDesktopNotification(title: string, body: string): Promise<boolean> {
  if (!isDesktopNotificationAvailable()) return false;
  const { isPermissionGranted, sendNotification } = await import("@tauri-apps/plugin-notification");
  if (!(await isPermissionGranted())) return false;
  sendNotification({ title, body });
  return true;
}
