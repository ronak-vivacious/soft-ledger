import { cn } from "@/lib/utils";

function formatPaise(paise: number): string {
  const rupees = paise / 100;
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(rupees);
}

export function Money({
  amount,
  size = "md",
  className,
  showSign = false,
}: {
  amount: number;
  size?: "sm" | "md" | "lg" | "xl";
  className?: string;
  showSign?: boolean;
}) {
  const sizeClasses = {
    sm: "text-sm",
    md: "text-lg font-semibold",
    lg: "text-2xl font-bold",
    xl: "text-3xl font-bold tracking-tight",
  };

  const prefix = showSign && amount > 0 ? "+" : "";

  return (
    <span className={cn("font-mono tabular-nums", sizeClasses[size], className)}>
      {prefix}
      {formatPaise(amount)}
    </span>
  );
}

export function formatMoney(paise: number): string {
  return formatPaise(paise);
}
