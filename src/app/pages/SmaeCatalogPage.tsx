/**
 * Catálogo SMAE navegable: búsqueda, filtro por grupo, equivalencia inversa,
 * y CRUD de alimentos personalizados.
 *
 * Resuelve feedback #10 (catálogo navegable) y prepara #11 (selección por equivalencias).
 */
import * as React from "react";
import { Search, Plus, Edit2, Trash2, Sparkles, Apple } from "lucide-react";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";
import { PageHeader, PageContent } from "@app/layout/AppLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@components/ui/card";
import { Input } from "@components/ui/input";
import { Button } from "@components/ui/button";
import { Badge } from "@components/ui/badge";
import { Skeleton } from "@components/ui/skeleton";
import {
  FOOD_GROUPS,
  FoodGroupLabel,
  GroupNutrition,
  type Food,
  type FoodGroup,
} from "@modules/smae/domain";
import {
  useSmaeFoods,
  useFindByEquivalencia,
  useRemoveCustomFood,
} from "@modules/smae/ui/useSmaeHooks";
import { SmaeFoodForm } from "@modules/smae/ui/SmaeFoodForm";

const GROUP_CHIP_CLASS: Record<FoodGroup, string> = {
  verduras: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100",
  frutas: "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-100",
  "cereales-sin-grasa": "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-100",
  "cereales-con-grasa": "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-100",
  leguminosas: "bg-lime-100 text-lime-800 dark:bg-lime-900 dark:text-lime-100",
  "aoa-muy-bajo": "bg-rose-100 text-rose-800 dark:bg-rose-900 dark:text-rose-100",
  "aoa-bajo": "bg-pink-100 text-pink-800 dark:bg-pink-900 dark:text-pink-100",
  "aoa-moderado": "bg-fuchsia-100 text-fuchsia-800 dark:bg-fuchsia-900 dark:text-fuchsia-100",
  "aoa-alto": "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-100",
  "leche-entera": "bg-sky-100 text-sky-800 dark:bg-sky-900 dark:text-sky-100",
  "leche-semidescremada": "bg-cyan-100 text-cyan-800 dark:bg-cyan-900 dark:text-cyan-100",
  "leche-descremada": "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-100",
  "aceites-sin-proteina": "bg-violet-100 text-violet-800 dark:bg-violet-900 dark:text-violet-100",
  "aceites-con-proteina": "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-100",
  "azucares-sin-grasa": "bg-pink-100 text-pink-800 dark:bg-pink-900 dark:text-pink-100",
  "azucares-con-grasa": "bg-rose-100 text-rose-800 dark:bg-rose-900 dark:text-rose-100",
};

interface FoodCardProps {
  food: Food;
  onEdit?: (food: Food) => void;
  onDelete?: (food: Food) => void;
}

