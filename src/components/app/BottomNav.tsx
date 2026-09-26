import { useQuery } from "@/lib/api-client";
import { api } from "@/lib/api-client";
import { Home, Users, Activity, Settings, Package, Repeat, Bell } from "lucide-react";
import { useNavigate, useLocation } from "react-router";
import { cn } from "@/lib/utils";
import { t } from "@/lib/i18n";

interface NavItem {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  path: string;
  badge?: number;
}

export function BottomNav({ role }: { role: "vendor" | "customer" }) {
  const navigate = useNavigate();
  const location = useLocation();
  const unread = useQuery(api.dashboard.unreadCount);

  const vendorNav: NavItem[] = [
    { icon: Home, label: t("navHome"), path: "/dashboard" },
    { icon: Users, label: t("navCustomers"), path: "/dashboard/customers" },
    { icon: Repeat, label: t("subscriptions"), path: "/dashboard/subscriptions" },
    { icon: Bell, label: "Alerts", path: "/dashboard/notifications", badge: unread },
    { icon: Settings, label: t("navMore"), path: "/dashboard/more" },
  ];

  const customerNav: NavItem[] = [
    { icon: Home, label: t("navHome"), path: "/dashboard" },
    { icon: Activity, label: t("navActivity"), path: "/dashboard/activity" },
    { icon: Bell, label: "Alerts", path: "/dashboard/notifications", badge: unread },
    { icon: Settings, label: t("navMore"), path: "/dashboard/more" },
  ];

  const items = role === "vendor" ? vendorNav : customerNav;

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-50 bg-white/90 backdrop-blur-lg border-t border-border/50 safe-area-pb"
      role="navigation"
      aria-label="Main navigation"
    >
      <div className="mx-auto max-w-lg flex items-center justify-around px-1 py-1">
        {items.map((item) => {
          const isActive =
            item.path === "/dashboard"
              ? location.pathname === "/dashboard"
              : location.pathname.startsWith(item.path);

          return (
            <button
              key={item.path}
              onClick={() => navigate(item.path)}
              className={cn(
                "relative flex flex-col items-center gap-0.5 px-3 py-2 rounded-xl transition-all duration-200",
                isActive
                  ? "text-primary"
                  : "text-muted-foreground hover:text-foreground",
              )}
              aria-current={isActive ? "page" : undefined}
            >
              <span className="relative">
                <item.icon className={cn("h-5 w-5", isActive && "scale-110")} />
                {item.badge !== undefined && item.badge > 0 && (
                  <span className="absolute -top-1.5 -right-2 h-4 min-w-4 px-1 rounded-full bg-error text-white text-[10px] font-bold flex items-center justify-center">
                    {item.badge > 9 ? "9+" : item.badge}
                  </span>
                )}
              </span>
              <span
                className={cn(
                  "text-[11px] font-medium",
                  isActive && "font-semibold",
                )}
              >
                {item.label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}

// Keep the old Package import used for potential vendor quick-links.
export const _icons = { Package };
