import { useState } from "react";
import { useQuery } from "@/lib/api-client";
import { api } from "@/lib/api-client";
import type { Id } from "@/lib/db-types";
import { Money, formatMoney } from "@/components/app/MoneyDisplay";
import { PaymentStatusBadge, PaymentAudit, ReversePaymentButton, methodIcon } from "@/components/app/PaymentStatus";
import { RecordSheet } from "@/components/app/RecordSheet";
import { PaymentSheet } from "@/components/app/PaymentSheet";
import { VerifyPaymentCard } from "@/components/app/PaymentStatus";
import { StatusBadge, getPaymentStatus } from "@/components/app/StatusBadge";
import { formatDate, formatDateLong, getYearMonth, getMonthName } from "@/components/app/timeAgo";
import { SkeletonCard } from "@/components/app/SkeletonCard";
import { EmptyState } from "@/components/app/EmptyState";
import { useNavigate, useParams } from "react-router";
import { ArrowLeft, ChevronLeft, ChevronRight, Pause, Play, Square } from "lucide-react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { t } from "@/lib/i18n";
import { toast } from "sonner";
import { useMutation } from "@/lib/api-client";

type Tx = {
  _id: string;
  date: string;
  productName?: string;
  productUnit?: string;
  productId: string;
  quantity: number;
  rate: number;
  totalAmount: number;
  notes?: string;
  source?: "single" | "subscription";
  reversalOfTransactionId?: string;
};

type Pay = {
  _id: string;
  amount: number;
  method: string;
  date: string;
  status: "pending" | "confirmed" | "rejected";
  recordedByRole: "vendor" | "customer";
  reversed?: boolean;
  verifiedAt?: number;
  reversalNote?: string;
  notes?: string;
};

type Sub = {
  _id: string;
  status: "active" | "paused" | "ended";
  quantity: number;
  frequency: "daily" | "weekly" | "monthly";
  startDate: string;
  productName: string;
  productUnit: string;
  productPrice: number;
  lastGeneratedDate?: string;
};

