import * as React from "react";
import { useTranslation } from "react-i18next";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@components/ui/dialog";
import { Button } from "@components/ui/button";
import { Badge } from "@components/ui/badge";
import { ScrollArea } from "@components/ui/scroll-area";
import { Loader2, Printer, Download } from "lucide-react";

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
  const [loading, setLoading] = React.useState(false);
  const [name, setName] = React.useState("");
  const [items, setItems] = React.useState<ShoppingListItem[]>([]);

  React.useEffect(() => {
    if (open && shoppingListId && loadShoppingList) {
      setLoading(true);
      loadShoppingList(shoppingListId)
        .then((data) => {
          setName(data.name);
          setItems(data.items ?? []);
        })
        .catch(() => setItems([]))
        .finally(() => setLoading(false));
    }
  }, [open, shoppingListId, loadShoppingList]);

  const grouped = React.useMemo(() => {
    const map = new Map<string, ShoppingListItem[]>();
    for (const item of items) {
      const cat = item.group || t("recipes.shopping_list.general_category");
      if (!map.has(cat)) map.set(cat, []);
      map.get(cat)!.push(item);
    }
    return Array.from(map.entries());
  }, [items]);

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
          <ScrollArea className="h-[350px] pr-4">
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
