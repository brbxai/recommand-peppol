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
} from "@tanstack/react-table";
import type { SortingState } from "@tanstack/react-table";
import { Button } from "@core/components/ui/button";
import { toast } from "@core/components/ui/sonner";
import { useActiveTeam } from "@core/hooks/user";
import { Trash2, Loader2, Copy, ArrowDown, ArrowUp, FolderArchive } from "lucide-react";
import { ColumnHeader } from "@core/components/data-table/column-header";
import { format } from "date-fns";
import { stringifyActionFailure } from "@recommand/lib/utils";
import type { TransmittedDocumentWithoutBody } from "@peppol/data/transmitted-documents";
import type { TransmittedDocuments } from "@peppol/api/transmitted-documents";
import type { Companies } from "@peppol/api/companies";
import { DataTablePagination } from "@core/components/data-table/pagination";
import {
  DataTableToolbar,
  type FilterConfig,
} from "@core/components/data-table/toolbar";
import { PartyInfoTooltip } from "@peppol/components/party-info-tooltip";
import { TransmissionStatusIcons } from "@peppol/components/transmission-status-icons";

const client = rc<TransmittedDocuments>("peppol");
const companiesClient = rc<Companies>("peppol");

export default function Page() {
  const [documents, setDocuments] = useState<TransmittedDocumentWithoutBody[]>(
    []
  );
  const [isLoading, setIsLoading] = useState(true);
  const [sorting, setSorting] = useState<SortingState>([]);
  const [globalFilter, setGlobalFilter] = useState("");
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [total, setTotal] = useState(0);
  const [companies, setCompanies] = useState<{ id: string; name: string }[]>([]);
  const activeTeam = useActiveTeam();

  const fetchCompanies = useCallback(async () => {
    if (!activeTeam?.id) {
      setCompanies([]);
      return;
    }

    try {
      const response = await companiesClient[":teamId"]["companies"].$get({
        param: { teamId: activeTeam.id },
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

    try {
      const response = await client[":teamId"]["documents"].$get({
        param: { teamId: activeTeam.id },
        query: {
          page: page.toString(),
          limit: limit.toString(),
          companyId: filteredCompanyIds,
          direction: (filteredDirectionValues.length === 0 || filteredDirectionValues.length > 1) ? undefined : filteredDirectionValues[0], // When no or all options are selected, don't filter on direction
          search: globalFilter || undefined, // Add the global search term to the query
          type: (filteredTypeValues.length === 0 || filteredTypeValues.length > 1) ? undefined : filteredTypeValues[0], // When no or all options are selected, don't filter on type
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

  useEffect(() => {
    fetchCompanies();
  }, [fetchCompanies]);

  useEffect(() => {
    fetchDocuments();
  }, [fetchDocuments]);

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

  const handleDownloadDocument = async (id: string) => {
    if (!activeTeam?.id) return;

    try {
      const response = await client[":teamId"]["documents"][":documentId"]["downloadPackage"].$get({
        param: {
          teamId: activeTeam.id,
          documentId: id,
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

  const columns: ColumnDef<TransmittedDocumentWithoutBody>[] = [
    {
      accessorKey: "id",
      header: ({ column }) => <ColumnHeader column={column} title="ID" />,
      cell: ({ row }) => {
        const id = row.getValue("id") as string;
        return (
          <div className="flex items-center gap-2">
            <pre className="font-mono text-xs">
              {id.slice(0, 6)}...{id.slice(-6)}
            </pre>
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
            ? (document.parsed as any)?.seller 
            : (document.parsed as any)?.buyer;
          
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
        const direction = document.direction;
        const sentOverPeppol = document.sentOverPeppol;
        const sentOverEmail = document.sentOverEmail;
        const emailRecipients = document.emailRecipients;
        
        // Check if document type is recognized and has parsed data
        const isRecognizedType = ["invoice", "creditNote", "selfBillingInvoice", "selfBillingCreditNote"].includes(documentType);
        
        if (isRecognizedType && document.parsed) {
          // For incoming documents, receiver is the buyer
          // For outgoing documents, receiver is the seller
          const receiverInfo = direction === "incoming" 
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
      id: "actions",
      header: "",
      size: 100,
      cell: ({ row }) => {
        const id = row.original.id;
        if (!id) return null;

        return (
          <div className="flex items-center justify-end gap-2">
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
    state: {
      sorting,
      globalFilter,
      columnFilters,
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
  ];

  return (
    <PageTemplate
      breadcrumbs={[{ label: "Peppol" }, { label: "Sent and received documents" }]}
      description="View and manage your transmitted Peppol documents."
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
    </PageTemplate>
  );
}
