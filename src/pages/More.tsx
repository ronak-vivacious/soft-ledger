import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { AppShell } from "@/components/app/AppShell";
import { useAuth } from "@/hooks/use-auth";
import { useNavigate } from "react-router";
import {
  LogOut,
  QrCode,
  Users,
  Info,
} from "lucide-react";

export default function More() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const business = useQuery(api.businesses.getByUser);
  const isVendor = !!business;

  const handleSignOut = async () => {
    await signOut();
    navigate("/");
  };

  return (
    <AppShell role={isVendor ? "vendor" : "customer"}>
      <div className="space-y-6 pt-4">
        <h1 className="text-2xl font-bold">More</h1>

        {/* Profile Card */}
        <div className="bg-card rounded-2xl p-5 soft-shadow border border-border/20">
          <div className="flex items-center gap-4">
            <div className="h-14 w-14 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-lg">
              {user?.name?.charAt(0)?.toUpperCase() || "?"}
            </div>
            <div>
              <p className="font-semibold text-base">{user?.name || "Guest"}</p>
              <p className="text-sm text-muted-foreground">
                {isVendor ? "Business owner" : "Customer"}
              </p>
            </div>
          </div>
        </div>

        {/* Menu Items */}
        <div className="bg-card rounded-2xl soft-shadow border border-border/20 overflow-hidden">
          {isVendor && (
            <button
              onClick={() => navigate("/dashboard/more/invite")}
              className="w-full flex items-center gap-3 px-5 py-4 hover:bg-muted/50 transition-colors border-b border-border/20"
            >
              <div className="h-9 w-9 rounded-xl bg-lavender/20 flex items-center justify-center">
                <QrCode className="h-4.5 w-4.5 text-lavender" />
              </div>
              <div className="text-left flex-1">
                <p className="text-sm font-medium">Invite customers</p>
                <p className="text-xs text-muted-foreground">
                  Share a QR code or link
                </p>
              </div>
            </button>
          )}

          {isVendor && (
            <button
              onClick={() => navigate("/dashboard/customers")}
              className="w-full flex items-center gap-3 px-5 py-4 hover:bg-muted/50 transition-colors border-b border-border/20"
            >
              <div className="h-9 w-9 rounded-xl bg-peach/20 flex items-center justify-center">
                <Users className="h-4.5 w-4.5 text-peach" />
              </div>
              <div className="text-left flex-1">
                <p className="text-sm font-medium">Manage customers</p>
                <p className="text-xs text-muted-foreground">
                  View and edit customer details
                </p>
              </div>
            </button>
          )}

          <button className="w-full flex items-center gap-3 px-5 py-4 hover:bg-muted/50 transition-colors border-b border-border/20">
            <div className="h-9 w-9 rounded-xl bg-teal-light flex items-center justify-center">
              <Info className="h-4.5 w-4.5 text-teal" />
            </div>
            <div className="text-left flex-1">
              <p className="text-sm font-medium">About Soft Ledger</p>
              <p className="text-xs text-muted-foreground">
                Version 1.0 · Made with ❤️
              </p>
            </div>
          </button>

          <button
            onClick={handleSignOut}
            className="w-full flex items-center gap-3 px-5 py-4 hover:bg-error-light/50 transition-colors"
          >
            <div className="h-9 w-9 rounded-xl bg-error-light flex items-center justify-center">
              <LogOut className="h-4.5 w-4.5 text-error" />
            </div>
            <div className="text-left flex-1">
              <p className="text-sm font-medium text-error">Sign out</p>
            </div>
          </button>
        </div>
      </div>
    </AppShell>
  );
}
