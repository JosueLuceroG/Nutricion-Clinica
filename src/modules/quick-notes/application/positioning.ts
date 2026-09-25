import {
  QUICK_NOTE_MAX_DIMENSIONS,
  QUICK_NOTE_MIN_DIMENSIONS,
  QUICK_NOTE_SIZE_DIMENSIONS,
  type QuickNotePosition,
  type QuickNoteSize,
  type QuickNoteSizePreset,
} from "../domain";

export const QUICK_NOTE_VIEWPORT_MARGIN = 8;
export const QUICK_NOTE_CASCADE_OFFSET = 28;

const LEGACY_QUICK_NOTE_SIZE_DIMENSIONS = {
  compact: { width: 280, height: 220 },
  regular: { width: 340, height: 300 },
} as const;

export interface QuickNotesViewport {
  width: number;
  height: number;
}

/** Absolute viewport boundaries after excluding headers, sidebars, and status bars. */
export interface QuickNotesSafeRect {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

export interface NormalizedQuickNoteGeometry {
  position: QuickNotePosition;
  size: QuickNoteSize;
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(Math.max(value, minimum), maximum);
}

function finiteOr(value: number, fallback: number): number {
  return Number.isFinite(value) ? value : fallback;
}

function normalizeViewport(viewport: QuickNotesViewport): QuickNotesViewport {
  return {
    width: Math.max(1, finiteOr(viewport.width, 1)),
    height: Math.max(1, finiteOr(viewport.height, 1)),
  };
}

export function createFullViewportSafeRect(
  viewport: QuickNotesViewport,
): QuickNotesSafeRect {
  const normalized = normalizeViewport(viewport);
  return {
    left: 0,
    top: 0,
    right: normalized.width,
    bottom: normalized.height,
  };
}

function normalizeSafeRect(
  safeRect: QuickNotesSafeRect,
  viewport: QuickNotesViewport,
): QuickNotesSafeRect {
  const left = clamp(finiteOr(safeRect.left, 0), 0, viewport.width);
  const top = clamp(finiteOr(safeRect.top, 0), 0, viewport.height);
  return {
    left,
    top,
    right: clamp(
      finiteOr(safeRect.right, viewport.width),
      left,
      viewport.width,
    ),
    bottom: clamp(
      finiteOr(safeRect.bottom, viewport.height),
      top,
      viewport.height,
    ),
  };
}

export function createQuickNoteSize(
  preset: QuickNoteSizePreset,
): QuickNoteSize {
  return { preset, ...QUICK_NOTE_SIZE_DIMENSIONS[preset] };
}

export function normalizeQuickNoteSize(size: QuickNoteSize): QuickNoteSize {
  const presetSize = QUICK_NOTE_SIZE_DIMENSIONS[size.preset];
  const legacySize = LEGACY_QUICK_NOTE_SIZE_DIMENSIONS[size.preset];
  if (size.width === legacySize.width && size.height === legacySize.height) {
    return createQuickNoteSize(size.preset);
  }
  return {
    preset: size.preset,
    width: clamp(
      finiteOr(size.width, presetSize.width),
      QUICK_NOTE_MIN_DIMENSIONS.width,
      QUICK_NOTE_MAX_DIMENSIONS.width,
    ),
    height: clamp(
      finiteOr(size.height, presetSize.height),
      QUICK_NOTE_MIN_DIMENSIONS.height,
      QUICK_NOTE_MAX_DIMENSIONS.height,
    ),
  };
}

export function clampNoteToViewport(
  position: QuickNotePosition,
  size: QuickNoteSize,
  safeRect: QuickNotesSafeRect,
): QuickNotePosition {
  const viewport = normalizeViewport({
    width: position.viewportWidth,
    height: position.viewportHeight,
  });
  const safe = normalizeSafeRect(safeRect, viewport);
  const normalizedSize = normalizeQuickNoteSize(size);
  const minimumX = Math.min(safe.right, safe.left + QUICK_NOTE_VIEWPORT_MARGIN);
  const minimumY = Math.min(safe.bottom, safe.top + QUICK_NOTE_VIEWPORT_MARGIN);
  const maximumX = Math.max(
    minimumX,
    safe.right - QUICK_NOTE_VIEWPORT_MARGIN - normalizedSize.width,
  );
  const maximumY = Math.max(
    minimumY,
    safe.bottom - QUICK_NOTE_VIEWPORT_MARGIN - normalizedSize.height,
  );

  return {
    x: clamp(finiteOr(position.x, minimumX), minimumX, maximumX),
    y: clamp(finiteOr(position.y, minimumY), minimumY, maximumY),
    viewportWidth: viewport.width,
    viewportHeight: viewport.height,
  };
}

export function createCascadedDefaultPosition(
  noteIndex: number,
  size: QuickNoteSize,
  viewport: QuickNotesViewport,
  safeRect: QuickNotesSafeRect,
): QuickNotePosition {
  const normalizedViewport = normalizeViewport(viewport);
  const safe = normalizeSafeRect(safeRect, normalizedViewport);
  const step = Math.max(0, Math.trunc(noteIndex)) % 10;
  return clampNoteToViewport(
    {
      x:
        safe.left +
        QUICK_NOTE_VIEWPORT_MARGIN +
        step * QUICK_NOTE_CASCADE_OFFSET,
      y:
        safe.top +
        QUICK_NOTE_VIEWPORT_MARGIN +
        step * QUICK_NOTE_CASCADE_OFFSET,
      viewportWidth: normalizedViewport.width,
      viewportHeight: normalizedViewport.height,
    },
    size,
    safe,
  );
}

export function normalizePersistedQuickNoteGeometry(
  position: QuickNotePosition,
  size: QuickNoteSize,
  viewport: QuickNotesViewport,
  safeRect: QuickNotesSafeRect,
): NormalizedQuickNoteGeometry {
  const normalizedViewport = normalizeViewport(viewport);
  const previousWidth = Math.max(
    1,
    finiteOr(position.viewportWidth, normalizedViewport.width),
  );
  const previousHeight = Math.max(
    1,
    finiteOr(position.viewportHeight, normalizedViewport.height),
  );
  const normalizedSize = normalizeQuickNoteSize(size);
  const scaledPosition: QuickNotePosition = {
    x: finiteOr(position.x, 0) * (normalizedViewport.width / previousWidth),
    y: finiteOr(position.y, 0) * (normalizedViewport.height / previousHeight),
    viewportWidth: normalizedViewport.width,
    viewportHeight: normalizedViewport.height,
  };

  return {
    position: clampNoteToViewport(scaledPosition, normalizedSize, safeRect),
    size: normalizedSize,
  };
}

export const createCascadedNotePosition = createCascadedDefaultPosition;
export const normalizeQuickNoteGeometry = normalizePersistedQuickNoteGeometry;
