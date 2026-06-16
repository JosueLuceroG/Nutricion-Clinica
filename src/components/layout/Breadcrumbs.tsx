import { useTranslation } from "react-i18next";
import { Link, useParams } from "react-router-dom";
import { ChevronRight, Home } from "lucide-react";
import { cn } from "@utils/cn";

export interface BreadcrumbItem {
  label: string;
  href?: string;
}

export function Breadcrumbs({ items, className }: { items: BreadcrumbItem[]; className?: string }) {
  const { t } = useTranslation();
  return (
    <nav aria-label={t("nav.breadcrumb")} className={cn("flex items-center text-sm", className)}>
      <ol className="flex items-center gap-1.5">
        <li>
          <Link
            to="/"
            className="flex items-center gap-1 text-muted-foreground transition-colors hover:text-foreground"
            aria-label={t("nav.home")}
          >
            <Home className="h-3.5 w-3.5" />
          </Link>
        </li>
        {items.map((item, i) => {
          const last = i === items.length - 1;
          return (
            <li key={`${item.label}-${i}`} className="flex items-center gap-1.5">
              <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/60" aria-hidden />
              {item.href && !last ? (
                <Link
                  to={item.href}
                  className="text-muted-foreground transition-colors hover:text-foreground"
                >
                  {item.label}
                </Link>
              ) : (
                <span className={cn("font-medium", last ? "text-foreground" : "text-muted-foreground")}>
                  {item.label}
                </span>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useBreadcrumbsFromParams() {
  const params = useParams();
  return params;
}
