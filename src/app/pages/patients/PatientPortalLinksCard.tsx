import * as React from "react";
import { useTranslation } from "react-i18next";
import { Ban, Copy, ExternalLink, History, Link2, RefreshCcw } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@components/ui/badge";
import { Button } from "@components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@components/ui/card";
import { Input } from "@components/ui/input";
import { Skeleton } from "@components/ui/skeleton";
import { ConfirmDialog } from "@components/layout/ConfirmDialog";
import {
  createPatientPortalLink,
  listPatientPortalLinks,
  revokePatientPortalLink,
  type PortalLink,
  type PortalAuditEvent,
} from "@services/api/patientPortalApi";

export function PatientPortalLinksCard({ patientId }: { patientId: string }) {
  const { t, i18n } = useTranslation();
  const [links, setLinks] = React.useState<PortalLink[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [creating, setCreating] = React.useState(false);
  const [revoking, setRevoking] = React.useState(false);
  const [createdUrl, setCreatedUrl] = React.useState<string | null>(null);
  const [revokeTarget, setRevokeTarget] = React.useState<PortalLink | null>(null);

  const loadLinks = React.useCallback(async (signal?: AbortSignal) => {
    setLoading(true);
    setError(null);
    try {
      const result = await listPatientPortalLinks(patientId, signal);
      setLinks(result);
    } catch (err) {
      if (signal?.aborted) return;
      setError(err instanceof Error ? err.message : t("patient_portal.links_error"));
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  }, [patientId, t]);

  React.useEffect(() => {
    const controller = new AbortController();
    void loadLinks(controller.signal);
    return () => controller.abort();
  }, [loadLinks]);

  const onCreate = async () => {
    setCreating(true);
    try {
      const result = await createPatientPortalLink({
        pacienteId: patientId,
        expiresInDays: 30,
        label: t("patient_portal.default_link_label"),
      });
      const url = buildPortalUrl(result.token);
      setCreatedUrl(url);
      setLinks((current) => [result.link, ...current.filter((link) => link.id !== result.link.id)]);
      await copyToClipboard(url);
      toast.success(t("patient_portal.link_created"), {
        description: t("patient_portal.link_created_desc"),
      });
    } catch (err) {
      toast.error(t("patient_portal.operation_error"), {
        description: err instanceof Error ? err.message : String(err),
      });
    } finally {
      setCreating(false);
    }
  };

  const onCopyCreated = async () => {
    if (!createdUrl) return;
    try {
      await copyToClipboard(createdUrl);
      toast.success(t("patient_portal.link_copied"));
    } catch (err) {
      toast.error(t("patient_portal.operation_error"), {
        description: err instanceof Error ? err.message : String(err),
      });
    }
  };

  const onRevoke = async () => {
    if (!revokeTarget) return;
    setRevoking(true);
    try {
      const revoked = await revokePatientPortalLink(revokeTarget.id);
      setLinks((current) => current.map((link) => (link.id === revoked.id ? revoked : link)));
      setRevokeTarget(null);
      toast.success(t("patient_portal.revoked_success"));
    } catch (err) {
      toast.error(t("patient_portal.operation_error"), {
        description: err instanceof Error ? err.message : String(err),
      });
      throw err;
    } finally {
      setRevoking(false);
    }
  };

  return (
    <>
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between gap-3">
            <div>
              <CardTitle className="flex items-center gap-2 text-base">
                <Link2 className="h-4 w-4 text-primary" aria-hidden />
                {t("patient_portal.manage_title")}
              </CardTitle>
              <CardDescription>{t("patient_portal.manage_desc")}</CardDescription>
            </div>
            <Button size="sm" onClick={onCreate} disabled={creating}>
              {creating ? t("patient_portal.creating_link") : t("patient_portal.create_link")}
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {createdUrl && (
            <div className="rounded-lg border border-primary/30 bg-primary/5 p-3">
              <p className="text-sm font-medium">{t("patient_portal.new_link_once")}</p>
              <div className="mt-2 flex gap-2">
                <Input readOnly value={createdUrl} aria-label={t("patient_portal.created_link_label")} />
                <Button type="button" variant="outline" size="icon" onClick={onCopyCreated} aria-label={t("patient_portal.copy_link")}>
                  <Copy className="h-4 w-4" aria-hidden />
                </Button>
                <Button asChild variant="outline" size="icon" aria-label={t("common.open")}>
                  <a href={createdUrl} target="_blank" rel="noreferrer">
                    <ExternalLink className="h-4 w-4" aria-hidden />
                  </a>
                </Button>
              </div>
            </div>
          )}

          {loading ? (
            <div className="space-y-2">
              <Skeleton className="h-16 w-full" />
              <Skeleton className="h-16 w-full" />
            </div>
          ) : error ? (
            <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3" role="alert">
              <p className="text-sm text-destructive">{error}</p>
              <Button className="mt-2" size="sm" variant="outline" onClick={() => void loadLinks()}>
                <RefreshCcw className="h-4 w-4" aria-hidden />
                {t("common.retry")}
              </Button>
            </div>
          ) : links.length === 0 ? (
            <p className="rounded-lg border border-dashed p-3 text-sm text-muted-foreground">
              {t("patient_portal.no_links")}
            </p>
          ) : (
            <ul className="space-y-2">
              {links.map((link) => (
                <li key={link.id} className="rounded-lg border p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 space-y-1">
                      <p className="truncate text-sm font-medium">
                        {link.label ?? t("patient_portal.link_label_fallback")}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {t("patient_portal.expires", { date: formatDateTime(link.expiresAt, i18n.language) })}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {t("patient_portal.last_access", {
                          date: link.lastAccessedAt ? formatDateTime(link.lastAccessedAt, i18n.language) : t("patient_portal.never_accessed"),
                        })}
                      </p>
                      {link.recentEvents.length > 0 && (
                        <div className="mt-2 border-t pt-2">
                          <p className="flex items-center gap-1 text-xs font-medium text-foreground">
                            <History className="h-3 w-3" aria-hidden />
                            {t("patient_portal.audit_history")}
                          </p>
                          <ul className="mt-1 space-y-1">
                            {link.recentEvents.map((event) => (
                              <li key={event.id} className="text-xs text-muted-foreground">
                                {eventLabel(t, event)} · {formatDateTime(event.occurredAt, i18n.language)}
                                {event.ipAddress ? ` · IP ${event.ipAddress}` : ""}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-2">
                      <Badge variant={statusVariant(link.status)}>
                        {t(`patient_portal.status_${link.status}`)}
                      </Badge>
                      {link.status === "active" && (
                        <Button size="sm" variant="outline" onClick={() => setRevokeTarget(link)}>
                          <Ban className="h-3.5 w-3.5" aria-hidden />
                          {t("patient_portal.revoke_link")}
                        </Button>
                      )}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <ConfirmDialog
        open={Boolean(revokeTarget)}
        onOpenChange={(open) => { if (!open) setRevokeTarget(null); }}
        title={t("patient_portal.revoke_link_title")}
        description={t("patient_portal.revoke_link_desc")}
        confirmLabel={t("patient_portal.revoke_link")}
        tone="warning"
        busy={revoking}
        onConfirm={onRevoke}
      />
    </>
  );
}

function eventLabel(t: ReturnType<typeof useTranslation>["t"], event: PortalAuditEvent): string {
  return t(`patient_portal.event_${event.type}`);
}

function statusVariant(status: PortalLink["status"]): "success" | "warning" | "secondary" {
  if (status === "active") return "success";
  if (status === "expired") return "warning";
  return "secondary";
}

function buildPortalUrl(token: string): string {
  return `${window.location.origin}${window.location.pathname}#/portal/${encodeURIComponent(token)}`;
}

async function copyToClipboard(value: string): Promise<void> {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(value);
    return;
  }
  const textarea = document.createElement("textarea");
  textarea.value = value;
  textarea.setAttribute("readonly", "true");
  textarea.style.position = "fixed";
  textarea.style.opacity = "0";
  document.body.appendChild(textarea);
  textarea.select();
  document.execCommand("copy");
  document.body.removeChild(textarea);
}

function formatDateTime(value: string | null, locale: string): string {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeStyle: "short" }).format(date);
}
