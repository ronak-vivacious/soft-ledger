import { useState } from "react";
import { useQuery } from "@/lib/api-client";
import { api } from "@/lib/api-client";
import { AppShell } from "@/components/app/AppShell";
import { Money } from "@/components/app/MoneyDisplay";
import { SkeletonCard } from "@/components/app/SkeletonCard";
import { EmptyState } from "@/components/app/EmptyState";
import { PendingVerifications } from "@/components/app/PaymentStatus";
import { getGreeting, getMonthName, getYearMonth } from "@/components/app/timeAgo";
import { useAuth } from "@/hooks/use-auth";
import { useNavigate } from "react-router";
import { Card, CardContent } from "@/components/ui/card";
import { ArrowRight } from "lucide-react";
import { PaymentSheet } from "@/components/app/PaymentSheet";
import { t } from "@/lib/i18n";

export default function CustomerHome() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const overview = useQuery(api.dashboard.customerOverview);
  const vendor = useQuery(api.customers.getMyVendor);
  const me = useQuery(api.customers.getByLinkedUser);
  const [payOpen, setPayOpen] = useState(false);

  const greeting = getGreeting();
  const firstName = user?.name?.split(" ")[0] || "there";

  if (overview === undefined) {
    return (
      <AppShell role="customer">
        <div className="space-y-4 pt-4">
          <SkeletonCard />
          <SkeletonCard />
        </div>
      </AppShell>
    );
  }

  if (overview === null) {
    return (
      <AppShell role="customer">
        <EmptyState
          icon="🤝"
          title={t("noVendor")}
          description={t("noVendorDesc")}
          action={
            <button
              onClick={() => navigate("/dashboard/connect")}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 active:scale-95 transition-all"
            >
              {t("findVendor")}
            </button>
          }
        />
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
            {overview.businessName} · {getMonthName(getYearMonth())}
          </p>
        </div>

        {/* Actionable: verifications first */}
        <PendingVerifications />

        {/* Balance Card */}
        <Card className="border-border/30 soft-shadow-md bg-gradient-to-br from-primary/5 to-teal-light/30">
          <CardContent className="p-6 text-center">
            {overview.outstanding > 0 ? (
              <>
                <p className="text-sm text-muted-foreground">{t("outstandingBalance")}</p>
                <Money amount={overview.outstanding} size="xl" className="text-error block mt-1" />
              </>
            ) : (
              <>
                <p className="text-sm text-success font-medium">✓ {t("inCredit")}</p>
                <Money amount={overview.credit} size="lg" className="text-success block mt-1" />
              </>
            )}
            <div className="flex justify-center gap-8 mt-4">
              <div>
                <p className="text-xs text-muted-foreground">{t("monthBilled")}</p>
                <Money amount={overview.monthBilled} size="md" className="block" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">{t("paid")}</p>
                <Money amount={overview.monthPaid} size="md" className="text-success block" />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Record payment CTA */}
        <button
          onClick={() => setPayOpen(true)}
          className="w-full h-12 rounded-2xl bg-success text-white text-sm font-semibold soft-shadow hover:bg-success/90 active:scale-[0.98] transition-all"
        >
          ₹ {t("payNow")}
        </button>

        {/* Active subscriptions shortcut */}
        {overview.activeSubscriptions > 0 && (
          <button
            onClick={() => navigate("/dashboard/subscriptions")}
            className="w-full bg-card rounded-2xl p-4 soft-shadow border border-border/20 flex items-center justify-between hover:border-primary/20 transition-all active:scale-[0.99]"
          >
            <span className="text-sm font-medium">
              🔁 {overview.activeSubscriptions} {t("activeSubs")}
            </span>
            <ArrowRight className="h-5 w-5 text-muted-foreground" />
          </button>
        )}

        {/* Recent activity */}
        {overview.recentActivity.length > 0 && (
          <div className="space-y-2">
            <h2 className="text-lg font-semibold">{t("whatYouGot")}</h2>
            {overview.recentActivity.map((tx: any) => (
              <div
                key={tx._id}
                className="bg-card rounded-2xl p-4 soft-shadow border border-border/20"
              >
                <div className="flex items-center gap-3">
                  <span className="text-xl">📦</span>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm truncate">{tx.productName}</p>
                    <p className="text-xs text-muted-foreground">
                      {tx.quantity} {tx.productUnit}
                    </p>
                  </div>
                  <Money amount={tx.totalAmount} size="sm" />
                </div>
              </div>
            ))}
            <button
              onClick={() => navigate("/dashboard/activity")}
              className="w-full bg-card rounded-2xl p-4 soft-shadow border border-border/20 flex items-center justify-between hover:border-primary/20 transition-all active:scale-[0.99]"
            >
              <span className="text-sm font-medium">{t("seeAll")}</span>
              <ArrowRight className="h-5 w-5 text-muted-foreground" />
            </button>
          </div>
        )}

        {overview.recentActivity.length === 0 && (
          <EmptyState
            icon="📦"
            title={t("nothingRecorded")}
            description={t("nothingRecordedDesc")}
          />
        )}
      </div>

      {overview && me && (
        <PaymentSheet
          open={payOpen}
          onClose={() => setPayOpen(false)}
          customerId={me._id}
          customerName={overview.businessName}
          currentDue={Math.max(0, overview.outstanding)}
          recordedByRole="customer"
        />
      )}
    </AppShell>
  );
}
