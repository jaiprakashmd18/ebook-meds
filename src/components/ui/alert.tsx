import * as React from "react";
import { AlertTriangle, CheckCircle2, Info, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";

const tones = {
  info: { cls: "border-accent/20 bg-accent-soft text-foreground", Icon: Info, icon: "text-accent" },
  success: { cls: "border-success/20 bg-success-soft text-foreground", Icon: CheckCircle2, icon: "text-success" },
  warning: { cls: "border-warning/25 bg-warning-soft text-foreground", Icon: AlertTriangle, icon: "text-warning" },
  danger: { cls: "border-danger/20 bg-danger-soft text-foreground", Icon: XCircle, icon: "text-danger" },
};

export function Alert({
  tone = "info",
  title,
  children,
  className,
  role,
}: {
  tone?: keyof typeof tones;
  title?: string;
  children?: React.ReactNode;
  className?: string;
  role?: "alert" | "status";
}) {
  const { cls, Icon, icon } = tones[tone];
  return (
    <div
      role={role ?? (tone === "danger" ? "alert" : "status")}
      className={cn("flex gap-3 rounded-[var(--radius-md)] border px-4 py-3 text-sm", cls, className)}
    >
      <Icon className={cn("mt-0.5 size-4 shrink-0", icon)} aria-hidden />
      <div className="flex min-w-0 flex-col gap-0.5">
        {title ? <p className="font-medium">{title}</p> : null}
        {children ? <div className="text-muted-foreground [&_a]:text-accent [&_a]:underline">{children}</div> : null}
      </div>
    </div>
  );
}
