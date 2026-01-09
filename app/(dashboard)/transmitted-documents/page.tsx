import { PageTemplate } from "@core/components/page-template";
import { rc } from "@recommand/lib/client";
import { useEffect, useState, useCallback } from "react";
import { DataTable } from "@core/components/data-table";
import {
  type ColumnDef,
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnFiltersState,
  type VisibilityState,
} from "@tanstack/react-table";
import type { SortingState } from "@tanstack/react-table";
import { Button } from "@core/components/ui/button";
import { toast } from "@core/components/ui/sonner";
import { useActiveTeam } from "@core/hooks/user";
import { Trash2, Loader2, Copy, ArrowDown, ArrowUp, FolderArchive, Tag, X, CheckCheck, Mail, MailOpen, Download } from "lucide-react";
import { useIsPlayground } from "@peppol/lib/client/playgrounds";
import { ColumnHeader } from "@core/components/data-table/column-header";
import { format } from "date-fns";
import { stringifyActionFailure } from "@recommand/lib/utils";
import type { TransmittedDocumentWithoutBody } from "@peppol/data/transmitted-documents";
import type { TransmittedDocuments } from "@peppol/api/documents";
import type { Companies } from "@peppol/api/companies";
import type { Labels } from "@peppol/api/labels";
import { DataTablePagination } from "@core/components/data-table/pagination";
import {
  DataTableToolbar,
  type FilterConfig,
} from "@core/components/data-table/toolbar";
import { PartyInfoTooltip } from "@peppol/components/party-info-tooltip";
import { TransmissionStatusIcons } from "@peppol/components/transmission-status-icons";
import { DocumentTypeCell } from "@peppol/components/document-type-cell";
import { Badge } from "@core/components/ui/badge";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@core/components/ui/popover";
import type { Label } from "@peppol/types/label";
import { Link } from "react-router-dom";
import { ConfirmDialog } from "@core/components/confirm-dialog";
import { ExportDocumentsDialog } from "@peppol/components/export-documents-dialog";
import type { SupportedDocumentType } from "@peppol/utils/document-types";
import type { Invoice } from "@peppol/utils/parsing/invoice/schemas";
import type { CreditNote } from "@peppol/utils/parsing/creditnote/schemas";
import type { SelfBillingInvoice } from "@peppol/utils/parsing/self-billing-invoice/schemas";
import type { SelfBillingCreditNote } from "@peppol/utils/parsing/self-billing-creditnote/schemas";

const client = rc<TransmittedDocuments>("peppol");
const companiesClient = rc<Companies>("peppol");
const labelsClient = rc<Labels>("v1");

const STORAGE_KEY = "transmitted-documents-preferences";

interface StoredPreferences {
  columnFilters: ColumnFiltersState;
  limit: number;
  columnVisibility: VisibilityState;
}

function loadPreferences(): Partial<StoredPreferences> {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      return JSON.parse(stored);
    }
  } catch (error) {
    console.error("Failed to load preferences from localStorage:", error);
  }
  return {};
}

function savePreferences(preferences: StoredPreferences) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(preferences));
  } catch (error) {
    console.error("Failed to save preferences to localStorage:", error);
  }
}

