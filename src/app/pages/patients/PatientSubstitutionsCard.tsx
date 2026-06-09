import { useTranslation } from "react-i18next";
import { Star, Trash2 } from "lucide-react";
import { Button } from "@components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@components/ui/card";
import { Skeleton } from "@components/ui/skeleton";
import { getSystemFoodById } from "@modules/smae/domain";
import { MealSlotLabel } from "@modules/mealplan/domain/MealSlot";
import { usePatientSubstitutions } from "@services/patientSubstitutionService";

export function PatientSubstitutionsCard({ patientId }: { patientId: string }) {
  const { t } = useTranslation();
  const { substitutions, loading, removeSubstitution } = usePatientSubstitutions(patientId);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-sm">
          <Star className="h-4 w-4 text-primary" />
          {t("patient_portal.substitutions_title")}
        </CardTitle>
        <CardDescription>{t("patient_portal.substitutions_desc")}</CardDescription>
      </CardHeader>
      <CardContent>
        {loading ? (
          <Skeleton className="h-12 w-full" />
        ) : substitutions.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("patient_portal.no_substitutions")}</p>
        ) : (
          <ul className="space-y-2">
            {substitutions.map((s) => {
              const food = getSystemFoodById(s.substituteFoodId);
              return (
                <li key={s.id} className="flex items-center justify-between gap-2 rounded-lg border p-2 text-xs">
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{food?.name ?? s.substituteFoodId}</p>
                    {s.mealSlot && <p className="text-muted-foreground">{MealSlotLabel[s.mealSlot as keyof typeof MealSlotLabel] ?? s.mealSlot}</p>}
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    aria-label={t("common.delete")}
                    onClick={() => removeSubstitution(s.id)}
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
