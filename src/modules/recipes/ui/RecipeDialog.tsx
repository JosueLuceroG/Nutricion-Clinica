import * as React from "react";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslation } from "react-i18next";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@components/ui/dialog";
import { Button } from "@components/ui/button";
import { Input } from "@components/ui/input";
import { Label } from "@components/ui/label";
import { Textarea } from "@components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@components/ui/select";
import { ScrollArea } from "@components/ui/scroll-area";
import { RecipeFormSchema, type RecipeFormInput } from "../application/recipeFormSchema";
import { RECIPE_CATEGORIES, RecipeCategoryLabel } from "../domain/RecipeTypes";
import { Plus, Trash2, GripVertical } from "lucide-react";

interface RecipeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: RecipeFormInput) => Promise<void>;
}

export function RecipeDialog({ open, onOpenChange, onSubmit }: RecipeDialogProps) {
  const { t } = useTranslation();
  const [step, setStep] = React.useState(0);
  const [submitting, setSubmitting] = React.useState(false);
  const form = useForm<RecipeFormInput>({
    resolver: zodResolver(RecipeFormSchema),
    defaultValues: {
      name: "", description: "", category: "plato_fuerte", cuisine: "mexicana",
      difficulty: "media", prepTimeMin: 0, cookTimeMin: 0, servings: 4,
      servingUnit: "porción", ingredients: [], steps: [], notes: "",
      tags: "", allergens: [], costTotal: 0, currency: "MXN",
    },
  });

  const { fields: ingredientFields, append: addIngredient, remove: removeIngredient } = useFieldArray({ control: form.control, name: "ingredients" });
  const { fields: stepFields, append: addStep, remove: removeStep } = useFieldArray({ control: form.control, name: "steps" });

  React.useEffect(() => {
    if (open) { form.reset(); setStep(0); }
  }, [open, form]);

  const handleSubmit = async (data: RecipeFormInput) => {
    setSubmitting(true);
    try { await onSubmit(data); onOpenChange(false); }
    finally { setSubmitting(false); }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>{t("recipes.new_title")}</DialogTitle>
          <DialogDescription>{t("recipes.step_count", { current: step + 1, total: 3 })}</DialogDescription>
        </DialogHeader>
        <form onSubmit={form.handleSubmit(handleSubmit)}>
          {step === 0 && (
            <div className="space-y-4">
              <div className="grid gap-2">
                <Label htmlFor="name">{t("common.name")}</Label>
                <Input id="name" {...form.register("name")} />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="description">{t("common.description")}</Label>
                <Textarea id="description" {...form.register("description")} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label>{t("recipes.category")}</Label>
                  <Select value={form.watch("category")} onValueChange={(v) => form.setValue("category", v as never)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {RECIPE_CATEGORIES.map((c) => (<SelectItem key={c} value={c}>{t(`recipes.category_${c}`, { defaultValue: RecipeCategoryLabel[c] })}</SelectItem>))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-2">
                  <Label>{t("recipes.difficulty")}</Label>
                  <Select value={form.watch("difficulty")} onValueChange={(v) => form.setValue("difficulty", v as never)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="facil">{t("recipes.difficulty_easy")}</SelectItem>
                      <SelectItem value="media">{t("recipes.difficulty_medium")}</SelectItem>
                      <SelectItem value="dificil">{t("recipes.difficulty_hard")}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div className="grid gap-2">
                  <Label>{t("recipes.prep_min")}</Label>
                  <Input type="number" min={0} {...form.register("prepTimeMin", { valueAsNumber: true })} />
                </div>
                <div className="grid gap-2">
                  <Label>{t("recipes.cook_min")}</Label>
                  <Input type="number" min={0} {...form.register("cookTimeMin", { valueAsNumber: true })} />
                </div>
                <div className="grid gap-2">
                  <Label>{t("recipes.servings")}</Label>
                  <Input type="number" min={1} {...form.register("servings", { valueAsNumber: true })} />
                </div>
              </div>
            </div>
          )}

          {step === 1 && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <Label>{t("recipes.ingredients")}</Label>
                  <Button type="button" variant="outline" size="sm" onClick={() => addIngredient({ equivalentId: "", name: "", quantity: 1, unit: "pieza", orderIndex: 0, isOptional: false })}>
                  <Plus className="mr-1 h-3 w-3" /> {t("common.add")}
                </Button>
              </div>
              <ScrollArea className="h-[300px] pr-4">
                {ingredientFields.map((field, idx) => (
                  <div key={field.id} className="mb-2 flex items-start gap-2 rounded border p-2">
                    <GripVertical className="mt-2 h-4 w-4 shrink-0 text-muted-foreground" />
                    <div className="grid flex-1 grid-cols-3 gap-2">
                      <Input placeholder={t("common.name")} {...form.register(`ingredients.${idx}.name`)} />
                      <Input type="number" step="0.01" placeholder={t("recipes.quantity_abbr")} {...form.register(`ingredients.${idx}.quantity`, { valueAsNumber: true })} />
                      <Input placeholder={t("recipes.unit")} {...form.register(`ingredients.${idx}.unit`)} />
                    </div>
                    <Button type="button" variant="ghost" size="icon" onClick={() => removeIngredient(idx)}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                ))}
              </ScrollArea>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <Label>{t("recipes.preparation")}</Label>
                  <Button type="button" variant="outline" size="sm" onClick={() => addStep({ description: "", orderIndex: 0 })}>
                  <Plus className="mr-1 h-3 w-3" /> {t("recipes.add_step")}
                </Button>
              </div>
              <ScrollArea className="h-[300px] pr-4">
                {stepFields.map((field, idx) => (
                  <div key={field.id} className="mb-2 flex items-start gap-2 rounded border p-2">
                    <span className="mt-2 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary text-[10px] text-primary-foreground">{idx + 1}</span>
                    <div className="grid flex-1 gap-2">
                      <Textarea placeholder={t("recipes.step_description")} {...form.register(`steps.${idx}.description`)} />
                      <div className="flex gap-2">
                        <Input type="number" placeholder={t("recipes.minutes_abbr")} className="w-20" {...form.register(`steps.${idx}.durationMin`, { valueAsNumber: true })} />
                        <Input placeholder={t("recipes.temperature_c")} className="w-24" {...form.register(`steps.${idx}.temperature`)} />
                      </div>
                    </div>
                    <Button type="button" variant="ghost" size="icon" onClick={() => removeStep(idx)}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                ))}
              </ScrollArea>
            </div>
          )}

          <div className="mt-6 flex justify-between">
            <div>
              {step > 0 && (
                <Button type="button" variant="outline" onClick={() => setStep(step - 1)}>{t("common.previous")}</Button>
              )}
            </div>
            <div className="flex gap-2">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>{t("common.cancel")}</Button>
              {step < 2 ? (
                <Button type="button" onClick={() => setStep(step + 1)}>{t("common.next")}</Button>
              ) : (
                <Button type="submit" disabled={submitting}>
                  {submitting ? t("common.saving") : t("recipes.save")}
                </Button>
              )}
            </div>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