export default function CustomerDetail() {
  const { customerId } = useParams<{ customerId: string }>();
  const navigate = useNavigate();
  const customer = useQuery(api.customers.getOne, {
    customerId: customerId as Id<"customers">,
  });
  const products = useQuery(api.products.getMine);
  const subs = useQuery(api.subscriptions.getMyBusiness, {});

  const [yearMonth, setYearMonth] = useState(getYearMonth());
  const [showRecord, setShowRecord] = useState(false);
  const [showPayment, setShowPayment] = useState(false);
  const [filterProduct, setFilterProduct] = useState<string>("all");
  const [filterSource, setFilterSource] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<string>("all");

  const statement = useQuery(api.customers.getStatement, {
    customerId: customerId as Id<"customers">,
    yearMonth,
  });
  const monthTx = useQuery(api.transactions.getByCustomer, {
    customerId: customerId as Id<"customers">,
    startDate: `${yearMonth}-01`,
    endDate: `${yearMonth}-31`,
  });
  const monthPay = useQuery(api.payments.getByCustomer, {
    customerId: customerId as Id<"customers">,
    startDate: `${yearMonth}-01`,
    endDate: `${yearMonth}-31`,
  });

  const prevMonth = () => {
    const [y, m] = yearMonth.split("-").map(Number);
    const d = new Date(y, m - 2);
    setYearMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
  };
  const nextMonth = () => {
    const [y, m] = yearMonth.split("-").map(Number);
    const d = new Date(y, m);
    setYearMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
  };

  if (!customer) {
    return (
      <div className="min-h-screen bg-background px-4">
        <div className="mx-auto max-w-lg space-y-4 pt-4">
          <SkeletonCard />
          <SkeletonCard />
        </div>
      </div>
    );
  }

  const status = getPaymentStatus(customer.totalBilled, customer.totalConfirmed);

  // Apply client-side filters on transactions
  const filteredTx = (monthTx as Tx[] | undefined)?.filter((tx) => {
    if (filterProduct !== "all" && tx.productId !== filterProduct) return false;
    if (filterSource !== "all" && (tx.source ?? "single") !== filterSource) return false;
    return true;
  });
  const filteredPay = (monthPay as Pay[] | undefined)?.filter((p) => {
    if (filterStatus === "pending" && (p.status !== "pending" || p.reversed)) return false;
    if (filterStatus === "confirmed" && (p.status !== "confirmed" || p.reversed)) return false;
    if (filterStatus === "rejected" && (p.status !== "rejected" || p.reversed)) return false;
    return true;
  });

  const customerSubs = (subs as Sub[] | undefined)?.filter(
    (s) => s._id && s.productName && String(s.quantity) && true,
  );
  void customerSubs;
  const mySubs = (subs as Sub[] | undefined)?.filter((s) => s.status !== "ended");

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-lg px-4">
        {/* Header */}
        <div className="flex items-center gap-3 pt-4 pb-2">
          <button
            onClick={() => navigate(-1)}
            className="h-10 w-10 rounded-full bg-card soft-shadow flex items-center justify-center hover:bg-muted transition-all"
            aria-label="Go back"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div className="flex-1 min-w-0">
            <h1 className="text-xl font-bold truncate">{customer.name}</h1>
            <div className="flex items-center gap-2 mt-1">
              <StatusBadge status={status} />
              {customer.phone && (
                <span className="text-xs text-muted-foreground">{customer.phone}</span>
              )}
            </div>
          </div>
        </div>

        {/* Lifetime Balance Card */}
        <div className="border border-border/30 soft-shadow-md mt-4 rounded-2xl bg-gradient-to-br from-primary/5 to-teal-light/30 p-6">
          <p className="text-sm text-muted-foreground mb-1">{t("outstandingBalance")}</p>
          <Money
            amount={customer.due}
            size="xl"
            className={`block ${customer.due > 0 ? "text-error" : "text-success"}`}
          />
          {customer.due < 0 && (
            <p className="text-xs text-success mt-1">{t("inCredit")} — applies to future bills</p>
          )}
          <div className="flex gap-6 mt-4">
            <div>
              <p className="text-xs text-muted-foreground">{t("totalBilled")}</p>
              <Money amount={customer.totalBilled} size="md" className="block" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">{t("totalPaid")}</p>
              <Money amount={customer.totalConfirmed} size="md" className="text-success block" />
            </div>
            {customer.totalPending > 0 && (
              <div>
                <p className="text-xs text-muted-foreground">{t("pending")}</p>
                <Money amount={customer.totalPending} size="md" className="text-warning block" />
              </div>
            )}
          </div>
        </div>

        {/* Quick Actions */}
        <div className="flex gap-3 mt-4">
          <button
            onClick={() => setShowRecord(true)}
            className="flex-1 h-12 rounded-2xl bg-primary text-primary-foreground text-sm font-semibold soft-shadow hover:bg-primary/90 active:scale-[0.98] transition-all"
          >
            + {t("recordPurchase")}
          </button>
          <button
            onClick={() => setShowPayment(true)}
            className="flex-1 h-12 rounded-2xl bg-success text-white text-sm font-semibold soft-shadow hover:bg-success/90 active:scale-[0.98] transition-all"
          >
            ₹ {t("recordPayment")}
          </button>
        </div>

        {/* Tabs: statement / payments / subscriptions */}
        <Tabs defaultValue="statement" className="mt-6">
          <TabsList className="w-full">
            <TabsTrigger value="statement" className="flex-1">{t("accountStatement")}</TabsTrigger>
            <TabsTrigger value="payments" className="flex-1">{t("payments")}</TabsTrigger>
            <TabsTrigger value="subs" className="flex-1">{t("subscriptions")}</TabsTrigger>
          </TabsList>

          {/* ---------------- Statement tab ---------------- */}
          <TabsContent value="statement" className="space-y-4 mt-4 pb-20">
            {/* Month selector */}
            <div className="flex items-center justify-center gap-4">
              <button
                onClick={prevMonth}
                className="h-8 w-8 rounded-full bg-card soft-shadow flex items-center justify-center hover:bg-muted transition-all"
                aria-label="Previous month"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <p className="text-base font-semibold min-w-[160px] text-center">
                {getMonthName(yearMonth)}
              </p>
              <button
                onClick={nextMonth}
                className="h-8 w-8 rounded-full bg-card soft-shadow flex items-center justify-center hover:bg-muted transition-all"
                aria-label="Next month"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>

            {statement ? (
              <div className="border border-border/30 rounded-2xl p-4 bg-card space-y-2 text-sm">
                <Row label={t("openingBalance")} value={statement.openingBalance} />
                <Row label={t("totalBilled")} value={statement.totalBilled} />
                <Row label={t("confirmed")} value={-statement.confirmedPayments} />
                {statement.pendingPayments > 0 && (
                  <Row label={`${t("pending")} (unverified)`} value={statement.pendingPayments} muted />
                )}
                <div className="border-t border-border/40 pt-2">
                  <Row label={t("closingBalance")} value={statement.closingBalance} bold />
                </div>
              </div>
            ) : (
              <SkeletonCard />
            )}

            {/* Filters */}
            <div className="grid grid-cols-3 gap-2">
              <Select value={filterProduct} onValueChange={setFilterProduct}>
                <SelectTrigger size="sm"><SelectValue placeholder={t("productFilter")} /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t("all")} {t("product").toLowerCase()}</SelectItem>
                  {(products ?? []).map((p: any) => (
                    <SelectItem key={p._id} value={p._id}>{p.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={filterSource} onValueChange={setFilterSource}>
                <SelectTrigger size="sm"><SelectValue placeholder={t("purchaseType")} /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t("all")}</SelectItem>
                  <SelectItem value="single">{t("singlePurchases")}</SelectItem>
                  <SelectItem value="subscription">{t("subPurchases")}</SelectItem>
                </SelectContent>
              </Select>
              <Select value={filterStatus} onValueChange={setFilterStatus}>
                <SelectTrigger size="sm"><SelectValue placeholder={t("paymentStatus")} /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t("all")}</SelectItem>
                  <SelectItem value="pending">{t("pending")}</SelectItem>
                  <SelectItem value="confirmed">{t("confirmed")}</SelectItem>
                  <SelectItem value="rejected">{t("rejected")}</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Transactions */}
            {!filteredTx ? (
              <SkeletonCard />
            ) : filteredTx.length === 0 ? (
              <EmptyState icon="📦" title="No purchases match" description="Try changing the filters." />
            ) : (
              <div className="space-y-1.5">
                {filteredTx.map((tx) => (
                  <div
                    key={tx._id}
                    className={`bg-card rounded-2xl p-4 soft-shadow border ${
                      tx.totalAmount < 0 || tx.reversalOfTransactionId
                        ? "border-error/30 bg-error-light/40"
                        : "border-border/20"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-lg">
                        {tx.totalAmount < 0 ? "↩️" : tx.source === "subscription" ? "🔁" : "📦"}
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{tx.productName}</p>
                        <p className="text-xs text-muted-foreground">
                          {formatDate(tx.date)} · {tx.quantity} {tx.productUnit} × {formatMoney(tx.rate)}
                        </p>
                        {tx.notes && (
                          <p className="text-xs text-muted-foreground italic truncate">{tx.notes}</p>
                        )}
                      </div>
                      <div className="text-right">
                        <Money amount={tx.totalAmount} size="sm" />
                        {tx.totalAmount > 0 && (
                          <div className="mt-1">
                            <ReverseTransactionButton transactionId={tx._id} />
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Monthly bills */}
            {customer.recentBills.length > 0 && (
              <div className="space-y-2 pt-2">
                <h3 className="text-sm font-medium text-muted-foreground px-1">{t("monthBills")}</h3>
                {customer.recentBills.map((b: any) => (
                  <button
                    key={b._id}
                    onClick={() => setYearMonth(b.yearMonth)}
                    className="w-full bg-card rounded-2xl p-4 soft-shadow border border-border/20 flex items-center justify-between hover:border-primary/20 transition-all"
                  >
                    <div className="text-left">
                      <p className="text-sm font-medium">{getMonthName(b.yearMonth)}</p>
                      <p className="text-xs text-muted-foreground">
                        {t("openingBalance")} {formatMoney(b.openingBalance)} → {t("closingBalance")}{" "}
                        {formatMoney(b.closingBalance)}
                      </p>
                    </div>
                    <Money
                      amount={b.closingBalance}
                      size="md"
                      className={b.closingBalance > 0 ? "text-error" : "text-success"}
                    />
                  </button>
                ))}
              </div>
            )}
          </TabsContent>

          {/* ---------------- Payments tab ---------------- */}
          <TabsContent value="payments" className="space-y-3 mt-4 pb-20">
            {!filteredPay ? (
              <SkeletonCard />
            ) : filteredPay.length === 0 ? (
              <EmptyState icon="🧾" title="No payments this month" description="Recorded and verified payments appear here." />
            ) : (
              filteredPay.map((p) => (
                <div key={p._id} className="bg-card rounded-2xl p-4 soft-shadow border border-border/20">
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-2">
                        <span>{methodIcon(p.method)}</span>
                        <Money amount={p.amount} size="md" className="text-success" />
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        {formatDateLong(p.date)} · {p.method.toUpperCase()} · {t("recordedBy")}{" "}
                        {p.recordedByRole}
                        {p.notes ? ` · ${p.notes}` : ""}
                      </p>
                    </div>
                    <PaymentStatusBadge payment={p} />
                  </div>
                  <PaymentAudit payment={p} />
                  {p.status === "confirmed" && !p.reversed && (
                    <div className="mt-2">
                      <ReversePaymentButton paymentId={p._id} />
                    </div>
                  )}
                </div>
              ))
            )}
          </TabsContent>

          {/* ---------------- Subscriptions tab ---------------- */}
          <TabsContent value="subs" className="space-y-3 mt-4 pb-20">
            {!mySubs ? (
              <SkeletonCard />
            ) : mySubs.length === 0 ? (
              <EmptyState
                icon="🔁"
                title={t("noSubs")}
                description={t("noSubsDesc")}
                action={
                  <button
                    onClick={() => navigate("/dashboard/subscriptions")}
                    className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 active:scale-95 transition-all"
                  >
                    {t("newSubscription")}
                  </button>
                }
              />
            ) : (
              mySubs
                .filter((s) => s.status !== "ended")
                .map((s) => (
                  <SubCard key={s._id} sub={s} customerId={customer._id} customerName={customer.name} products={products ?? []} />
                ))
            )}
          </TabsContent>
        </Tabs>
      </div>

      {/* Sheets */}
      {products && (
        <RecordSheet
          open={showRecord}
          onClose={() => setShowRecord(false)}
          customerId={customer._id}
          customerName={customer.name}
          products={products}
        />
      )}
      <PaymentSheet
        open={showPayment}
        onClose={() => setShowPayment(false)}
        customerId={customer._id}
        customerName={customer.name}
        currentDue={Math.max(0, customer.due)}
        recordedByRole="vendor"
      />
    </div>
  );
}

function Row({
  label,
  value,
  bold,
  muted,
}: {
  label: string;
  value: number;
  bold?: boolean;
  muted?: boolean;
}) {
  return (
    <div className="flex items-center justify-between">
      <span className={`text-muted-foreground ${bold ? "font-semibold text-foreground" : ""}`}>
        {label}
      </span>
      <Money
        amount={value}
        size={bold ? "md" : "sm"}
        className={`${bold ? "font-bold" : ""} ${muted ? "text-warning" : ""} ${
          !muted && value < 0 ? "text-success" : ""
        }`}
      />
    </div>
  );
}

function SubCard({
  sub,
  customerId,
  customerName,
  products,
}: {
  sub: Sub;
  customerId: string;
  customerName: string;
  products: Array<{ _id: string; name: string; unit: string; price: number; active?: boolean }>;
}) {
  void products;
  void customerId;
  void customerName;
  const pause = useMutation(api.subscriptions.pause);
  const resume = useMutation(api.subscriptions.resume);
  const end = useMutation(api.subscriptions.end);

  const act = async (fn: () => Promise<unknown>, msg: string) => {
    try {
      await fn();
      toast.success(msg);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("errGeneric"));
    }
  };

  return (
    <div className="bg-card rounded-2xl p-4 soft-shadow border border-border/20">
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="text-sm font-medium truncate">
            🔁 {sub.productName} · {sub.quantity} {sub.productUnit}
          </p>
          <p className="text-xs text-muted-foreground mt-0.5">
            {t(sub.frequency)} · from {formatDate(sub.startDate)} ·{" "}
            {formatMoney(sub.productPrice)}/{sub.productUnit}
          </p>
        </div>
        <span
          className={`text-xs px-2 py-1 rounded-full font-medium shrink-0 ${
            sub.status === "active"
              ? "bg-success-light text-success"
              : "bg-warning-light text-warning"
          }`}
        >
          {t(sub.status)}
        </span>
      </div>
      <div className="flex gap-2 mt-3">
        {sub.status === "active" ? (
          <button
            onClick={() => act(() => pause({ subscriptionId: sub._id as never }), "Subscription paused")}
            className="flex-1 py-2 rounded-xl bg-muted text-xs font-medium text-muted-foreground hover:bg-muted/80 flex items-center justify-center gap-1"
          >
            <Pause className="h-3.5 w-3.5" /> {t("pause")}
          </button>
        ) : (
          <button
            onClick={() => act(() => resume({ subscriptionId: sub._id as never }), "Subscription resumed")}
            className="flex-1 py-2 rounded-xl bg-primary/10 text-xs font-medium text-primary hover:bg-primary/15 flex items-center justify-center gap-1"
          >
            <Play className="h-3.5 w-3.5" /> {t("resume")}
          </button>
        )}
        <button
          onClick={() => {
            if (window.confirm(`${t("endSubTitle")} ${t("endSubDesc")}`)) {
              act(() => end({ subscriptionId: sub._id as never }), "Subscription ended");
            }
          }}
          className="flex-1 py-2 rounded-xl bg-error-light text-xs font-medium text-error hover:bg-error-light/70 flex items-center justify-center gap-1"
        >
          <Square className="h-3.5 w-3.5" /> {t("end")}
        </button>
      </div>
    </div>
  );
}

function ReverseTransactionButton({ transactionId }: { transactionId: string }) {
  const reverse = useMutation(api.transactions.reverse);
  const [busy, setBusy] = useState(false);

  const act = async () => {
    const reason = window.prompt(`${t("reversePurchaseDesc")}\n${t("reason")}:`);
    if (reason === null) return;
    setBusy(true);
    try {
      await reverse({ transactionId: transactionId as never, reason: reason || undefined });
      toast.success("Reversal recorded");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("errGeneric"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <button
      onClick={act}
      disabled={busy}
      className="text-xs text-muted-foreground hover:text-error transition-colors"
    >
      {t("reversePurchase")}
    </button>
  );
}
