import * as React from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import { telemedicinaApi } from "@services/api/telemedicinaApi";
import { PageHeader, PageContent } from "@app/layout/AppLayout";
import { Button } from "@components/ui/button";
import { Input } from "@components/ui/input";
import { Label } from "@components/ui/label";
import { Textarea } from "@components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@components/ui/card";

export function NewTelemedicinaSalaPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [pacienteId, setPacienteId] = React.useState("");
  const [scheduledAt, setScheduledAt] = React.useState("");
  const [notas, setNotas] = React.useState("");
  const [saving, setSaving] = React.useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pacienteId.trim()) return;
    setSaving(true);
    try {
      const { id } = await telemedicinaApi.create({
        pacienteId: pacienteId.trim(),
        scheduledAt: scheduledAt ? new Date(scheduledAt).toISOString() : undefined,
        notas: notas.trim() || undefined,
      });
      toast.success(t("telemedicina.sala_created"));
      navigate(`/telemedicina/${id}`, { replace: true });
    } catch (err) {
      toast.error(t("common.error_occurred"), {
        description: err instanceof Error ? err.message : String(err),
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <PageHeader
        title={t("telemedicina.new_sala")}
        actions={
          <Button variant="ghost" size="sm" onClick={() => navigate("/telemedicina")}>
            <ArrowLeft className="mr-1 h-4 w-4" />
            {t("common.back")}
          </Button>
        }
      />

      <PageContent>
        <Card className="mx-auto max-w-lg">
          <CardHeader>
            <CardTitle>{t("telemedicina.new_sala_title")}</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="pacienteId">{t("patient.title_single")} ID</Label>
                <Input
                  id="pacienteId"
                  value={pacienteId}
                  onChange={(e) => setPacienteId(e.target.value)}
                  placeholder="UUID del paciente"
                  required
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="scheduledAt">{t("telemedicina.scheduled_at")}</Label>
                <Input
                  id="scheduledAt"
                  type="datetime-local"
                  value={scheduledAt}
                  onChange={(e) => setScheduledAt(e.target.value)}
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="notas">{t("common.notes")}</Label>
                <Textarea
                  id="notas"
                  value={notas}
                  onChange={(e) => setNotas(e.target.value)}
                  rows={3}
                />
              </div>

              <div className="flex gap-2">
                <Button type="button" variant="outline" onClick={() => navigate("/telemedicina")}>
                  {t("common.cancel")}
                </Button>
                <Button type="submit" disabled={saving || !pacienteId.trim()}>
                  {saving ? t("common.saving") : t("telemedicina.create_sala")}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </PageContent>
    </>
  );
}
