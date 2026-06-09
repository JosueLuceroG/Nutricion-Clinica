import * as React from "react";
import { useTranslation } from "react-i18next";
import { useWeeklyPlans, useCreateWeeklyPlan } from "@modules/meal-planner/ui/useMealPlannerHooks";
import { mealPlannerService } from "@services/mealPlannerService";
import { Card, CardContent, CardHeader, CardTitle } from "@components/ui/card";
import { Button } from "@components/ui/button";
import { Badge } from "@components/ui/badge";
import { Skeleton } from "@components/ui/skeleton";
import { Plus, ShoppingCart } from "lucide-react";
import { WeeklyPlanDialog } from "@modules/meal-planner/ui/WeeklyPlanDialog";
import { ShoppingListDialog } from "@modules/meal-planner/ui/ShoppingListDialog";
import type { WeeklyPlan } from "@modules/meal-planner/domain/WeeklyPlan";
import type { MealPlannerFormInput } from "@modules/meal-planner/application/mealPlannerFormSchema";

const statusColor: Record<string, string> = {
  draft: "bg-gray-100 text-gray-800",
  active: "bg-green-100 text-green-800",
  completed: "bg-blue-100 text-blue-800",
  cancelled: "bg-red-100 text-red-800",
};

function PlanCard({ plan, onViewShoppingList }: { plan: WeeklyPlan; onViewShoppingList: (plan: WeeklyPlan) => void }) {
  const { t } = useTranslation();
  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between">
          <CardTitle className="text-base">{plan.name}</CardTitle>
          <Badge className={statusColor[plan.status]}>
            {t(`meal_planner.status_${plan.status}`)}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="text-sm text-muted-foreground">
        <div className="grid grid-cols-2 gap-1">
          <span>{plan.startDate} → {plan.endDate}</span>
          <span>{plan.targetKcal} kcal</span>
          <span>{t("meal_planner.days_count", { count: plan.days.length })}</span>
          <span>{plan.type}</span>
        </div>
        <div className="mt-2 flex justify-end">
          <Button variant="outline" size="sm" onClick={() => onViewShoppingList(plan)}>
            <ShoppingCart className="mr-1 h-3 w-3" /> {t("meal_planner.shopping_list")}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

export function MealPlannerPage() {
  const { t } = useTranslation();
  const { plans, loading, refresh } = useWeeklyPlans();
  const { create } = useCreateWeeklyPlan();
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [shoppingListDialogOpen, setShoppingListDialogOpen] = React.useState(false);
  const [shoppingListPlanId, setShoppingListPlanId] = React.useState("");

  const handleCreatePlan = async (data: MealPlannerFormInput) => {
    await create(data);
    await refresh();
  };

  const handleViewShoppingList = async (plan: WeeklyPlan) => {
    await mealPlannerService.generateShoppingList(plan.id, plan.patientId);
    setShoppingListPlanId(plan.id);
    setShoppingListDialogOpen(true);
  };

  const handleLoadShoppingList = async (id: string) => {
    const lists = await mealPlannerService.listShoppingLists("all");
    const list = lists.find((l: any) => l.id === id);
    if (!list) return { items: [], name: "" };
    const parsedItems = typeof list.items === "string" ? JSON.parse(list.items) : (list.items ?? []);
    return {
      name: list.name ?? t("meal_planner.shopping_list"),
      items: parsedItems,
    };
  };

  return (
    <div className="flex h-full flex-col">
      <div className="border-b px-6 py-3">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold">{t("meal_planner.title")}</h1>
            <p className="text-sm text-muted-foreground">{t("meal_planner.plan_count", { count: plans.length })}</p>
          </div>
          <Button onClick={() => setDialogOpen(true)}>
            <Plus className="mr-1 h-4 w-4" /> {t("meal_planner.create_plan")}
          </Button>
        </div>
      </div>

      <WeeklyPlanDialog open={dialogOpen} onOpenChange={setDialogOpen} onSubmit={handleCreatePlan} />

      <ShoppingListDialog
        open={shoppingListDialogOpen}
        onOpenChange={setShoppingListDialogOpen}
        shoppingListId={shoppingListPlanId}
        loadShoppingList={handleLoadShoppingList}
      />

      <div className="flex-1 overflow-y-auto p-6">
        {loading ? (
          <div className="space-y-4">
            {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-28 w-full" />)}
          </div>
        ) : plans.length === 0 ? (
          <p className="py-12 text-center text-sm text-muted-foreground">
            {t("meal_planner.no_weekly_plans")}
          </p>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {plans.map((p) => <PlanCard key={p.id} plan={p} onViewShoppingList={handleViewShoppingList} />)}
          </div>
        )}
      </div>
    </div>
  );
}
