import { PageTemplate } from "@core/components/page-template";
import { rc } from "@recommand/lib/client";
import type { Webhooks } from "@peppol/api/webhooks";
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
import { Trash2, Loader2, Pencil, Copy, Search } from "lucide-react";
import { ColumnHeader } from "@core/components/data-table/column-header";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@core/components/ui/dialog";
import { Input } from "@core/components/ui/input";
import type { Company } from "../../../types/company";
import type { Webhook, WebhookFormData } from "../../../types/webhook";
import { defaultWebhookFormData } from "../../../types/webhook";
import { WebhookForm } from "../../../components/webhook-form";
import { CompanyDropdown } from "../../../components/company-dropdown";
import { Label } from "@core/components/ui/label";

const client = rc<Webhooks>("v1");
const companiesClient = rc<Companies>("v1");

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

// Webhook actions component
const WebhookActions = ({
  id,
  onEdit,
  onDelete,
}: {
  id: string;
  onEdit: () => void;
  onDelete: () => void;
}) => (
  <div className="flex items-center justify-end gap-2">
    <Button variant="ghost" size="icon" onClick={onEdit}>
      <Pencil className="h-4 w-4" />
    </Button>
    <Button variant="ghost" size="icon" onClick={onDelete}>
      <Trash2 className="h-4 w-4 text-destructive" />
    </Button>
  </div>
);

