import type { ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { useAuthStore } from "@store/authStore";
import { hasModuleAccess } from "./securityService";

export interface RequireModuleProps {
  module: string;
  action?: string;
  redirectTo?: string;
  children: ReactNode;
}

export function RequireModule({
  module,
  action = "read",
  redirectTo = "/",
  children,
}: RequireModuleProps): ReactNode {
  const role = useAuthStore((state) => state.user?.rol ?? null);
  if (!role || !hasModuleAccess(module, role, action)) {
    return <Navigate to={redirectTo} replace />;
  }
  return <>{children}</>;
}
