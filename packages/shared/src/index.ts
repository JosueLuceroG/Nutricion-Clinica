/**
 * Tipos compartidos entre cliente (apps/web) y API (apps/api).
 *
 * El cliente y el servidor hablan el mismo idioma a través de este paquete.
 * Por ahora contiene solo los identificadores comunes y los enums de
 * tenancy/RBAC. Los tipos de dominio (Patient, Consultation, etc.) viven
 * en el cliente y se replicarán al servidor a medida que se necesiten los
 * endpoints de sync.
 */

// =====================================================================
// Roles (RBAC) — sprint 14C
// =====================================================================

export const RoleSchema = {
  /** Superusuario cross-sucursal: ve todo, valida, edita precios globales. */
  ADMIN: "admin",
  /** Nutri\u00f3loga titular: due\u00f1a de pacientes en sus sucursales asignadas. */
  NUTRIOLOGA: "nutriologa",
  /** Asistente: agenda, cobra, no ve notas cl\u00ednicas completas. */
  ASISTENTE: "asistente",
  /** Soporte t\u00e9cnico: solo lectura para diagn\u00f3stico, sin datos sensibles. */
  SOPORTE: "soporte_tecnico",
  /** Auditor: solo bit\u00e1cora (NOM-024). */
  AUDITOR: "auditor",
  /** Facturaci\u00f3n: m\u00f3dulo econ\u00f3mico, sin acceso a historia cl\u00ednica. */
  FACTURACION: "facturacion",
} as const;

export type Role = (typeof RoleSchema)[keyof typeof RoleSchema];

export const ALL_ROLES: Role[] = Object.values(RoleSchema);

export const RoleLabel: Record<Role, string> = {
  admin: "Administrador",
  nutriologa: "Nutri\u00f3loga titular",
  asistente: "Asistente",
  soporte_tecnico: "Soporte t\u00e9cnico",
  auditor: "Auditor",
  facturacion: "Facturaci\u00f3n",
};

// =====================================================================
// Sucursal (Sprint 14B)
// =====================================================================

export interface SucursalDTO {
  id: string;
  nombre: string;
  direccion: string | null;
  telefono: string | null;
  email: string | null;
  activa: boolean;
  createdAt: string;
  updatedAt: string;
}

// =====================================================================
// Profesional (Sprint 14C)
// =====================================================================

export interface ProfesionalDTO {
  id: string;
  email: string;
  nombreCompleto: string;
  cedulaProfesional: string | null;
  rol: Role;
  sucursalIds: string[];
  activo: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface AuthResponse {
  token: string;
  profesional: ProfesionalDTO;
  sucursales: SucursalDTO[];
  /** ID de la sucursal activa al login (la primera asignada o la \u00faltima usada). */
  sucursalActivaId: string | null;
}

export interface LoginRequest {
  email: string;
  password: string;
  sucursalId?: string;
}

export interface RegisterRequest {
  email: string;
  password: string;
  nombreCompleto: string;
  cedulaProfesional?: string;
  rol?: Role;
  sucursalIds: string[];
}

// =====================================================================
// JWT payload
// =====================================================================

export interface JwtPayload {
  /** Subject = profesional.id */
  sub: string;
  email: string;
  rol: Role;
  /** Sucursales a las que el profesional tiene acceso. Admin = todas. */
  sucursalIds: string[];
  iat: number;
  exp: number;
}

// =====================================================================
// Constantes
// =====================================================================

export const SYNC_SCHEMA_VERSION = 1;
export const API_VERSION = "v1";
