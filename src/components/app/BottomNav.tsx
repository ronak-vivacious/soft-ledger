import { Home, Users, Activity, Settings } from "lucide-react";
import { useNavigate, useLocation } from "react-router";
import { cn } from "@/lib/utils";

interface NavItem {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  path: string;
}

const vendorNav: NavItem[] = [
  { icon: Home, label: "Home", path: "/dashboard" },
  { icon: Users, label: "Customers", path: "/dashboard/customers" },
  { icon: Activity, label: "Activity", path: "/dashboard/activity" },
  { icon: Settings, label: "More", path: "/dashboard/more" },
];

const customerNav: NavItem[] = [
  { icon: Home, label: "Home", path: "/dashboard" },
  { icon: Activity, label: "Activity", path: "/dashboard/activity" },
  { icon: Settings, label: "More", path: "/dashboard/more" },
];

export function BottomNav({ role }: { role: "vendor" | "customer" }) {
  const navigate = useNavigate();
  const location = useLocation();
  const items = role === "vendor" ? vendorNav : customerNav;

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-50 bg-white/90 backdrop-blur-lg border-t border-border/50 safe-area-pb"
      role="navigation"
      aria-label="Main navigation"
    >
      <div className="mx-auto max-w-lg flex items-center justify-around px-2 py-1">
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
                "flex flex-col items-center gap-0.5 px-4 py-2 rounded-xl transition-all duration-200",
                isActive
                  ? "text-primary"
                  : "text-muted-foreground hover:text-foreground",
              )}
              aria-current={isActive ? "page" : undefined}
            >
              <item.icon className={cn("h-5 w-5", isActive && "scale-110")} />
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