export default function Page() {
  const activeTeam = useActiveTeam();
  const [webhooks, setWebhooks] = useState<Webhook[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [sorting, setSorting] = useState<SortingState>([]);
  const [globalFilter, setGlobalFilter] = useState("");
  const [companyFilter, setCompanyFilter] = useState<string | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [dialogMode, setDialogMode] = useState<"create" | "edit">("create");
  const [formData, setFormData] = useState<WebhookFormData>(
    defaultWebhookFormData
  );
  const [editingWebhook, setEditingWebhook] = useState<Webhook | null>(null);

  const fetchData = useCallback(async () => {
    if (!activeTeam?.id) {
      setWebhooks([]);
      setCompanies([]);
      setIsLoading(false);
      return;
    }

    try {
      const [webhooksResponse, companiesResponse] = await Promise.all([
        client[":teamId"]["webhooks"].$get({
          param: { teamId: activeTeam.id },
          query: { companyId: companyFilter || undefined },
        }),
        companiesClient[":teamId"]["companies"].$get({
          param: { teamId: activeTeam.id },
        }),
      ]);

      const [webhooksJson, companiesJson] = await Promise.all([
        webhooksResponse.json(),
        companiesResponse.json(),
      ]);

      if (webhooksJson.success && Array.isArray(webhooksJson.webhooks)) {
        setWebhooks(webhooksJson.webhooks);
      }
      if (companiesJson.success && Array.isArray(companiesJson.companies)) {
        setCompanies(companiesJson.companies);
      }
    } catch (error) {
      console.error("Error fetching data:", error);
      toast.error("Failed to load data");
    } finally {
      setIsLoading(false);
    }
  }, [activeTeam?.id, companyFilter]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleWebhookSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeTeam?.id) {
      toast.error("No active team selected");
      return;
    }

    try {
      const response =
        dialogMode === "create"
          ? await client[":teamId"]["webhooks"].$post({
            param: { teamId: activeTeam.id },
            json: formData,
          })
          : await client[":teamId"]["webhooks"][":webhookId"].$put({
            param: {
              teamId: activeTeam.id,
              webhookId: editingWebhook!.id,
            },
            json: formData,
          });

      const json = await handleApiResponse(
        response,
        `Webhook ${dialogMode === "create" ? "created" : "updated"
        } successfully`
      );

      setWebhooks((prev) =>
        dialogMode === "create"
          ? [...prev, json.webhook]
          : prev.map((webhook) =>
            webhook.id === editingWebhook!.id ? json.webhook : webhook
          )
      );

      setFormData(defaultWebhookFormData);
      setEditingWebhook(null);
      setIsDialogOpen(false);
    } catch (error) {
      toast.error(
        `Failed to ${dialogMode === "create" ? "create" : "update"} webhook`
      );
    }
  };

  const handleDeleteWebhook = async (id: string) => {
    if (!activeTeam?.id) return;

    try {
      const response = await client[":teamId"]["webhooks"][
        ":webhookId"
      ].$delete({
        param: {
          teamId: activeTeam.id,
          webhookId: id,
        },
      });
      await handleApiResponse(response, "Webhook deleted successfully");
      setWebhooks((prev) => prev.filter((webhook) => webhook.id !== id));
    } catch (error) {
      toast.error("Failed to delete webhook");
    }
  };

  const getCompanyName = (companyId: string | null) => {
    if (!companyId) return "All companies";
    const company = companies.find((c) => c.id === companyId);
    return company ? company.name : "Unknown Company";
  };

  const columns: ColumnDef<Webhook>[] = [
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
                toast.success("Webhook ID copied to clipboard");
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
      accessorKey: "url",
      header: ({ column }) => <ColumnHeader column={column} title="URL" />,
      cell: ({ row }) => (row.getValue("url") as string) ?? "N/A",
      enableGlobalFilter: true,
    },
    {
      accessorKey: "companyId",
      header: ({ column }) => <ColumnHeader column={column} title="Company" />,
      cell: ({ row }) => getCompanyName(row.getValue("companyId")),
      enableGlobalFilter: true,
      filterFn: (row, id, value) => {
        if (!value) return true;
        return row.getValue(id) === value;
      },
    },
    {
      id: "actions",
      header: "",
      size: 100,
      cell: ({ row }) => {
        const id = row.original.id;
        if (!id) return null;

        return (
          <WebhookActions
            id={id}
            onEdit={() => {
              setEditingWebhook(row.original);
              setFormData({
                url: row.original.url,
                companyId: row.original.companyId || undefined,
              });
              setDialogMode("edit");
              setIsDialogOpen(true);
            }}
            onDelete={() => handleDeleteWebhook(id)}
          />
        );
      },
    },
  ];

  const table = useReactTable({
    data: webhooks,
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
    filterFns: {
      companyFilter: (row, id, value) => {
        if (!value) return true;
        return row.getValue(id) === value;
      },
    },
  });

  return (
    <PageTemplate
      breadcrumbs={[{ label: "Peppol" }, { label: "Webhooks" }]}
      description="Configure webhooks to receive notifications about Peppol document events."
      buttons={[
        <Dialog
          key="create-webhook-dialog"
          open={isDialogOpen}
          onOpenChange={setIsDialogOpen}
        >
          <DialogTrigger asChild>
            <Button
              onClick={() => {
                setDialogMode("create");
                setFormData(defaultWebhookFormData);
                setEditingWebhook(null);
              }}
            >
              Create Webhook
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[600px]">
            <DialogHeader>
              <DialogTitle>
                {dialogMode === "create"
                  ? "Create New Webhook"
                  : "Edit Webhook"}
              </DialogTitle>
            </DialogHeader>
            <WebhookForm
              formData={formData}
              companies={companies}
              onChange={(data) => setFormData(data as WebhookFormData)}
              onSubmit={handleWebhookSubmit}
              onCancel={() => setIsDialogOpen(false)}
              isEditing={dialogMode === "edit"}
            />
          </DialogContent>
        </Dialog>,
      ]}
    >
      <div className="space-y-6">
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Label htmlFor="search">Search</Label>
            <div className="relative">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                id="search"
                placeholder="Search webhooks..."
                value={globalFilter ?? ""}
                onChange={(event) =>
                  setGlobalFilter(String(event.target.value))
                }
                className="pl-8"
              />
            </div>
          </div>
          <CompanyDropdown
            companies={companies}
            value={companyFilter}
            onChange={setCompanyFilter}
          />
        </div>
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <DataTable columns={columns} table={table} />
        )}
      </div>
    </PageTemplate>
  );
}
