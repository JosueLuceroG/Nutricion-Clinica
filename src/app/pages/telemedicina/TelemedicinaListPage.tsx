import * as React from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Phone, Plus, Video, VideoOff, Clock, CheckCircle2, XCircle } from "lucide-react";
import { toast } from "sonner";
import { telemedicinaApi } from "@services/api/telemedicinaApi";
import { PageHeader, PageContent } from "@app/layout/AppLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@components/ui/card";
import { Button } from "@components/ui/button";
import { Badge } from "@components/ui/badge";
import { EmptyState } from "@components/layout/EmptyState";
import { Skeleton } from "@components/ui/skeleton";
import type { TelemedicinaSalaDTO } from "@nutriclinica/shared";

const estadoIcon: Record<TelemedicinaSalaDTO['estado'], React.ComponentType<{ className?: string }>> = {
  pendiente: Clock,
  activa: Video,
  finalizada: CheckCircle2,
  cancelada: XCircle,
};

const estadoVariant: Record<TelemedicinaSalaDTO['estado'], "outline" | "secondary" | "default" | "destructive"> = {
  pendiente: "outline",
  activa: "default",
  finalizada: "secondary",
  cancelada: "destructive",
};

export function TelemedicinaListPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [salas, setSalas] = React.useState<TelemedicinaSalaDTO[]>([]);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    const loadSalas = async () => {
      setLoading(true);
      try {
        const { salas: data } = await telemedicinaApi.list();
        setSalas(data);
      } catch (err) {
        toast.error(t("common.error_occurred"), {
          description: err instanceof Error ? err.message : String(err),
        });
      } finally {
        setLoading(false);
      }
    };
    void loadSalas();
  }, [t]);

  const handleJoin = (sala: TelemedicinaSalaDTO) => {
    navigate(`/telemedicina/${sala.id}`);
  };

  const handleChangeEstado = async (sala: TelemedicinaSalaDTO, nuevoEstado: TelemedicinaSalaDTO['estado']) => {
    try {
      await telemedicinaApi.updateEstado(sala.id, nuevoEstado);
      setSalas((prev) =>
        prev.map((s) => (s.id === sala.id ? { ...s, estado: nuevoEstado } : s)),
      );
      toast.success(t("telemedicina.estado_updated"));
    } catch (err) {
      toast.error(t("common.error_occurred"), {
        description: err instanceof Error ? err.message : String(err),
      });
    }
  };

  if (loading) {
    return (
      <>
        <PageHeader title={t("nav.telemedicina")} />
        <PageContent>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-40 rounded-lg" />
            ))}
          </div>
        </PageContent>
      </>
    );
  }

  return (
    <>
      <PageHeader
        title={t("nav.telemedicina")}
        description={t("telemedicina.list_desc")}
        actions={
          <Button onClick={() => navigate("/telemedicina/nueva")}>
            <Plus className="mr-2 h-4 w-4" />
            {t("telemedicina.new_sala")}
          </Button>
        }
      />

      <PageContent>
        {salas.length === 0 ? (
          <EmptyState
            icon={VideoOff}
            title={t("telemedicina.no_salas")}
            description={t("telemedicina.no_salas_desc")}
            action={{ label: t("telemedicina.new_sala"), onClick: () => navigate("/telemedicina/nueva") }}
          />
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {salas.map((sala) => {
              const Icon = estadoIcon[sala.estado];
              return (
                <Card key={sala.id} className="flex flex-col">
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-base">Sala #{sala.id.slice(0, 8)}</CardTitle>
                      <Badge variant={estadoVariant[sala.estado]} className="gap-1">
                        <Icon className="h-3 w-3" />
                        {t(`telemedicina.estado_${sala.estado}`)}
                      </Badge>
                    </div>
                    <CardDescription>
                      {sala.scheduledAt
                        ? new Date(sala.scheduledAt).toLocaleString()
                        : t("telemedicina.not_scheduled")}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="flex-1">
                    {sala.notas && (
                      <p className="mb-3 text-sm text-muted-foreground line-clamp-2">{sala.notas}</p>
                    )}
                    <div className="flex flex-wrap gap-2">
                      {sala.estado === "pendiente" && (
                        <>
                          <Button size="sm" onClick={() => handleJoin(sala)}>
                            <Video className="mr-1 h-3 w-3" />
                            {t("telemedicina.join")}
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleChangeEstado(sala, "activa")}
                          >
                            <Phone className="mr-1 h-3 w-3" />
                            {t("telemedicina.start")}
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleChangeEstado(sala, "cancelada")}
                          >
                            <XCircle className="mr-1 h-3 w-3" />
                            {t("telemedicina.cancel")}
                          </Button>
                        </>
                      )}
                      {sala.estado === "activa" && (
                        <>
                          <Button size="sm" onClick={() => handleJoin(sala)}>
                            <Video className="mr-1 h-3 w-3" />
                            {t("telemedicina.join")}
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleChangeEstado(sala, "finalizada")}
                          >
                            <CheckCircle2 className="mr-1 h-3 w-3" />
                            {t("telemedicina.end")}
                          </Button>
                        </>
                      )}
                      {sala.estado === "finalizada" && (
                        <Button size="sm" variant="secondary" disabled>
                          <CheckCircle2 className="mr-1 h-3 w-3" />
                          {t("telemedicina.completed")}
                        </Button>
                      )}
                      {sala.estado === "cancelada" && (
                        <Button size="sm" variant="secondary" disabled>
                          <XCircle className="mr-1 h-3 w-3" />
                          {t("telemedicina.cancelled")}
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </PageContent>
    </>
  );
}
