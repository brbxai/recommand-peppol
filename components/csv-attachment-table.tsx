import { useMemo } from "react";
import { DataTable } from "@core/components/data-table";
import {
  getCoreRowModel,
  useReactTable,
  type ColumnDef,
} from "@tanstack/react-table";
import { buildCsvTableData, type CsvRow } from "@peppol/utils/csv";

interface CsvAttachmentTableProps {
  csv: string;
}

export function CsvAttachmentTable({ csv }: CsvAttachmentTableProps) {
  const { columns, data } = useMemo(
    () => buildCsvTableData(csv),
    [csv],
  ) as {
    columns: ColumnDef<CsvRow>[];
    data: CsvRow[];
  };

  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
  });

  return <DataTable columns={columns} table={table} />;
}


