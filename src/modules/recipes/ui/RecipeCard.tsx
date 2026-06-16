import { useTranslation } from "react-i18next";
import type { RecipeCategory } from "../domain/RecipeTypes";
import { Badge } from "@components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@components/ui/card";
import { Clock, Users, ChefHat, AlertCircle, Flame, Beef, Wheat, Droplets, DollarSign } from "lucide-react";

interface RecipeCardProps {
  id: string;
  name: string;
  category: RecipeCategory;
  difficulty: string;
  servings: number;
  totalTimeMin: number;
  status: string;
  ingredientCount: number;
  kcal?: number;
  proteinG?: number;
  carbsG?: number;
  fatG?: number;
  costTotal?: number;
  currency?: string;
  onClick?: () => void;
}

const difficultyColor: Record<string, string> = {
  facil: "bg-green-100 text-green-700",
  media: "bg-amber-100 text-amber-700",
  dificil: "bg-red-100 text-red-700",
};

const statusLabelKey: Record<string, string> = {
  active: "recipes.status_active",
  draft: "recipes.status_draft",
  archived: "recipes.status_archived",
};

const difficultyLabelKey: Record<string, string> = {
  facil: "recipes.difficulty_easy",
  media: "recipes.difficulty_medium",
  dificil: "recipes.difficulty_hard",
};

export function RecipeCard({ name, category, difficulty, servings, totalTimeMin, status, ingredientCount, kcal, proteinG, carbsG, fatG, costTotal, currency, onClick }: RecipeCardProps) {
  const { t } = useTranslation();
  return (
    <button type="button" onClick={onClick} className="w-full text-left">
      <Card className="transition-colors hover:bg-accent">
        <CardHeader className="pb-2">
          <div className="flex items-start justify-between">
            <CardTitle className="text-sm font-medium">{name}</CardTitle>
            <Badge variant={status === "active" ? "default" : "secondary"} className="h-5 text-[10px]">
              {t(statusLabelKey[status] ?? status)}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="pb-3">
          <div className="mb-2 flex flex-wrap gap-1">
            <Badge variant="outline" className="h-5 text-[10px]">
              {t(`recipes.category_${category}`)}
            </Badge>
            <Badge variant="outline" className={`h-5 text-[10px] ${difficultyColor[difficulty] ?? ""}`}>
              <ChefHat className="mr-0.5 h-2.5 w-2.5" />
              {t(difficultyLabelKey[difficulty] ?? difficulty)}
            </Badge>
          </div>
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {totalTimeMin} min
            </span>
            <span className="flex items-center gap-1">
              <Users className="h-3 w-3" />
              {t("recipes.servings_abbr", { count: servings })}
            </span>
            <span className="flex items-center gap-1">
              <AlertCircle className="h-3 w-3" />
              {t("recipes.ingredients_abbr", { count: ingredientCount })}
            </span>
          </div>
          {kcal !== undefined && (
            <div className="mt-2 flex items-center gap-3 border-t pt-2 text-xs text-muted-foreground">
              <span className="flex items-center gap-1" title={t("recipes.kcal")}>
                <Flame className="h-3 w-3 text-orange-500" />
                {Math.round(kcal)} kcal
              </span>
              <span className="flex items-center gap-1" title={t("recipes.protein")}>
                <Beef className="h-3 w-3 text-red-500" />
                {Math.round(proteinG ?? 0)}g
              </span>
              <span className="flex items-center gap-1" title={t("recipes.carbs")}>
                <Wheat className="h-3 w-3 text-amber-500" />
                {Math.round(carbsG ?? 0)}g
              </span>
              <span className="flex items-center gap-1" title={t("recipes.fat")}>
                <Droplets className="h-3 w-3 text-blue-500" />
                {Math.round(fatG ?? 0)}g
              </span>
            </div>
          )}
          {costTotal !== undefined && costTotal > 0 && (
            <div className="mt-2 flex items-center gap-1 border-t pt-2 text-xs text-muted-foreground">
              <DollarSign className="h-3 w-3 text-emerald-500" />
              <span>{t("pricing.total_cost")}: {costTotal.toFixed(2)} {currency ?? "MXN"}</span>
            </div>
          )}
        </CardContent>
      </Card>
    </button>
  );
}
