import { PageTemplate } from "@core/components/page-template";
import { rc } from "@recommand/lib/client";
import type { Companies } from "@peppol/api/companies";
import { useEffect, useState, useCallback } from "react";
import { DataTable } from "@core/components/data-table";
import {
  type ColumnDef,
  getCoreRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  useReactTable,
} from "@tanstack/react-table";
import type { SortingState } from "@tanstack/react-table";
import { Button } from "@core/components/ui/button";
import { toast } from "@core/components/ui/sonner";
import { stringifyActionFailure } from "@recommand/lib/utils";
import { useUser } from "@core/hooks/use-user";
import { Trash2, Loader2, Pencil, Copy } from "lucide-react";
import { ColumnHeader } from "@core/components/data-table/column-header";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@core/components/ui/dialog";
import { CompanyForm } from "../../../components/company-form";
import type { Company, CompanyFormData } from "../../../types/company";
import { defaultCompanyFormData } from "../../../types/company";
import { DataTableToolbar } from "@core/components/data-table/toolbar";
import { DataTablePagination } from "@core/components/data-table/pagination";

const client = rc<Companies>("peppol");

// Utility function to handle API responses
const handleApiResponse = async (
  response: Response,
  successMessage: string
) => {
  const json = await response.json();
  if (!json.success) {
    throw new Error(
      "Invalid response format: " + stringifyActionFailure(json.errors)
    );
  }
  toast.success(successMessage);
  return json;
};

// Utility function to create column definition
const createColumn = (
  key: keyof Company,
  title: string
): ColumnDef<Company> => ({
  accessorKey: key,
  header: ({ column }) => <ColumnHeader column={column} title={title} />,
  cell: ({ row }) => (row.getValue(key) as string) ?? "N/A",
  enableGlobalFilter: true,
});

export default function Page() {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [sorting, setSorting] = useState<SortingState>([]);
  const [globalFilter, setGlobalFilter] = useState("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [dialogMode, setDialogMode] = useState<"create" | "edit">("create");
  const [formData, setFormData] = useState<CompanyFormData>(
    defaultCompanyFormData
  );
  const [editingCompany, setEditingCompany] = useState<Company | null>(null);
  const { activeTeam } = useUser();

  const fetchCompanies = useCallback(async () => {
    if (!activeTeam?.id) {
      setCompanies([]);
      setIsLoading(false);
      return;
    }

    try {
      const response = await client[":teamId"]["companies"].$get({
        param: { teamId: activeTeam.id },
      });
      const json = await response.json();

      if (!json.success || !Array.isArray(json.companies)) {
        console.error("Invalid API response format:", json);
        toast.error("Failed to load companies");
        setCompanies([]);
      } else {
        setCompanies(json.companies);
      }
    } catch (error) {
      console.error("Error fetching companies:", error);
      toast.error("Failed to load companies");
      setCompanies([]);
    } finally {
      setIsLoading(false);
    }
  }, [activeTeam?.id]);

  useEffect(() => {
    fetchCompanies();
  }, [fetchCompanies]);

  const handleCompanySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeTeam?.id) {
      toast.error("No active team selected");
      return;
    }

    try {
      console.log("dialogMode", dialogMode);
      if (dialogMode === "create") {
        const response = await client[":teamId"]["companies"].$post({
          param: { teamId: activeTeam.id },
          json: formData,
        });

        const json = await handleApiResponse(
          response,
          "Company created successfully"
        );
        setCompanies((prev) => [...prev, json.company]);
      } else if (editingCompany) {
        console.log("editingCompany", editingCompany);
        const response = await client[":teamId"]["companies"][
          ":companyId"
        ].$put({
          param: {
            teamId: activeTeam.id,
            companyId: editingCompany.id,
          },
          json: {
            ...formData,
            vatNumber: formData.vatNumber || undefined,
          },
        });

        const json = await handleApiResponse(
          response,
          "Company updated successfully"
        );
        setCompanies((prev) =>
          prev.map((company) =>
            company.id === editingCompany.id ? json.company : company
          )
        );
      }

      setFormData(defaultCompanyFormData);
      setEditingCompany(null);
      setIsDialogOpen(false);
    } catch (error) {
      toast.error(
        `Failed to ${dialogMode === "create" ? "create" : "update"} company`
      );
    }
  };

  const handleDeleteCompany = async (id: string) => {
    if (!activeTeam?.id) return;

    try {
      const response = await client[":teamId"]["companies"][
        ":companyId"
      ].$delete({
        param: {
          teamId: activeTeam.id,
          companyId: id,
        },
      });
      await handleApiResponse(response, "Company deleted successfully");
      fetchCompanies();
    } catch (error) {
      toast.error("Failed to delete company");
    }
  };

  const columns: ColumnDef<Company>[] = [
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
                toast.success("Company ID copied to clipboard");
              }}
            >
              <Copy className="h-4 w-4" />
            </Button>
          </div>
        );
      },
      enableGlobalFilter: true,
    },
    createColumn("name", "Name"),
    createColumn("enterpriseNumber", "Enterprise Number"),
    createColumn("city", "City"),
    createColumn("country", "Country"),
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
              onClick={() => {
                setEditingCompany(row.original);
                setFormData(row.original);
                setDialogMode("edit");
                setIsDialogOpen(true);
              }}
            >
              <Pencil className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => handleDeleteCompany(id)}
            >
              <Trash2 className="h-4 w-4 text-destructive" />
            </Button>
          </div>
        );
      },
    },
  ];

  const table = useReactTable({
    data: companies,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    onSortingChange: setSorting,
    state: {
      sorting,
      globalFilter,
    },
    onGlobalFilterChange: setGlobalFilter,
  });

  return (
    <PageTemplate
      breadcrumbs={[{ label: "Peppol" }, { label: "Companies" }]}
      description="Add all companies for which you want to send or receive Peppol documents."
      buttons={[
        <Dialog
          key="create-company-dialog"
          open={isDialogOpen}
          onOpenChange={setIsDialogOpen}
        >
          <DialogTrigger asChild>
            <Button
              onClick={() => {
                setDialogMode("create");
                setFormData(defaultCompanyFormData);
                setEditingCompany(null);
              }}
            >
              Create Company
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[600px]">
            <DialogHeader>
              <DialogTitle>
                {dialogMode === "create"
                  ? "Create New Company"
                  : "Edit Company"}
              </DialogTitle>
            </DialogHeader>
            <CompanyForm
              company={formData}
              onChange={(data) => setFormData(data as CompanyFormData)}
              onSubmit={handleCompanySubmit}
              onCancel={() => setIsDialogOpen(false)}
              isEditing={dialogMode === "edit"}
            />
          </DialogContent>
        </Dialog>,
      ]}
    >
      <div className="space-y-6">
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="space-y-4">
            <DataTableToolbar table={table} enableGlobalSearch />
            <DataTable columns={columns} table={table} />
            <DataTablePagination table={table} />
          </div>
        )}
      </div>
    </PageTemplate>
  );
}
