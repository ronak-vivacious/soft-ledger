import { useState } from "react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Money } from "@/components/app/MoneyDisplay";
import { StatusBadge, getPaymentStatus } from "@/components/app/StatusBadge";
import { RecordSheet } from "@/components/app/RecordSheet";
import { PaymentSheet } from "@/components/app/PaymentSheet";
import { formatDate, getYearMonth, getMonthName } from "@/components/app/timeAgo";
import { SkeletonCard } from "@/components/app/SkeletonCard";
import { EmptyState } from "@/components/app/EmptyState";
import { useNavigate, useParams } from "react-router";
import { ArrowLeft, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export default function CustomerDetail() {
  const { customerId } = useParams<{ customerId: string }>();
  const navigate = useNavigate();
  const business = useQuery(api.businesses.getByUser);
  const customer = useQuery(
    api.customers.getOne,
    customerId ? { customerId: customerId as any } : "skip",
  );
  const products = useQuery(
    api.products.getByBusiness,
    business ? { businessId: business._id } : "skip",
  );
  const [yearMonth, setYearMonth] = useState(getYearMonth());
  const [showRecord, setShowRecord] = useState(false);
  const [showPayment, setShowPayment] = useState(false);

  const summary = useQuery(
    api.summary.customerMonthlySummary,
    customerId
      ? { customerId: customerId as any, yearMonth }
      : "skip",
  );

  const [showRecordSheet, setShowRecordSheet] = useState(false);
  const [showPaymentSheet, setShowPaymentSheet] = useState(false);

  if (!customer || !business) {
    return (
      <div className="min-h-screen bg-background px-4">
        <div className="mx-auto max-w-lg space-y-4 pt-4">
          <SkeletonCard />
          <SkeletonCard />
        </div>
      </div>
    );
  }

  const status = getPaymentStatus(customer.totalBilled, customer.totalPaid);

  const prevMonth = () => {
    const [y, m] = yearMonth.split("-").map(Number);
    const d = new Date(y, m - 2);
    setYearMonth(
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`,
    );
  };

  const nextMonth = () => {
    const [y, m] = yearMonth.split("-").map(Number);
    const d = new Date(y, m);
    setYearMonth(
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`,
    );
  };

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
          <div className="flex-1">
            <h1 className="text-xl font-bold">{customer.name}</h1>
            <StatusBadge status={status} className="mt-1" />
          </div>
        </div>

        {/* Balance Card */}
        <Card className="border-border/30 soft-shadow-md mt-4 bg-gradient-to-br from-primary/5 to-teal-light/30">
          <CardContent className="p-6">
            <p className="text-sm text-muted-foreground mb-1">Total</p>
            <Money amount={customer.totalBilled} size="xl" className="block" />
            <div className="flex gap-6 mt-4">
              <div>
                <p className="text-xs text-muted-foreground">Paid</p>
                <Money
                  amount={customer.totalPaid}
                  size="md"
                  className="text-success block"
                />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Due</p>
                <Money
                  amount={customer.due}
                  size="md"
                  className="text-error block"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Quick Actions */}
        <div className="flex gap-3 mt-4">
          <button
            onClick={() => setShowRecordSheet(true)}
            className="flex-1 h-12 rounded-2xl bg-primary text-primary-foreground text-sm font-semibold soft-shadow hover:bg-primary/90 active:scale-[0.98] transition-all"
          >
            + Record
          </button>
          <button
            onClick={() => setShowPaymentSheet(true)}
            className="flex-1 h-12 rounded-2xl bg-success text-white text-sm font-semibold soft-shadow hover:bg-success/90 active:scale-[0.98] transition-all"
          >
            ₹ Payment
          </button>
        </div>

        {/* Month Selector */}
        <div className="flex items-center justify-center gap-4 mt-8 mb-4">
          <button
            onClick={prevMonth}
            className="h-8 w-8 rounded-full bg-card soft-shadow flex items-center justify-center hover:bg-muted transition-all"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <p className="text-base font-semibold min-w-[160px] text-center">
            {getMonthName(yearMonth)}
          </p>
          <button
            onClick={nextMonth}
            className="h-8 w-8 rounded-full bg-card soft-shadow flex items-center justify-center hover:bg-muted transition-all"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>

        {/* Monthly Summary */}
        {summary ? (
          <div className="space-y-4 pb-20">
            {/* Products breakdown */}
            {summary.products.length > 0 ? (
              <div className="space-y-3">
                <h3 className="text-sm font-medium text-muted-foreground px-1">
                  Activity
                </h3>
                {summary.products.map((p) => (
                  <div
                    key={p.name}
                    className="bg-card rounded-2xl p-4 soft-shadow border border-border/20"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <span className="text-2xl">
                          📦
                        </span>
                        <div>
                          <p className="font-medium">{p.name}</p>
                          <p className="text-sm text-muted-foreground">
                            {p.quantity} units
                          </p>
                        </div>
                      </div>
                      <Money amount={p.amount} size="md" />
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <EmptyState
                icon="📦"
                title="No activity this month"
                description="Transactions will appear here once you record deliveries."
              />
            )}

            {/* Payments */}
            {summary.payments.length > 0 && (
              <div className="space-y-3">
                <h3 className="text-sm font-medium text-muted-foreground px-1">
                  Payments
                </h3>
                {summary.payments.map((p) => (
                  <div
                    key={p._id}
                    className="bg-card rounded-2xl p-4 soft-shadow border border-border/20"
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium">{formatDate(p.date)}</p>
                        <p className="text-xs text-muted-foreground capitalize">
                          {p.method}
                        </p>
                      </div>
                      <Money
                        amount={p.amount}
                        size="md"
                        className="text-success"
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Remaining */}
            {summary.due > 0 && (
              <div className="bg-error-light rounded-2xl p-4 text-center">
                <p className="text-sm text-muted-foreground">Remaining</p>
                <Money
                  amount={summary.due}
                  size="lg"
                  className="text-error block mt-1"
                />
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            <SkeletonCard />
            <SkeletonCard />
          </div>
        )}
      </div>

      {/* Sheets */}
      {products && (
        <RecordSheet
          open={showRecordSheet}
          onClose={() => setShowRecordSheet(false)}
          businessId={business._id}
          customerId={customer._id}
          customerName={customer.name}
          products={products}
        />
      )}
      <PaymentSheet
        open={showPaymentSheet}
        onClose={() => setShowPaymentSheet(false)}
        businessId={business._id}
        customerId={customer._id}
        customerName={customer.name}
        currentDue={customer.due}
      />
    </div>
  );
}
