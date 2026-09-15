import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { AppShell } from "@/components/app/AppShell";
import { Money, formatMoney } from "@/components/app/MoneyDisplay";
import { SkeletonCard } from "@/components/app/SkeletonCard";
import { EmptyState } from "@/components/app/EmptyState";
import { getGreeting, getToday } from "@/components/app/timeAgo";
import { useAuth } from "@/hooks/use-auth";
import { useNavigate } from "react-router";
import { Users, TrendingUp, IndianRupee, ArrowRight } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

export default function VendorHome() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const business = useQuery(api.businesses.getByUser);
  const today = getToday();
  const todaySummary = useQuery(
    api.dashboard.todaySummary,
    business ? { businessId: business._id, date: today } : "skip",
  );
  const recentActivity = useQuery(
    api.dashboard.recentActivity,
    business ? { businessId: business._id, date: today, limit: 5 } : "skip",
  );
  const outstanding = useQuery(
    api.dashboard.totalOutstanding,
    business ? { businessId: business._id } : "skip",
  );

  const greeting = getGreeting();
  const firstName = user?.name?.split(" ")[0] || "there";

  if (!business) {
    return (
      <AppShell role="vendor">
        <div className="space-y-4 pt-4">
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell role="vendor">
      <div className="space-y-6 pt-4">
        {/* Greeting */}
        <div>
          <h1 className="text-2xl font-bold text-foreground">
            {greeting}, {firstName} 👋
          </h1>
          <p className="text-muted-foreground mt-1">
            Here&apos;s how {business.name} is doing today
          </p>
        </div>

        {/* Today's Summary Card */}
        {todaySummary ? (
          <Card className="border-border/30 soft-shadow-md bg-gradient-to-br from-primary/5 to-teal-light/30">
            <CardContent className="p-6">
              <p className="text-sm font-medium text-muted-foreground mb-3">
                Today at a glance
              </p>
              <div className="grid grid-cols-3 gap-4">
                <div className="text-center">
                  <div className="flex items-center justify-center mb-2">
                    <div className="h-9 w-9 rounded-xl bg-primary/10 flex items-center justify-center">
                      <Users className="h-4.5 w-4.5 text-primary" />
                    </div>
                  </div>
                  <p className="text-2xl font-bold tabular-nums">
                    {todaySummary.customerCount}
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    customers
                  </p>
                </div>
                <div className="text-center">
                  <div className="flex items-center justify-center mb-2">
                    <div className="h-9 w-9 rounded-xl bg-primary/10 flex items-center justify-center">
                      <TrendingUp className="h-4.5 w-4.5 text-primary" />
                    </div>
                  </div>
                  <p className="text-2xl font-bold tabular-nums">
                    {todaySummary.totalQuantity}
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    units
                  </p>
                </div>
                <div className="text-center">
                  <div className="flex items-center justify-center mb-2">
                    <div className="h-9 w-9 rounded-xl bg-primary/10 flex items-center justify-center">
                      <IndianRupee className="h-4.5 w-4.5 text-primary" />
                    </div>
                  </div>
                  <Money
                    amount={todaySummary.totalAmount}
                    size="lg"
                    className="block text-center"
                  />
                  <p className="text-xs text-muted-foreground mt-0.5">
                    earned
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        ) : (
          <SkeletonCard />
        )}

        {/* Outstanding */}
        {outstanding !== undefined && outstanding > 0 && (
          <button
            onClick={() => navigate("/dashboard/customers")}
            className="w-full bg-card rounded-2xl p-5 soft-shadow border border-border/30 flex items-center justify-between hover:border-primary/20 transition-all active:scale-[0.99]"
          >
            <div>
              <p className="text-sm text-muted-foreground">Still owed</p>
              <Money amount={outstanding} size="lg" className="text-error" />
            </div>
            <ArrowRight className="h-5 w-5 text-muted-foreground" />
          </button>
        )}

        {/* Recent Activity */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-semibold">Recent orders</h2>
            <button
              onClick={() => navigate("/dashboard/activity")}
              className="text-sm text-primary font-medium hover:underline"
            >
              See all
            </button>
          </div>

          {!recentActivity ? (
            <div className="space-y-2">
              {[1, 2, 3].map((i) => (
                <div
                  key={i}
                  className="bg-card rounded-2xl p-4 soft-shadow animate-pulse"
                >
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 bg-muted rounded-full" />
                    <div className="flex-1">
                      <div className="h-4 w-24 bg-muted rounded mb-2" />
                      <div className="h-3 w-16 bg-muted rounded" />
                    </div>
                    <div className="h-5 w-16 bg-muted rounded-full" />
                  </div>
                </div>
              ))}
            </div>
          ) : recentActivity.length === 0 ? (
            <EmptyState
              icon="📝"
              title="No orders yet today"
              description="When you start logging orders, they'll show up right here."
            />
          ) : (
            <div className="space-y-2">
              {recentActivity.map((tx) => (
                <div
                  key={tx._id}
                  className="bg-card rounded-2xl p-4 soft-shadow border border-border/20"
                >
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-semibold text-sm">
                      {tx.customerName.charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate">
                        {tx.customerName}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {tx.productName} · {tx.quantity} {tx.productUnit}
                      </p>
                    </div>
                    <Money amount={tx.totalAmount} size="sm" />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </AppShell>
  );
}
