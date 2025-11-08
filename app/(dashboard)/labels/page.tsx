import { PageTemplate } from "@core/components/page-template";
import { rc } from "@recommand/lib/client";
import type { Labels } from "@peppol/api/labels";
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
import { Trash2, Loader2, Pencil, Copy } from "lucide-react";
import { ColumnHeader } from "@core/components/data-table/column-header";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@core/components/ui/dialog";
import { LabelForm } from "../../../components/label-form";
import type { Label, LabelFormData } from "../../../types/label";
import { defaultLabelFormData } from "../../../types/label";
import { DataTableToolbar } from "@core/components/data-table/toolbar";
import { DataTablePagination } from "@core/components/data-table/pagination";
import { AsyncButton } from "@core/components/async-button";

const client = rc<Labels>("peppol");

const handleApiResponse = async (
  response: Response,
  successMessage: string
) => {
  const json = await response.json();
  if (!json.success) {
    toast.error(stringifyActionFailure(json.errors));
    throw new Error(stringifyActionFailure(json.errors));
  } else {
    toast.success(successMessage);
  }
  return json;
};

const createColumn = (
  key: keyof Label,
  title: string
): ColumnDef<Label> => ({
  accessorKey: key,
  header: ({ column }) => <ColumnHeader column={column} title={title} />,
  cell: ({ row }) => (row.getValue(key) as string) ?? "N/A",
  enableGlobalFilter: true,
});

export default function Page() {
  const [labels, setLabels] = useState<Label[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [sorting, setSorting] = useState<SortingState>([]);
  const [globalFilter, setGlobalFilter] = useState("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [dialogMode, setDialogMode] = useState<"create" | "edit">("create");
  const [formData, setFormData] = useState<LabelFormData>(
    defaultLabelFormData
  );
  const [editingLabel, setEditingLabel] = useState<Label | null>(null);
  const activeTeam = useActiveTeam();

  const fetchLabels = useCallback(async () => {
    if (!activeTeam?.id) {
      setLabels([]);
      setIsLoading(false);
      return;
    }

    try {
      const response = await client[":teamId"]["labels"].$get({
        param: { teamId: activeTeam.id },
      });
      const json = await response.json();

      if (!json.success || !Array.isArray(json.labels)) {
        console.error("Invalid API response format:", json);
        toast.error("Failed to load labels");
        setLabels([]);
      } else {
        setLabels(json.labels);
      }
    } catch (error) {
      console.error("Error fetching labels:", error);
      toast.error("Failed to load labels");
      setLabels([]);
    } finally {
      setIsLoading(false);
    }
  }, [activeTeam?.id]);

  useEffect(() => {
    fetchLabels();
  }, [fetchLabels]);

  const handleLabelSubmit = async () => {
    if (!activeTeam?.id) {
      toast.error("No active team selected");
      return;
    }

    try {
      if (dialogMode === "create") {
        const response = await client[":teamId"]["labels"].$post({
          param: { teamId: activeTeam.id },
          json: formData,
        });

        const json = await handleApiResponse(
          response,
          "Label created successfully"
        );
        setLabels((prev) => [...prev, json.label]);
      } else if (editingLabel) {
        const response = await client[":teamId"]["labels"][
          ":labelId"
        ].$put({
          param: {
            teamId: activeTeam.id,
            labelId: editingLabel.id,
          },
          json: formData,
        });

        const json = await handleApiResponse(
          response,
          "Label updated successfully"
        );
        setLabels((prev) =>
          prev.map((label) =>
            label.id === editingLabel.id ? json.label : label
          )
        );
      }

      setFormData(defaultLabelFormData);
      setEditingLabel(null);
      setIsDialogOpen(false);
    } catch (error) {
      console.error("Error submitting label:", error);
    }
  };

  const handleDeleteLabel = async (id: string) => {
    if (!activeTeam?.id) return;

    try {
      const response = await client[":teamId"]["labels"][
        ":labelId"
      ].$delete({
        param: {
          teamId: activeTeam.id,
          labelId: id,
        },
      });
      await handleApiResponse(response, "Label deleted successfully");
      fetchLabels();
    } catch (error) {
      console.error("Error deleting label:", error);
    }
  };

  const columns: ColumnDef<Label>[] = [
    {
      accessorKey: "id",
      header: ({ column }) => <ColumnHeader column={column} title="ID" />,
      cell: ({ row }) => {
        const id = row.getValue("id") as string;
        return (
          <div className="flex items-center gap-2">
            <span className="font-mono text-xs">
              {id.slice(0, 6)}...{id.slice(-6)}
            </span>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => {
                navigator.clipboard.writeText(id);
                toast.success("Label ID copied to clipboard");
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
        const colorHex = row.original.colorHex;
        return (
          <div className="flex items-center gap-2">
            <div
              className="w-4 h-4 rounded-full"
              style={{ backgroundColor: colorHex }}
            />
            <span>{name}</span>
          </div>
        );
      },
      enableGlobalFilter: true,
    },
    {
      accessorKey: "colorHex",
      header: ({ column }) => <ColumnHeader column={column} title="Color" />,
      cell: ({ row }) => {
        const colorHex = row.getValue("colorHex") as string;
        return (
          <div className="flex items-center gap-2">
            <div
              className="w-6 h-6 rounded border border-border"
              style={{ backgroundColor: colorHex }}
            />
            <span className="font-mono text-xs">{colorHex}</span>
          </div>
        );
      },
      enableGlobalFilter: true,
    },
    createColumn("externalId", "External ID"),
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
                setEditingLabel(row.original);
                setFormData({
                  name: row.original.name,
                  colorHex: row.original.colorHex,
                  externalId: row.original.externalId,
                });
                setDialogMode("edit");
                setIsDialogOpen(true);
              }}
              title="Edit"
            >
              <Pencil className="h-4 w-4" />
            </Button>
            <AsyncButton
              variant="ghost"
              size="icon"
              onClick={async () => await handleDeleteLabel(id)}
              title="Delete"
            >
              <Trash2 className="h-4 w-4 text-destructive" />
            </AsyncButton>
          </div>
        );
      },
    },
  ];

  const table = useReactTable({
    data: labels,
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
      breadcrumbs={[{ label: "Peppol" }, { label: "Labels" }]}
      description="Manage labels for organizing and categorizing your data."
      buttons={[
        <Dialog
          key="create-label-dialog"
          open={isDialogOpen}
          onOpenChange={setIsDialogOpen}
        >
          <DialogTrigger asChild>
            <Button
              onClick={() => {
                setDialogMode("create");
                setFormData(defaultLabelFormData);
                setEditingLabel(null);
              }}
            >
              Create Label
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[600px]">
            <DialogHeader>
              <DialogTitle>
                {dialogMode === "create"
                  ? "Create New Label"
                  : "Edit Label"}
              </DialogTitle>
            </DialogHeader>
            <LabelForm
              label={formData}
              onChange={(data) => setFormData(data as LabelFormData)}
              onSubmit={async () => await handleLabelSubmit()}
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

