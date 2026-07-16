import { useEffect, useState, type FormEvent } from "react";
import { useNavigate, Navigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  ArrowRight,
  ChartNoAxesCombined,
  Cloud,
  Eye,
  EyeOff,
  Headphones,
  Lock,
  Mail,
  Shield,
  ShieldCheck,
  Users,
} from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@components/ui/dialog";
import { NutriLogoLoader } from "@components/loaders/NutriLogoLoader";
import { authApi } from "@services/api/authApi";
import { useAuthStore } from "@store/authStore";
import { useSyncStore } from "@store/syncStore";
import { type AuthSucursalDTO } from "@nutriclinica/shared";
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

  return (
    <main className="nc-login-page">
      {loading && <NutriLogoLoader text="Iniciando sesión..." fullscreen />}

      <section className="nc-login-shell">
        <section className="nc-brand-panel">
          <div className="nc-brand-orbit" aria-hidden="true" />
          <div className="nc-brand-dots" aria-hidden="true" />

          <img
            className="nc-logo"
            src="/assets/nutriclinica-logo.png"
            alt="NutriClinica"
          />

          <div className="nc-brand-layout">
            <div className="nc-brand-copy">
              <h1>
                <span>{t("auth.hero_title_line_1")}</span>
                <span>{t("auth.hero_title_line_2")}</span>
                <span className="nc-title-gradient">{t("auth.hero_title_line_3")}</span>
                <span className="nc-title-gradient nc-title-gradient-last">{t("auth.hero_title_line_4")}</span>
              </h1>

              <div className="nc-title-accent" aria-hidden="true">
                <span />
                <i />
                <i />
                <i />
              </div>

              <p className="nc-hero-description">
                {t("auth.hero_description")}
              </p>
            </div>

            <div className="nc-feature-stack" aria-label={t("auth.feature_group_label")}>
              <article className="nc-feature-card">
                <div className="nc-feature-icon">
                  <ShieldCheck size={42} strokeWidth={2.35} />
                </div>
                <div>
                  <strong>{t("auth.feature_security_title")}</strong>
                  <p>{t("auth.feature_security_desc")}</p>
                </div>
              </article>

              <article className="nc-feature-card">
                <div className="nc-feature-icon">
                  <ChartNoAxesCombined size={42} strokeWidth={2.35} />
                </div>
                <div>
                  <strong>{t("auth.feature_efficiency_title")}</strong>
                  <p>{t("auth.feature_efficiency_desc")}</p>
                </div>
              </article>

              <article className="nc-feature-card">
                <div className="nc-feature-icon">
                  <Users size={42} strokeWidth={2.35} />
                </div>
                <div>
                  <strong>{t("auth.feature_collaboration_title")}</strong>
                  <p>{t("auth.feature_collaboration_desc")}</p>
                </div>
              </article>
            </div>
          </div>

          <div className="nc-hero-visual" aria-hidden="true">
            <img src="/assets/login-hero2.png" alt="" className="nc-hero-image" />
          </div>
        </section>

        <section className="nc-form-panel">
          {requires2fa ? (
            <div className="nc-login-card nc-login-card-alt">
              <header className="nc-login-header nc-login-header-alt">
                <div className="nc-login-icon">
                  <Shield size={31} strokeWidth={2.2} />
                </div>
                <div>
                  <h2>{t("auth.2fa_title")}</h2>
                  <p>{t("auth.2fa_description")}</p>
                </div>
              </header>

              <form className="nc-alt-form" onSubmit={handleTotpSubmit}>
                <div className="nc-field">
                  <label htmlFor="totp">{t("auth.2fa_code")}</label>
                  <div className="nc-input nc-input-centered">
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
            <div className="nc-login-card nc-login-card-alt">
              <header className="nc-login-header nc-login-header-alt">
                <div className="nc-login-icon">
                  <ArrowRight size={31} strokeWidth={2.2} />
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
            <form className="nc-login-card nc-login-card-main" onSubmit={handleLogin}>
              <header className="nc-login-header">
                <h2>{t("auth.welcome_back")}</h2>
                <p>{t("auth.signin_subtitle")}</p>
                <div className="nc-login-header-accent" aria-hidden="true">
                  <span />
                </div>
              </header>

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
                    placeholder={t("auth.email_placeholder")}
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
                    placeholder={t("auth.password_placeholder")}
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
                disabled={loading}
              >
                {loading ? (
                  <>
                    <div className="nc-spinner" />
                    <span>{t("auth.logging_in")}</span>
                  </>
                ) : (
                  <>
                    <span>{t("auth.login_button")}</span>
                    <ArrowRight size={26} strokeWidth={2.1} />
                  </>
                )}
              </button>

              <div className="nc-login-card-rule" aria-hidden="true" />

              <div className="nc-login-security-row" aria-label={t("auth.secure_access")}>
                <article className="nc-security-item">
                  <Lock size={32} strokeWidth={2.2} />
                  <div>
                    <strong>{t("auth.security_access_short")}</strong>
                    <p>{t("auth.security_access_short_desc")}</p>
                  </div>
                </article>

                <article className="nc-security-item">
                  <ShieldCheck size={34} strokeWidth={2.15} />
                  <div>
                    <strong>{t("auth.privacy_guaranteed")}</strong>
                    <p>{t("auth.privacy_guaranteed_desc")}</p>
                  </div>
                </article>

                <article className="nc-security-item">
                  <Cloud size={34} strokeWidth={2.15} />
                  <div>
                    <strong>{t("auth.backup_daily_title")}</strong>
                    <p>{t("auth.backup_daily_desc")}</p>
                  </div>
                </article>
              </div>
            </form>
          )}
        </section>

        <footer className="nc-login-footer">
          <span>{t("auth.footer_copyright")}</span>
          <span className="nc-footer-mark" aria-hidden="true" />
          <span className="nc-footer-support">
            <Headphones size={20} strokeWidth={2.15} />
            <strong>{t("auth.support_title")}</strong>
            <span>{t("auth.support_email")}</span>
          </span>
        </footer>
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
