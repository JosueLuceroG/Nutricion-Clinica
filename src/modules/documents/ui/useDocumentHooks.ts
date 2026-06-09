import * as React from "react";
import { documentService } from "@services/documentService";
import type { NutriClinicaDocument } from "../domain/NutriClinicaDocument";
import type { DocumentFormInput } from "../application/documentFormSchema";

export function useDocuments() {
  const [docs, setDocs] = React.useState<NutriClinicaDocument[]>([]);
  const [loading, setLoading] = React.useState(true);

  const refresh = React.useCallback(async () => {
    setLoading(true);
    try {
      const data = await documentService.list();
      setDocs(data);
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => { void refresh(); }, [refresh]);

  return { docs, loading, refresh };
}

export function useCreateDocument() {
  const [creating, setCreating] = React.useState(false);

  const create = React.useCallback(async (input: DocumentFormInput, generatedBy: string) => {
    setCreating(true);
    try {
      return await documentService.create(input, generatedBy);
    } finally {
      setCreating(false);
    }
  }, []);

  return { create, creating };
}
