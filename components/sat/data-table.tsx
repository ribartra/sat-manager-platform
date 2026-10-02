"use client";

import {
  flexRender,
  getCoreRowModel,
  useReactTable,
  type ColumnDef,
  type Row,
} from "@tanstack/react-table";
import { cn } from "@/lib/utils";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/sat/empty-state";

export type DataTableResponsiveStrategy = "scroll" | "priority";
export type DataTableDensity = "comfortable" | "compact";
export type ColumnPriority = "high" | "medium" | "low";

export type DataTableColumnMeta = {
  /** Used when responsiveStrategy="priority". */
  priority?: ColumnPriority;
  align?: "left" | "right" | "center";
  headerClassName?: string;
  cellClassName?: string;
};

declare module "@tanstack/react-table" {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars, @typescript-eslint/no-empty-object-type -- module augmentation must be an interface
  interface ColumnMeta<TData, TValue> extends DataTableColumnMeta {}
}

const PRIORITY_HIDE: Record<ColumnPriority, string> = {
  high: "",
  medium: "hidden sm:table-cell",
  low: "hidden md:table-cell",
};

const ALIGN: Record<"left" | "right" | "center", string> = {
  left: "text-left",
  right: "text-right",
  center: "text-center",
};

interface DataTableProps<TData> {
  columns: ColumnDef<TData, unknown>[];
  data: TData[];
  responsiveStrategy?: DataTableResponsiveStrategy;
  density?: DataTableDensity;
  emptyTitle?: string;
  emptyDescription?: string;
  getRowId?: (originalRow: TData, index: number, parent?: Row<TData>) => string;
  className?: string;
}

export function DataTable<TData>({
  columns,
  data,
  responsiveStrategy = "scroll",
  density = "comfortable",
  emptyTitle = "No results",
  emptyDescription,
  getRowId,
  className,
}: DataTableProps<TData>) {
  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getRowId,
  });

  const cellPad = density === "compact" ? "px-3 py-2" : "px-4 py-3";

  if (data.length === 0) {
    return (
      <Card className={cn("overflow-hidden", className)}>
        <EmptyState title={emptyTitle} description={emptyDescription} className="border-0 bg-transparent" />
      </Card>
    );
  }

  return (
    <Card className={cn("overflow-hidden", className)}>
      <div className={cn(responsiveStrategy === "scroll" || responsiveStrategy === "priority" ? "w-full overflow-x-auto" : "")}>
        <table className="w-full text-sm">
          <thead>
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id} className="border-b border-border bg-muted">
                {headerGroup.headers.map((header) => {
                  const meta = header.column.columnDef.meta;
                  const priority = meta?.priority ?? "high";
                  const align = meta?.align ?? "left";
                  return (
                    <th
                      key={header.id}
                      className={cn(
                        cellPad,
                        "font-medium text-muted-foreground",
                        ALIGN[align],
                        responsiveStrategy === "priority" ? PRIORITY_HIDE[priority] : "",
                        meta?.headerClassName,
                      )}
                    >
                      {header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}
                    </th>
                  );
                })}
              </tr>
            ))}
          </thead>
          <tbody className="divide-y divide-border">
            {table.getRowModel().rows.map((row) => (
              <tr key={row.id} className="hover:bg-muted/60">
                {row.getVisibleCells().map((cell) => {
                  const meta = cell.column.columnDef.meta;
                  const priority = meta?.priority ?? "high";
                  const align = meta?.align ?? "left";
                  return (
                    <td
                      key={cell.id}
                      className={cn(
                        cellPad,
                        ALIGN[align],
                        responsiveStrategy === "priority" ? PRIORITY_HIDE[priority] : "",
                        meta?.cellClassName,
                      )}
                    >
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
