import { useState } from "react";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { toast } from "sonner";
import { Check } from "lucide-react";
import { formatMoney } from "./MoneyDisplay";

const PAYMENT_METHODS = [
  { id: "cash", label: "Cash", icon: "💵" },
  { id: "upi", label: "UPI", icon: "📱" },
  { id: "bank", label: "Bank", icon: "🏦" },
  { id: "other", label: "Other", icon: "💳" },
];

export function PaymentSheet({
  open,
  onClose,
  businessId,
  customerId,
  customerName,
  currentDue,
}: {
  open: boolean;
  onClose: () => void;
  businessId: string;
  customerId: string;
  customerName: string;
  currentDue: number;
}) {
  const createPayment = useMutation(api.payments.create);
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState("cash");
  const [recording, setRecording] = useState(false);
  const [done, setDone] = useState(false);

  const today = new Date().toISOString().split("T")[0];
  const amountPaise = Math.round(parseFloat(amount || "0") * 100);

  const handleRecord = async () => {
    if (amountPaise <= 0) return;
    setRecording(true);
    try {
      await createPayment({
        businessId: businessId as any,
        customerId: customerId as any,
        amount: amountPaise,
        method,
        date: today,
      });
      setDone(true);
      setTimeout(() => {
        setDone(false);
        setRecording(false);
        setAmount("");
        onClose();
      }, 1200);
    } catch {
      toast.error("Something went wrong. Please try again.");
      setRecording(false);
    }
  };

  return (
    <Drawer open={open} onOpenChange={(o) => !o && onClose()}>
      <DrawerContent className="px-4 pb-8">
        <DrawerHeader className="px-0 pt-4">
          <DrawerTitle className="text-lg font-semibold">
            {done
              ? "Payment recorded ✓"
              : `Record payment from ${customerName}`}
          </DrawerTitle>
        </DrawerHeader>

        {done ? (
          <div className="flex flex-col items-center py-10 gap-4">
            <div className="h-16 w-16 rounded-full bg-success-light flex items-center justify-center">
              <Check className="h-8 w-8 text-success" />
            </div>
            <p className="text-2xl font-bold text-success">
              {formatMoney(amountPaise)}
            </p>
            <p className="text-sm text-muted-foreground">
              via {PAYMENT_METHODS.find((m) => m.id === method)?.label}
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Due amount */}
            <div className="bg-error-light rounded-2xl p-4 text-center">
              <p className="text-sm text-muted-foreground">Outstanding due</p>
              <p className="text-2xl font-bold text-error mt-1">
                {formatMoney(currentDue)}
              </p>
            </div>

            {/* Amount input */}
            <div className="bg-card rounded-2xl p-4 soft-shadow">
              <label className="text-sm text-muted-foreground block mb-2">
                Amount (₹)
              </label>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-2xl font-bold text-muted-foreground">
                  ₹
                </span>
                <input
                  type="number"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="0"
                  className="w-full text-4xl font-bold text-center bg-transparent py-4 outline-none tabular-nums"
                  min="0"
                  step="1"
                />
              </div>
              {/* Quick amount buttons */}
              {currentDue > 0 && (
                <div className="flex gap-2 mt-2">
                  {[
                    { label: "Full due", value: currentDue / 100 },
                    { label: "Half", value: currentDue / 200 },
                    { label: "₹100", value: 100 },
                    { label: "₹500", value: 500 },
                  ].map((opt) => (
                    <button
                      key={opt.label}
                      onClick={() => setAmount(opt.value.toString())}
                      className="flex-1 py-2 rounded-xl text-xs font-medium bg-muted text-muted-foreground hover:bg-muted/80 transition-all"
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Payment method */}
            <div>
              <p className="text-sm text-muted-foreground mb-3 px-1">
                Payment method
              </p>
              <div className="grid grid-cols-4 gap-2">
                {PAYMENT_METHODS.map((m) => (
                  <button
                    key={m.id}
                    onClick={() => setMethod(m.id)}
                    className={cn(
                      "flex flex-col items-center gap-1.5 py-3 rounded-2xl text-xs font-medium transition-all",
                      method === m.id
                        ? "bg-primary/10 text-primary ring-2 ring-primary/20"
                        : "bg-muted text-muted-foreground hover:bg-muted/80",
                    )}
                  >
                    <span className="text-lg">{m.icon}</span>
                    {m.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Record button */}
            <Button
              onClick={handleRecord}
              disabled={recording || amountPaise <= 0}
              className="w-full h-14 rounded-2xl text-base font-semibold bg-success hover:bg-success/90 active:scale-[0.98] transition-all text-white"
            >
              {recording ? (
                <span className="animate-pulse">Recording...</span>
              ) : (
                `Record ${formatMoney(amountPaise)}`
              )}
            </Button>
          </div>
        )}
      </DrawerContent>
    </Drawer>
  );
}
