import { cn } from "@/lib/utils";

type Status = "paid" | "partial" | "due" | "none";

export function StatusBadge({
  status,
  className,
}: {
  status: Status;
  className?: string;
}) {
  const config = {
    paid: {
      label: "Paid",
      className: "bg-success-light text-success",
      dot: "bg-success",
    },
    partial: {
      label: "Partial",
      className: "bg-warning-light text-warning",
      dot: "bg-warning",
    },
    due: {
      label: "Due",
      className: "bg-error-light text-error",
      dot: "bg-error",
    },
    none: {
      label: "No activity",
      className: "bg-muted text-muted-foreground",
      dot: "bg-muted-foreground",
    },
  };

  const { label, className: badgeClass, dot } = config[status];

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium",
        badgeClass,
        className,
      )}
    >
      <span className={cn("h-1.5 w-1.5 rounded-full", dot)} />
      {label}
    </span>
  );
}

export function getPaymentStatus(totalBilled: number, totalPaid: number): Status {
  if (totalBilled === 0) return "none";
  if (totalPaid >= totalBilled) return "paid";
  if (totalPaid > 0) return "partial";
  return "due";
}
