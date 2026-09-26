import { useState } from "react";
import { useMutation, useQuery } from "@/lib/api-client";
import { api } from "@/lib/api-client";
import { useNavigate } from "react-router";
import { Button } from "@/components/ui/button";
import {
  Building2,
  ShoppingBag,
  ArrowRight,
  ArrowLeft,
  Search,
  Check,
  AtSign,
} from "lucide-react";
import { toast } from "sonner";
import { t } from "@/lib/i18n";

type Step = "pick" | "business" | "customer-search" | "customer-name" | "done";

const USERNAME_RE = /^[a-z0-9_]{3,24}$/;

export default function Onboarding() {
  const navigate = useNavigate();
  const createBusiness = useMutation(api.businesses.create);
  const sendCustomerRequest = useMutation(api.connections.sendCustomerRequest);

  const [step, setStep] = useState<Step>("pick");
  const [businessName, setBusinessName] = useState("");
  const [businessUsername, setBusinessUsername] = useState("");
  const [phone, setPhone] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedBusiness, setSelectedBusiness] = useState<{
    _id: string;
    name: string;
  } | null>(null);
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);

  const results = useQuery(
    api.businesses.searchByName,
    searchQuery.trim().length >= 1 ? { name: searchQuery.trim() } : "skip",
  );

  // --- Business owner path ---
  const handleCreateBusiness = async () => {
    if (!businessName.trim()) return;
    const username = businessUsername.trim().toLowerCase();
    if (username && !USERNAME_RE.test(username)) {
      toast.error(t("usernameHint"));
      return;
    }
    setSaving(true);
    try {
      await createBusiness({
        name: businessName.trim(),
        phone: phone.trim() || undefined,
        username: username || undefined,
      });
      setDone(true);
      setTimeout(() => navigate("/dashboard"), 1200);
    } catch (err) {
      setSaving(false);
      toast.error(err instanceof Error ? err.message : t("errGeneric"));
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <div className="flex-1 flex flex-col items-center justify-center px-6">
        <div className="w-full max-w-sm">
          {/* Done state */}
          {done && (
            <div className="flex flex-col items-center gap-4 py-10">
              <div className="h-16 w-16 rounded-full bg-success-light flex items-center justify-center">
                <Check className="h-8 w-8 text-success" />
              </div>
              <p className="text-xl font-semibold">You're all set!</p>
              <p className="text-muted-foreground text-center">
                Taking you to your dashboard…
              </p>
            </div>
          )}

          {/* Step: Pick role */}
          {!done && step === "pick" && (
            <>
              <h1 className="text-2xl font-bold text-center mb-2">
                Welcome to Soft Ledger!
              </h1>
              <p className="text-muted-foreground text-center mb-8">{t("pickRole")}</p>

              <div className="space-y-3">
                <button
                  onClick={() => setStep("business")}
                  className="w-full bg-card rounded-2xl p-5 soft-shadow border border-border/30 flex items-center gap-4 hover:border-primary/20 transition-all active:scale-[0.99]"
                >
                  <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                    <Building2 className="h-5 w-5 text-primary" />
                  </div>
                  <div className="text-left">
                    <p className="font-semibold">{t("iRunBusiness")}</p>
                    <p className="text-sm text-muted-foreground mt-0.5">
                      {t("iRunBusinessDesc")}
                    </p>
                  </div>
                </button>

                <button
                  onClick={() => setStep("customer-search")}
                  className="w-full bg-card rounded-2xl p-5 soft-shadow border border-border/30 flex items-center gap-4 hover:border-primary/20 transition-all active:scale-[0.99]"
                >
                  <div className="h-12 w-12 rounded-xl bg-success-light flex items-center justify-center shrink-0">
                    <ShoppingBag className="h-5 w-5 text-success" />
                  </div>
                  <div className="text-left">
                    <p className="font-semibold">{t("imCustomer")}</p>
                    <p className="text-sm text-muted-foreground mt-0.5">
                      {t("imCustomerDesc")}
                    </p>
                  </div>
                </button>
              </div>
            </>
          )}

          {/* Step: Business setup */}
          {!done && step === "business" && (
            <>
              <button
                onClick={() => setStep("pick")}
                className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-6 transition-colors"
              >
                <ArrowLeft className="h-4 w-4" />
                {t("back")}
              </button>

              <div className="flex justify-center mb-6">
                <div className="h-16 w-16 rounded-2xl bg-primary/10 flex items-center justify-center">
                  <Building2 className="h-8 w-8 text-primary" />
                </div>
              </div>

              <h1 className="text-2xl font-bold text-center mb-2">
                What's your business called?
              </h1>
              <p className="text-muted-foreground text-center mb-8">
                This is how your customers will see you in Soft Ledger.
              </p>

              <div className="space-y-4">
                <div>
                  <label className="text-sm text-muted-foreground block mb-1.5 px-1">
                    {t("businessNameLabel")} *
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
                  <label className="text-sm text-muted-foreground flex items-center gap-1 mb-1.5 px-1">
                    <AtSign className="h-3.5 w-3.5" />
                    {t("usernameLabel")} ({t("optional")})
                  </label>
                  <input
                    type="text"
                    value={businessUsername}
                    onChange={(e) => setBusinessUsername(e.target.value.toLowerCase())}
                    placeholder="e.g. sunrisedairy"
                    className="w-full px-4 py-3.5 bg-card rounded-2xl border border-border/50 text-base outline-none focus:ring-2 focus:ring-primary/30 transition-all font-mono"
                  />
                  <p className="text-xs text-muted-foreground mt-1 px-1">
                    {t("usernameHint")}
                  </p>
                </div>

                <div>
                  <label className="text-sm text-muted-foreground block mb-1.5 px-1">
                    {t("phoneLabel")}
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
                  onClick={handleCreateBusiness}
                  disabled={saving || !businessName.trim()}
                  className="w-full h-14 rounded-2xl text-base font-semibold bg-primary hover:bg-primary/90 active:scale-[0.98] transition-all mt-4"
                >
                  {saving ? (
                    <span className="animate-pulse">Setting things up…</span>
                  ) : (
                    <>
                      Let's go
                      <ArrowRight className="ml-2 h-5 w-5" />
                    </>
                  )}
                </Button>
              </div>
            </>
          )}

          {/* Step: Customer — search for business */}
          {!done && step === "customer-search" && (
            <>
              <button
                onClick={() => setStep("pick")}
                className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-6 transition-colors"
              >
                <ArrowLeft className="h-4 w-4" />
                {t("back")}
              </button>

              <div className="flex justify-center mb-6">
                <div className="h-16 w-16 rounded-2xl bg-success-light flex items-center justify-center">
                  <ShoppingBag className="h-8 w-8 text-success" />
                </div>
              </div>

              <h1 className="text-2xl font-bold text-center mb-2">{t("findVendor")}</h1>
              <p className="text-muted-foreground text-center mb-6">
                Search for the business you buy from.
              </p>

              {/* Search input */}
              <div className="relative mb-4">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Type a business name…"
                  className="w-full pl-10 pr-4 py-3.5 bg-card rounded-2xl border border-border/50 text-base outline-none focus:ring-2 focus:ring-primary/30 transition-all"
                  autoFocus
                />
              </div>

              {/* Results */}
              {results && results.length > 0 && (
                <div className="bg-card rounded-2xl soft-shadow border border-border/20 overflow-hidden">
                  {results.map((biz: any) => (
                    <button
                      key={biz._id}
                      onClick={async () => {
                        try {
                          const name = await sendCustomerRequest({ businessId: biz._id as never });
                          toast.success(`Request sent to ${name} — they must accept to connect.`);
                          navigate("/dashboard");
                        } catch (err) {
                          toast.error(err instanceof Error ? err.message : t("errGeneric"));
                        }
                      }}
                      className="w-full flex items-center gap-3 px-4 py-3.5 hover:bg-muted/50 transition-colors border-b border-border/10 last:border-0 text-left"
                    >
                      <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center text-primary font-semibold text-sm shrink-0">
                        {biz.name.charAt(0).toUpperCase()}
                      </div>
                      <span className="font-medium text-sm">{biz.name}</span>
                    </button>
                  ))}
                </div>
              )}

              {searchQuery.length >= 1 && results && results.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-6">
                  No businesses found matching &ldquo;{searchQuery}&rdquo;.
                  <br />
                  Try a different name, or ask the business for an invite link.
                </p>
              )}

              {searchQuery.length === 0 && (
                <p className="text-xs text-muted-foreground text-center py-4">
                  Start typing to search
                </p>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
