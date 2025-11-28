import { PageTemplate } from "@core/components/page-template";
import { rc } from "@recommand/lib/client";
import type { TransmittedDocuments } from "@peppol/api/documents";
import { useActiveTeam } from "@core/hooks/user";
import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { toast } from "@core/components/ui/sonner";
import { stringifyActionFailure } from "@recommand/lib/utils";
import { Loader2, Trash2, FolderArchive, ArrowDown, ArrowUp } from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@core/components/ui/card";
import { Button } from "@core/components/ui/button";
import { AsyncButton } from "@core/components/async-button";
import { TransmissionStatusIcons } from "@peppol/components/transmission-status-icons";
import type { TransmittedDocument } from "@peppol/data/transmitted-documents";
import type { Label } from "@peppol/types/label";
import { Badge } from "@core/components/ui/badge";
import { format } from "date-fns";
import { Alert, AlertDescription, AlertTitle } from "@core/components/ui/alert";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@core/components/ui/tabs";
import { SyntaxHighlighter } from "@peppol/components/send-document/syntax-highlighter";

const client = rc<TransmittedDocuments>("peppol");

type TransmittedDocumentWithLabels = TransmittedDocument & {
  labels?: Label[];
};

export default function TransmittedDocumentDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const activeTeam = useActiveTeam();

  const [doc, setDoc] = useState<TransmittedDocumentWithLabels | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [previewHtml, setPreviewHtml] = useState<string | null>(null);
  const [isPreviewLoading, setIsPreviewLoading] = useState(false);

  useEffect(() => {
    const fetchDocument = async () => {
      if (!id || !activeTeam?.id) return;

      try {
        setIsLoading(true);
        const response = await client[":teamId"]["documents"][":documentId"].$get({
          param: {
            teamId: activeTeam.id,
            documentId: id,
          },
        });
        const json = await response.json();

        if (!json.success) {
          toast.error(stringifyActionFailure(json.errors));
          navigate("/transmitted-documents");
          return;
        }
        const apiDoc = json.document as TransmittedDocumentWithLabels & {
          createdAt: string;
          updatedAt: string;
          readAt: string | null;
        };

        const hydratedDoc: TransmittedDocumentWithLabels = {
          ...apiDoc,
          createdAt: new Date(apiDoc.createdAt),
          updatedAt: new Date(apiDoc.updatedAt),
          readAt: apiDoc.readAt ? new Date(apiDoc.readAt) : null,
        };

        setDoc(hydratedDoc);

        // Fetch HTML preview in parallel once we have a valid document
        try {
          setIsPreviewLoading(true);
          const previewResponse =
            await client[":teamId"]["documents"][":documentId"]["render"].$get({
              param: {
                teamId: activeTeam.id,
                documentId: hydratedDoc.id,
              },
            });
          const previewJson = await previewResponse.json();
          if (previewJson.success && typeof previewJson.html === "string") {
            setPreviewHtml(previewJson.html);
          }
        } catch (error) {
          console.error("Failed to load rendered document HTML:", error);
        } finally {
          setIsPreviewLoading(false);
        }
      } catch (error) {
        console.error("Error fetching document:", error);
        toast.error("Failed to load document");
        navigate("/transmitted-documents");
      } finally {
        setIsLoading(false);
      }
    };

    fetchDocument();
  }, [id, activeTeam?.id, navigate]);

  const handleDelete = async () => {
    if (!activeTeam?.id || !doc) return;
    if (!confirm("Are you sure you want to delete this document?")) return;

    try {
      const response = await client[":teamId"]["documents"][":documentId"].$delete({
        param: {
          teamId: activeTeam.id,
          documentId: doc.id,
        },
      });
      const json = await response.json();
      if (!json.success) {
        throw new Error(stringifyActionFailure(json.errors));
      }

      toast.success("Document deleted successfully");
      navigate("/transmitted-documents");
    } catch (error) {
      console.error("Failed to delete document:", error);
      toast.error("Failed to delete document");
    }
  };

  const handleDownload = async () => {
    if (!activeTeam?.id || !doc) return;

    try {
      const response = await client[":teamId"]["documents"][":documentId"]["downloadPackage"].$get({
        param: {
          teamId: activeTeam.id,
          documentId: doc.id,
        },
      });

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = window.document.createElement("a");
      link.href = url;
      link.download = `${doc.id}.zip`;
      window.document.body.appendChild(link);
      link.click();
      window.document.body.removeChild(link);
      window.URL.revokeObjectURL(url);

      toast.success("Document downloaded successfully");
    } catch (error) {
      console.error("Failed to download document:", error);
      toast.error("Failed to download document");
    }
  };

  if (isLoading) {
    return (
      <PageTemplate
        breadcrumbs={[
          { label: "Peppol", href: "/" },
          {
            label: "Sent and received documents",
            href: "/transmitted-documents",
          },
          { label: "Loading..." },
        ]}
        description="Loading document details..."
      >
        <div className="flex items-center justify-center h-96">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </PageTemplate>
    );
  }

  if (!doc) {
    return (
      <PageTemplate
        breadcrumbs={[
          { label: "Peppol", href: "/" },
          {
            label: "Sent and received documents",
            href: "/transmitted-documents",
          },
          { label: "Not found" },
        ]}
        description="Document not found"
      >
        <div className="flex items-center justify-center h-96">
          <Button onClick={() => navigate("/transmitted-documents")}>
            Back to documents
          </Button>
        </div>
      </PageTemplate>
    );
  }

  const parsed: any = doc.parsed;

  const directionIcon =
    doc.direction === "incoming" ? (
      <ArrowDown className="h-4 w-4" />
    ) : (
      <ArrowUp className="h-4 w-4" />
    );

  const documentNumber =
    parsed?.invoiceNumber ??
    parsed?.creditNoteNumber ??
    parsed?.selfBillingInvoiceNumber ??
    parsed?.selfBillingCreditNoteNumber;
  const hasStructuredData = !!parsed && doc.type !== "unknown";
  const titleNumber =
    documentNumber || `${doc.id.slice(0, 6)}...${doc.id.slice(-6)}`;
  const directionLabel =
    doc.direction === "incoming" ? "Incoming document" : "Outgoing document";

  return (
    <PageTemplate
      breadcrumbs={[
        { label: "Peppol", href: "/" },
        {
          label: "Sent and received documents",
          href: "/transmitted-documents",
        },
        { label: doc.id },
      ]}
      description="Preview and metadata for this transmitted Peppol document."
      buttons={[
        <AsyncButton key="download" variant="outline" onClick={handleDownload}>
          <FolderArchive className="h-4 w-4 mr-2" />
          Download package
        </AsyncButton>,
        <AsyncButton key="delete" variant="destructive" onClick={handleDelete}>
          <Trash2 className="h-4 w-4 mr-2" />
          Delete
        </AsyncButton>,
      ]}
    >
      <div className="space-y-4">
        <Card>
          <CardHeader className="space-y-3">
            <div className="flex flex-wrap items-center gap-2 text-xs uppercase tracking-wide text-muted-foreground">
              {directionIcon}
              <span>{directionLabel}</span>
              <span>•</span>
              <span className="capitalize">{doc.type}</span>
            </div>
            <CardTitle className="text-2xl font-semibold tracking-tight">
              {titleNumber}
            </CardTitle>
            <CardDescription className="flex flex-wrap items-center gap-2 text-xs md:text-sm">
              <span className="text-muted-foreground">
                Created {format(new Date(doc.createdAt), "PPpp")}
              </span>
              {doc.readAt && (
                <>
                  <span>•</span>
                  <span className="text-muted-foreground">
                    Read {format(new Date(doc.readAt), "PPpp")}
                  </span>
                </>
              )}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="flex flex-wrap items-center gap-2">
              <TransmissionStatusIcons
                sentOverPeppol={doc.sentOverPeppol}
                sentOverEmail={doc.sentOverEmail}
                emailRecipients={doc.emailRecipients || undefined}
              />
              {doc.labels &&
                doc.labels.map((label) => (
                  <Badge
                    key={label.id}
                    variant="outline"
                    className="flex items-center gap-1 border-none"
                    style={{ color: label.colorHex }}
                  >
                    <span
                      className="w-2 h-2 rounded-full"
                      style={{ backgroundColor: label.colorHex }}
                    />
                    <span className="leading-none pt-0.5">
                      {label.name}
                    </span>
                  </Badge>
                ))}
            </div>
          </CardContent>
        </Card>

        {!hasStructuredData && (
          <Alert className="border-dashed">
            <AlertTitle>Limited document details</AlertTitle>
            <AlertDescription>
              This document could not be fully parsed. Only technical metadata
              and raw XML are available.
            </AlertDescription>
          </Alert>
        )}

        <div className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
          <Card>
            <CardHeader>
              <CardTitle>Document preview</CardTitle>
              <CardDescription>
                Rendered billing document as it appears in the generated PDF.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {isPreviewLoading && (
                <div className="flex items-center justify-center h-32 text-sm text-muted-foreground">
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Loading preview...
                </div>
              )}
              {!isPreviewLoading && previewHtml && (
                <div className="border rounded-md overflow-hidden bg-background">
                  <iframe
                    title="Document preview"
                    srcDoc={previewHtml}
                    className="w-full h-[800px] border-0"
                  />
                </div>
              )}
              {!isPreviewLoading && !previewHtml && (
                <p className="text-sm text-muted-foreground">
                  No preview available for this document.
                </p>
              )}
            </CardContent>
          </Card>

          <Card className="lg:sticky lg:top-6">
            <CardHeader>
              <CardTitle>Technical details & raw data</CardTitle>
              <CardDescription>
                Inspect metadata, parsed JSON structure, or the original XML payload.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Tabs defaultValue="metadata">
                <TabsList className="grid w-full grid-cols-3 mb-3">
                  <TabsTrigger value="metadata">Metadata</TabsTrigger>
                  <TabsTrigger value="json" disabled={!hasStructuredData}>
                    JSON
                  </TabsTrigger>
                  <TabsTrigger value="xml">XML</TabsTrigger>
                </TabsList>
                <TabsContent value="metadata">
                  <div className="grid grid-cols-1 gap-3 text-xs md:text-sm">
                    <div className="space-y-1">
                      <div className="text-muted-foreground">Document ID</div>
                      <div className="font-mono text-xs break-all">{doc.id}</div>
                    </div>
                    <div className="space-y-1">
                      <div className="text-muted-foreground">Company ID</div>
                      <div className="font-mono text-xs break-all">
                        {doc.companyId}
                      </div>
                    </div>
                    <div className="space-y-1">
                      <div className="text-muted-foreground">Sender ID</div>
                      <div className="font-mono text-xs break-all">
                        {doc.senderId}
                      </div>
                    </div>
                    <div className="space-y-1">
                      <div className="text-muted-foreground">Receiver ID</div>
                      <div className="font-mono text-xs break-all">
                        {doc.receiverId}
                      </div>
                    </div>
                    <div className="space-y-1">
                      <div className="text-muted-foreground">DocType ID</div>
                      <div className="font-mono text-xs break-all">
                        {doc.docTypeId}
                      </div>
                    </div>
                    <div className="space-y-1">
                      <div className="text-muted-foreground">Process ID</div>
                      <div className="font-mono text-xs break-all">
                        {doc.processId}
                      </div>
                    </div>
                    <div className="space-y-1">
                      <div className="text-muted-foreground">Country (C1)</div>
                      <div className="font-mono text-xs break-all">
                        {doc.countryC1}
                      </div>
                    </div>
                  </div>
                </TabsContent>
                <TabsContent value="json">
                  {hasStructuredData && (
                    <div className="h-[320px] overflow-auto w-full rounded border bg-white">
                      <SyntaxHighlighter
                        code={JSON.stringify(parsed, null, 2)}
                        language="json"
                        className="p-4 h-full min-w-full"
                      />
                    </div>
                  )}
                </TabsContent>
                <TabsContent value="xml">
                  <div className="h-[320px] overflow-auto w-full rounded border bg-white">
                    <SyntaxHighlighter
                      code={doc.xml ?? ""}
                      language="xml"
                      className="p-4 h-full min-w-full"
                    />
                  </div>
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
        </div>
      </div>
    </PageTemplate>
  );
}
