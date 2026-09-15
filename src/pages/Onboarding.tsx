import { useState } from "react";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useAuth } from "@/hooks/use-auth";
import { useNavigate } from "react-router";
import { Button } from "@/components/ui/button";
import { Building2, ArrowRight } from "lucide-react";

export default function Onboarding() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const createBusiness = useMutation(api.businesses.create);
  const [businessName, setBusinessName] = useState("");
  const [phone, setPhone] = useState("");
  const [saving, setSaving] = useState(false);

  const handleCreate = async () => {
    if (!businessName.trim()) return;
    setSaving(true);
    try {
      await createBusiness({
        name: businessName.trim(),
        phone: phone.trim() || undefined,
      });
      navigate("/dashboard");
    } catch {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <div className="flex-1 flex flex-col items-center justify-center px-6">
        <div className="w-full max-w-sm">
          {/* Icon */}
          <div className="flex justify-center mb-6">
            <div className="h-20 w-20 rounded-3xl bg-primary/10 flex items-center justify-center">
              <Building2 className="h-10 w-10 text-primary" />
            </div>
          </div>

          <h1 className="text-2xl font-bold text-center mb-2">
            What&apos;s your business called?
          </h1>
          <p className="text-muted-foreground text-center mb-8">
            This is how your customers will see you in Soft Ledger.
          </p>

          <div className="space-y-4">
            <div>
              <label className="text-sm text-muted-foreground block mb-1.5 px-1">
                Business name *
              </label>
              <input
                type="text"
                value={businessName}
                onChange={(e) => setBusinessName(e.target.value)}
                placeholder="e.g. Sunrise Dairy, Galaxy Traders"
                className="w-full px-4 py-3.5 bg-card rounded-2xl border border-border/50 text-base outline-none focus:ring-2 focus:ring-primary/30 transition-all"
                autoFocus
              />
            </div>

            <div>
              <label className="text-sm text-muted-foreground block mb-1.5 px-1">
                Phone (optional)
              </label>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="e.g. 98765 43210"
                className="w-full px-4 py-3.5 bg-card rounded-2xl border border-border/50 text-base outline-none focus:ring-2 focus:ring-primary/30 transition-all"
              />
            </div>

            <Button
              onClick={handleCreate}
              disabled={saving || !businessName.trim()}
              className="w-full h-14 rounded-2xl text-base font-semibold bg-primary hover:bg-primary/90 active:scale-[0.98] transition-all mt-6"
            >
              {saving ? (
                <span className="animate-pulse">Setting things up...</span>
              ) : (
                <>
                  Let&apos;s go
                  <ArrowRight className="ml-2 h-5 w-5" />
                </>
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
