import * as React from "react";
import { useDocuments, useCreateDocument } from "@modules/documents/ui/useDocumentHooks";
import { documentService } from "@services/documentService";
import { DocumentTypeLabel, DocumentStatusLabel } from "@modules/documents/domain/DocumentTypes";
import { Card, CardContent, CardHeader, CardTitle } from "@components/ui/card";
import { Button } from "@components/ui/button";
import { Badge } from "@components/ui/badge";
import { Skeleton } from "@components/ui/skeleton";
import { useAuthStore } from "@store/authStore";
import { useTranslation } from "react-i18next";
import { Plus, Signature } from "lucide-react";
import { DocumentDialog } from "@modules/documents/ui/DocumentDialog";
import { DocumentSignDialog } from "@modules/documents/ui/DocumentSignDialog";
import type { NutriClinicaDocument } from "@modules/documents/domain/NutriClinicaDocument";
import type { DocumentFormInput } from "@modules/documents/application/documentFormSchema";

const statusColor: Record<string, string> = {
  draft: "bg-gray-100 text-gray-800",
  signed: "bg-green-100 text-green-800",
  delivered: "bg-blue-100 text-blue-800",
  voided: "bg-red-100 text-red-800",
};

function DocCard({ doc, onSign }: { doc: NutriClinicaDocument; onSign: (doc: NutriClinicaDocument) => void }) {
  const { t } = useTranslation();
  const preview = doc.contentHtml.replace(/<[^>]+>/g, "").slice(0, 120);

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between">
          <div>
            <CardTitle className="text-base">{doc.title}</CardTitle>
            <p className="text-xs text-muted-foreground">{t("documents.type_" + doc.type, { defaultValue: DocumentTypeLabel[doc.type] })}</p>
          </div>
          <Badge className={statusColor[doc.status]}>
            {t("documents.status_" + doc.status, { defaultValue: DocumentStatusLabel[doc.status] })}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="text-sm text-muted-foreground">
        {preview && <p className="line-clamp-2">{preview}...</p>}
        <p className="mt-1 text-xs">
          v{doc.version} · {new Date(doc.createdAt).toLocaleDateString()}
        </p>
        {doc.status === "draft" && (
          <div className="mt-2 flex justify-end">
            <Button variant="outline" size="sm" onClick={() => onSign(doc)}>
              <Signature className="mr-1 h-3 w-3" /> {t("documents.sign")}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export function DocumentsPage() {
  const { t } = useTranslation();
  const { docs, loading, refresh } = useDocuments();
  const { create } = useCreateDocument();
  const user = useAuthStore((s) => s.user);
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [signDialogOpen, setSignDialogOpen] = React.useState(false);
  const [signingDoc, setSigningDoc] = React.useState<NutriClinicaDocument | null>(null);

  const handleCreateDoc = async (data: DocumentFormInput) => {
    await create(data, user?.id ?? "");
    await refresh();
  };

  const handleSignClick = (doc: NutriClinicaDocument) => {
    setSigningDoc(doc);
    setSignDialogOpen(true);
  };

  const handleSignConfirm = async () => {
    if (!signingDoc || !user) return;
    const hash = crypto.randomUUID();
    await documentService.sign(signingDoc.id, user.id, hash);
    setSignDialogOpen(false);
    setSigningDoc(null);
    await refresh();
  };

  return (
    <div className="flex h-full flex-col">
      <div className="border-b px-6 py-3">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold">{t("documents.professional_title")}</h1>
            <p className="text-sm text-muted-foreground">{t("documents.documents_count", { count: docs.length })}</p>
          </div>
          <Button onClick={() => setDialogOpen(true)}>
            <Plus className="mr-1 h-4 w-4" /> {t("documents.create_document")}
          </Button>
        </div>
      </div>

      <DocumentDialog open={dialogOpen} onOpenChange={setDialogOpen} onSubmit={handleCreateDoc} />

      {signingDoc && (
        <DocumentSignDialog
          open={signDialogOpen}
          onOpenChange={(open) => { setSignDialogOpen(open); if (!open) setSigningDoc(null); }}
          documentId={signingDoc.id}
          documentTitle={signingDoc.title}
          documentType={t("documents.type_" + signingDoc.type, { defaultValue: DocumentTypeLabel[signingDoc.type] })}
          onSigned={handleSignConfirm}
        />
      )}

      <div className="flex-1 overflow-y-auto p-6">
        {loading ? (
          <div className="space-y-4">
            {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-28 w-full" />)}
          </div>
        ) : docs.length === 0 ? (
          <p className="py-12 text-center text-sm text-muted-foreground">
            {t("documents.no_generated")}
          </p>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {docs.map((d) => <DocCard key={d.id} doc={d} onSign={handleSignClick} />)}
          </div>
        )}
      </div>
    </div>
  );
}
