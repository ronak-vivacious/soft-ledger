import { useState } from "react";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useMutation } from "@/lib/api-client";
import { api } from "@/lib/api-client";
import { toast } from "sonner";
import { Check } from "lucide-react";
import { formatMoney } from "./MoneyDisplay";
import { t } from "@/lib/i18n";

interface Product {
  _id: string;
  name: string;
  unit: string;
  price: number;
  active?: boolean;
}

export function RecordSheet({
  open,
  onClose,
  customerId,
  customerName,
  products,
}: {
  open: boolean;
  onClose: () => void;
  customerId: string;
  customerName: string;
  products: Product[];
}) {
  const createTransaction = useMutation(api.transactions.create);
  const activeProducts = products.filter((p) => p.active !== false);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(
    activeProducts[0] || null,
  );
  const [quantity, setQuantity] = useState(1);
  const [recording, setRecording] = useState(false);
  const [done, setDone] = useState(false);

  const rate = selectedProduct?.price || 0;
  const total = Math.round(quantity * rate);

  const handleRecord = async () => {
    if (!selectedProduct) return;
    setRecording(true);
    try {
      await createTransaction({
        customerId: customerId as never,
        productId: selectedProduct._id as never,
        quantity,
      });
      setDone(true);
      setTimeout(() => {
        setDone(false);
        setRecording(false);
        setQuantity(1);
        onClose();
      }, 1200);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("errGeneric"));
      setRecording(false);
    }
  };

  const handleQuantityChange = (delta: number) => {
    setQuantity((q) => Math.max(0.5, q + delta));
  };

  return (
    <Drawer open={open} onOpenChange={(o) => !o && onClose()}>
      <DrawerContent className="px-4 pb-8 max-h-[85vh] overflow-y-auto">
        <DrawerHeader className="px-0 pt-4">
          <DrawerTitle className="text-lg font-semibold">
            {done ? t("recorded") : `${t("recordFor")} ${customerName}`}
          </DrawerTitle>
        </DrawerHeader>

        {done ? (
          <div className="flex flex-col items-center py-10 gap-4">
            <div className="h-16 w-16 rounded-full bg-success-light flex items-center justify-center">
              <Check className="h-8 w-8 text-success" />
            </div>
            <p className="text-lg font-semibold text-foreground">
              {selectedProduct?.name} · {quantity} {selectedProduct?.unit}
            </p>
            <p className="text-2xl font-bold text-primary">{formatMoney(total)}</p>
          </div>
        ) : activeProducts.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">
            No active products. Add one under Products first.
          </p>
        ) : (
          <div className="space-y-6">
            {/* Product selector */}
            <div className="flex flex-wrap gap-2">
              {activeProducts.map((product) => (
                <button
                  key={product._id}
                  onClick={() => setSelectedProduct(product)}
                  className={cn(
                    "py-3 px-4 rounded-2xl text-sm font-medium transition-all duration-200",
                    selectedProduct?._id === product._id
                      ? "bg-primary text-primary-foreground shadow-md"
                      : "bg-muted text-muted-foreground hover:bg-muted/80",
                  )}
                >
                  {product.name === "Milk" ? "🥛" : product.name === "Tea" ? "☕" : "📦"}{" "}
                  {product.name}
                </button>
              ))}
            </div>

            {/* Quantity picker */}
            <div className="bg-card rounded-2xl p-6 soft-shadow-md">
              <p className="text-sm text-muted-foreground text-center mb-4">
                {t("quantity")}
              </p>
              <div className="flex items-center justify-center gap-6">
                <button
                  onClick={() => handleQuantityChange(-0.5)}
                  className="h-12 w-12 rounded-full bg-muted text-2xl font-medium flex items-center justify-center hover:bg-muted/80 active:scale-95 transition-all"
                >
                  −
                </button>
                <div className="text-center">
                  <p className="text-4xl font-bold text-foreground tabular-nums">
                    {quantity}
                  </p>
                  <p className="text-sm text-muted-foreground mt-1">
                    {selectedProduct?.unit}
                  </p>
                </div>
                <button
                  onClick={() => handleQuantityChange(0.5)}
                  className="h-12 w-12 rounded-full bg-muted text-2xl font-medium flex items-center justify-center hover:bg-muted/80 active:scale-95 transition-all"
                >
                  +
                </button>
              </div>
            </div>

            {/* Price preview */}
            <div className="flex items-center justify-between px-2">
              <span className="text-sm text-muted-foreground">
                {t("rate")}: {formatMoney(rate)}/{selectedProduct?.unit}
              </span>
              <span className="text-lg font-bold text-primary">{formatMoney(total)}</span>
            </div>

            {/* Quick quantity buttons */}
            <div className="flex gap-2">
              {[0.5, 1, 1.5, 2].map((q) => (
                <button
                  key={q}
                  onClick={() => setQuantity(q)}
                  className={cn(
                    "flex-1 py-2.5 rounded-xl text-sm font-medium transition-all",
                    quantity === q
                      ? "bg-primary/10 text-primary"
                      : "bg-muted text-muted-foreground hover:bg-muted/80",
                  )}
                >
                  {q} {selectedProduct?.unit}
                </button>
              ))}
            </div>

            {/* Record button */}
            <Button
              onClick={handleRecord}
              disabled={recording || !selectedProduct}
              className="w-full h-14 rounded-2xl text-base font-semibold bg-primary hover:bg-primary/90 active:scale-[0.98] transition-all"
            >
              {recording ? (
                <span className="animate-pulse">{t("recording")}</span>
              ) : (
                `${t("record")} ${formatMoney(total)}`
              )}
            </Button>
          </div>
        )}
      </DrawerContent>
    </Drawer>
  );
}