function FoodCard({ food, onEdit, onDelete }: FoodCardProps) {
  const { t } = useTranslation();
  const n = food.nutrition;
  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <CardTitle className="text-base truncate">{food.name}</CardTitle>
            <CardDescription className="text-xs">{food.shortName}</CardDescription>
          </div>
          <Badge className={GROUP_CHIP_CLASS[food.group]} variant="secondary">
            {t("smae.food_group_" + food.group, { defaultValue: FoodGroupLabel[food.group] })}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        <p className="text-sm text-muted-foreground">
          {food.serving} · <span className="font-medium">{food.servingGrams} g</span>
        </p>
        <div className="flex flex-wrap gap-2 text-xs">
          <span className="rounded bg-muted px-2 py-0.5">{n.kcal} kcal</span>
          <span className="rounded bg-muted px-2 py-0.5">{t("smae.protein_short")} {n.proteinG} g</span>
          <span className="rounded bg-muted px-2 py-0.5">{t("smae.carbs_short")} {n.carbsG} g</span>
          <span className="rounded bg-muted px-2 py-0.5">{t("smae.fat_short")} {n.fatG} g</span>
          {food.custom && (
            <Badge variant="outline" className="text-xs">
              {t("smae.custom_badge")}
            </Badge>
          )}
        </div>
        {food.keywords.length > 0 && (
          <p className="text-xs text-muted-foreground italic">{food.keywords.join(" · ")}</p>
        )}
        {food.custom && (onEdit || onDelete) && (
          <div className="flex gap-2 pt-2">
            {onEdit && (
              <Button size="sm" variant="outline" onClick={() => onEdit(food)}>
                <Edit2 className="mr-1 h-3 w-3" /> {t("common.edit")}
              </Button>
            )}
            {onDelete && (
              <Button size="sm" variant="ghost" onClick={() => onDelete(food)}>
                <Trash2 className="mr-1 h-3 w-3" /> {t("common.delete")}
              </Button>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export function SmaeCatalogPage() {
  const { t } = useTranslation();
  const [query, setQuery] = React.useState("");
  const [group, setGroup] = React.useState<FoodGroup | "">("");
  const [customOnly, setCustomOnly] = React.useState(false);
  const [formOpen, setFormOpen] = React.useState(false);
  const [editingFood, setEditingFood] = React.useState<Food | undefined>(undefined);

  const [equivKcal, setEquivKcal] = React.useState("70");
  const [equivTol, setEquivTol] = React.useState("5");
  const [showEquiv, setShowEquiv] = React.useState(false);

  const { data: foods, loading, error } = useSmaeFoods({
    q: query,
    group: group === "" ? null : group,
    customOnly,
  });

  const { data: equivFoods, loading: equivLoading } = useFindByEquivalencia(
    Number(equivKcal) || 0,
    Number(equivTol) || 0,
  );

  const { remove } = useRemoveCustomFood();

  const handleDelete = async (food: Food) => {
    if (!confirm(t("smae.delete_custom_confirm", { name: food.name }))) return;
    const ok = await remove(food.id);
    if (ok) {
      toast.success(t("smae.delete_success"));
    } else {
      toast.error(t("smae.delete_error"));
    }
  };

  const handleEdit = (food: Food) => {
    setEditingFood(food);
    setFormOpen(true);
  };

  const handleNew = () => {
    setEditingFood(undefined);
    setFormOpen(true);
  };

  return (
    <>
      <PageHeader
        title={t("smae.title")}
        description={t("smae.page_description")}
      />
      <PageContent className="space-y-4">
        <Card>
          <CardContent className="pt-6 space-y-3">
            <div className="flex flex-col sm:flex-row gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder={t("smae.search_long")}
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  className="pl-8"
                />
              </div>
              <select
                value={group}
                onChange={(e) => setGroup((e.target.value || "") as FoodGroup | "")}
                className="flex h-9 rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
              >
                <option value="">{t("smae.all_groups")}</option>
                {FOOD_GROUPS.map((g) => (
                  <option key={g} value={g}>
                    {t("smae.food_group_" + g, { defaultValue: FoodGroupLabel[g] })}
                  </option>
                ))}
              </select>
              <Button onClick={() => setShowEquiv((s) => !s)} variant="outline">
                <Sparkles className="mr-1 h-4 w-4" /> {t("smae.equivalence_search")}
              </Button>
              <Button onClick={() => setCustomOnly((c) => !c)} variant={customOnly ? "default" : "outline"}>
                <Apple className="mr-1 h-4 w-4" />
                {customOnly ? t("smae.custom_only") : t("smae.all_foods_filter")}
              </Button>
              <Button onClick={handleNew}>
                <Plus className="mr-1 h-4 w-4" /> {t("smae.new")}
              </Button>
            </div>

            {showEquiv && (
              <div className="rounded-lg border bg-muted/40 p-3 space-y-2">
                <p className="text-sm font-medium">{t("smae.inverse_equivalence")}</p>
                <p className="text-xs text-muted-foreground">
                  {t("smae.inverse_description")}
                </p>
                <div className="flex flex-wrap items-center gap-2">
                  <label className="text-sm flex items-center gap-1">
                    kcal ±{" "}
                    <Input
                      type="number"
                      min="1"
                      max="500"
                      value={equivKcal}
                      onChange={(e) => setEquivKcal(e.target.value)}
                      className="w-20"
                    />
                  </label>
                  <label className="text-sm flex items-center gap-1">
                    {t("smae.tolerance")}{" "}
                    <Input
                      type="number"
                      min="0"
                      max="50"
                      value={equivTol}
                      onChange={(e) => setEquivTol(e.target.value)}
                      className="w-20"
                    />
                  </label>
                  <span className="text-sm text-muted-foreground">
                    {equivLoading
                      ? t("smae.searching")
                      : t("smae.result_count", { count: equivFoods?.length ?? 0 })}
                  </span>
                </div>
                {equivFoods && equivFoods.length > 0 && (
                  <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                    {equivFoods.slice(0, 9).map((f) => (
                      <div
                        key={f.id}
                        className="flex items-center justify-between rounded border bg-card px-2 py-1 text-sm"
                      >
                        <span className="truncate">{f.name}</span>
                        <Badge variant="outline" className="ml-2 text-xs">
                          {f.nutrition.kcal} kcal
                        </Badge>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {error && (
          <Card className="border-destructive">
            <CardContent className="pt-6 text-sm text-destructive">
              {t("smae.load_error", { message: error.message })}
            </CardContent>
          </Card>
        )}

        {loading && !foods && (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <Card key={i}>
                <CardHeader>
                  <Skeleton className="h-5 w-3/4" />
                  <Skeleton className="h-3 w-1/2" />
                </CardHeader>
                <CardContent>
                  <Skeleton className="h-4 w-full mb-2" />
                  <Skeleton className="h-4 w-2/3" />
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {foods && foods.length === 0 && (
          <Card>
            <CardContent className="py-10 text-center text-muted-foreground">
              <p>{t("smae.no_matching_foods")}</p>
              <p className="text-xs mt-1">
                {t("smae.no_matching_foods_hint")}
              </p>
            </CardContent>
          </Card>
        )}

        {foods && foods.length > 0 && (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {foods.map((food) => (
              <FoodCard
                key={food.id}
                food={food}
                onEdit={handleEdit}
                onDelete={handleDelete}
              />
            ))}
          </div>
        )}

        <Card className="bg-muted/30">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">{t("smae.nutrition_profiles")}</CardTitle>
            <CardDescription className="text-xs">
              {t("smae.nutrition_profiles_description")}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-1 sm:grid-cols-2 lg:grid-cols-3 text-xs">
              {FOOD_GROUPS.map((g) => {
                const n = GroupNutrition[g];
                return (
                  <div key={g} className="flex justify-between border-b py-0.5">
                    <span className="truncate">{t("smae.food_group_" + g, { defaultValue: FoodGroupLabel[g] })}</span>
                    <span className="text-muted-foreground">
                      {n.kcal} kcal · {t("smae.protein_short")}{n.proteinG} {t("smae.carbs_short")}{n.carbsG} {t("smae.fat_short")}{n.fatG}
                    </span>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </PageContent>

      <SmaeFoodForm
        open={formOpen}
        onOpenChange={setFormOpen}
        mode={editingFood ? "edit" : "create"}
        initialFood={editingFood}
      />
    </>
  );
}
