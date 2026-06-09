import * as React from "react";
import { Plus, Search } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@components/ui/button";
import { Input } from "@components/ui/input";
import { RecipeCard } from "@modules/recipes/ui/RecipeCard";
import { RecipeDialog } from "@modules/recipes/ui/RecipeDialog";
import { useRecipes, useCreateRecipe } from "@modules/recipes/ui/useRecipeHooks";
import type { RecipeFormInput } from "@modules/recipes/application/recipeFormSchema";

export function RecipesPage() {
  const { t } = useTranslation();
  const { recipes, loading, refresh } = useRecipes();
  const { create } = useCreateRecipe();
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [search, setSearch] = React.useState("");

  const filtered = React.useMemo(() => {
    if (!search.trim()) return recipes;
    const q = search.toLowerCase();
    return recipes.filter((r) => r.name.toLowerCase().includes(q));
  }, [recipes, search]);

  const handleCreate = async (data: RecipeFormInput) => {
    await create(data);
    refresh();
  };

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b px-6 py-3">
        <h1 className="text-xl font-semibold">{t("recipes.recipe_book")}</h1>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder={t("recipes.search")}
              className="w-60 pl-8"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <Button onClick={() => setDialogOpen(true)}>
            <Plus className="mr-1 h-4 w-4" /> {t("recipes.new")}
          </Button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6">
        {loading ? (
          <p className="py-8 text-center text-sm text-muted-foreground">{t("recipes.loading")}</p>
        ) : filtered.length === 0 ? (
          <div className="py-12 text-center">
            <p className="text-sm text-muted-foreground">
              {search ? t("recipes.no_results") : t("recipes.no_recipes_yet")}
            </p>
            {!search && (
              <Button variant="link" onClick={() => setDialogOpen(true)}>
                {t("recipes.create_first")}
              </Button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.map((r) => (
              <RecipeCard
                key={r.id}
                id={r.id}
                name={r.name}
                category={r.category}
                difficulty={r.difficulty}
                servings={r.servings}
                totalTimeMin={r.totalTimeMin}
                status={r.status}
                ingredientCount={r.ingredients.length}
              />
            ))}
          </div>
        )}
      </div>

      <RecipeDialog open={dialogOpen} onOpenChange={setDialogOpen} onSubmit={handleCreate} />
    </div>
  );
}
