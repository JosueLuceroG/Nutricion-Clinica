import { useEffect, useState, type FormEvent } from "react";
import { useNavigate, Navigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  ArrowRight,
  Eye,
  EyeOff,
  Lock,
  LogIn,
  Mail,
  ShieldCheck,
  Shield,
} from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@components/ui/dialog";
import { authApi } from "@services/api/authApi";
import { useAuthStore } from "@store/authStore";
import { useSyncStore } from "@store/syncStore";
import { RoleLabel, type AuthSucursalDTO } from "@nutriclinica/shared";
import "./LoginPage.css";

export function LoginPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const setSession = useAuthStore((s) => s.setSession);
  const setSucursalId = useSyncStore((s) => s.setSucursalId);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem("nc_remembered_email");
    if (saved) {
      setEmail(saved);
      setRememberMe(true);
    }
  }, []);

  useEffect(() => {
    if (!rememberMe) {
      localStorage.removeItem("nc_remembered_email");
    }
  }, [rememberMe]);

  const [sucursales, setSucursales] = useState<AuthSucursalDTO[] | null>(null);
  const [pendingSession, setPendingSession] = useState<{
    token: string;
    user: { id: string; email: string; nombreCompleto: string; rol: "admin" | "nutriologa" | "asistente" | "soporte_tecnico" | "auditor" | "facturacion" };
  } | null>(null);
  const [requires2fa, setRequires2fa] = useState(false);
  const [pending2faToken, setPending2faToken] = useState<string | null>(null);
  const [totpCode, setTotpCode] = useState("");
  const [forgotOpen, setForgotOpen] = useState(false);

  if (isAuthenticated) {
    return <Navigate to="/" replace />;
  }

  const handleLogin = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const response = await authApi.login({ email, password });
      if (response.requires2fa && response.pending2faToken) {
        setRequires2fa(true);
        setPending2faToken(response.pending2faToken);
        setLoading(false);
        return;
      }
      if (rememberMe) {
        localStorage.setItem("nc_remembered_email", email);
      }
      if (rememberMe) {
        localStorage.setItem("nc_remembered_email", email);
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
      const raw = err instanceof Error ? err.message : "No fue posible iniciar sesión";
      if (
        raw.includes("Failed to fetch") ||
        raw.includes("NetworkError") ||
        raw.includes("TypeError") ||
        raw.includes("NetworkError")
      ) {
        toast.error("No se pudo conectar con el servidor. Intenta nuevamente.", { duration: 5000 });
      } else {
        toast.error(raw, { duration: 5000 });
      }
    } finally {
      setLoading(false);
    }
  };

  const handleTotpSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!pending2faToken) return;
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
      const raw2 = err instanceof Error ? err.message : "Código invalido o expirado";
      if (
        raw2.includes("Failed to fetch") ||
        raw2.includes("NetworkError") ||
        raw2.includes("TypeError")
      ) {
        toast.error("No se pudo conectar con el servidor. Intenta nuevamente.", { duration: 5000 });
      } else {
        toast.error(raw2, { duration: 5000 });
      }
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

  const rolesList = Object.values(RoleLabel).slice(0, 3).join(" \u00b7 ");

  return (
    <main className="nc-login-page">
      <section className="nc-login-shell">

        <div className="nc-shell-art" aria-hidden="true">
          <img src="/assets/login-hero.png" alt="" className="nc-shell-art-image" />
          <div className="nc-shell-art-overlay" />
        </div>

        {/* ===== LEFT ===== */}
        <section className="nc-brand-panel">
          <div className="nc-brand-circle" />
          <div className="nc-brand-dots" />

          <div className="nc-brand-content">
            <img
              className="nc-logo"
              src="/assets/nutriclinica-logo.png"
              alt="NutriClinica"
            />

            <div className="nc-brand-copy">
              <h1>
                <span className="nc-title-main">Gesti&oacute;n cl&iacute;nica nutricional</span>
                <span className="nc-title-line">
                  m&aacute;s <span className="nc-title-gradient">simple, segura y eficiente</span>
                </span>
              </h1>

              <p className="nc-hero-description">
  Una plataforma diseñada para nutriólogas
  <br />
  y su equipo, que mejora la atención y el
  <br />
  seguimiento de cada paciente.
</p>
            </div>
          </div>
        </section>

        {/* ===== RIGHT ===== */}
        <section className="nc-form-panel">

          {requires2fa ? (
            /* ---------- 2FA ---------- */
            <div className="nc-login-card nc-card-2fa">
              <header className="nc-login-header">
                <div className="nc-login-icon">
                  <Shield size={31} strokeWidth={2.2} />
                </div>
                <div>
                  <h2>{t("auth.2fa_title")}</h2>
                  <p>{t("auth.2fa_description")}</p>
                </div>
              </header>

              <form onSubmit={handleTotpSubmit}>
                <div className="nc-field">
                  <label htmlFor="totp">{t("auth.2fa_code")}</label>
                  <div className="nc-input">
                    <input
                      id="totp"
                      type="text"
                      inputMode="numeric"
                      autoComplete="one-time-code"
                      maxLength={6}
                      value={totpCode}
                      onChange={(e) => setTotpCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                      required
                      autoFocus
                      placeholder="000000"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  className="nc-submit"
                  disabled={loading || totpCode.length !== 6}
                >
                  {loading ? (
                    <>
                      <div className="nc-spinner" />
                      <span>{t("auth.verifying")}</span>
                    </>
                  ) : (
                    <span>{t("auth.verify")}</span>
                  )}
                </button>
              </form>
            </div>

          ) : sucursales && sucursales.length > 1 ? (
            /* ---------- Branch selection ---------- */
            <div className="nc-login-card">
              <header className="nc-login-header">
                <div className="nc-login-icon">
                  <LogIn size={31} strokeWidth={2.2} />
                </div>
                <div>
                  <h2>{t("auth.select_branch")}</h2>
                  <p>Tienes acceso a m&uacute;ltiples sucursales. Selecciona con cu&aacute;l quieres iniciar.</p>
                </div>
              </header>

              <div className="nc-branch-list">
                {sucursales.map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    className="nc-branch-btn"
                    onClick={() => handleSucursalPick(s.id)}
                  >
                    <span>{s.nombre}</span>
                    {s.esTitular && <span className="nc-branch-titular">Titular</span>}
                  </button>
                ))}
              </div>
            </div>

          ) : (
            /* ---------- Normal login ---------- */
            <form className="nc-login-card" onSubmit={handleLogin}>
              <header className="nc-login-header">
                <div className="nc-login-icon">
                  <LogIn size={31} strokeWidth={2.2} />
                </div>
                <div>
                  <h2>{t("auth.login_title")}</h2>
                  <p>{t("auth.tagline")}</p>
                </div>
              </header>

              <div className="nc-divider" />

              <div className="nc-field">
                <label htmlFor="email">{t("auth.email")}</label>
                <div className="nc-input">
                  <Mail size={20} strokeWidth={2} />
                  <input
                    id="email"
                    type="email"
                    autoComplete="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    autoFocus
                    placeholder="correo@ejemplo.com"
                  />
                </div>
              </div>

              <div className="nc-field">
                <label htmlFor="password">{t("auth.password")}</label>
                <div className="nc-input">
                  <Lock size={20} strokeWidth={2} />
                  <input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    autoComplete="current-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    placeholder="Contraseña"
                  />
                  <button
                    type="button"
                    className="nc-eye-button"
                    onClick={() => setShowPassword((v) => !v)}
                    aria-label={showPassword ? t("auth.hide_password") : t("auth.show_password")}
                  >
                    {showPassword ? <EyeOff size={20} strokeWidth={2} /> : <Eye size={20} strokeWidth={2} />}
                  </button>
                </div>
              </div>

              <div className="nc-options">
                <label className="nc-remember">
                  <input
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                  />
                  <span>{t("auth.remember_me")}</span>
                </label>

                <a
                  href="#"
                  onClick={(e) => {
                    e.preventDefault();
                    setForgotOpen(true);
                  }}
                >
                  {t("auth.forgot_password")}
                </a>
              </div>

              <button
                type="submit"
                className="nc-submit"
                disabled={loading || !email || !password}
              >
                {loading ? (
                  <>
                    <div className="nc-spinner" />
                    <span>{t("auth.logging_in")}</span>
                  </>
                ) : (
                  <>
                    <span>{t("auth.login_button")}</span>
                    <ArrowRight size={23} strokeWidth={2.2} />
                  </>
                )}
              </button>

              <div className="nc-secure-box">
                <div className="nc-secure-icon">
                  <ShieldCheck size={22} strokeWidth={2.1} />
                </div>
                <div>
                  <strong>{t("auth.secure_access")}</strong>
                  <p>{t("auth.secure_access_desc")}</p>
                </div>
              </div>

              <footer className="nc-login-footer">
                <strong>{t("auth.credentials_note")}</strong>
                <span>{t("auth.roles_available", { roles: rolesList })}</span>
              </footer>
            </form>
          )}

        </section>
      </section>
      <Dialog open={forgotOpen} onOpenChange={setForgotOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("auth.forgot_password")}</DialogTitle>
            <DialogDescription>
              Contacta al administrador del sistema para restablecer tu contrase&ntilde;a.
            </DialogDescription>
          </DialogHeader>
        </DialogContent>
      </Dialog>
    </main>
  );
}
