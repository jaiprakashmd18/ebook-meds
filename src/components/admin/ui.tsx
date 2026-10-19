import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";

export function AdminHeader({ title, description, actions }: { title: string; description?: string; actions?: React.ReactNode }) {
  return (
    <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        {description ? <p className="mt-1 text-sm text-muted-foreground">{description}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
    </div>
  );
}

export function Panel({ title, description, children, className }: { title?: string; description?: string; children: React.ReactNode; className?: string }) {
  return (
    <section className={cn("rounded-[var(--radius-lg)] border border-border bg-background p-5", className)}>
      {title ? <h2 className="font-semibold">{title}</h2> : null}
      {description ? <p className="mt-0.5 text-sm text-muted-foreground">{description}</p> : null}
      <div className={title || description ? "mt-4" : undefined}>{children}</div>
    </section>
  );
}

export function DataTable({ head, children, empty }: { head: string[]; children: React.ReactNode; empty?: boolean }) {
  return (
    <div className="overflow-x-auto rounded-[var(--radius-lg)] border border-border bg-background">
      <table className="w-full min-w-[640px] text-left text-sm">
        <thead className="border-b border-border bg-surface text-xs text-muted-foreground">
          <tr>{head.map((h) => <th key={h} scope="col" className="px-4 py-2.5 font-medium">{h}</th>)}</tr>
        </thead>
        <tbody className="divide-y divide-border">{children}</tbody>
      </table>
      {empty ? <p className="px-4 py-10 text-center text-sm text-muted-foreground">Nothing here yet.</p> : null}
    </div>
  );
}

const STATUS_TONES: Record<string, "neutral" | "accent" | "success" | "warning" | "danger"> = {
  draft: "neutral",
  review: "warning",
  published: "success",
  archived: "neutral",
  pending: "warning",
  paid: "success",
  failed: "danger",
  cancelled: "neutral",
  refunded: "danger",
  partially_refunded: "warning",
  open: "warning",
  in_review: "accent",
  resolved: "success",
  rejected: "neutral",
  approved: "success",
  removed: "danger",
  active: "success",
  revoked: "danger",
};

export function StatusBadge({ status }: { status: string }) {
  return <Badge tone={STATUS_TONES[status] ?? "neutral"}>{status.replace(/_/g, " ")}</Badge>;
}
