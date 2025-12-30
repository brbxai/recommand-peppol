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
import { useActiveTeam } from "@core/hooks/user";
import { useNavigate } from "react-router-dom";
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
import { Link } from "react-router-dom";
import { ConfirmDialog } from "@core/components/confirm-dialog";

const client = rc<Companies>("peppol");

// Utility function to handle API responses
const handleApiResponse = async (
  response: Response,
  successMessage: string
) => {
  const json = await response.json();
  if (!json.success) {
    toast.error(stringifyActionFailure(json.errors));
    throw new Error(stringifyActionFailure(json.errors));
  }else{
    toast.success(successMessage);
  }
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
  const navigate = useNavigate();
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
  const [deletingCompanyId, setDeletingCompanyId] = useState<string | null>(null);
  const activeTeam = useActiveTeam();

  const fetchCompanies = useCallback(async () => {
    if (!activeTeam?.id) {
      setCompanies([]);
      setIsLoading(false);
      return;
    }

    try {
      const response = await client[":teamId"]["companies"].$get({
        param: { teamId: activeTeam.id },
        query: {},
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

  const handleCompanySubmit = async () => {
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
      console.error("Error submitting company:", error);
    }
  };

  const handleDeleteCompany = async (id: string) => {
    if (!activeTeam?.id) return;

    try {
      setDeletingCompanyId(id);
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
      console.error("Error deleting company:", error);
    } finally {
      setDeletingCompanyId(null);
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
            <Link
              to={`/companies/${id}`}
              className="p-0 h-auto font-mono text-xs hover:underline"
            >
              {id.slice(0, 6)}...{id.slice(-6)}
            </Link>
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
    {
      accessorKey: "name",
      header: ({ column }) => <ColumnHeader column={column} title="Name" />,
      cell: ({ row }) => {
        const name = row.getValue("name") as string;
        const id = row.original.id;
        return (
          <Link
            to={`/companies/${id}`}
            className="p-0 h-auto font-normal text-left hover:underline"
          >
            {name}
          </Link>
        );
      },
      enableGlobalFilter: true,
    },
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
              onClick={() => navigate(`/companies/${id}`)}
              title="Edit"
            >
              <Pencil className="h-4 w-4" />
            </Button>
            <ConfirmDialog
              title="Delete Company"
              description="Are you sure you want to delete this company? This action cannot be undone."
              confirmButtonText="Delete"
              onConfirm={async () => await handleDeleteCompany(id)}
              isLoading={deletingCompanyId === id}
              variant="destructive"
              trigger={
                <Button
                  variant="ghost"
                  size="icon"
                  title="Delete"
                >
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              }
            />
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
              onSubmit={async () => await handleCompanySubmit()}
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
