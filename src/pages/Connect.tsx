import { useState } from "react";
import { useMutation, useQuery } from "@/lib/api-client";
import { api } from "@/lib/api-client";
import { AppShell } from "@/components/app/AppShell";
import { SkeletonCard } from "@/components/app/SkeletonCard";
import { EmptyState } from "@/components/app/EmptyState";
import { useNavigate } from "react-router";
import { AtSign, Check, X, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { t } from "@/lib/i18n";

export default function Connect() {
  const navigate = useNavigate();
  const vendor = useQuery(api.customers.getMyVendor);
  const requests = useQuery(api.connections.getMyRequests);
  const sendRequest = useMutation(api.connections.sendCustomerRequest);

  const [username, setUsername] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  const handleRequest = async () => {
    const handle = username.trim().replace(/^@/, "").toLowerCase();
    if (!handle) return;
    setSending(true);
    try {
      const businessName = await sendRequest({ username: handle });
      toast.success(`Request sent to ${businessName}`);
      setSent(true);
      setUsername("");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("errGeneric"));
    } finally {
      setSending(false);
    }
  };

  return (
    <AppShell role="customer">
      <div className="space-y-6 pt-4 pb-8">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate("/dashboard")}
            className="h-10 w-10 rounded-full bg-card soft-shadow flex items-center justify-center hover:bg-muted transition-all"
            aria-label={t("back")}
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <h1 className="text-2xl font-bold">{t("findVendor")}</h1>
        </div>

        {/* Connected vendor */}
        {vendor?.active && (
          <div className="bg-card rounded-2xl p-5 soft-shadow border border-success/30">
            <p className="text-xs text-muted-foreground">{t("connectedVendors")}</p>
            <div className="flex items-center gap-3 mt-2">
              <div className="h-12 w-12 rounded-2xl bg-primary/10 flex items-center justify-center text-primary font-bold">
                {vendor.name.charAt(0).toUpperCase()}
              </div>
              <div>
                <p className="font-semibold">{vendor.name}</p>
                <p className="text-xs text-success flex items-center gap-1">
                  <Check className="h-3 w-3" /> Connected
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Search by username */}
        <div className="bg-card rounded-2xl p-5 soft-shadow border border-border/20 space-y-4">
          <div>
            <p className="text-sm font-medium">{t("findVendorDesc")}</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              They accept the request before you're connected — keeps both sides safe.
            </p>
          </div>
          <div className="relative">
            <AtSign className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value.toLowerCase())}
              placeholder="vendorname"
              className="w-full pl-10 pr-4 py-3 bg-background rounded-2xl border border-border/50 text-base outline-none focus:ring-2 focus:ring-primary/30 transition-all font-mono"
            />
          </div>
          <Button
            onClick={handleRequest}
            disabled={sending || !username.trim()}
            className="w-full h-12 rounded-2xl bg-primary hover:bg-primary/90 font-semibold"
          >
            {sending ? "Sending…" : t("requestConnection")}
          </Button>
          {sent && (
            <p className="text-xs text-success text-center">{t("requestSent")}</p>
          )}
        </div>

        {/* Pending requests addressed to me */}
        <div className="space-y-2">
          <h2 className="text-lg font-semibold">{t("connectionRequests")}</h2>
          {!requests ? (
            <SkeletonCard />
          ) : requests.length === 0 ? (
            <EmptyState
              icon="🤝"
              title={t("noRequests")}
              description="When a vendor invites you, it shows up here."
            />
          ) : (
            requests.map((r: any) => (
              <RequestCard key={r._id} requestId={r._id} businessName={r.businessName} />
            ))
          )}
        </div>
      </div>
    </AppShell>
  );
}

function RequestCard({
  requestId,
  businessName,
}: {
  requestId: string;
  businessName: string;
}) {
  const respond = useMutation(api.connections.respondToRequest);
  const [busy, setBusy] = useState(false);

  const act = async (accept: boolean) => {
    setBusy(true);
    try {
      await respond({ requestId: requestId as never, accept });
      toast.success(accept ? `Connected to ${businessName}!` : "Request declined");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("errGeneric"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="bg-card rounded-2xl p-4 soft-shadow border border-border/20">
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-semibold text-sm">
          {businessName.charAt(0).toUpperCase()}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium truncate">{businessName}</p>
          <p className="text-xs text-muted-foreground">wants to connect with you</p>
        </div>
      </div>
      <div className="flex gap-2 mt-3">
        <Button
          size="sm"
          className="flex-1 bg-success hover:bg-success/90 text-white"
          disabled={busy}
          onClick={() => act(true)}
        >
          <Check className="h-4 w-4 mr-1" /> {t("accept")}
        </Button>
        <Button
          size="sm"
          variant="outline"
          className="flex-1"
          disabled={busy}
          onClick={() => act(false)}
        >
          <X className="h-4 w-4 mr-1" /> {t("decline")}
        </Button>
      </div>
    </div>
  );
}
