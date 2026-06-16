import * as React from "react";
import { useTranslation } from "react-i18next";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@components/ui/dialog";
import { Button } from "@components/ui/button";
import { Badge } from "@components/ui/badge";
import { ScrollArea } from "@components/ui/scroll-area";
import { Loader2, Printer, Download, DollarSign, AlertTriangle } from "lucide-react";
import { calculateShoppingListCost } from "@modules/pricing/application/shoppingListCostCalculator";
import { usePreferencesStore } from "@store/preferencesStore";

interface ShoppingListItem {
  group: string;
  food: string;
  quantity: number;
  unit: string;
}

interface ShoppingListDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  shoppingListId: string;
  loadShoppingList?: (id: string) => Promise<{ items: ShoppingListItem[]; name: string }>;
}

export function ShoppingListDialog({ open, onOpenChange, shoppingListId, loadShoppingList }: ShoppingListDialogProps) {
  const { t } = useTranslation();
  const defaultCurrency = usePreferencesStore((s) => s.currency);
  const [loading, setLoading] = React.useState(false);
  const [name, setName] = React.useState("");
  const [items, setItems] = React.useState<ShoppingListItem[]>([]);
  const [totalCost, setTotalCost] = React.useState<number | null>(null);
  const [costCurrency, setCostCurrency] = React.useState<string>(defaultCurrency);
  const [missingFoods, setMissingFoods] = React.useState<string[]>([]);

  const foodIdLookup = React.useCallback(async (foodName: string): Promise<string | null> => {
    const { SYSTEM_FOODS } = await import("@modules/smae/domain/SYSTEM_FOODS");
    const food = SYSTEM_FOODS.find((f) => f.name.toLowerCase() === foodName.toLowerCase() || f.shortName?.toLowerCase() === foodName.toLowerCase());
    return food?.id ?? null;
  }, []);

  React.useEffect(() => {
    if (open && shoppingListId && loadShoppingList) {
      setLoading(true);
      loadShoppingList(shoppingListId)
        .then(async (data) => {
          setName(data.name);
          setItems(data.items ?? []);
          try {
            const cost = await calculateShoppingListCost(data.items ?? [], foodIdLookup);
            setTotalCost(cost.totalCost);
            setCostCurrency(cost.currency);
            setMissingFoods(cost.missingFoods);
          } catch {
            setTotalCost(null);
            setMissingFoods([]);
          }
        })
        .catch(() => { setItems([]); })
        .finally(() => setLoading(false));
    }
  }, [open, shoppingListId, loadShoppingList, foodIdLookup]);

  const grouped = React.useMemo(() => {
    const map = new Map<string, ShoppingListItem[]>();
    for (const item of items) {
      const cat = item.group || t("recipes.shopping_list.general_category");
      if (!map.has(cat)) map.set(cat, []);
      map.get(cat)!.push(item);
    }
    return Array.from(map.entries());
  }, [items, t]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>{t("recipes.shopping_list.title")}</DialogTitle>
          <DialogDescription>{name || t("recipes.shopping_list.loading")}</DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : items.length === 0 ? (
          <p className="py-4 text-center text-sm text-muted-foreground">{t("recipes.shopping_list.empty")}</p>
        ) : (
          <>
            {totalCost !== null && (
              <div className="flex items-center justify-between rounded-lg border bg-muted/30 px-4 py-2 text-sm">
                <span className="flex items-center gap-1 font-medium">
                  <DollarSign className="h-4 w-4 text-emerald-500" />
                  {t("pricing.shopping_total")}
                </span>
                <span className="font-semibold">{totalCost.toFixed(2)} {costCurrency}</span>
              </div>
            )}

            {missingFoods.length > 0 && (
              <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                <span>{t("pricing.missing_prices", { foods: missingFoods.slice(0, 5).join(", ") + (missingFoods.length > 5 ? ` +${missingFoods.length - 5}` : "") })}</span>
              </div>
            )}

            <ScrollArea className="h-[300px] pr-4">
              <div className="space-y-4">
                {grouped.map(([category, categoryItems]) => (
                  <div key={category}>
                    <div className="mb-2 flex items-center gap-2">
                      <Badge variant="secondary">{category}</Badge>
                      <span className="text-xs text-muted-foreground">{categoryItems.length} {t("recipes.shopping_list.items_count")}</span>
                    </div>
                    <div className="space-y-1">
                      {categoryItems.map((item, idx) => (
                        <div key={idx} className="flex items-center justify-between rounded border px-3 py-1.5 text-sm">
                          <span className="font-medium">{item.food}</span>
                          <span className="text-muted-foreground">{item.quantity} {item.unit}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </>
        )}

        <div className="flex justify-end gap-2">
          <Button variant="outline" size="sm" disabled>
            <Printer className="mr-1 h-4 w-4" /> {t("recipes.shopping_list.print")}
          </Button>
          <Button variant="outline" size="sm" disabled>
            <Download className="mr-1 h-4 w-4" /> {t("recipes.shopping_list.download")}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
