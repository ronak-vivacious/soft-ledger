import { useState } from "react";
import { useMutation, useQuery } from "@/lib/api-client";
import { api } from "@/lib/api-client";
import { AppShell } from "@/components/app/AppShell";
import { formatMoney } from "@/components/app/MoneyDisplay";
import { SkeletonCard } from "@/components/app/SkeletonCard";
import { EmptyState } from "@/components/app/EmptyState";
import { formatDate } from "@/components/app/timeAgo";
import { Button } from "@/components/ui/button";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useNavigate } from "react-router";
import { Plus, Pause, Play, Square, Check } from "lucide-react";
import { toast } from "sonner";
import { t } from "@/lib/i18n";
import { cn } from "@/lib/utils";

type Sub = {
  _id: string;
  status: "active" | "paused" | "ended";
  quantity: number;
  frequency: "daily" | "weekly" | "monthly";
  startDate: string;
  customerId: string;
  productName: string;
  productUnit: string;
  productPrice: number;
  customerName: string;
};

type Customer = { _id: string; name: string };
type Product = { _id: string; name: string; unit: string; price: number; active?: boolean };

export default function Subscriptions() {
  const subs = useQuery(api.subscriptions.getMyBusiness, {});
  const customers = useQuery(api.customers.getByBusiness);
  const products = useQuery(api.products.getMine);
  const navigate = useNavigate();
  const [createOpen, setCreateOpen] = useState(false);

  const pause = useMutation(api.subscriptions.pause);
  const resume = useMutation(api.subscriptions.resume);
  const end = useMutation(api.subscriptions.end);

  const act = async (fn: () => Promise<unknown>, msg: string) => {
    try {
      await fn();
      toast.success(msg);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("errGeneric"));
    }
  };

  const active = subs?.filter((s: any) => s.status === "active") ?? [];
  const paused = subs?.filter((s: any) => s.status === "paused") ?? [];
  const ended = subs?.filter((s: any) => s.status === "ended") ?? [];

  return (
    <AppShell role="vendor">
      <div className="space-y-4 pt-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">{t("subscriptions")}</h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              {active.length} {t("active").toLowerCase()} · {paused.length} {t("paused").toLowerCase()}
            </p>
          </div>
          <button
            onClick={() => setCreateOpen(true)}
            className="h-11 w-11 rounded-full bg-primary text-primary-foreground flex items-center justify-center soft-shadow-md hover:bg-primary/90 active:scale-95 transition-all"
            aria-label={t("newSubscription")}
          >
            <Plus className="h-5 w-5" />
          </button>
        </div>

        {!subs ? (
          <SkeletonCard />
        ) : subs.length === 0 ? (
          <EmptyState
            icon="🔁"
            title={t("noSubs")}
            description={t("noSubsDesc")}
            action={
              <button
                onClick={() => setCreateOpen(true)}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 active:scale-95 transition-all"
              >
                <Plus className="h-4 w-4" />
                {t("newSubscription")}
              </button>
            }
          />
        ) : (
          <div className="space-y-2 pb-8">
            {[...active, ...paused, ...ended].map((s) => (
              <div
                key={s._id}
                className={`bg-card rounded-2xl p-4 soft-shadow border border-border/20 ${
                  s.status === "ended" ? "opacity-60" : ""
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">
                      🔁 {s.customerName} — {s.productName} · {s.quantity} {s.productUnit}
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {t(s.frequency)} · {t("startDate")} {formatDate(s.startDate)} ·{" "}
                      {formatMoney(s.productPrice)}/{s.productUnit}
                    </p>
                  </div>
                  <span
                    className={cn(
                      "text-xs px-2 py-1 rounded-full font-medium shrink-0",
                      s.status === "active"
                        ? "bg-success-light text-success"
                        : s.status === "paused"
                          ? "bg-warning-light text-warning"
                          : "bg-muted text-muted-foreground",
                    )}
                  >
                    {t(s.status)}
                  </span>
                </div>
                {s.status !== "ended" && (
                  <div className="flex gap-2 mt-3">
                    {s.status === "active" ? (
                      <button
                        onClick={() => act(() => pause({ subscriptionId: s._id as never }), "Paused")}
                        className="flex-1 py-2 rounded-xl bg-muted text-xs font-medium text-muted-foreground hover:bg-muted/80 flex items-center justify-center gap-1"
                      >
                        <Pause className="h-3.5 w-3.5" /> {t("pause")}
                      </button>
                    ) : (
                      <button
                        onClick={() => act(() => resume({ subscriptionId: s._id as never }), "Resumed")}
                        className="flex-1 py-2 rounded-xl bg-primary/10 text-xs font-medium text-primary hover:bg-primary/15 flex items-center justify-center gap-1"
                      >
                        <Play className="h-3.5 w-3.5" /> {t("resume")}
                      </button>
                    )}
                    <button
                      onClick={() => {
                        if (window.confirm(`${t("endSubTitle")} ${t("endSubDesc")}`)) {
                          act(() => end({ subscriptionId: s._id as never }), "Ended");
                        }
                      }}
                      className="flex-1 py-2 rounded-xl bg-error-light text-xs font-medium text-error hover:bg-error-light/70 flex items-center justify-center gap-1"
                    >
                      <Square className="h-3.5 w-3.5" /> {t("end")}
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      <CreateSubscriptionDrawer
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        customers={customers ?? []}
        products={(products ?? []).filter((p: any) => p.active !== false)}
      />
    </AppShell>
  );
}

function CreateSubscriptionDrawer({
  open,
  onClose,
  customers,
  products,
}: {
  open: boolean;
  onClose: () => void;
  customers: Customer[];
  products: Product[];
}) {
  const create = useMutation(api.subscriptions.create);
  const [customerId, setCustomerId] = useState<string>("");
  const [productId, setProductId] = useState<string>("");
  const [quantity, setQuantity] = useState("1");
  const [frequency, setFrequency] = useState<"daily" | "weekly" | "monthly">("daily");
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);

  const selectedProduct = products.find((p) => p._id === productId);
  const qtyNum = parseFloat(quantity) || 0;
  const perDelivery = selectedProduct ? Math.round(qtyNum * selectedProduct.price) : 0;

  const handleSave = async () => {
    if (!customerId || !productId || !(qtyNum > 0)) return;
    setSaving(true);
    try {
      await create({
        customerId: customerId as never,
        productId: productId as never,
        quantity: qtyNum,
        frequency,
      });
      setDone(true);
      setTimeout(() => {
        setSaving(false);
        setDone(false);
        setCustomerId("");
        setProductId("");
        setQuantity("1");
        setFrequency("daily");
        onClose();
      }, 1000);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("errGeneric"));
      setSaving(false);
    }
  };

  return (
    <Drawer open={open} onOpenChange={(o) => !o && onClose()}>
      <DrawerContent className="px-4 pb-8 max-h-[85vh] overflow-y-auto">
        <DrawerHeader className="px-0 pt-4">
          <DrawerTitle className="text-lg font-semibold">
            {done ? "Subscription created ✓" : t("newSubscription")}
          </DrawerTitle>
        </DrawerHeader>

        {done ? (
          <div className="flex flex-col items-center py-10 gap-4">
            <div className="h-16 w-16 rounded-full bg-success-light flex items-center justify-center">
              <Check className="h-8 w-8 text-success" />
            </div>
            <p className="text-sm text-muted-foreground text-center">
              Purchases are logged automatically on schedule.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            <div>
              <label className="text-sm text-muted-foreground block mb-1.5 px-1">
                {t("customer")} *
              </label>
              <Select value={customerId} onValueChange={setCustomerId}>
                <SelectTrigger><SelectValue placeholder="Pick a customer" /></SelectTrigger>
                <SelectContent>
                  {customers.map((c) => (
                    <SelectItem key={c._id} value={c._id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-sm text-muted-foreground block mb-1.5 px-1">
                {t("product")} *
              </label>
              <Select value={productId} onValueChange={setProductId}>
                <SelectTrigger><SelectValue placeholder="Pick a product" /></SelectTrigger>
                <SelectContent>
                  {products.map((p) => (
                    <SelectItem key={p._id} value={p._id}>
                      {p.name} ({formatMoney(p.price)}/{p.unit})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm text-muted-foreground block mb-1.5 px-1">
                  {t("quantity")} *
                </label>
                <input
                  type="number"
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                  min="0.5"
                  step="0.5"
                  className="w-full px-4 py-3 bg-card rounded-2xl border border-border/50 text-base outline-none focus:ring-2 focus:ring-primary/30 transition-all"
                />
              </div>
              <div>
                <label className="text-sm text-muted-foreground block mb-1.5 px-1">
                  {t("frequency")} *
                </label>
                <Select
                  value={frequency}
                  onValueChange={(v) => setFrequency(v as "daily" | "weekly" | "monthly")}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="daily">{t("daily")}</SelectItem>
                    <SelectItem value="weekly">{t("weekly")}</SelectItem>
                    <SelectItem value="monthly">{t("monthly")}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {selectedProduct && qtyNum > 0 && (
              <p className="text-center text-sm text-muted-foreground">
                ≈ {formatMoney(perDelivery)} per delivery — logged automatically
              </p>
            )}

            <Button
              onClick={handleSave}
              disabled={saving || !customerId || !productId || !(qtyNum > 0)}
              className="w-full h-14 rounded-2xl text-base font-semibold bg-primary hover:bg-primary/90 active:scale-[0.98] transition-all mt-2"
            >
              {saving ? <span className="animate-pulse">Creating…</span> : t("save")}
            </Button>
          </div>
        )}
      </DrawerContent>
    </Drawer>
  );
}