export default function Page() {
  const loadedPreferences = loadPreferences();
  const [documents, setDocuments] = useState<TransmittedDocumentWithoutBody[]>(
    []
  );
  const [isLoading, setIsLoading] = useState(true);
  const [sorting, setSorting] = useState<SortingState>([]);
  const [globalFilter, setGlobalFilter] = useState("");
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>(
    loadedPreferences.columnFilters ?? []
  );
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(loadedPreferences.limit ?? 10);
  const [total, setTotal] = useState(0);
  const [companies, setCompanies] = useState<{ id: string; name: string }[]>([]);
  const [labels, setLabels] = useState<Label[]>([]);
  const defaultColumnVisibility: VisibilityState = {
    documentNumber: false,
    totalExclVat: false,
    totalInclVat: false,
  };
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>(
    loadedPreferences.columnVisibility
      ? { ...defaultColumnVisibility, ...loadedPreferences.columnVisibility }
      : defaultColumnVisibility
  );
  const activeTeam = useActiveTeam();
  const isPlayground = useIsPlayground();
  const [isDeletingAll, setIsDeletingAll] = useState(false);
  const [isExportDialogOpen, setIsExportDialogOpen] = useState(false);

  const fetchCompanies = useCallback(async () => {
    if (!activeTeam?.id) {
      setCompanies([]);
      return;
    }

    try {
      const response = await companiesClient[":teamId"]["companies"].$get({
        param: { teamId: activeTeam.id },
        query: {},
      });
      const json = await response.json();

      if (!json.success || !Array.isArray(json.companies)) {
        toast.error("Failed to load companies");
        setCompanies([]);
      } else {
        setCompanies(
          json.companies.map((company: { id: string; name: string }) => ({
            id: company.id,
            name: company.name,
          }))
        );
      }
    } catch (error) {
      toast.error("Failed to load companies");
      setCompanies([]);
    }
  }, [activeTeam?.id]);

  const fetchDocuments = useCallback(async () => {
    if (!activeTeam?.id) {
      setDocuments([]);
      setIsLoading(false);
      return;
    }

    const directionFilter = columnFilters.find((f) => f.id === "direction");
    const filteredDirectionValues = directionFilter?.value as string[] ?? [];

    const companyFilter = columnFilters.find((f) => f.id === "companyId");
    const filteredCompanyIds = companyFilter?.value as string[] ?? [];

    const typeFilter = columnFilters.find((f) => f.id === "type");
    const filteredTypeValues = typeFilter?.value as string[] ?? [];

    const isUnreadFilter = columnFilters.find((f) => f.id === "isUnread");
    const filteredIsUnreadValues = isUnreadFilter?.value as string[] ?? [];

    try {
      const response = await client[":teamId"]["documents"].$get({
        param: { teamId: activeTeam.id },
        query: {
          page: page,
          limit: limit,
          companyId: filteredCompanyIds,
          direction: ((filteredDirectionValues.length === 0 || filteredDirectionValues.length > 1) ? undefined : filteredDirectionValues[0]) as "incoming" | "outgoing", // When no or all options are selected, don't filter on direction
          search: globalFilter || undefined, // Add the global search term to the query
          type: ((filteredTypeValues.length === 0 || filteredTypeValues.length > 1) ? undefined : filteredTypeValues[0]) as SupportedDocumentType, // When no or all options are selected, don't filter on type
          isUnread: ((filteredIsUnreadValues.length === 0 || filteredIsUnreadValues.length > 1) ? undefined : filteredIsUnreadValues[0]) as "true" | "false" | undefined,
        },
      });
      const json = await response.json();

      if (!json.success) {
        console.error("Invalid API response format:", json);
        toast.error("Failed to load documents");
        setDocuments([]);
      } else {
        setDocuments(
          json.documents.map((doc) => ({
            ...doc,
            readAt: doc.readAt ? new Date(doc.readAt) : null,
            createdAt: new Date(doc.createdAt),
            updatedAt: new Date(doc.updatedAt),
            labels: doc.labels || [],
          }))
        );
        setTotal(json.pagination.total);
      }
    } catch (error) {
      console.error("Error fetching documents:", error);
      toast.error("Failed to load documents");
      setDocuments([]);
    } finally {
      setIsLoading(false);
    }
  }, [activeTeam?.id, page, limit, columnFilters, globalFilter]);

  const fetchLabels = useCallback(async () => {
    if (!activeTeam?.id) {
      setLabels([]);
      return;
    }

    try {
      const response = await labelsClient[":teamId"]["labels"].$get({
        param: { teamId: activeTeam.id },
      });
      const json = await response.json();

      if (!json.success || !Array.isArray(json.labels)) {
        toast.error("Failed to load labels");
        setLabels([]);
      } else {
        setLabels(json.labels);
      }
    } catch (error) {
      console.error("Error fetching labels:", error);
      toast.error("Failed to load labels");
      setLabels([]);
    }
  }, [activeTeam?.id]);

  useEffect(() => {
    fetchCompanies();
  }, [fetchCompanies]);

  useEffect(() => {
    fetchLabels();
  }, [fetchLabels]);

  useEffect(() => {
    fetchDocuments();
  }, [fetchDocuments]);

  useEffect(() => {
    savePreferences({
      columnFilters,
      limit,
      columnVisibility,
    });
  }, [columnFilters, limit, columnVisibility]);

  const handleDeleteDocument = async (id: string) => {
    if (!activeTeam?.id) return;

    try {
      const response = await client[":teamId"]["documents"][
        ":documentId"
      ].$delete({
        param: {
          teamId: activeTeam.id,
          documentId: id,
        },
      });
      const json = await response.json();
      if (!json.success) {
        throw new Error(stringifyActionFailure(json.errors));
      }
      toast.success("Document deleted successfully");
      fetchDocuments();
    } catch (error) {
      toast.error("Failed to delete document");
    }
  };

  const handleDeleteAllDocuments = async () => {
    if (!activeTeam?.id || !isPlayground) return;

    setIsDeletingAll(true);
    try {
      const response = await client[":teamId"]["documents"]["all"].$delete({
        param: { teamId: activeTeam.id },
      });
      const json = await response.json();
      if (!json.success) {
        throw new Error(stringifyActionFailure(json.errors));
      }
      toast.success("All documents deleted successfully");
      fetchDocuments();
    } catch (error) {
      toast.error("Failed to delete all documents");
    } finally {
      setIsDeletingAll(false);
    }
  };

  const handleToggleMarkAsRead = async (id: string, currentReadAt: Date | null) => {
    if (!activeTeam?.id) return;

    const isRead = currentReadAt !== null;
    const newReadStatus = !isRead;

    setDocuments((prev) =>
      prev.map((doc) =>
        doc.id === id
          ? {
              ...doc,
              readAt: newReadStatus ? new Date() : null,
            }
          : doc
      )
    );

    try {
      const response = await client[":teamId"]["documents"][":documentId"]["markAsRead"].$post({
        param: {
          teamId: activeTeam.id,
          documentId: id,
        },
        json: {
          read: newReadStatus,
        },
      });
      const json = await response.json();
      if (!json.success) {
        throw new Error(stringifyActionFailure(json.errors));
      }
      toast.success(newReadStatus ? "Document marked as read" : "Document marked as unread");
      fetchDocuments();
    } catch (error) {
      setDocuments((prev) =>
        prev.map((doc) =>
          doc.id === id
            ? {
                ...doc,
                readAt: currentReadAt,
              }
            : doc
        )
      );
      toast.error("Failed to update document read status");
    }
  };

  const handleDownloadDocument = async (id: string) => {
    if (!activeTeam?.id) return;

    try {
      const response = await client[":teamId"]["documents"][":documentId"]["downloadPackage"].$get({
        param: {
          teamId: activeTeam.id,
          documentId: id,
        },
        query: {
          generatePdf: "always",
        },
      });

      // Create a blob from the response
      const blob = await response.blob();

      // Create a URL for the blob
      const url = window.URL.createObjectURL(blob);

      // Create a temporary link element
      const link = document.createElement('a');
      link.href = url;
      link.download = `${id}.zip`;

      // Append to body, click, and remove
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      // Clean up the URL
      window.URL.revokeObjectURL(url);

      toast.success("Document downloaded successfully");
    } catch (error) {
      toast.error("Failed to download document");
    }
  };

  const handleAssignLabel = async (documentId: string, labelId: string) => {
    if (!activeTeam?.id) return;

    const document = documents.find((d) => d.id === documentId);
    if (!document) return;

    const label = labels.find((l) => l.id === labelId);
    if (!label) return;

    const isAlreadyAssigned = document.labels?.some((l) => l.id === labelId);
    if (isAlreadyAssigned) return;

    setDocuments((prev) =>
      prev.map((doc) =>
        doc.id === documentId
          ? {
            ...doc,
            labels: [
              ...(doc.labels || []), label
            ]
          }
          : doc
      )
    );

    try {
      const response = await client[":teamId"]["documents"][":documentId"]["labels"][":labelId"].$post({
        param: {
          teamId: activeTeam.id,
          documentId,
          labelId,
        },
      });
      const json = await response.json();
      if (!json.success) {
        throw new Error(stringifyActionFailure(json.errors));
      }
    } catch (error) {
      setDocuments((prev) =>
        prev.map((doc) =>
          doc.id === documentId
            ? { ...doc, labels: doc.labels?.filter((l) => l.id !== labelId) || [] }
            : doc
        )
      );
      toast.error("Failed to assign label");
    }
  };

  const handleUnassignLabel = async (documentId: string, labelId: string) => {
    if (!activeTeam?.id) return;

    const document = documents.find((d) => d.id === documentId);
    if (!document) return;

    const isAssigned = document.labels?.some((l) => l.id === labelId);
    if (!isAssigned) return;

    setDocuments((prev) =>
      prev.map((doc) =>
        doc.id === documentId
          ? { ...doc, labels: doc.labels?.filter((l) => l.id !== labelId) || [] }
          : doc
      )
    );

    try {
      const response = await client[":teamId"]["documents"][":documentId"]["labels"][":labelId"].$delete({
        param: {
          teamId: activeTeam.id,
          documentId,
          labelId,
        },
      });
      const json = await response.json();
      if (!json.success) {
        throw new Error(stringifyActionFailure(json.errors));
      }
    } catch (error) {
      const label = labels.find((l) => l.id === labelId);
      if (label) {
        setDocuments((prev) =>
          prev.map((doc) =>
            doc.id === documentId
              ? {
                ...doc,
                labels: [
                  ...(doc.labels || []),
                  label
                ]
              }
              : doc
          )
        );
      }
      toast.error("Failed to unassign label");
    }
  };

  const columns: ColumnDef<TransmittedDocumentWithoutBody>[] = [
    {
      accessorKey: "id",
      header: ({ column }) => <ColumnHeader column={column} title="ID" />,
      cell: ({ row }) => {
        const id = row.getValue("id") as string;
        return (
          <div className="flex items-center gap-2">
            <Link
              to={`/transmitted-documents/${id}`}
              className="font-mono text-xs hover:underline"
            >
              {id.slice(0, 6)}...{id.slice(-6)}
            </Link>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => {
                navigator.clipboard.writeText(id);
                toast.success("Document ID copied to clipboard");
              }}
            >
              <Copy className="h-4 w-4" />
            </Button>
          </div>
        );
      },
      enableGlobalFilter: true,
    },
    {
      accessorKey: "companyId",
      header: ({ column }) => <ColumnHeader column={column} title="Company" />,
      cell: ({ row }) => {
        const companyId = row.original.companyId;
        const company = companies.find((c) => c.id === companyId);
        return company?.name ?? companyId;
      },
      enableColumnFilter: false,
      enableGlobalFilter: true,
    },
    {
      accessorKey: "type",
      header: ({ column }) => <ColumnHeader column={column} title="Type" />,
      cell: ({ row }) => {
        const document = row.original;
        const type = row.getValue("type") as string;
        const validation = document.validation;

        return <DocumentTypeCell type={type} validation={validation} />;
      },
      enableGlobalFilter: true,
    },
    {
      id: "documentNumber",
      accessorFn: (row) => {
        const parsed = row.parsed;
        if (!parsed) return null;
        return (parsed as any)?.invoiceNumber ?? (parsed as any)?.creditNoteNumber ?? null;
      },
      header: ({ column }) => <ColumnHeader column={column} title="Document Number" />,
      meta: { label: "Document Number" },
      cell: ({ row }) => {
        const parsed = row.original.parsed;
        if (!parsed) {
          return <span className="text-muted-foreground">-</span>;
        }
        const documentNumber = (parsed as any)?.invoiceNumber ?? (parsed as any)?.creditNoteNumber ?? null;
        return documentNumber ? <span>{documentNumber}</span> : <span className="text-muted-foreground">-</span>;
      },
      enableHiding: true,
      enableGlobalFilter: true,
    },
    {
      accessorKey: "senderId",
      header: ({ column }) => <ColumnHeader column={column} title="Sender" />,
      cell: ({ row }) => {
        const document = row.original;
        const senderId = row.getValue("senderId") as string;
        const documentType = document.type;

        // Check if document type is recognized and has parsed data
        const isRecognizedType = ["invoice", "creditNote", "selfBillingInvoice", "selfBillingCreditNote"].includes(documentType);

        if (isRecognizedType && document.parsed) {
          // For billing documents, sender is the seller, for self-billing documents, sender is the buyer
          const senderInfo = ["invoice", "creditNote"].includes(documentType)
            ? (document.parsed as Invoice | CreditNote)?.seller
            : ["selfBillingInvoice", "selfBillingCreditNote"].includes(documentType) ? (document.parsed as SelfBillingInvoice | SelfBillingCreditNote)?.buyer : undefined;

          if (senderInfo?.name) {
            return (
              <div className="flex items-center gap-2">
                <span>{senderInfo.name}</span>
                <PartyInfoTooltip partyInfo={senderInfo} peppolAddress={senderId} />
              </div>
            );
          }
        }

        // Fallback to showing senderId for unrecognized types or missing parsed data
        return <span>{senderId}</span>;
      },
      enableGlobalFilter: true,
    },
    {
      accessorKey: "receiverId",
      header: ({ column }) => <ColumnHeader column={column} title="Receiver" />,
      cell: ({ row }) => {
        const document = row.original;
        const receiverId = row.getValue("receiverId") as string;
        const documentType = document.type;
        const sentOverPeppol = document.sentOverPeppol;
        const sentOverEmail = document.sentOverEmail;
        const emailRecipients = document.emailRecipients;

        // Check if document type is recognized and has parsed data
        const isRecognizedType = ["invoice", "creditNote", "selfBillingInvoice", "selfBillingCreditNote"].includes(documentType);

        if (isRecognizedType && document.parsed) {
          // For billing documents, receiver is the buyer, for self-billing documents, receiver is the seller
          const receiverInfo = ["invoice", "creditNote"].includes(documentType)
            ? (document.parsed as any)?.buyer
            : (document.parsed as any)?.seller;

          if (receiverInfo?.name) {
            return (
              <div className="flex items-center gap-2">
                <span>{receiverInfo.name}</span>
                <div className="flex items-center gap-1">
                  <PartyInfoTooltip partyInfo={receiverInfo} peppolAddress={receiverId} />
                  <TransmissionStatusIcons
                    sentOverPeppol={sentOverPeppol}
                    sentOverEmail={sentOverEmail}
                    emailRecipients={emailRecipients || undefined}
                  />
                </div>
              </div>
            );
          }
        }

        // Fallback to showing receiverId for unrecognized types or missing parsed data
        return (
          <div className="flex items-center gap-2">
            <span>{receiverId}</span>
            <TransmissionStatusIcons
              sentOverPeppol={sentOverPeppol}
              sentOverEmail={sentOverEmail}
              emailRecipients={emailRecipients || undefined}
            />
          </div>
        );
      },
      enableGlobalFilter: true,
    },
    {
      id: "totalExclVat",
      accessorFn: (row) => {
        const parsed = row.parsed;
        if (!parsed) return null;
        const totals = (parsed as any)?.totals;
        return totals?.taxExclusiveAmount ? parseFloat(totals.taxExclusiveAmount) : null;
      },
      header: ({ column }) => <ColumnHeader column={column} title="Total Excl. VAT" />,
      meta: { label: "Total Excl. VAT" },
      cell: ({ row }) => {
        const parsed = row.original.parsed;
        if (!parsed) {
          return <span className="text-muted-foreground">-</span>;
        }
        const totals = (parsed as any)?.totals;
        if (totals?.taxExclusiveAmount) {
          const amount = String(totals.taxExclusiveAmount);
          const currency = (parsed as any)?.currency || "EUR";
          return <span className="font-mono">{amount} {currency}</span>;
        }
        return <span className="text-muted-foreground">-</span>;
      },
      enableHiding: true,
      enableGlobalFilter: false,
    },
    {
      id: "totalInclVat",
      accessorFn: (row) => {
        const parsed = row.parsed;
        if (!parsed) return null;
        const totals = (parsed as any)?.totals;
        return totals?.taxInclusiveAmount ? parseFloat(totals.taxInclusiveAmount) : null;
      },
      header: ({ column }) => <ColumnHeader column={column} title="Total Incl. VAT" />,
      meta: { label: "Total Incl. VAT" },
      cell: ({ row }) => {
        const parsed = row.original.parsed;
        if (!parsed) {
          return <span className="text-muted-foreground">-</span>;
        }
        const totals = (parsed as any)?.totals;
        if (totals?.taxInclusiveAmount) {
          const amount = String(totals.taxInclusiveAmount);
          const currency = (parsed as any)?.currency || "EUR";
          return <span className="font-mono">{amount} {currency}</span>;
        }
        return <span className="text-muted-foreground">-</span>;
      },
      enableHiding: true,
      enableGlobalFilter: false,
    },
    {
      accessorKey: "direction",
      header: ({ column }) => (
        <ColumnHeader column={column} title="Direction" />
      ),
      cell: ({ row }) => {
        const direction = row.getValue("direction") as string;
        return (
          <div className="flex items-center gap-1">
            {direction === "incoming" ? (
              <ArrowDown className="h-4 w-4" />
            ) : (
              <ArrowUp className="h-4 w-4" />
            )}
            <span className="capitalize">{direction}</span>
          </div>
        );
      },
      filterFn: "equals",
      enableGlobalFilter: true,
    },
    {
      accessorKey: "createdAt",
      header: ({ column }) => (
        <ColumnHeader column={column} title="Created At" />
      ),
      cell: ({ row }) => {
        const date = row.getValue("createdAt") as string;
        return format(new Date(date), "PPpp");
      },
      enableGlobalFilter: true,
    },
    {
      accessorKey: "readAt",
      header: ({ column }) => <ColumnHeader column={column} title="Read At" />,
      cell: ({ row }) => {
        const date = row.getValue("readAt") as string;
        return date ? (
          format(new Date(date), "PPpp")
        ) : (
          <p className="text-muted-foreground">-</p>
        );
      },
      enableGlobalFilter: true,
    },
    {
      id: "isUnread",
      accessorFn: (row) => (row.readAt === null ? "true" : "false"),
      header: () => null,
      cell: () => null,
      enableHiding: false,
      filterFn: (row, id, value) => {
        if (!value || value.length === 0) return true;
        const isUnread = row.original.readAt === null;
        return value.includes(isUnread ? "true" : "false");
      },
    },
    {
      accessorKey: "labels",
      header: ({ column }) => <ColumnHeader column={column} title="Labels" />,
      cell: ({ row }) => {
        const documentLabels = row.original.labels || [];
        const documentId = row.original.id;

        return (
          <div className="flex items-center gap-2 flex-wrap">
            {documentLabels.map((label) => (
              <Badge
                key={label.id}
                variant="outline"
                className="flex items-center justify-center gap-1 border-none"
                style={{ color: label.colorHex }}
              >
                <div
                  className="w-2 h-2 rounded-full shrink-0"
                  style={{ backgroundColor: label.colorHex }}
                />
                <span className="leading-none pt-0.5">{label.name}</span>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleUnassignLabel(documentId, label.id);
                  }}
                  className="ml-1 hover:bg-muted rounded p-0.5 flex items-center justify-center shrink-0"
                >
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            ))}
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="ghost" size="icon" title="Add label">
                  <Tag className="h-4 w-4" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-64 p-0" align="start">
                <div className="p-2">
                  <div className="text-sm font-medium mb-2">Assign Labels</div>
                  <div className="space-y-1 max-h-64 overflow-y-auto">
                    {labels
                      .filter((label) => !documentLabels.some((l) => l.id === label.id))
                      .map((label) => (
                        <button
                          key={label.id}
                          onClick={() => {
                            handleAssignLabel(documentId, label.id);
                          }}
                          className="w-full flex items-center gap-2 px-2 py-1.5 text-sm hover:bg-accent rounded-md text-left"
                        >
                          <div
                            className="w-3 h-3 rounded-full"
                            style={{ backgroundColor: label.colorHex }}
                          />
                          <span className="flex-1">{label.name}</span>
                        </button>
                      ))}
                    {labels.filter((label) => !documentLabels.some((l) => l.id === label.id)).length === 0 && (
                      <div className="text-sm text-muted-foreground px-2 py-1.5">
                        No available labels
                      </div>
                    )}
                  </div>
                </div>
              </PopoverContent>
            </Popover>
          </div>
        );
      },
      enableGlobalFilter: true,
    },
    {
      id: "actions",
      header: "",
      size: 100,
      cell: ({ row }) => {
        const id = row.original.id;
        if (!id) return null;

        const isRead = row.original.readAt !== null;

        return (
          <div className="flex items-center justify-end gap-2">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => handleToggleMarkAsRead(id, row.original.readAt)}
              title={isRead ? "Mark as unread" : "Mark as read"}
            >
              {isRead ? (
                <CheckCheck className="h-4 w-4 opacity-30" />
              ) : (
                <CheckCheck className="h-4 w-4" />
              )}
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => handleDownloadDocument(id)}
              title="Download document package"
            >
              <FolderArchive className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => handleDeleteDocument(id)}
              title="Delete document"
            >
              <Trash2 className="h-4 w-4 text-destructive" />
            </Button>
          </div>
        );
      },
    },
  ];

  const table = useReactTable({
    data: documents,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onColumnVisibilityChange: setColumnVisibility,
    state: {
      sorting,
      globalFilter,
      columnFilters,
      columnVisibility,
      pagination: {
        pageIndex: page - 1,
        pageSize: limit,
      },
    },
    onGlobalFilterChange: setGlobalFilter,
    onPaginationChange: (updater) => {
      if (typeof updater === "function") {
        const newState = updater({
          pageIndex: page - 1,
          pageSize: limit,
        });
        setPage(newState.pageIndex + 1);
        setLimit(newState.pageSize);
      }
    },
    pageCount: Math.ceil(total / limit),
    manualPagination: true,
    manualFiltering: true,
  });

  const filterConfigs: FilterConfig<TransmittedDocumentWithoutBody>[] = [
    {
      id: "companyId",
      title: "Company",
      options: companies.map((company) => ({
        label: company.name,
        value: company.id,
      })),
    },
    {
      id: "direction",
      title: "Direction",
      options: [
        { label: "Incoming", value: "incoming", icon: ArrowDown },
        { label: "Outgoing", value: "outgoing", icon: ArrowUp },
      ],
    },
    {
      id: "type",
      title: "Type",
      options: [
        { label: "Invoice", value: "invoice" },
        { label: "Credit Note", value: "creditNote" },
        { label: "Self Billing Invoice", value: "selfBillingInvoice" },
        { label: "Self Billing Credit Note", value: "selfBillingCreditNote" },
        { label: "Unknown", value: "unknown" },
      ],
    },
    {
      id: "isUnread",
      title: "Read Status",
      options: [
        { label: "Unread", value: "true", icon: Mail },
        { label: "Read", value: "false", icon: MailOpen },
      ],
    },
  ];

  return (
    <PageTemplate
      breadcrumbs={[{ label: "Peppol" }, { label: "Sent and received documents" }]}
      description="View and manage your transmitted Peppol documents."
      buttons={[
        <Button
          key="export"
          variant="outline"
          onClick={() => setIsExportDialogOpen(true)}
        >
          <Download className="h-4 w-4 mr-2" />
          Export
        </Button>,
        ...(isPlayground
          ? [
              <ConfirmDialog
                key="delete-all"
                title="Delete All Documents"
                description="Are you sure you want to delete all documents? This action cannot be undone. All documents in this playground will be permanently removed."
                confirmButtonText="Delete All"
                onConfirm={handleDeleteAllDocuments}
                isLoading={isDeletingAll}
                trigger={
                  <Button variant="destructive" disabled={isDeletingAll}>
                    {isDeletingAll ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Deleting...
                      </>
                    ) : (
                      <>
                        <Trash2 className="h-4 w-4 mr-2" />
                        Delete All
                      </>
                    )}
                  </Button>
                }
              />,
            ]
          : []),
      ]}
    >
      <div className="space-y-6">
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <>
            <DataTableToolbar
              table={table}
              searchPlaceholder="Search documents..."
              enableGlobalSearch
              filterColumns={filterConfigs}
            />
            <DataTable columns={columns} table={table} />
            <DataTablePagination table={table} />
          </>
        )}
      </div>
      <ExportDocumentsDialog
        open={isExportDialogOpen}
        onOpenChange={setIsExportDialogOpen}
      />
    </PageTemplate>
  );
}
