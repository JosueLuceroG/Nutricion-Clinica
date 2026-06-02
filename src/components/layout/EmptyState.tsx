import * as React from "react";
import { AlertTriangle, Inbox, Search, Database } from "lucide-react";
import { Button } from "@components/ui/button";
import { cn } from "@utils/cn";

interface EmptyStateProps {
  title: string;
  description?: string;
  icon?: React.ComponentType<{ className?: string }>;
  action?: { label: string; onClick: () => void };
  variant?: "default" | "search" | "error" | "offline";
  className?: string;
}

const VARIANT_ICONS = {
  default: Inbox,
  search: Search,
  error: AlertTriangle,
  offline: Database,
};

export function EmptyState({
  title,
  description,
  icon,
  action,
  variant = "default",
  className,
}: EmptyStateProps) {
  const Icon = icon ?? VARIANT_ICONS[variant];
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed bg-muted/20 px-6 py-12 text-center",
        className,
      )}
    >
      <div
        className={cn(
          "flex h-12 w-12 items-center justify-center rounded-full",
          variant === "error" ? "bg-destructive/10 text-destructive" : "bg-muted text-muted-foreground",
        )}
      >
        <Icon className="h-6 w-6" aria-hidden />
      </div>
      <div className="space-y-1">
        <h3 className="text-sm font-semibold">{title}</h3>
        {description && (
          <p className="mx-auto max-w-sm text-sm text-muted-foreground">{description}</p>
        )}
      </div>
      {action && (
        <Button onClick={action.onClick} size="sm" className="mt-2">
          {action.label}
        </Button>
      )}
    </div>
  );
}

export function NoResultsFound({ onReset }: { onReset?: () => void }) {
  return (
    <EmptyState
      variant="search"
      title="Sin resultados"
      description="No encontramos elementos que coincidan con tu búsqueda."
      action={onReset ? { label: "Limpiar filtros", onClick: onReset } : undefined}
    />
  );
}

export function ErrorState({ message, onRetry }: { message?: string; onRetry?: () => void }) {
  return (
    <EmptyState
      variant="error"
      title="Algo salió mal"
      description={message ?? "Ocurrió un error inesperado. Intenta de nuevo."}
      action={onRetry ? { label: "Reintentar", onClick: onRetry } : undefined}
    />
  );
}
