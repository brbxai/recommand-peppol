import { PageTemplate } from "@core/components/page-template";
import { rc } from "@recommand/lib/client";
import { useEffect, useState, useCallback } from "react";
import { DataTable } from "@core/components/data-table";
import { type ColumnDef, getCoreRowModel, getSortedRowModel, getFilteredRowModel, useReactTable } from "@tanstack/react-table";
import type { SortingState } from "@tanstack/react-table";
import { Button } from "@core/components/ui/button";
import { toast } from "@core/components/ui/sonner";
import { useUser } from "@core/hooks/use-user";
import { Trash2, Loader2, Copy, ArrowDown, ArrowUp } from "lucide-react";
import { SortableHeader } from "@core/components/data-table/sortable-header";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@core/components/ui/select";
import { Input } from "@core/components/ui/input";
import { Label } from "@core/components/ui/label";
import { format } from "date-fns";
import { stringifyActionFailure } from "@recommand/lib/utils";
import type { TransmittedDocumentWithoutBody } from "@peppol/data/transmitted-documents";
import type { TransmittedDocuments } from "@peppol/api/transmitted-documents";
import type { Companies } from "@peppol/api/companies";
import { DataTablePagination } from "@core/components/data-table/pagination";

const client = rc<TransmittedDocuments>('peppol');
const companiesClient = rc<Companies>('peppol');

