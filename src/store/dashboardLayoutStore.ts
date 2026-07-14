import { create } from "zustand";
import { v4 as uuid } from "uuid";
import { createDashboardPreset, createDefaultDashboardPreferences, getNextDashboardPosition, packDashboardLayout } from "@app/pages/dashboard/customization/dashboardPresets";
import { getDashboardWidgetDefinition, getDashboardWidgetSize } from "@app/pages/dashboard/customization/dashboardWidgetRegistry";
import type { CustomKpiConfig, DashboardPreferences, DashboardPresetId, DashboardScope, DashboardWidgetConfig, DashboardWidgetDefinitionId, DashboardWidgetPosition, DashboardWidgetSizePreset, LegacyDashboardPreferences } from "@app/pages/dashboard/customization/dashboardWidgetTypes";
import { dashboardStorageKey, localDashboardPreferencesRepository } from "@services/dashboard/LocalDashboardPreferencesRepository";

interface DashboardLayoutState {
  scopeKey: string | null;
  scope: DashboardScope | null;
  saved: DashboardPreferences | null;
  draft: DashboardPreferences | null;
  isEditing: boolean;
  isDirty: boolean;
  error: string | null;
  hydrate: (scope: DashboardScope, legacy?: LegacyDashboardPreferences) => void;
  beginEditing: () => void;
  cancelEditing: () => void;
  saveDraft: () => boolean;
  applyPreset: (presetId: DashboardPresetId) => void;
  updateLayout: (layout: DashboardWidgetPosition[]) => void;
  addWidget: (definitionId: DashboardWidgetDefinitionId, customKpiId?: string, size?: DashboardWidgetSizePreset) => void;
  updateWidget: (instanceId: string, config: DashboardWidgetConfig) => void;
  setWidgetSize: (instanceId: string, preset: DashboardWidgetSizePreset) => void;
  setRowsMode: (mode: "auto" | "manual") => void;
  adjustMinRows: (delta: -1 | 1) => void;
  moveWidgetInOrder: (instanceId: string, direction: -1 | 1) => void;
  duplicateWidget: (instanceId: string) => void;
  toggleWidgetHidden: (instanceId: string) => void;
  removeWidget: (instanceId: string) => void;
  addCustomKpi: (config: CustomKpiConfig) => void;
  removeCustomKpi: (customKpiId: string) => void;
  clearError: () => void;
}

function clonePreferences(value: DashboardPreferences): DashboardPreferences {
  return structuredClone(value);
}

function changed(draft: DashboardPreferences | null, saved: DashboardPreferences | null): boolean {
  if (!draft || !saved) return false;
  const normalize = (value: DashboardPreferences) => {
    const copy = clonePreferences(value);
    copy.updatedAt = "";
    copy.revision = "";
    return JSON.stringify(copy);
  };
  return normalize(draft) !== normalize(saved);
}

function withDraft(
  state: DashboardLayoutState,
  update: (draft: DashboardPreferences) => DashboardPreferences | null,
): Partial<DashboardLayoutState> {
  if (!state.draft) return {};
  const before = JSON.stringify(state.draft);
  const draft = update(clonePreferences(state.draft));
  if (!draft) return { error: "No se pudo completar la acción. Revisa el espacio disponible y la configuración del widget." };
  if (JSON.stringify(draft) === before) return {};
  draft.activePresetId = null;
  return { draft, isDirty: changed(draft, state.saved), error: null };
}

