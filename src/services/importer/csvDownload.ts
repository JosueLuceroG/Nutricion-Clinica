export interface CsvDownloadResult {
  fileName: string;
  opened: boolean;
  path?: string;
}

function isTauriRuntime(): boolean {
  if (typeof window === "undefined") return false;
  const tauriWindow = window as Window & {
    __TAURI__?: unknown;
    __TAURI_INTERNALS__?: unknown;
  };
  return Boolean(tauriWindow.__TAURI__ || tauriWindow.__TAURI_INTERNALS__);
}

function withUtf8Bom(content: string): string {
  return content.startsWith("\uFEFF") ? content : `\uFEFF${content}`;
}

export function prepareCsvPreviewWindow(): Window | null {
  if (isTauriRuntime() || typeof window === "undefined") return null;
  const previewWindow = window.open("", "_blank");
  if (!previewWindow) return null;

  previewWindow.opener = null;
  previewWindow.document.title = "Preparando CSV...";
  previewWindow.document.body.textContent = "Preparando archivo CSV...";
  return previewWindow;
}

export function closeCsvPreviewWindow(previewWindow: Window | null): void {
  if (previewWindow && !previewWindow.closed) previewWindow.close();
}

export async function downloadAndOpenCsv(
  content: string,
  fileName: string,
  previewWindow: Window | null,
): Promise<CsvDownloadResult> {
  const csv = withUtf8Bom(content);

  if (isTauriRuntime()) {
    const { invoke } = await import("@tauri-apps/api/core");
    const path = await invoke<string>("save_and_open_csv", {
      fileName,
      content: csv,
    });
    return { fileName, opened: true, path };
  }

  const downloadUrl = URL.createObjectURL(
    new Blob([csv], { type: "text/csv;charset=utf-8" }),
  );
  const anchor = document.createElement("a");
  anchor.href = downloadUrl;
  anchor.download = fileName;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(downloadUrl), 1_000);

  const previewUrl = URL.createObjectURL(
    new Blob([csv], { type: "text/plain;charset=utf-8" }),
  );
  const targetWindow =
    previewWindow && !previewWindow.closed
      ? previewWindow
      : window.open(previewUrl, "_blank");
  if (targetWindow && previewWindow && !previewWindow.closed) {
    previewWindow.location.replace(previewUrl);
  }
  window.setTimeout(() => URL.revokeObjectURL(previewUrl), 60_000);

  return { fileName, opened: targetWindow !== null };
}
