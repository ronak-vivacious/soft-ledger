import { useQuery } from "@/lib/api-client";
import { api } from "@/lib/api-client";
import { AppShell } from "@/components/app/AppShell";
import { Money } from "@/components/app/MoneyDisplay";
import { SkeletonCard } from "@/components/app/SkeletonCard";
import { EmptyState } from "@/components/app/EmptyState";
import { formatDate, getYearMonth, getMonthName } from "@/components/app/timeAgo";
import { useAuth } from "@/hooks/use-auth";
import { useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

type Tx = {
  _id: string;
  date: string;
  productName?: string;
  productUnit?: string;
  quantity: number;
  totalAmount: number;
  notes?: string;
  source?: "single" | "subscription";
  reversalOfTransactionId?: string;
};

function groupByDate<T extends { date: string }>(items: T[]): Map<string, T[]> {
  const map = new Map<string, T[]>();
  for (const item of items) {
    const existing = map.get(item.date) || [];
    existing.push(item);
    map.set(item.date, existing);
  }
  return map;
}

function ActivityList({ txList }: { txList: Tx[] | undefined }) {
  if (!txList) {
    return (
      <div className="space-y-4">
        <SkeletonCard />
        <SkeletonCard />
      </div>
    );
  }
  if (txList.length === 0) {
    return (
      <EmptyState
        icon="📋"
        title="No transactions this month"
        description="Transactions will appear here once purchases are recorded."
      />
    );
  }

  const txByDate = groupByDate(txList);
  return (
    <div className="space-y-6 pb-8">
      {Array.from(txByDate.entries()).map(([date, items]) => (
        <div key={date}>
          <p className="text-sm font-medium text-muted-foreground mb-2 px-1">
            {formatDate(date)}
          </p>
          <div className="space-y-1.5">
            {items.map((tx) => (
              <div
                key={tx._id}
                className={`bg-card rounded-2xl p-4 soft-shadow border ${
                  tx.totalAmount < 0 || tx.reversalOfTransactionId
                    ? "border-error/30 bg-error-light/40"
                    : "border-border/20"
                }`}
              >
                <div className="flex items-center gap-3">
                  <span className="text-xl">
                    {tx.totalAmount < 0 ? "↩️" : tx.source === "subscription" ? "🔁" : "📦"}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">
                      {tx.productName || "Product"}
                      {tx.source === "subscription" && (
                        <span className="ml-1.5 text-xs text-primary">· subscription</span>
                      )}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {tx.quantity} {tx.productUnit || "units"}
                      {tx.notes ? ` · ${tx.notes}` : ""}
                    </p>
                  </div>
                  <Money amount={tx.totalAmount} size="sm" />
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

export default function Activity() {
  const { user } = useAuth();
  const business = useQuery(api.businesses.getByUser);
  const customer = useQuery(api.customers.getByLinkedUser);
  const [yearMonth, setYearMonth] = useState(getYearMonth());

  const startDate = `${yearMonth}-01`;
  const endDate = `${yearMonth}-31`;

  const isVendor = !!business;

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

  const vendorTx = useQuery(
    api.transactions.getMyBusiness,
    business ? { startDate, endDate } : "skip",
  );
  const customerTx = useQuery(
    api.transactions.getMine,
    !business && customer ? { startDate, endDate } : "skip",
  );

  return (
    <AppShell role={isVendor ? "vendor" : "customer"}>
      <div className="space-y-4 pt-4">
        <h1 className="text-2xl font-bold">Activity</h1>

        {/* Month Selector */}
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

        {isVendor ? (
          <ActivityList txList={vendorTx as Tx[] | undefined} />
        ) : (
          <ActivityList txList={customerTx as Tx[] | undefined} />
        )}
      </div>
    </AppShell>
  );
}
