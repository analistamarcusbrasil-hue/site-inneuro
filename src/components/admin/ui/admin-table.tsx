import type {
  HTMLAttributes,
  TableHTMLAttributes,
  TdHTMLAttributes,
  ThHTMLAttributes,
} from "react";
import { cn } from "@/lib/utils";

export function AdminTableContainer({
  className,
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "border-border-light overflow-x-auto rounded-2xl border bg-white",
        className,
      )}
      {...props}
    />
  );
}

export function AdminTable({
  className,
  ...props
}: TableHTMLAttributes<HTMLTableElement>) {
  return (
    <table
      className={cn(
        "w-full min-w-[44rem] border-collapse text-left",
        className,
      )}
      {...props}
    />
  );
}

export function AdminTableHeader({
  className,
  ...props
}: HTMLAttributes<HTMLTableSectionElement>) {
  return (
    <thead
      className={cn(
        "border-border-light bg-surface text-muted border-b text-xs font-bold tracking-[0.06em] uppercase",
        className,
      )}
      {...props}
    />
  );
}

export function AdminTableBody({
  className,
  ...props
}: HTMLAttributes<HTMLTableSectionElement>) {
  return (
    <tbody
      className={cn("divide-border-light divide-y", className)}
      {...props}
    />
  );
}

export function AdminTableRow({
  className,
  ...props
}: HTMLAttributes<HTMLTableRowElement>) {
  return (
    <tr
      className={cn("hover:bg-surface/70 transition-colors", className)}
      {...props}
    />
  );
}

export function AdminTableHead({
  className,
  ...props
}: ThHTMLAttributes<HTMLTableCellElement>) {
  return <th className={cn("h-11 px-4", className)} {...props} />;
}

export function AdminTableCell({
  className,
  ...props
}: TdHTMLAttributes<HTMLTableCellElement>) {
  return (
    <td
      className={cn("text-ink px-4 py-3 align-middle text-sm", className)}
      {...props}
    />
  );
}
