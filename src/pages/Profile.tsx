import { useState } from "react";
import { useMutation, useQuery } from "@/lib/api-client";
import { api } from "@/lib/api-client";
import { AppShell } from "@/components/app/AppShell";
import { useAuth } from "@/hooks/use-auth";
import { useNavigate } from "react-router";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SkeletonCard } from "@/components/app/SkeletonCard";
import { LogOut, Check, AtSign } from "lucide-react";
import { toast } from "sonner";
import { t } from "@/lib/i18n";

export default function Profile() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const business = useQuery(api.businesses.getByUser);

  const [name, setName] = useState(user?.name ?? "");
  const [phone, setPhone] = useState(user?.phone ?? "");
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);

  const updateProfile = useMutation(api.users.updateProfile);

  const handleSave = async () => {
    if (!name.trim()) return;
    setSaving(true);
    try {
      await updateProfile({ name: name.trim(), phone: phone.trim() || undefined });
      setDone(true);
      toast.success(t("profileSaved"));
      setTimeout(() => {
        setDone(false);
        setSaving(false);
      }, 1000);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("errGeneric"));
      setSaving(false);
    }
  };

  const handleSignOut = async () => {
    await signOut();
    navigate("/");
  };

  if (!user) return <SkeletonCard />;

  return (
    <AppShell role={user.role === "vendor" ? "vendor" : "customer"}>
      <div className="space-y-6 pt-4 pb-8">
        <h1 className="text-2xl font-bold">{t("profile")}</h1>

        {/* Identity card */}
        <div className="bg-card rounded-2xl p-5 soft-shadow border border-border/20">
          <div className="flex items-center gap-4">
            <div className="h-14 w-14 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-lg">
              {user.name?.charAt(0)?.toUpperCase() || "?"}
            </div>
            <div className="min-w-0">
              <p className="font-semibold text-base truncate">{user.name || "—"}</p>
              <p className="text-sm text-muted-foreground">
                {user.role === "vendor" ? t("businessOwner") : t("customer")}
              </p>
              {user.username && (
                <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1">
                  <AtSign className="h-3 w-3" />
                  {user.username}
                </p>
              )}
            </div>
          </div>
          {user.role === "vendor" && business?.username && (
            <p className="text-xs text-muted-foreground mt-3 border-t border-border/30 pt-3">
              Customers find your business at{" "}
              <span className="font-mono font-semibold text-foreground">
                @{business.username}
              </span>
            </p>
          )}
        </div>

        {/* Edit form */}
        <div className="bg-card rounded-2xl p-5 soft-shadow border border-border/20 space-y-4">
          <p className="text-sm font-medium">{t("editProfile")}</p>
          <div>
            <label className="text-sm text-muted-foreground block mb-1.5 px-1">
              Name
            </label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name" />
          </div>
          <div>
            <label className="text-sm text-muted-foreground block mb-1.5 px-1">
              {t("phoneLabel")}
            </label>
            <Input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="98765 43210"
            />
          </div>
          <Button
            onClick={handleSave}
            disabled={saving || !name.trim()}
            className="w-full h-12 rounded-2xl bg-primary hover:bg-primary/90 font-semibold"
          >
            {done ? (
              <>
                <Check className="h-4 w-4 mr-1" /> Saved
              </>
            ) : (
              t("save")
            )}
          </Button>
        </div>

        {/* Actions */}
        <div className="bg-card rounded-2xl soft-shadow border border-border/20 overflow-hidden">
          <button
            onClick={handleSignOut}
            className="w-full flex items-center gap-3 px-5 py-4 hover:bg-error-light/50 transition-colors"
          >
            <div className="h-9 w-9 rounded-xl bg-error-light flex items-center justify-center">
              <LogOut className="h-4 w-4 text-error" />
            </div>
            <div className="text-left flex-1">
              <p className="text-sm font-medium text-error">{t("signOut")}</p>
            </div>
          </button>
        </div>
      </div>
    </AppShell>
  );
}
