/**
 * FoodPicker: dialog para seleccionar un alimento del catálogo SMAE.
 *
 * Dos modos:
 *  - "Catálogo": búsqueda por nombre / palabra clave + filtro por grupo.
 *  - "Por equivalencia": input kcal target + tolerancia, devuelve los
 *    alimentos cuyo grupo calza (resuelve feedback #11).
 *
 * Encapsula `useSmaeFoods` y `useFindByEquivalencia` para no acoplarse
 * al detalle del repositorio.
 */
import * as React from "react";
import { Search, Sparkles, Apple, Loader2 } from "lucide-react";
import {
  type Food,
  type FoodGroup,
  type FoodId,
  FOOD_GROUPS,
  FoodGroupLabel,
} from "@modules/smae/domain";
import {
  useSmaeFoods,
  useFindByEquivalencia,
} from "@modules/smae/ui/useSmaeHooks";
import { Button } from "@components/ui/button";
import { Input } from "@components/ui/input";
import { Badge } from "@components/ui/badge";
import { Skeleton } from "@components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@components/ui/dialog";

interface FoodPickerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (foodId: FoodId) => void;
  excludeFoodIds?: readonly FoodId[];
}

type Tab = "catalog" | "equivalencia";

export function FoodPicker({ open, onOpenChange, onSelect, excludeFoodIds }: FoodPickerProps) {
  const [tab, setTab] = React.useState<Tab>("catalog");

  const [query, setQuery] = React.useState("");
  const [group, setGroup] = React.useState<FoodGroup | "">("");

  const [kcalTarget, setKcalTarget] = React.useState("70");
  const [tolerance, setTolerance] = React.useState("5");

  const { data: catalog, loading: loadingCatalog, error: catalogError } = useSmaeFoods({
    q: query,
    group: group === "" ? null : group,
  });

  const { data: equivResults, loading: loadingEquiv } = useFindByEquivalencia(
    Number(kcalTarget) || 0,
    Number(tolerance) || 0,
  );

  const handleSelect = (food: Food) => {
    onSelect(food.id as FoodId);
    onOpenChange(false);
  };

  const filteredCatalog = React.useMemo(() => {
    if (!catalog) return [];
    if (!excludeFoodIds || excludeFoodIds.length === 0) return catalog;
    const exclude = new Set<string>(excludeFoodIds);
    return catalog.filter((f) => !exclude.has(f.id));
  }, [catalog, excludeFoodIds]);

  const filteredEquiv = React.useMemo(() => {
    if (!equivResults) return [];
    if (!excludeFoodIds || excludeFoodIds.length === 0) return equivResults;
    const exclude = new Set<string>(excludeFoodIds);
    return equivResults.filter((f) => !exclude.has(f.id));
  }, [equivResults, excludeFoodIds]);

  React.useEffect(() => {
    if (!open) {
      setQuery("");
      setGroup("");
      setTab("catalog");
    }
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Seleccionar alimento</DialogTitle>
          <DialogDescription>
            Busca en el catálogo SMAE o encuentra alimentos por equivalencia nutricional.
          </DialogDescription>
        </DialogHeader>

        <div className="flex gap-2 border-b pb-2">
          <Button
            type="button"
            variant={tab === "catalog" ? "default" : "ghost"}
            size="sm"
            onClick={() => setTab("catalog")}
          >
            <Apple className="mr-1 h-4 w-4" /> Catálogo
          </Button>
          <Button
            type="button"
            variant={tab === "equivalencia" ? "default" : "ghost"}
            size="sm"
            onClick={() => setTab("equivalencia")}
          >
            <Sparkles className="mr-1 h-4 w-4" /> Por equivalencia
          </Button>
        </div>

        {tab === "catalog" && (
          <div className="space-y-2">
            <div className="flex flex-col sm:flex-row gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  autoFocus
                  placeholder="Buscar por nombre o palabra clave (ej. tortilla, frijol, mexicano)"
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
                <option value="">Todos los grupos</option>
                {FOOD_GROUPS.map((g) => (
                  <option key={g} value={g}>
                    {FoodGroupLabel[g]}
                  </option>
                ))}
              </select>
            </div>

            <ResultsList
              loading={loadingCatalog}
              error={catalogError}
              foods={filteredCatalog}
              onSelect={handleSelect}
              emptyMessage="No se encontraron alimentos con esos criterios."
            />
          </div>
        )}

        {tab === "equivalencia" && (
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">
              Encuentra alimentos cuyo grupo cumple un kcal target ± tolerancia.
              Útil para "¿qué me da ~70 kcal por ración?".
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <label className="text-sm flex items-center gap-1">
                kcal
                <Input
                  type="number"
                  min="1"
                  max="500"
                  value={kcalTarget}
                  onChange={(e) => setKcalTarget(e.target.value)}
                  className="w-20"
                />
              </label>
              <label className="text-sm flex items-center gap-1">
                ± tolerancia
                <Input
                  type="number"
                  min="0"
                  max="50"
                  value={tolerance}
                  onChange={(e) => setTolerance(e.target.value)}
                  className="w-20"
                />
              </label>
              <span className="text-sm text-muted-foreground">
                {loadingEquiv ? (
                  <Loader2 className="inline h-3 w-3 animate-spin" />
                ) : (
                  `${filteredEquiv.length} resultado(s)`
                )}
              </span>
            </div>
            <ResultsList
              loading={loadingEquiv}
              error={null}
              foods={filteredEquiv}
              onSelect={handleSelect}
              emptyMessage="Ningún grupo cumple ese criterio. Ajusta tolerancia o kcal."
            />
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function ResultsList({
  loading,
  error,
  foods,
  onSelect,
  emptyMessage,
}: {
  loading: boolean;
  error: Error | null;
  foods: Food[];
  onSelect: (food: Food) => void;
  emptyMessage: string;
}) {
  if (loading) {
    return (
      <div className="space-y-2 max-h-80 overflow-y-auto">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-12 w-full" />
        ))}
      </div>
    );
  }
  if (error) {
    return <p className="text-sm text-destructive">Error: {error.message}</p>;
  }
  if (foods.length === 0) {
    return <p className="text-sm text-muted-foreground py-6 text-center">{emptyMessage}</p>;
  }
  return (
    <div className="max-h-80 overflow-y-auto divide-y rounded-md border">
      {foods.map((food) => (
        <button
          key={food.id}
          type="button"
          onClick={() => onSelect(food)}
          className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left hover:bg-muted/50"
        >
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium truncate">{food.name}</p>
            <p className="text-xs text-muted-foreground truncate">
              {food.shortName} · {food.serving} ({food.servingGrams} g)
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="text-xs">
              {FoodGroupLabel[food.group]}
            </Badge>
            <Badge variant="secondary" className="text-xs">
              {food.nutrition.kcal} kcal
            </Badge>
          </div>
        </button>
      ))}
    </div>
  );
}
