import * as React from "react";
import { useTranslation } from "react-i18next";
import { Camera, CheckCircle2 } from "lucide-react";
import { Badge } from "@components/ui/badge";
import { Button } from "@components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@components/ui/card";
import { Skeleton } from "@components/ui/skeleton";
import {
  fetchProfessionalMealPhotoObjectUrl,
  listProfessionalMealPhotos,
  reviewMealPhoto,
  type PortalMealPhoto,
} from "@services/api/patientPortalApi";

export function PatientMealPhotosCard({ patientId }: { patientId: string }) {
  const { t, i18n } = useTranslation();
  const [photos, setPhotos] = React.useState<PortalMealPhoto[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [reviewingId, setReviewingId] = React.useState<string | null>(null);

  const loadPhotos = React.useCallback(
    async (signal?: AbortSignal) => {
      const result = await listProfessionalMealPhotos(patientId, signal);
      setPhotos(result);
    },
    [patientId],
  );

  React.useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    loadPhotos(controller.signal)
      .catch((err) => setError(err instanceof Error ? err.message : t("patient_portal.meal_photos_load_error")))
      .finally(() => setLoading(false));
    return () => controller.abort();
  }, [loadPhotos, t]);

  const onReview = async (photoId: string) => {
    setReviewingId(photoId);
    try {
      const updated = await reviewMealPhoto(photoId);
      setPhotos((current) => current.map((photo) => (photo.id === updated.id ? updated : photo)));
    } finally {
      setReviewingId(null);
    }
  };

  const formatDateTime = (value: string | null) => {
    if (!value) return "";
    try {
      return new Intl.DateTimeFormat(i18n.language, {
        dateStyle: "medium",
        timeStyle: "short",
      }).format(new Date(value));
    } catch {
      return "";
    }
  };

  const mealSlotLabel = (slot: string) =>
    t(`patient_portal.meal_slot_${slot.replace(/-/g, "_")}`, { defaultValue: slot });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-sm">
          <Camera className="h-4 w-4 text-primary" />
          {t("patient_portal.meal_photos_pro_title")}
        </CardTitle>
        <CardDescription>{t("patient_portal.meal_photos_pro_desc")}</CardDescription>
      </CardHeader>
      <CardContent>
        {loading ? (
          <Skeleton className="h-32 w-full rounded-lg" />
        ) : error ? (
          <p className="text-sm text-destructive">{error}</p>
        ) : photos.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("patient_portal.meal_photos_pro_empty")}</p>
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2">
            {photos.map((photo) => (
              <li key={photo.id} className="overflow-hidden rounded-lg border bg-card">
                <AuthenticatedMealPhotoImage
                  photoId={photo.id}
                  alt={photo.caption || t("patient_portal.meal_photos_image_alt")}
                />
                <div className="space-y-2 p-3 text-sm">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-medium">{mealSlotLabel(photo.mealSlot)}</p>
                      <p className="text-xs text-muted-foreground">{formatDateTime(photo.createdAt)}</p>
                    </div>
                    {photo.reviewedAt ? (
                      <Badge variant="success" className="gap-1">
                        <CheckCircle2 className="h-3 w-3" />
                        {t("patient_portal.meal_photos_reviewed")}
                      </Badge>
                    ) : (
                      <Badge variant="warning">{t("patient_portal.meal_photos_pending_review")}</Badge>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {t("patient_portal.meal_photos_rating_value", { count: photo.adherenceRating })}
                  </p>
                  {photo.caption && <p className="break-words text-muted-foreground">{photo.caption}</p>}
                  {!photo.reviewedAt && (
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => void onReview(photo.id)}
                      disabled={reviewingId === photo.id}
                    >
                      {reviewingId === photo.id
                        ? t("patient_portal.meal_photos_reviewing")
                        : t("patient_portal.meal_photos_mark_reviewed")}
                    </Button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

function AuthenticatedMealPhotoImage({ photoId, alt }: { photoId: string; alt: string }) {
  const [src, setSrc] = React.useState<string | null>(null);

  React.useEffect(() => {
    const controller = new AbortController();
    let objectUrl: string | null = null;
    fetchProfessionalMealPhotoObjectUrl(photoId, controller.signal)
      .then((url) => {
        objectUrl = url;
        setSrc(url);
      })
      .catch(() => setSrc(null));
    return () => {
      controller.abort();
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [photoId]);

  if (!src) return <Skeleton className="h-40 w-full rounded-none" />;
  return <img src={src} alt={alt} className="h-40 w-full object-cover" loading="lazy" />;
}
