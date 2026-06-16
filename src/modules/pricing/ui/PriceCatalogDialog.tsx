import * as React from "react";
import { useTranslation } from "react-i18next";
import { DollarSign, Plus, Pencil, Trash2 } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@components/ui/dialog";
import { Button } from "@components/ui/button";
import { Input } from "@components/ui/input";
import { Label } from "@components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@components/ui/table";
import { toast } from "sonner";
import { priceService } from "../application/priceService";
import type { FoodPrice } from "../domain/FoodPrice";
import { usePreferencesStore } from "@store/preferencesStore";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function PriceCatalogDialog({ open, onOpenChange }: Props) {
  const { t } = useTranslation();
  const defaultCurrency = usePreferencesStore((s) => s.currency);
  const [prices, setPrices] = React.useState<FoodPrice[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [editId, setEditId] = React.useState<string | null>(null);
  const [form, setForm] = React.useState<{ foodId: string; foodName: string; price: number; currency: string; quantityBase: number; unit: string; notes: string }>({ foodId: "", foodName: "", price: 0, currency: defaultCurrency, quantityBase: 1, unit: "pz", notes: "" });
  const [showForm, setShowForm] = React.useState(false);

  const load = React.useCallback(async () => {
    setLoading(true);
    try {
      const list = await priceService.list();
      setPrices(list);
    } catch {
      toast.error("Error loading prices");
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => { if (open) { load(); } }, [open, load]);

  const handleSave = async () => {
    if (!form.foodId || !form.foodName || form.price <= 0) return;
    try {
      if (editId) {
        await priceService.update(editId, form);
        toast.success(t("common.saved"));
      } else {
        await priceService.create({ ...form, sucursalId: null, effectiveDate: null });
        toast.success(t("common.saved"));
      }
      setShowForm(false);
      setEditId(null);
      setForm({ foodId: "", foodName: "", price: 0, currency: defaultCurrency, quantityBase: 1, unit: "pz", notes: "" });
      await load();
    } catch {
      toast.error(t("common.error"));
    }
  };

  const handleEdit = (p: FoodPrice) => {
    setEditId(p.id);
      setForm({ foodId: p.foodId, foodName: p.foodName, price: p.price, currency: p.currency, quantityBase: p.quantityBase, unit: p.unit, notes: p.notes });
    setShowForm(true);
  };

  const handleDelete = async (id: string) => {
    try {
      await priceService.remove(id);
      toast.success(t("common.deleted"));
      await load();
    } catch {
      toast.error(t("common.error"));
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <DollarSign className="h-5 w-5" />
            {t("pricing.catalog_title")}
          </DialogTitle>
          <DialogDescription>{t("pricing.catalog_desc")}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex justify-end">
            <Button size="sm" onClick={() => { setEditId(null); setForm({ foodId: "", foodName: "", price: 0, currency: defaultCurrency, quantityBase: 1, unit: "pz", notes: "" }); setShowForm(true); }} disabled={showForm}>
              <Plus className="mr-1 h-4 w-4" />{t("pricing.add_price")}
            </Button>
          </div>

          {showForm && (
            <div className="rounded-lg border p-4 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>{t("pricing.food_id")}</Label>
                  <Input value={form.foodId} onChange={(e) => setForm({ ...form, foodId: e.target.value })} placeholder="ej: fruta-manzana" />
                </div>
                <div>
                  <Label>{t("pricing.food_name")}</Label>
                  <Input value={form.foodName} onChange={(e) => setForm({ ...form, foodName: e.target.value })} placeholder="Manzana" />
                </div>
                <div>
                  <Label>{t("pricing.price")}</Label>
                  <Input type="number" step="0.01" min="0" value={form.price} onChange={(e) => setForm({ ...form, price: parseFloat(e.target.value) || 0 })} />
                </div>
                <div>
                  <Label>{t("pricing.currency")}</Label>
                  <Select value={form.currency} onValueChange={(v) => setForm({ ...form, currency: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="MXN">MXN</SelectItem>
                      <SelectItem value="USD">USD</SelectItem>
                      <SelectItem value="EUR">EUR</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>{t("pricing.quantity_base")}</Label>
                  <Input type="number" step="1" min="1" value={form.quantityBase} onChange={(e) => setForm({ ...form, quantityBase: parseInt(e.target.value) || 1 })} />
                </div>
                <div>
                  <Label>{t("pricing.unit")}</Label>
                  <Select value={form.unit} onValueChange={(v) => setForm({ ...form, unit: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="pz">{t("pricing.unit_pz")}</SelectItem>
                      <SelectItem value="g">{t("pricing.unit_g")}</SelectItem>
                      <SelectItem value="kg">{t("pricing.unit_kg")}</SelectItem>
                      <SelectItem value="ml">{t("pricing.unit_ml")}</SelectItem>
                      <SelectItem value="l">{t("pricing.unit_l")}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div>
                <Label>{t("pricing.notes")}</Label>
                <Input value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
              </div>
              <div className="flex gap-2 justify-end">
                <Button variant="outline" size="sm" onClick={() => { setShowForm(false); setEditId(null); }}>{t("common.cancel")}</Button>
                <Button size="sm" onClick={handleSave}>{t("common.save")}</Button>
              </div>
            </div>
          )}

          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("pricing.food_name")}</TableHead>
                  <TableHead>{t("pricing.price")}</TableHead>
                  <TableHead>{t("pricing.currency")}</TableHead>
                  <TableHead>{t("pricing.quantity_base")}</TableHead>
                  <TableHead>{t("pricing.unit")}</TableHead>
                  <TableHead className="w-24">{t("common.actions")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground">{t("common.loading")}</TableCell></TableRow>
                ) : prices.length === 0 ? (
                  <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground">{t("pricing.no_prices")}</TableCell></TableRow>
                ) : (
                  prices.map((p) => (
                    <TableRow key={p.id}>
                      <TableCell className="font-medium">{p.foodName}</TableCell>
                      <TableCell>{p.price.toFixed(2)}</TableCell>
                      <TableCell>{p.currency}</TableCell>
                      <TableCell>{p.quantityBase}</TableCell>
                      <TableCell>{p.unit}</TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button variant="ghost" size="icon" onClick={() => handleEdit(p)}><Pencil className="h-4 w-4" /></Button>
                          <Button variant="ghost" size="icon" onClick={() => handleDelete(p.id)}><Trash2 className="h-4 w-4" /></Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>{t("common.close")}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
