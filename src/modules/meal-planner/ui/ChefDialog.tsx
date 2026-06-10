import * as React from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@components/ui/dialog";
import { Button } from "@components/ui/button";
import { Input } from "@components/ui/input";
import { Label } from "@components/ui/label";
import { Textarea } from "@components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@components/ui/select";
import { Badge } from "@components/ui/badge";
import { Loader2, ChefHat, Sparkles } from "lucide-react";
import { generateMealPlan } from "../application/chefService";
import type { MealSlot } from "@modules/mealplan/domain/MealSlot";

export interface ChefApplyPayload {
  days: Array<{ dayNumber: number; meals: Array<{ slot: MealSlot; foods: string[] }> }>;
  targetKcal: number;
  timesPerDay: number;
  restrictions: string[];
  daysCount: number;
}

interface ChefDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onApply: (payload: ChefApplyPayload) => Promise<void>;
}

export function ChefDialog({ open, onOpenChange, onApply }: ChefDialogProps) {
  const { t } = useTranslation();
  const [targetKcal, setTargetKcal] = React.useState(1800);
  const [timesPerDay, setTimesPerDay] = React.useState(5);
  const [restrictions, setRestrictions] = React.useState("");
  const [preferences, setPreferences] = React.useState("");
  const [daysCount, setDaysCount] = React.useState(7);
  const [generating, setGenerating] = React.useState(false);
  const [result, setResult] = React.useState<Awaited<ReturnType<typeof generateMealPlan>> | null>(null);

  const handleGenerate = async () => {
    setGenerating(true);
    setResult(null);
    try {
      const res = await generateMealPlan({
        targetKcal, timesPerDay,
        targetProteinPct: 20, targetFatPct: 25, targetCarbPct: 55,
        restrictions: restrictions.split(",").map((s) => s.trim()).filter(Boolean),
        preferences,
        daysCount,
      });
      if (res.error) {
        toast.error(res.error);
      }
      setResult(res);
    } finally {
      setGenerating(false);
    }
  };

  const slotLabel = (slot: MealSlot): string => {
    const labels: Record<MealSlot, string> = {
      breakfast: "Desayuno",
      "morning-snack": "Colación matutina",
      lunch: "Comida",
      "afternoon-snack": "Colación vespertina",
      dinner: "Cena",
    };
    return labels[slot] ?? slot;
  };

  const handleApply = async () => {
    if (!result?.days?.length) return;
    await onApply({
      days: result.days.map((d) => ({
        dayNumber: d.dayNumber,
        meals: d.meals.map((m) => ({ slot: m.slot, foods: m.foods })),
      })),
      targetKcal, timesPerDay,
      restrictions: restrictions.split(",").map((s) => s.trim()).filter(Boolean),
      daysCount,
    });
    toast.success(t("meal_planner.chef_applied"));
    onOpenChange(false);
  };

  const proteinG = Math.round(targetKcal * 0.2 / 4);
  const fatG = Math.round(targetKcal * 0.25 / 9);
  const carbsG = Math.round(targetKcal * 0.55 / 4);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ChefHat className="h-5 w-5 text-orange-500" />
            {t("meal_planner.chef_title")}
          </DialogTitle>
        </DialogHeader>

        <div className="grid gap-4 py-2">
          <div className="grid grid-cols-3 gap-3">
            <div className="grid gap-1">
              <Label className="text-xs">{t("meal_planner.target_kcal")}</Label>
              <Input type="number" value={targetKcal} onChange={(e) => setTargetKcal(Number(e.target.value))} min={800} max={5000} />
            </div>
            <div className="grid gap-1">
              <Label className="text-xs">{t("meal_planner.meals_per_day")}</Label>
              <Select value={String(timesPerDay)} onValueChange={(v) => setTimesPerDay(Number(v))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {[3, 4, 5, 6].map((n) => <SelectItem key={n} value={String(n)}>{n}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-1">
              <Label className="text-xs">{t("meal_planner.days_count")}</Label>
              <Select value={String(daysCount)} onValueChange={(v) => setDaysCount(Number(v))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {[1, 3, 5, 7, 14].map((n) => <SelectItem key={n} value={String(n)}>{n}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="rounded-lg bg-muted p-3 text-xs text-muted-foreground">
            {t("meal_planner.chef_macro_hint", { protein: proteinG, fat: fatG, carbs: carbsG, kcal: targetKcal })}
          </div>

          <div className="grid gap-1">
            <Label className="text-xs">{t("meal_planner.restrictions")}</Label>
            <Input value={restrictions} onChange={(e) => setRestrictions(e.target.value)} placeholder={t("meal_planner.restrictions_placeholder")} />
          </div>

          <div className="grid gap-1">
            <Label className="text-xs">{t("meal_planner.preferences")}</Label>
            <Textarea value={preferences} onChange={(e) => setPreferences(e.target.value)} rows={2} placeholder={t("meal_planner.preferences_placeholder")} />
          </div>

          <Button onClick={handleGenerate} disabled={generating} className="w-full">
            {generating ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Sparkles className="mr-1 h-4 w-4" />}
            {generating ? t("meal_planner.generating") : t("meal_planner.generate_with_ai")}
          </Button>

          {result?.error ? (
            <p className="text-sm text-red-500">{result.error}</p>
          ) : null}

          {result?.days?.length ? (
            <div className="space-y-3">
              <p className="text-sm font-medium">{t("meal_planner.chef_result_title")}</p>
              {result.days.slice(0, 3).map((day) => (
                <div key={day.dayNumber} className="rounded-lg border p-3">
                  <p className="mb-1 text-sm font-semibold">{t("meal_planner.day_number", { n: day.dayNumber })} — {day.totalKcal} kcal</p>
                  <div className="space-y-1">
                    {day.meals.map((meal, i) => (
                      <div key={i} className="flex items-start justify-between text-xs">
                        <div className="flex flex-wrap gap-1">
                          <Badge variant="outline" className="text-[10px]">{slotLabel(meal.slot)}</Badge>
                          <span className="text-muted-foreground">{meal.foods.join(", ")}</span>
                        </div>
                        <span className="ml-2 shrink-0 font-mono text-muted-foreground">{meal.kcal} kcal</span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
              {result.days.length > 3 ? (
                <p className="text-xs text-muted-foreground">... y {result.days.length - 3} días más</p>
              ) : null}
            </div>
          ) : null}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>{t("common.cancel")}</Button>
          <Button onClick={handleApply} disabled={!result?.days?.length || generating}>
            {t("meal_planner.apply_plan")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
