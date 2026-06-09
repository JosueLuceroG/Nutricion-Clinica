import * as React from "react";
import { useGoals, useCreateGoal } from "@modules/goals/ui/useGoalHooks";
import { GoalStatusLabel } from "@modules/goals/domain/GoalTypes";
import { Badge } from "@components/ui/badge";
import { Button } from "@components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@components/ui/card";
import { Skeleton } from "@components/ui/skeleton";
import { useAuthStore } from "@store/authStore";
import { Plus } from "lucide-react";
import { useTranslation } from "react-i18next";
import { GoalDialog } from "@modules/goals/ui/GoalDialog";
import type { Goal } from "@modules/goals/domain/Goal";
import type { GoalFormInput } from "@modules/goals/application/goalFormSchema";

const statusColor: Record<string, string> = {
  activo: "bg-blue-100 text-blue-800",
  en_pausa: "bg-yellow-100 text-yellow-800",
  logrado: "bg-green-100 text-green-800",
  no_logrado: "bg-red-100 text-red-800",
  abandonado: "bg-gray-100 text-gray-800",
  modificado: "bg-purple-100 text-purple-800",
};

function GoalCard({ goal }: { goal: Goal }) {
  const { t } = useTranslation();
  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between">
          <CardTitle className="text-base">{goal.variable}</CardTitle>
          <Badge className={statusColor[goal.status]}>
            {t("goals.status_" + goal.status, { defaultValue: GoalStatusLabel[goal.status] })}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="text-sm text-muted-foreground">
        <div className="grid grid-cols-2 gap-1">
          <span>{t("goals.initial")}: {goal.initialValue} {goal.unit}</span>
          <span>{t("goals.target")}: {goal.targetValue} {goal.unit}</span>
          <span>{t("goals.start")}: {goal.startDate}</span>
          <span>{t("goals.term")}: {goal.targetDate}</span>
        </div>
        {goal.actionPlan && (
          <p className="mt-2 line-clamp-2">{goal.actionPlan}</p>
        )}
      </CardContent>
    </Card>
  );
}

export function GoalsPage() {
  const { t } = useTranslation();
  const { goals, loading, refresh } = useGoals();
  const { create } = useCreateGoal();
  const user = useAuthStore((s) => s.user);
  const [dialogOpen, setDialogOpen] = React.useState(false);

  const grouped = React.useMemo(() => {
    const map = new Map<string, Goal[]>();
    for (const g of goals) {
      const list = map.get(g.type) ?? [];
      list.push(g);
      map.set(g.type, list);
    }
    return map;
  }, [goals]);

  const handleCreateGoal = async (data: GoalFormInput) => {
    await create(data, user?.id ?? "");
    await refresh();
  };

  return (
    <div className="flex h-full flex-col">
      <div className="border-b px-6 py-3">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold">{t("goals.clinical_title")}</h1>
            <p className="text-sm text-muted-foreground">{t("goals.objectives_count", { count: goals.length })}</p>
          </div>
          <Button onClick={() => setDialogOpen(true)}>
            <Plus className="mr-1 h-4 w-4" /> {t("goals.add_goal")}
          </Button>
        </div>
      </div>

      <GoalDialog open={dialogOpen} onOpenChange={setDialogOpen} onSubmit={handleCreateGoal} />
      <div className="flex-1 overflow-y-auto p-6">
        {loading ? (
          <div className="space-y-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-32 w-full" />
            ))}
          </div>
        ) : goals.length === 0 ? (
          <p className="py-12 text-center text-sm text-muted-foreground">
            {t("goals.no_clinical_goals")}
          </p>
        ) : (
          <div className="space-y-6">
            {Array.from(grouped.entries()).map(([type, items]) => (
              <div key={type}>
                <h2 className="mb-3 text-lg font-medium capitalize">{type}</h2>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {items.map((g) => (
                    <GoalCard key={g.id} goal={g} />
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