export const useDashboardLayoutStore = create<DashboardLayoutState>((set, get) => ({
  scopeKey: null,
  scope: null,
  saved: null,
  draft: null,
  isEditing: false,
  isDirty: false,
  error: null,

  hydrate: (scope, legacy) => {
    const scopeKey = dashboardStorageKey(scope);
    if (get().scopeKey === scopeKey && get().saved) return;
    const result = localDashboardPreferencesRepository.loadResult(scope);
    const preferences = result.status === "found"
      ? result.preferences
      : createDefaultDashboardPreferences(scope, legacy);
    let error = result.status === "invalid" ? result.message : null;
    if (result.status === "missing") {
      try {
        localDashboardPreferencesRepository.save(scope, preferences);
      } catch (saveError) {
        error = saveError instanceof Error ? saveError.message : String(saveError);
      }
    }
    set({
      scopeKey,
      scope,
      saved: preferences,
      draft: clonePreferences(preferences),
      isEditing: false,
      isDirty: false,
      error,
    });
  },

  beginEditing: () => set((state) => state.saved ? {
    draft: clonePreferences(state.saved),
    isEditing: true,
    isDirty: false,
    error: null,
  } : {}),

  cancelEditing: () => set((state) => state.saved ? {
    draft: clonePreferences(state.saved),
    isEditing: false,
    isDirty: false,
    error: null,
  } : {}),

  saveDraft: () => {
    const { scope, draft } = get();
    if (!scope || !draft) return false;
    try {
      const next = {
        ...clonePreferences(draft),
        updatedAt: new Date().toISOString(),
        revision: uuid(),
      };
      const saved = localDashboardPreferencesRepository.save(scope, next);
      set({ saved, draft: clonePreferences(saved), isEditing: false, isDirty: false, error: null });
      return true;
    } catch (error) {
      set({ error: error instanceof Error ? error.message : String(error) });
      return false;
    }
  },

  applyPreset: (presetId) => set((state) => {
    if (!state.scope || !state.draft) return {};
    const preset = createDashboardPreset(presetId, state.scope);
    preset.customKpis = clonePreferences(state.draft).customKpis;
    return { draft: preset, isDirty: changed(preset, state.saved), error: null };
  }),

  updateLayout: (layout) => set((state) => withDraft(state, (draft) => {
    if (layout.some((item) => item.x < 0 || item.y < 0 || item.x + item.w > 12 || item.y + item.h > draft.grid.maxRows)) {
      return null;
    }
    const updatedIds = new Set(layout.map((item) => item.i));
    const merged = [
      ...draft.layout.filter((item) => !updatedIds.has(item.i)),
      ...layout.map((item) => ({ ...item })),
    ];
    const hasOverlap = merged.some((item, index) => merged.slice(index + 1).some((other) =>
      item.x < other.x + other.w && item.x + item.w > other.x && item.y < other.y + other.h && item.y + item.h > other.y,
    ));
    if (hasOverlap) return null;
    draft.layout = merged;
    const visibleOrder = [...layout]
      .sort((a, b) => a.y - b.y || a.x - b.x)
      .map((item) => item.i);
    draft.smallScreenOrder = [
      ...visibleOrder,
      ...draft.smallScreenOrder.filter((id) => !updatedIds.has(id)),
    ];
    return draft;
  })),

  addWidget: (definitionId, customKpiId, sizePreset) => set((state) => withDraft(state, (draft) => {
    const definition = getDashboardWidgetDefinition(definitionId);
    if (definition.singleton && draft.widgets.some((widget) => widget.definitionId === definitionId)) return draft;
    if (definitionId === "customKpi" && (!customKpiId || !draft.customKpis.some((config) => config.id === customKpiId))) return null;
    if (draft.widgets.length >= 40) return null;
    const now = new Date().toISOString();
    const instanceId = definition.singleton ? definition.id : uuid();
    const position = getNextDashboardPosition(draft.layout, definitionId, instanceId, draft.grid.maxRows);
    if (!position) return null;
    const selectedSize = sizePreset ? getDashboardWidgetSize(definitionId, sizePreset) : null;
    const nextPosition = selectedSize ? {
      ...position,
      w: selectedSize.w,
      h: selectedSize.h,
      minW: selectedSize.minW,
      minH: selectedSize.minH,
      maxW: selectedSize.maxW,
      maxH: selectedSize.maxH,
    } : position;
    const nextOrder = [...draft.smallScreenOrder, instanceId];
    const layout = sizePreset
      ? packDashboardLayout([...draft.layout, nextPosition], nextOrder, draft.grid.maxRows)
      : [...draft.layout, nextPosition];
    if (!layout) return null;
    draft.widgets.push({
      instanceId,
      definitionId,
      definitionVersion: definition.version,
      hidden: false,
      config: customKpiId ? { customKpiId } : {},
      createdAt: now,
      updatedAt: now,
    });
    draft.layout = layout;
    draft.smallScreenOrder = nextOrder;
    return draft;
  })),

  updateWidget: (instanceId, config) => set((state) => withDraft(state, (draft) => {
    draft.widgets = draft.widgets.map((widget) => widget.instanceId === instanceId
      ? { ...widget, config: { ...widget.config, ...config }, updatedAt: new Date().toISOString() }
      : widget);
    return draft;
  })),

  setWidgetSize: (instanceId, preset) => set((state) => withDraft(state, (draft) => {
    const widget = draft.widgets.find((item) => item.instanceId === instanceId);
    if (!widget) return draft;
    const size = getDashboardWidgetSize(widget.definitionId, preset);
    const resized = draft.layout.map((item) => item.i === instanceId ? {
      ...item,
      w: size.w,
      h: size.h,
      minW: size.minW,
      minH: size.minH,
      maxW: size.maxW,
      maxH: size.maxH,
    } : item);
    const packed = packDashboardLayout(resized, draft.smallScreenOrder, draft.grid.maxRows);
    if (!packed) return null;
    draft.layout = packed;
    return draft;
  })),

  setRowsMode: (mode) => set((state) => withDraft(state, (draft) => {
    draft.grid.rowsMode = mode;
    return draft;
  })),

  adjustMinRows: (delta) => set((state) => withDraft(state, (draft) => {
    const occupiedRows = draft.layout.reduce((max, item) => Math.max(max, item.y + item.h), 1);
    const minimum = Math.max(1, Math.min(draft.grid.maxRows, occupiedRows));
    draft.grid.rowsMode = "manual";
    draft.grid.minRows = Math.max(minimum, Math.min(draft.grid.maxRows, draft.grid.minRows + delta));
    return draft;
  })),

  moveWidgetInOrder: (instanceId, direction) => set((state) => withDraft(state, (draft) => {
    const order = [...draft.smallScreenOrder];
    const visibleIds = new Set(draft.widgets.filter((widget) => !widget.hidden).map((widget) => widget.instanceId));
    const visibleOrder = order.filter((id) => visibleIds.has(id));
    const visibleIndex = visibleOrder.indexOf(instanceId);
    const adjacentId = visibleOrder[visibleIndex + direction];
    if (visibleIndex < 0 || !adjacentId) return draft;
    const index = order.indexOf(instanceId);
    const nextIndex = order.indexOf(adjacentId);
    [order[index], order[nextIndex]] = [order[nextIndex]!, order[index]!];
    const packed = packDashboardLayout(draft.layout, order, draft.grid.maxRows);
    if (!packed) return null;
    draft.smallScreenOrder = order;
    draft.layout = packed;
    return draft;
  })),

  duplicateWidget: (instanceId) => set((state) => withDraft(state, (draft) => {
    const source = draft.widgets.find((widget) => widget.instanceId === instanceId);
    if (!source) return draft;
    const definition = getDashboardWidgetDefinition(source.definitionId);
    if (definition.singleton) return draft;
    if (draft.widgets.length >= 40) return null;
    const now = new Date().toISOString();
    const duplicateId = uuid();
    const position = getNextDashboardPosition(draft.layout, source.definitionId, duplicateId, draft.grid.maxRows);
    if (!position) return null;
    let config = { ...source.config };
    if (source.definitionId === "customKpi" && source.config.customKpiId) {
      const sourceKpi = draft.customKpis.find((item) => item.id === source.config.customKpiId);
      if (sourceKpi) {
        if (draft.customKpis.length >= 25) return null;
        const customKpiId = uuid();
        draft.customKpis.push({ ...sourceKpi, id: customKpiId, createdAt: now, updatedAt: now });
        config = { ...config, customKpiId };
      }
    }
    draft.widgets.push({ ...source, config, instanceId: duplicateId, createdAt: now, updatedAt: now });
    draft.layout.push(position);
    draft.smallScreenOrder.push(duplicateId);
    return draft;
  })),

  toggleWidgetHidden: (instanceId) => set((state) => withDraft(state, (draft) => {
    const widget = draft.widgets.find((item) => item.instanceId === instanceId);
    if (!widget) return draft;
    if (widget.hidden) {
      const position = getNextDashboardPosition(draft.layout, widget.definitionId, instanceId, draft.grid.maxRows);
      if (!position) return null;
      draft.layout.push(position);
    } else {
      draft.layout = draft.layout.filter((item) => item.i !== instanceId);
    }
    widget.hidden = !widget.hidden;
    widget.updatedAt = new Date().toISOString();
    return draft;
  })),

  removeWidget: (instanceId) => set((state) => withDraft(state, (draft) => {
    draft.widgets = draft.widgets.filter((widget) => widget.instanceId !== instanceId);
    draft.layout = draft.layout.filter((item) => item.i !== instanceId);
    draft.smallScreenOrder = draft.smallScreenOrder.filter((id) => id !== instanceId);
    return draft;
  })),

  addCustomKpi: (config) => set((state) => withDraft(state, (draft) => {
    const existing = draft.customKpis.findIndex((item) => item.id === config.id);
    if (existing >= 0) draft.customKpis[existing] = config;
    else {
      if (draft.customKpis.length >= 25) return null;
      draft.customKpis.push(config);
    }
    return draft;
  })),

  removeCustomKpi: (customKpiId) => set((state) => withDraft(state, (draft) => {
    const instanceIds = draft.widgets
      .filter((widget) => widget.config.customKpiId === customKpiId)
      .map((widget) => widget.instanceId);
    draft.customKpis = draft.customKpis.filter((item) => item.id !== customKpiId);
    draft.widgets = draft.widgets.filter((widget) => !instanceIds.includes(widget.instanceId));
    draft.layout = draft.layout.filter((item) => !instanceIds.includes(item.i));
    draft.smallScreenOrder = draft.smallScreenOrder.filter((id) => !instanceIds.includes(id));
    return draft;
  })),

  clearError: () => set({ error: null }),
}));
