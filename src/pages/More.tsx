import { useQuery } from "@/lib/api-client";
import { api } from "@/lib/api-client";
import { AppShell } from "@/components/app/AppShell";
import { useAuth } from "@/hooks/use-auth";
import { useNavigate } from "react-router";
import {
  QrCode,
  Users,
  Info,
  Package,
  Repeat,
  Bell,
  UserCircle,
} from "lucide-react";
import { t } from "@/lib/i18n";

export default function More() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const business = useQuery(api.businesses.getByUser);
  const unread = useQuery(api.dashboard.unreadCount);
  const isVendor = !!business;

  return (
    <AppShell role={isVendor ? "vendor" : "customer"}>
      <div className="space-y-6 pt-4">
        <h1 className="text-2xl font-bold">{t("navMore")}</h1>

        {/* Profile Card */}
        <button
          onClick={() => navigate("/dashboard/profile")}
          className="w-full bg-card rounded-2xl p-5 soft-shadow border border-border/20 text-left hover:border-primary/20 transition-all"
        >
          <div className="flex items-center gap-4">
            <div className="h-14 w-14 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-lg">
              {user?.name?.charAt(0)?.toUpperCase() || "?"}
            </div>
            <div className="min-w-0 flex-1">
              <p className="font-semibold text-base truncate">{user?.name || "Guest"}</p>
              <p className="text-sm text-muted-foreground">
                {isVendor ? t("businessOwner") : t("customer")}
                {user?.username ? ` · @${user.username}` : ""}
              </p>
            </div>
            <UserCircle className="h-5 w-5 text-muted-foreground" />
          </div>
        </button>

        {/* Notifications */}
        <button
          onClick={() => navigate("/dashboard/notifications")}
          className="w-full bg-card rounded-2xl px-5 py-4 soft-shadow border border-border/20 flex items-center gap-3 hover:border-primary/20 transition-all"
        >
          <div className="h-9 w-9 rounded-xl bg-primary/10 flex items-center justify-center">
            <Bell className="h-4 w-4 text-primary" />
          </div>
          <div className="text-left flex-1">
            <p className="text-sm font-medium">{t("notifications")}</p>
            <p className="text-xs text-muted-foreground">
              Reminders, verifications and requests
            </p>
          </div>
          {unread !== undefined && unread > 0 && (
            <span className="h-5 min-w-5 px-1.5 rounded-full bg-error text-white text-xs font-semibold flex items-center justify-center">
              {unread > 9 ? "9+" : unread}
            </span>
          )}
        </button>

        {/* Menu Items */}
        <div className="bg-card rounded-2xl soft-shadow border border-border/20 overflow-hidden">
          {isVendor && (
            <>
              <button
                onClick={() => navigate("/dashboard/products")}
                className="w-full flex items-center gap-3 px-5 py-4 hover:bg-muted/50 transition-colors border-b border-border/20"
              >
                <div className="h-9 w-9 rounded-xl bg-peach/20 flex items-center justify-center">
                  <Package className="h-4 w-4 text-peach" />
                </div>
                <div className="text-left flex-1">
                  <p className="text-sm font-medium">{t("products")}</p>
                  <p className="text-xs text-muted-foreground">{t("productsDesc")}</p>
                </div>
              </button>

              <button
                onClick={() => navigate("/dashboard/subscriptions")}
                className="w-full flex items-center gap-3 px-5 py-4 hover:bg-muted/50 transition-colors border-b border-border/20"
              >
                <div className="h-9 w-9 rounded-xl bg-primary/10 flex items-center justify-center">
                  <Repeat className="h-4 w-4 text-primary" />
                </div>
                <div className="text-left flex-1">
                  <p className="text-sm font-medium">{t("subscriptions")}</p>
                  <p className="text-xs text-muted-foreground">{t("subscriptionsDesc")}</p>
                </div>
              </button>

              <button
                onClick={() => navigate("/dashboard/customers")}
                className="w-full flex items-center gap-3 px-5 py-4 hover:bg-muted/50 transition-colors border-b border-border/20"
              >
                <div className="h-9 w-9 rounded-xl bg-teal-light flex items-center justify-center">
                  <Users className="h-4 w-4 text-teal" />
                </div>
                <div className="text-left flex-1">
                  <p className="text-sm font-medium">{t("manageCustomers")}</p>
                  <p className="text-xs text-muted-foreground">{t("viewAndEdit")}</p>
                </div>
              </button>

              <button
                onClick={() => navigate("/dashboard/more/invite")}
                className="w-full flex items-center gap-3 px-5 py-4 hover:bg-muted/50 transition-colors border-b border-border/20"
              >
                <div className="h-9 w-9 rounded-xl bg-lavender/20 flex items-center justify-center">
                  <QrCode className="h-4 w-4 text-lavender" />
                </div>
                <div className="text-left flex-1">
                  <p className="text-sm font-medium">{t("inviteCustomers")}</p>
                  <p className="text-xs text-muted-foreground">
                    Share a QR code or link
                  </p>
                </div>
              </button>
            </>
          )}

          {!isVendor && (
            <button
              onClick={() => navigate("/dashboard/connect")}
              className="w-full flex items-center gap-3 px-5 py-4 hover:bg-muted/50 transition-colors border-b border-border/20"
            >
              <div className="h-9 w-9 rounded-xl bg-teal-light flex items-center justify-center">
                <Users className="h-4 w-4 text-teal" />
              </div>
              <div className="text-left flex-1">
                <p className="text-sm font-medium">{t("findVendor")}</p>
                <p className="text-xs text-muted-foreground">{t("findVendorDesc")}</p>
              </div>
            </button>
          )}

          <button className="w-full flex items-center gap-3 px-5 py-4 hover:bg-muted/50 transition-colors">
            <div className="h-9 w-9 rounded-xl bg-muted flex items-center justify-center">
              <Info className="h-4 w-4 text-muted-foreground" />
            </div>
            <div className="text-left flex-1">
              <p className="text-sm font-medium">{t("aboutApp")}</p>
              <p className="text-xs text-muted-foreground">{t("appVersion")}</p>
            </div>
          </button>
        </div>
      </div>
    </AppShell>
  );
}
