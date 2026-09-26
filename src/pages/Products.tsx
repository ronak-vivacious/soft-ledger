import { useState } from "react";
import { useMutation, useQuery } from "@/lib/api-client";
import { api } from "@/lib/api-client";
import { AppShell } from "@/components/app/AppShell";
import { Money, formatMoney } from "@/components/app/MoneyDisplay";
import { SkeletonCard } from "@/components/app/SkeletonCard";
import { EmptyState } from "@/components/app/EmptyState";
import { Button } from "@/components/ui/button";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { Input } from "@/components/ui/input";
import { useNavigate } from "react-router";
import { Plus, Pencil, Check } from "lucide-react";
import { toast } from "sonner";
import { t } from "@/lib/i18n";

type Product = {
  _id: string;
  name: string;
  description?: string;
  unit: string;
  price: number;
  active?: boolean;
};

export default function Products() {
  const products = useQuery(api.products.getMine);
  const navigate = useNavigate();
  const [editorOpen, setEditorOpen] = useState(false);
  const [editing, setEditing] = useState<Product | null>(null);

  const toggleActive = useMutation(api.products.update);

  const handleToggle = async (p: Product) => {
    try {
      await toggleActive({ productId: p._id as never, active: p.active === false });
      toast.success(p.active === false ? "Product enabled" : "Product disabled — history kept");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("errGeneric"));
    }
  };

  const activeCount = products?.filter((p: any) => p.active !== false).length ?? 0;

  return (
    <AppShell role="vendor">
      <div className="space-y-4 pt-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">{t("products")}</h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              {activeCount} active · {products?.length ?? 0} total
            </p>
          </div>
          <button
            onClick={() => {
              setEditing(null);
              setEditorOpen(true);
            }}
            className="h-11 w-11 rounded-full bg-primary text-primary-foreground flex items-center justify-center soft-shadow-md hover:bg-primary/90 active:scale-95 transition-all"
            aria-label={t("newProduct")}
          >
            <Plus className="h-5 w-5" />
          </button>
        </div>

        {!products ? (
          <SkeletonCard />
        ) : products.length === 0 ? (
          <EmptyState
            icon="🧺"
            title={t("noProducts")}
            description={t("noProductsDesc")}
            action={
              <button
                onClick={() => {
                  setEditing(null);
                  setEditorOpen(true);
                }}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 active:scale-95 transition-all"
              >
                <Plus className="h-4 w-4" />
                {t("newProduct")}
              </button>
            }
          />
        ) : (
          <div className="space-y-2 pb-8">
            {products.map((p: any) => (
              <div
                key={p._id}
                className={`bg-card rounded-2xl p-4 soft-shadow border ${
                  p.active === false
                    ? "border-border/20 opacity-70"
                    : "border-border/20"
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-medium text-sm truncate">{p.name}</p>
                      {p.active === false && (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
                          {t("disabled")}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {formatMoney(p.price)} / {p.unit}
                      {p.description ? ` · ${p.description}` : ""}
                    </p>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      onClick={() => {
                        setEditing(p);
                        setEditorOpen(true);
                      }}
                      className="h-9 w-9 rounded-full bg-muted flex items-center justify-center text-muted-foreground hover:bg-muted/80 transition-all"
                      aria-label={t("edit")}
                    >
                      <Pencil className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => handleToggle(p)}
                      className={
                        p.active === false
                          ? "px-3 py-1.5 rounded-full bg-success/10 text-success text-xs font-medium hover:bg-success/15 transition-all"
                          : "px-3 py-1.5 rounded-full bg-warning-light text-warning text-xs font-medium hover:bg-warning-light/70 transition-all"
                      }
                    >
                      {p.active === false ? t("enableProduct") : t("disableProduct")}
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <ProductEditor
        open={editorOpen}
        onClose={() => setEditorOpen(false)}
        product={editing}
      />
    </AppShell>
  );
}

function ProductEditor({
  open,
  onClose,
  product,
}: {
  open: boolean;
  onClose: () => void;
  product: Product | null;
}) {
  const create = useMutation(api.products.create);
  const update = useMutation(api.products.update);

  const [name, setName] = useState(product?.name ?? "");
  const [description, setDescription] = useState(product?.description ?? "");
  const [unit, setUnit] = useState(product?.unit ?? "");
  const [priceRupees, setPriceRupees] = useState(
    product ? (product.price / 100).toString() : "",
  );
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);

  // Reset state when opening with a different product
  const [lastKey, setLastKey] = useState("");
  const key = product?._id ?? "new";
  if (open && key !== lastKey) {
    setLastKey(key);
    setName(product?.name ?? "");
    setDescription(product?.description ?? "");
    setUnit(product?.unit ?? "");
    setPriceRupees(product ? (product.price / 100).toString() : "");
    setDone(false);
  }

  const handleSave = async () => {
    const paise = Math.round(parseFloat(priceRupees || "0") * 100);
    if (!name.trim() || !unit.trim() || !(paise > 0)) return;
    setSaving(true);
    try {
      if (product) {
        await update({
          productId: product._id as never,
          name: name.trim(),
          unit: unit.trim(),
          price: paise,
          description: description.trim() || undefined,
        });
      } else {
        await create({
          name: name.trim(),
          unit: unit.trim(),
          price: paise,
          description: description.trim() || undefined,
        });
      }
      setDone(true);
      setTimeout(() => {
        setSaving(false);
        setDone(false);
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
            {done ? "Saved ✓" : product ? `${t("edit")} ${product.name}` : t("newProduct")}
          </DrawerTitle>
        </DrawerHeader>

        {done ? (
          <div className="flex flex-col items-center py-10 gap-4">
            <div className="h-16 w-16 rounded-full bg-success-light flex items-center justify-center">
              <Check className="h-8 w-8 text-success" />
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div>
              <label className="text-sm text-muted-foreground block mb-1.5 px-1">
                {t("productName")} *
              </label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Milk, Tea, Grocery packet"
                autoFocus
              />
            </div>
            <div>
              <label className="text-sm text-muted-foreground block mb-1.5 px-1">
                {t("description")} ({t("optional")})
              </label>
              <Input
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="e.g. Fresh cow milk"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm text-muted-foreground block mb-1.5 px-1">
                  {t("unit")} *
                </label>
                <Input
                  value={unit}
                  onChange={(e) => setUnit(e.target.value)}
                  placeholder="litre, cup, packet"
                />
              </div>
              <div>
                <label className="text-sm text-muted-foreground block mb-1.5 px-1">
                  {t("pricePerUnit")} (₹) *
                </label>
                <Input
                  type="number"
                  value={priceRupees}
                  onChange={(e) => setPriceRupees(e.target.value)}
                  placeholder="60"
                  min="0"
                  step="0.5"
                />
              </div>
            </div>
            <Button
              onClick={handleSave}
              disabled={saving || !name.trim() || !unit.trim()}
              className="w-full h-14 rounded-2xl text-base font-semibold bg-primary hover:bg-primary/90 active:scale-[0.98] transition-all mt-2"
            >
              {saving ? <span className="animate-pulse">Saving…</span> : t("save")}
            </Button>
          </div>
        )}
      </DrawerContent>
    </Drawer>
  );
}
