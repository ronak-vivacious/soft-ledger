import { useQuery } from "@/lib/api-client";
import { api } from "@/lib/api-client";
import { AppShell } from "@/components/app/AppShell";
import { Money } from "@/components/app/MoneyDisplay";
import { SkeletonCard } from "@/components/app/SkeletonCard";
import { EmptyState } from "@/components/app/EmptyState";
import { PendingVerifications } from "@/components/app/PaymentStatus";
import { getGreeting } from "@/components/app/timeAgo";
import { useAuth } from "@/hooks/use-auth";
import { useNavigate } from "react-router";
import { Users, TrendingUp, IndianRupee, Repeat, ArrowRight } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { t } from "@/lib/i18n";

export default function VendorHome() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const overview = useQuery(api.dashboard.vendorOverview);

  const greeting = getGreeting();
  const firstName = user?.name?.split(" ")[0] || "there";

  if (overview === undefined) {
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

  if (overview === null) {
    return (
      <AppShell role="vendor">
        <EmptyState
          icon="🏪"
          title="Set up your business"
          description="Reload the page to finish setting up."
        />
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
          <p className="text-muted-foreground mt-1">{t("vendorHelloSuffix")}</p>
        </div>

        {/* Actionable: verifications first */}
        <PendingVerifications />

        {/* Today's Summary Card */}
        <Card className="border-border/30 soft-shadow-md bg-gradient-to-br from-primary/5 to-teal-light/30">
          <CardContent className="p-6">
            <p className="text-sm font-medium text-muted-foreground mb-3">
              {t("todayAtGlance")}
            </p>
            <div className="grid grid-cols-3 gap-4">
              <div className="text-center">
                <div className="flex items-center justify-center mb-2">
                  <div className="h-9 w-9 rounded-xl bg-primary/10 flex items-center justify-center">
                    <Users className="h-4 w-4 text-primary" />
                  </div>
                </div>
                <p className="text-2xl font-bold tabular-nums">{overview.todayCount}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{t("customers")}</p>
              </div>
              <div className="text-center">
                <div className="flex items-center justify-center mb-2">
                  <div className="h-9 w-9 rounded-xl bg-primary/10 flex items-center justify-center">
                    <TrendingUp className="h-4 w-4 text-primary" />
                  </div>
                </div>
                <p className="text-2xl font-bold tabular-nums">{overview.activeSubscriptions}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{t("activeSubs")}</p>
              </div>
              <div className="text-center">
                <div className="flex items-center justify-center mb-2">
                  <div className="h-9 w-9 rounded-xl bg-primary/10 flex items-center justify-center">
                    <IndianRupee className="h-4 w-4 text-primary" />
                  </div>
                </div>
                <Money amount={overview.todayPurchases} size="lg" className="block text-center" />
                <p className="text-xs text-muted-foreground mt-0.5">{t("earnedToday")}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Outstanding */}
        <button
          onClick={() => navigate("/dashboard/customers")}
          className="w-full bg-card rounded-2xl p-5 soft-shadow border border-border/30 flex items-center justify-between hover:border-primary/20 transition-all active:scale-[0.99]"
        >
          <div>
            <p className="text-sm text-muted-foreground">{t("stillOwed")}</p>
            <Money amount={overview.totalOutstanding} size="lg" className="text-error" />
            {overview.overdueCustomers.length > 0 && (
              <p className="text-xs text-muted-foreground mt-1">
                Top: {overview.overdueCustomers.map((c: any) => c.name).join(", ")}
              </p>
            )}
          </div>
          <ArrowRight className="h-5 w-5 text-muted-foreground" />
        </button>

        {/* Month progress */}
        <button
          onClick={() => navigate("/dashboard/activity")}
          className="w-full bg-card rounded-2xl p-5 soft-shadow border border-border/30 flex items-center justify-between hover:border-primary/20 transition-all active:scale-[0.99]"
        >
          <div>
            <p className="text-sm text-muted-foreground">{t("monthBilled")}</p>
            <Money amount={overview.monthBilled} size="lg" />
            <p className="text-xs text-success mt-1">
              {t("receivedMonth")}: <Money amount={overview.paymentsReceivedMonth} size="sm" className="text-success" />
            </p>
          </div>
          <ArrowRight className="h-5 w-5 text-muted-foreground" />
        </button>

        {/* Recent Activity */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-semibold">{t("recentOrders")}</h2>
            <button
              onClick={() => navigate("/dashboard/activity")}
              className="text-sm text-primary font-medium hover:underline"
            >
              {t("seeAll")}
            </button>
          </div>

          {overview.recentActivity.length === 0 ? (
            <EmptyState
              icon="📝"
              title={t("noOrdersToday")}
              description={t("noOrdersTodayDesc")}
            />
          ) : (
            <div className="space-y-2">
              {overview.recentActivity.map((tx: any) => (
                <div
                  key={tx._id}
                  className="bg-card rounded-2xl p-4 soft-shadow border border-border/20"
                >
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-semibold text-sm">
                      {tx.customerName.charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate">{tx.customerName}</p>
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
