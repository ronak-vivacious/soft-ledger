import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { AppShell } from "@/components/app/AppShell";
import { Money } from "@/components/app/MoneyDisplay";
import { SkeletonCard } from "@/components/app/SkeletonCard";
import { EmptyState } from "@/components/app/EmptyState";
import { getGreeting, getYearMonth, getMonthName } from "@/components/app/timeAgo";
import { useAuth } from "@/hooks/use-auth";
import { useNavigate } from "react-router";
import { Card, CardContent } from "@/components/ui/card";
import { ArrowRight } from "lucide-react";

export default function CustomerHome() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const customer = useQuery(api.customers.getByLinkedUser);
  const business = useQuery(
    api.businesses.getByUser,
    customer ? {} : "skip",
  );

  const yearMonth = getYearMonth();
  const summary = useQuery(
    api.summary.customerMonthlySummary,
    customer
      ? { customerId: customer._id, yearMonth }
      : "skip",
  );

  const businessName = useQuery(
    api.summary.businessForCustomer,
    customer ? { customerId: customer._id } : "skip",
  );

  const greeting = getGreeting();
  const firstName = user?.name?.split(" ")[0] || "there";

  if (!customer) {
    return (
      <AppShell role="customer">
        <div className="space-y-4 pt-4">
          <SkeletonCard />
          <SkeletonCard />
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell role="customer">
      <div className="space-y-6 pt-4">
        {/* Greeting */}
        <div>
          <h1 className="text-2xl font-bold text-foreground">
            {greeting}, {firstName} 👋
          </h1>
          <p className="text-muted-foreground mt-1">
            {businessName?.name || "Your business"} · {getMonthName(yearMonth)}
          </p>
        </div>

        {/* Balance Card */}
        {summary ? (
          <Card className="border-border/30 soft-shadow-md bg-gradient-to-br from-primary/5 to-teal-light/30">
            <CardContent className="p-6 text-center">
              <Money amount={summary.totalBilled} size="xl" className="block" />
              <p className="text-sm text-muted-foreground mt-1">Total this month</p>
              <div className="flex justify-center gap-8 mt-4">
                <div>
                  <p className="text-xs text-muted-foreground">Paid</p>
                  <Money
                    amount={summary.totalPaid}
                    size="md"
                    className="text-success block"
                  />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Due</p>
                  <Money
                    amount={summary.due}
                    size="md"
                    className="text-error block"
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        ) : (
          <SkeletonCard />
        )}

        {/* Product Breakdown */}
        {summary && summary.products.length > 0 && (
          <div className="space-y-3">
            <h2 className="text-lg font-semibold">What you got this month</h2>
            {summary.products.map((p) => (
              <div
                key={p.name}
                className="bg-card rounded-2xl p-4 soft-shadow border border-border/20"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">📦</span>
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
        )}

        {/* View History */}
        {summary && summary.transactions.length > 0 && (
          <button
            onClick={() => navigate("/dashboard/activity")}
            className="w-full bg-card rounded-2xl p-4 soft-shadow border border-border/20 flex items-center justify-between hover:border-primary/20 transition-all active:scale-[0.99]"
          >
            <span className="text-sm font-medium">See full history</span>
            <ArrowRight className="h-5 w-5 text-muted-foreground" />
          </button>
        )}

        {summary && summary.products.length === 0 && (
          <EmptyState
            icon="📦"
            title="Nothing recorded yet"
            description="Once your business logs some orders, they'll pop up here for you to browse."
          />
        )}
      </div>
    </AppShell>
  );
}
