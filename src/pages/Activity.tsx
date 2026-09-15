import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { AppShell } from "@/components/app/AppShell";
import { Money } from "@/components/app/MoneyDisplay";
import { SkeletonCard } from "@/components/app/SkeletonCard";
import { EmptyState } from "@/components/app/EmptyState";
import { formatDate, getYearMonth, getMonthName } from "@/components/app/timeAgo";
import { useAuth } from "@/hooks/use-auth";
import { useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

function groupByDate(
  items: Array<{ date: string; [key: string]: unknown }>,
): Map<string, typeof items> {
  const map = new Map<string, typeof items>();
  for (const item of items) {
    const existing = map.get(item.date) || [];
    existing.push(item);
    map.set(item.date, existing);
  }
  return map;
}

function VendorActivity({
  businessId,
  startDate,
  endDate,
}: {
  businessId: string;
  startDate: string;
  endDate: string;
}) {
  const transactions = useQuery(api.transactions.getByBusinessRange, {
    businessId: businessId as any,
    startDate,
    endDate,
  });
  return <ActivityList txList={transactions ?? undefined} />;
}

function CustomerActivity({
  customerId,
  startDate,
  endDate,
}: {
  customerId: string;
  startDate: string;
  endDate: string;
}) {
  const transactions = useQuery(api.transactions.getByCustomerRange, {
    customerId: customerId as any,
    startDate,
    endDate,
  });
  return <ActivityList txList={transactions ?? undefined} />;
}

function ActivityList({
  txList,
}: {
  txList: Array<Record<string, unknown>> | undefined;
}) {
  const txByDate = txList ? groupByDate(txList as any) : null;

  return (
    <>
      {!txList ? (
        <div className="space-y-4">
          <SkeletonCard />
          <SkeletonCard />
        </div>
      ) : txList.length === 0 ? (
        <EmptyState
          icon="📋"
          title="No transactions this month"
          description="Transactions will appear here once deliveries are recorded."
        />
      ) : (
        <div className="space-y-6 pb-8">
          {Array.from(txByDate?.entries() || []).map(([date, items]) => (
            <div key={date}>
              <p className="text-sm font-medium text-muted-foreground mb-2 px-1">
                {formatDate(date)}
              </p>
              <div className="space-y-1.5">
                {(items as any[]).map((tx: any) => (
                  <div
                    key={tx._id}
                    className="bg-card rounded-2xl p-4 soft-shadow border border-border/20"
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-xl">📦</span>
                      <div className="flex-1">
                        <p className="text-sm font-medium">
                          {tx.productName || "Product"}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {tx.quantity} {tx.productUnit || "units"}
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
      )}
    </>
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
    <AppShell role={isVendor ? "vendor" : "customer"}>
      <div className="space-y-4 pt-4">
        <h1 className="text-2xl font-bold">Activity</h1>

        {/* Month Selector */}
        <div className="flex items-center justify-center gap-4">
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

        {/* Activity Content */}
        {isVendor && business ? (
          <VendorActivity
            businessId={business._id}
            startDate={startDate}
            endDate={endDate}
          />
        ) : customer ? (
          <CustomerActivity
            customerId={customer._id}
            startDate={startDate}
            endDate={endDate}
          />
        ) : (
          <div className="space-y-4">
            <SkeletonCard />
            <SkeletonCard />
          </div>
        )}
      </div>
    </AppShell>
  );
}
