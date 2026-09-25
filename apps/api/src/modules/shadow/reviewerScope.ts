/**
 * Alcance de revisores del shadow (Build 09.5A §70-71).
 * Cada revisor queda acotado a sucursales/capabilities específicas; la revisión
 * de otro tenant/capability queda DENIED (nunca cross-tenant).
 */

export interface ReviewerScopeEntry {
  reviewerKey: string;
  sucursalIds?: string[];
  capabilities?: string[];
  role?: string;
}

export interface ReviewerScopeResult {
  allowed: boolean;
  reason: string;
}

export function readReviewerScopes(env: NodeJS.ProcessEnv = process.env): ReviewerScopeEntry[] {
  const raw = env.SHADOW_REVIEWER_SCOPES?.trim();
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((entry): entry is ReviewerScopeEntry =>
        typeof entry === 'object' &&
        entry !== null &&
        typeof (entry as ReviewerScopeEntry).reviewerKey === 'string' &&
        (entry as ReviewerScopeEntry).reviewerKey.length > 0)
      .map((entry) => ({
        reviewerKey: entry.reviewerKey,
        sucursalIds: entry.sucursalIds,
        capabilities: entry.capabilities,
        role: entry.role,
      }));
  } catch {
    return [];
  }
}

export function canReviewInScope(
  reviewerKey: string,
  context: { sucursalId?: string; capability: string; role?: string },
  scopes: ReviewerScopeEntry[],
): ReviewerScopeResult {
  const scope = scopes.find((s) => s.reviewerKey === reviewerKey);
  if (!scope) {
    return { allowed: false, reason: `revisor '${reviewerKey}' sin alcance configurado` };
  }
  if (scope.sucursalIds && !scope.sucursalIds.includes(context.sucursalId ?? '')) {
    return { allowed: false, reason: `revisor '${reviewerKey}' no cubre la sucursal '${context.sucursalId}'` };
  }
  if (scope.capabilities && !scope.capabilities.includes(context.capability)) {
    return { allowed: false, reason: `revisor '${reviewerKey}' no cubre la capability '${context.capability}'` };
  }
  return { allowed: true, reason: `alcance OK: ${scope.sucursalIds?.length ?? 0} sucursales, ${scope.capabilities?.length ?? 0} capabilities` };
}