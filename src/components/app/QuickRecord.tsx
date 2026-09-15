import { cn } from "@/lib/utils";
import { Check, Plus } from "lucide-react";
import { useState } from "react";

export function QuickRecordButton({
  label,
  onClick,
  variant = "primary",
}: {
  label: string;
  onClick: () => void;
  variant?: "primary" | "success";
}) {
  const [recorded, setRecorded] = useState(false);

  const handleClick = () => {
    onClick();
    setRecorded(true);
    setTimeout(() => setRecorded(false), 1500);
  };

  return (
    <button
      onClick={handleClick}
      className={cn(
        "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium transition-all duration-200",
        "active:scale-95",
        recorded
          ? "bg-success-light text-success"
          : variant === "primary"
            ? "bg-primary/10 text-primary hover:bg-primary/20"
            : "bg-teal-light text-teal hover:bg-teal/20",
      )}
    >
      {recorded ? (
        <>
          <Check className="h-3.5 w-3.5" />
          Recorded
        </>
      ) : (
        <>
          <Plus className="h-3.5 w-3.5" />
          {label}
        </>
      )}
    </button>
  );
}
