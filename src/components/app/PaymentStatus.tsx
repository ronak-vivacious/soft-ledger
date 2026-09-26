import { useMutation, useQuery } from "@/lib/api-client";
import { api } from "@/lib/api-client";
import type { Id } from "@/lib/db-types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Money, formatMoney } from "@/components/app/MoneyDisplay";
import { formatDate } from "@/components/app/timeAgo";
import { useState } from "react";
import { toast } from "sonner";
import { Check, X, Loader2 } from "lucide-react";
import { t } from "@/lib/i18n";

type PaymentLike = {
  _id: string;
  amount: number;
  method: string;
  date: string;
  status: "pending" | "confirmed" | "rejected";
  recordedByRole: "vendor" | "customer";
  reversed?: boolean;
  verifiedBy?: Id<"users">;
  verifiedAt?: number;
  reversedBy?: Id<"users">;
  reversalNote?: string;
  notes?: string;
};

const METHOD_ICON: Record<string, string> = {
  cash: "💵",
  upi: "📱",
  bank: "🏦",
  other: "💳",
};

/** Status pill for a payment record. */
export function PaymentStatusBadge({ payment }: { payment: PaymentLike }) {
  const status = payment.reversed
    ? "reversed"
    : payment.status === "confirmed"
      ? "confirmed"
      : payment.status === "rejected"
        ? "rejected"
        : "pending";

  const config = {
    pending: { label: t("statusPendingVerify"), cls: "bg-warning-light text-warning" },
    confirmed: { label: t("statusConfirmed"), cls: "bg-success-light text-success" },
    rejected: { label: t("statusRejected"), cls: "bg-error-light text-error" },
    reversed: { label: t("reversed"), cls: "bg-muted text-muted-foreground" },
  }[status];

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${config.cls}`}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-current opacity-70" />
      {config.label}
    </span>
  );
}

export const methodIcon = (method: string) => METHOD_ICON[method] ?? "💳";

/** Audit line shown for verified/reversed payments. */
export function PaymentAudit({ payment }: { payment: PaymentLike }) {
  return (
    <div className="text-xs text-muted-foreground space-y-0.5">
      {payment.verifiedAt && (
        <p>
          {t("verifiedBy")} the {payment.recordedByRole === "vendor" ? "customer" : "vendor"}
          {" · "}
          {new Date(payment.verifiedAt).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}
        </p>
      )}
      {payment.reversed && (
        <p className="text-error">
          {t("reversed")}: {payment.reversalNote ?? ""}
        </p>
      )}
    </div>
  );
}

/** Confirm / dispute actions for a pending payment recorded by the other side. */
export function VerifyPaymentCard({ payment }: { payment: PaymentLike }) {
  const verifyPayment = useMutation(api.payments.verify);
  const [busy, setBusy] = useState(false);
  const [disputeOpen, setDisputeOpen] = useState(false);
  const [note, setNote] = useState("");

  const act = async (decision: "confirmed" | "rejected") => {
    setBusy(true);
    try {
      await verifyPayment({ paymentId: payment._id as Id<"payments">, decision, note: note.trim() || undefined });
      toast.success(
        decision === "confirmed"
          ? "Payment confirmed"
          : "Payment disputed — balance unchanged",
      );
      setDisputeOpen(false);
      setNote("");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("errGeneric"));
    } finally {
      setBusy(false);
    }
  };

  const roleLabel = payment.recordedByRole === "vendor" ? "vendor" : "customer";

  return (
    <div className="bg-card rounded-2xl border border-border/30 soft-shadow p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <span>{methodIcon(payment.method)}</span>
            <Money amount={payment.amount} size="lg" />
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            {formatDate(payment.date)} · {t("recordedBy")} {roleLabel}
            {payment.notes ? ` · ${payment.notes}` : ""}
          </p>
        </div>
      </div>
      <div className="flex gap-2 mt-3">
        <Button
          size="sm"
          className="flex-1 bg-success hover:bg-success/90 text-white"
          disabled={busy}
          onClick={() => act("confirmed")}
        >
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4 mr-1" />}
          {t("confirmPayment")}
        </Button>
        <Button
          size="sm"
          variant="outline"
          className="flex-1 text-error border-error/40 hover:bg-error-light"
          disabled={busy}
          onClick={() => setDisputeOpen(true)}
        >
          <X className="h-4 w-4 mr-1" />
          {t("rejectPayment")}
        </Button>
      </div>

      <Dialog open={disputeOpen} onOpenChange={setDisputeOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{t("rejectPayment")}</DialogTitle>
            <DialogDescription>
              The recorded amount won't count toward the balance until resolved.
            </DialogDescription>
          </DialogHeader>
          <Input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Why are you disputing this?"
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setDisputeOpen(false)}>{t("cancel")}</Button>
            <Button
              className="bg-error hover:bg-error/90 text-white"
              disabled={busy}
              onClick={() => act("rejected")}
            >
              {t("dispute")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/** Reverse action for a confirmed payment (audit-trailed correction). */
export function ReversePaymentButton({ paymentId }: { paymentId: string }) {
  const reversePayment = useMutation(api.payments.reverse);
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  const act = async () => {
    setBusy(true);
    try {
      await reversePayment({ paymentId: paymentId as Id<"payments">, note: note.trim() || undefined });
      toast.success("Payment reversed with audit note");
      setOpen(false);
      setNote("");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("errGeneric"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="text-xs text-muted-foreground hover:text-error transition-colors"
      >
        {t("reversePayment")}
      </button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{t("reversePayment")}</DialogTitle>
            <DialogDescription>{t("reversePaymentDesc")}</DialogDescription>
          </DialogHeader>
          <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder={t("reason")} />
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>{t("cancel")}</Button>
            <Button className="bg-error hover:bg-error/90 text-white" disabled={busy} onClick={act}>
              {t("reversePayment")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

/** Section listing payments awaiting MY verification. */
export function PendingVerifications() {
  const pending = useQuery(api.payments.getPendingForMe);

  if (!pending) return null;
  if (pending.length === 0) {
    return (
      <div className="text-center py-6">
        <p className="text-sm text-muted-foreground">{t("noPendingPayments")}</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <h2 className="text-lg font-semibold">
        {t("paymentsAwaiting")} ({pending.length})
      </h2>
      {pending.map((p: any) => (
        <VerifyPaymentCard key={p._id} payment={p as PaymentLike} />
      ))}
    </div>
  );
}