export default function Page() {
  const [documents, setDocuments] = useState<TransmittedDocumentWithoutBody[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [sorting, setSorting] = useState<SortingState>([]);
  const [globalFilter, setGlobalFilter] = useState("");
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [total, setTotal] = useState(0);
  const [companyId, setCompanyId] = useState<string | undefined>();
  const [direction, setDirection] = useState<"incoming" | "outgoing" | "all" | undefined>("all");
  const [companies, setCompanies] = useState<{ id: string; name: string }[]>([]);
  const { activeTeam } = useUser();

  const fetchCompanies = useCallback(async () => {
    if (!activeTeam?.id) {
      setCompanies([]);
      return;
    }

    try {
      const response = await companiesClient[':teamId']['companies'].$get({
        param: { teamId: activeTeam.id }
      });
      const json = await response.json();

      if (!json.success || !Array.isArray(json.companies)) {
        toast.error('Failed to load companies');
        setCompanies([]);
      } else {
        setCompanies(json.companies.map((company: { id: string; name: string }) => ({
          id: company.id,
          name: company.name
        })));
      }
    } catch (error) {
      toast.error('Failed to load companies');
      setCompanies([]);
    }
  }, [activeTeam?.id]);

  const fetchDocuments = useCallback(async () => {
    if (!activeTeam?.id) {
      setDocuments([]);
      setIsLoading(false);
      return;
    }

    try {
      const response = await client[':teamId']['documents'].$get({
        param: { teamId: activeTeam.id },
        query: { 
          page: page.toString(), 
          limit: limit.toString(), 
          companyId, 
          direction: direction === "all" ? undefined : direction 
        }
      });
      const json = await response.json();

      if (!json.success) {
        console.error('Invalid API response format:', json);
        toast.error('Failed to load documents');
        setDocuments([]);
      } else {
        setDocuments(json.documents.map(doc => ({
          ...doc,
          readAt: doc.readAt ? new Date(doc.readAt) : null,
          createdAt: new Date(doc.createdAt)
        })));
        setTotal(json.pagination.total);
      }
    } catch (error) {
      console.error('Error fetching documents:', error);
      toast.error('Failed to load documents');
      setDocuments([]);
    } finally {
      setIsLoading(false);
    }
  }, [activeTeam?.id, page, limit, companyId, direction]);

  useEffect(() => {
    fetchCompanies();
    fetchDocuments();
  }, [fetchCompanies, fetchDocuments]);

  const handleDeleteDocument = async (id: string) => {
    if (!activeTeam?.id) return;

    try {
      const response = await client[':teamId']['documents'][':documentId'].$delete({
        param: {
          teamId: activeTeam.id,
          documentId: id
        }
      });
      const json = await response.json();
      if (!json.success) {
        throw new Error(stringifyActionFailure(json.errors));
      }
      toast.success('Document deleted successfully');
      fetchDocuments();
    } catch (error) {
      toast.error('Failed to delete document');
    }
  };

  const columns: ColumnDef<TransmittedDocumentWithoutBody>[] = [
    {
      accessorKey: "id",
      header: ({ column }) => <SortableHeader column={column} title="ID" />,
      cell: ({ row }) => {
        const id = row.getValue("id") as string;
        return <div className="flex items-center gap-2">
          <pre className="font-mono text-xs">{id.slice(0, 6)}...{id.slice(-6)}</pre>
          <Button variant="ghost" size="icon" onClick={() => {
            navigator.clipboard.writeText(id);
            toast.success('Document ID copied to clipboard');
          }}><Copy className="h-4 w-4" /></Button>
        </div>;
      },
      enableGlobalFilter: true,
    },
    {
      id: "company",
      header: ({ column }) => <SortableHeader column={column} title="Company" />,
      cell: ({ row }) => {
        const companyId = row.original.companyId;
        const company = companies.find(c => c.id === companyId);
        return company?.name;
      },
      enableGlobalFilter: true,
    },
    {
      accessorKey: "senderId",
      header: ({ column }) => <SortableHeader column={column} title="Sender" />,
      enableGlobalFilter: true,
    },
    {
      accessorKey: "receiverId",
      header: ({ column }) => <SortableHeader column={column} title="Receiver" />,
      enableGlobalFilter: true,
    },
    {
      accessorKey: "direction",
      header: ({ column }) => <SortableHeader column={column} title="Direction" />,
      cell: ({ row }) => {
        const direction = row.getValue("direction") as string;
        return <div className="flex items-center gap-1">
          {direction === 'incoming' ? (
            <ArrowDown className="h-4 w-4" style={{ color: '#5189DD' }} />
          ) : (
            <ArrowUp className="h-4 w-4 text-secondary" />
          )}
          <span className="capitalize">{direction}</span>
        </div>;
      },
      enableGlobalFilter: true,
    },
    {
      accessorKey: "createdAt",
      header: ({ column }) => <SortableHeader column={column} title="Created At" />,
      cell: ({ row }) => {
        const date = row.getValue("createdAt") as string;
        return format(new Date(date), 'PPpp');
      },
      enableGlobalFilter: true,
    },
    {
      accessorKey: "readAt",
      header: ({ column }) => <SortableHeader column={column} title="Read At" />,
      cell: ({ row }) => {
        const date = row.getValue("readAt") as string;
        return date ? format(new Date(date), 'PPpp') : <p className="text-muted-foreground">Not read</p>;
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

        return <div className="flex items-center justify-end gap-2">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => handleDeleteDocument(id)}
          >
            <Trash2 className="h-4 w-4 text-destructive" />
          </Button>
        </div>;
      },
    },
  ];

  const table = useReactTable({
    data: documents,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    onSortingChange: setSorting,
    state: {
      sorting,
      globalFilter,
      pagination: {
        pageIndex: page - 1,
        pageSize: limit,
      },
    },
    onGlobalFilterChange: setGlobalFilter,
    onPaginationChange: (updater) => {
      if (typeof updater === 'function') {
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
  });

  return <PageTemplate
    breadcrumbs={[
      { label: "Peppol" },
      { label: "Transmitted Documents" },
    ]}
    description="View and manage your transmitted Peppol documents."
  >
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center">
        <div className="flex-1">
          <Label htmlFor="search">Search</Label>
          <Input
            id="search"
            placeholder="Search documents..."
            value={globalFilter}
            onChange={(e) => setGlobalFilter(e.target.value)}
          />
        </div>
        <div className="flex gap-4">
          <div>
            <Label htmlFor="direction">Direction</Label>
            <Select
              value={direction}
              onValueChange={(value) => setDirection(value as "incoming" | "outgoing" | "all" | undefined)}
            >
              <SelectTrigger>
                <SelectValue placeholder="All directions" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="incoming">Incoming</SelectItem>
                <SelectItem value="outgoing">Outgoing</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="company">Company</Label>
            <Select
              value={companyId || "all"}
              onValueChange={(value) => setCompanyId(value === "all" ? undefined : value)}
            >
              <SelectTrigger>
                <SelectValue placeholder="All companies" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All companies</SelectItem>
                {companies.map((company) => (
                  <SelectItem key={company.id} value={company.id}>
                    {company.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <>
          <DataTable columns={columns} table={table} showSearch={false} />
          <DataTablePagination table={table} />
        </>
      )}
    </div>
  </PageTemplate>
} 