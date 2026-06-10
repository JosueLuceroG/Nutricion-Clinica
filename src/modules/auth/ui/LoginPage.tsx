import * as React from "react";
import { useNavigate, Navigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Eye, EyeOff, LogIn, AlertCircle, Shield } from "lucide-react";
import { toast } from "sonner";
import { authApi } from "@services/api/authApi";
import { useAuthStore } from "@store/authStore";
import { useSyncStore } from "@store/syncStore";
import { Button } from "@components/ui/button";
import { Input } from "@components/ui/input";
import { Label } from "@components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@components/ui/card";
import { RoleLabel, type AuthSucursalDTO } from "@nutriclinica/shared";
import { cn } from "@utils/cn";

export function LoginPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const setSession = useAuthStore((s) => s.setSession);
  const setSucursalId = useSyncStore((s) => s.setSucursalId);

  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [showPassword, setShowPassword] = React.useState(false);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [sucursales, setSucursales] = React.useState<AuthSucursalDTO[] | null>(null);
  const [pendingSession, setPendingSession] = React.useState<{
    token: string;
    user: { id: string; email: string; nombreCompleto: string; rol: "admin" | "nutriologa" | "asistente" | "soporte_tecnico" | "auditor" | "facturacion" };
  } | null>(null);
  const [requires2fa, setRequires2fa] = React.useState(false);
  const [pending2faToken, setPending2faToken] = React.useState<string | null>(null);
  const [totpCode, setTotpCode] = React.useState("");

  if (isAuthenticated) {
    return <Navigate to="/" replace />;
  }

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const response = await authApi.login({ email, password });
      if (response.requires2fa && response.pending2faToken) {
        setRequires2fa(true);
        setPending2faToken(response.pending2faToken);
        setLoading(false);
        return;
      }
      if (response.sucursales.length > 1) {
        setPendingSession({ token: response.token, user: response.profesional });
        setSucursales(response.sucursales);
      } else {
        const sucursalActivaId = response.sucursalActivaId ?? response.sucursales[0]?.id ?? null;
        setSession({
          token: response.token,
          user: response.profesional,
          sucursales: response.sucursales,
          sucursalActivaId,
        });
        if (sucursalActivaId) setSucursalId(sucursalActivaId);
        toast.success(`Bienvenido/a, ${response.profesional.nombreCompleto}`);
        navigate("/", { replace: true });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "No fue posible iniciar sesi\u00f3n");
    } finally {
      setLoading(false);
    }
  };

  const handleTotpSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pending2faToken) return;
    setError(null);
    setLoading(true);
    try {
      const response = await authApi.login({ email, password, totpCode, pending2faToken });
      const sucursalActivaId = response.sucursalActivaId ?? response.sucursales[0]?.id ?? null;
      setSession({
        token: response.token,
        user: response.profesional,
        sucursales: response.sucursales,
        sucursalActivaId,
      });
      if (sucursalActivaId) setSucursalId(sucursalActivaId);
      toast.success(`Bienvenido/a, ${response.profesional.nombreCompleto}`);
      navigate("/", { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : "C\u00f3digo inv\u00e1lido o expirado");
    } finally {
      setLoading(false);
    }
  };

  const handleSucursalPick = (id: string) => {
    if (!pendingSession) return;
    setSession({
      token: pendingSession.token,
      user: pendingSession.user,
      sucursales: sucursales ?? [],
      sucursalActivaId: id,
    });
    setSucursalId(id);
    toast.success(`Bienvenido/a, ${pendingSession.user.nombreCompleto}`);
    navigate("/", { replace: true });
  };

  if (sucursales && sucursales.length > 1) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-muted/30 p-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>{t("auth.select_branch")}</CardTitle>
            <CardDescription>
              Tienes acceso a m&uacute;ltiples sucursales. Selecciona con cu&aacute;l quieres iniciar.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {sucursales.map((s) => (
              <Button
                key={s.id}
                variant="outline"
                className="w-full justify-between"
                onClick={() => handleSucursalPick(s.id)}
              >
                <span>{s.nombre}</span>
                {s.esTitular && <span className="text-xs text-muted-foreground">Titular</span>}
              </Button>
            ))}
          </CardContent>
        </Card>
      </div>
    );
  }

  if (requires2fa) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-muted/30 p-4">
        <Card className="w-full max-w-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5" aria-hidden />
              {t("auth.2fa_title")}
            </CardTitle>
            <CardDescription>
              {t("auth.2fa_description")}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleTotpSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="totp">{t("auth.2fa_code")}</Label>
                <Input
                  id="totp"
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  maxLength={6}
                  value={totpCode}
                  onChange={(e) => setTotpCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                  required
                  autoFocus
                  className="text-center text-lg tracking-widest"
                  placeholder="000000"
                />
              </div>

              {error && (
                <div
                  role="alert"
                  className={cn(
                    "flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/5 p-2 text-xs text-destructive",
                  )}
                >
                  <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
                  <span>{error}</span>
                </div>
              )}

              <Button type="submit" className="w-full" disabled={loading || totpCode.length !== 6}>
                {loading ? t("auth.verifying") : t("auth.verify")}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/30 p-4">
      <Card className="w-full max-w-sm">
        <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <LogIn className="h-5 w-5" aria-hidden />
              {t("auth.login_title")}
            </CardTitle>
          <CardDescription>
            NutriClinica \u2014 expediente cl&iacute;nico nutricional
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="email">{t("auth.email")}</Label>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoFocus
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="password">{t("auth.password")}</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="pr-9"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute inset-y-0 right-0 flex w-9 items-center justify-center text-muted-foreground hover:text-foreground"
                  aria-label={showPassword ? t("auth.hide_password") : t("auth.show_password")}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            {error && (
              <div
                role="alert"
                className={cn(
                  "flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/5 p-2 text-xs text-destructive",
                )}
              >
                <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
                <span>{error}</span>
              </div>
            )}

            <Button type="submit" className="w-full" disabled={loading || !email || !password}>
              {loading ? t("auth.logging_in") : t("auth.login_button")}
            </Button>

            <p className="text-center text-xs text-muted-foreground">
              Las credenciales las gestiona tu administradora de sucursal.
              <br />
              <span className="opacity-70">Rol disponible: {Object.values(RoleLabel).slice(0, 3).join(" \u00b7 ")}</span>
            </p>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
