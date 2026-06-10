import * as React from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import { telemedicinaApi } from "@services/api/telemedicinaApi";
import { VideoCallRoom } from "@modules/telemedicina/VideoCallRoom";
import { PageHeader, PageContent } from "@app/layout/AppLayout";
import { Button } from "@components/ui/button";
import { Badge } from "@components/ui/badge";
import { Card, CardContent } from "@components/ui/card";
import { Skeleton } from "@components/ui/skeleton";
import { Video, Clock, CheckCircle2, XCircle } from "lucide-react";
import type { TelemedicinaSalaDTO } from "@nutriclinica/shared";

const estadoLabel: Record<TelemedicinaSalaDTO['estado'], string> = {
  pendiente: "telemedicina.estado_pendiente",
  activa: "telemedicina.estado_activa",
  finalizada: "telemedicina.estado_finalizada",
  cancelada: "telemedicina.estado_cancelada",
};

const estadoIcon: Record<TelemedicinaSalaDTO['estado'], React.ComponentType<{ className?: string }>> = {
  pendiente: Clock,
  activa: Video,
  finalizada: CheckCircle2,
  cancelada: XCircle,
};

export function VideoCallRoomPage() {
  const { t } = useTranslation();
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [sala, setSala] = React.useState<TelemedicinaSalaDTO | null>(null);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    if (!id) return;
    const loadSala = async (salaId: string) => {
      try {
        const data = await telemedicinaApi.get(salaId);
        setSala(data);
      } catch (err) {
        toast.error(t("common.error_occurred"), {
          description: err instanceof Error ? err.message : String(err),
        });
        navigate("/telemedicina", { replace: true });
      } finally {
        setLoading(false);
      }
    };
    void loadSala(id);
  }, [id, navigate, t]);

  const handleEndCall = async () => {
    if (!sala) return;
    try {
      await telemedicinaApi.updateEstado(sala.id, "finalizada");
      setSala((prev) => prev ? { ...prev, estado: "finalizada" } : null);
      toast.success(t("telemedicina.call_ended"));
    } catch (err) {
      toast.error(t("common.error_occurred"), {
        description: err instanceof Error ? err.message : String(err),
      });
    }
  };

  if (loading) {
    return (
      <>
        <PageHeader title={t("telemedicina.room_title")} />
        <PageContent>
          <Skeleton className="h-96 rounded-lg" />
        </PageContent>
      </>
    );
  }

  if (!sala) return null;

  const Icon = estadoIcon[sala.estado];

  return (
    <>
      <PageHeader
        title={`Sala #${sala.id.slice(0, 8)}`}
        actions={
          <Button variant="ghost" size="sm" onClick={() => navigate("/telemedicina")}>
            <ArrowLeft className="mr-1 h-4 w-4" />
            {t("common.back")}
          </Button>
        }
      />

      <PageContent>
        <div className="mb-4 flex items-center gap-3">
          <Badge variant="outline" className="gap-1 text-sm">
            <Icon className="h-4 w-4" />
            {t(estadoLabel[sala.estado])}
          </Badge>
          {sala.scheduledAt && (
            <span className="text-sm text-muted-foreground">
              {new Date(sala.scheduledAt).toLocaleString()}
            </span>
          )}
        </div>

        {sala.notas && (
          <Card className="mb-4">
            <CardContent className="py-3">
              <p className="text-sm text-muted-foreground">{sala.notas}</p>
            </CardContent>
          </Card>
        )}

        <div className="h-96">
          <VideoCallRoom onEndCall={handleEndCall} />
        </div>
      </PageContent>
    </>
  );
}
