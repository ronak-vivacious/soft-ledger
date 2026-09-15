import { useState } from "react";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { toast } from "sonner";
import { Check } from "lucide-react";

export function NewCustomerSheet({
  open,
  onClose,
  businessId,
}: {
  open: boolean;
  onClose: () => void;
  businessId: string;
}) {
  const createCustomer = useMutation(api.customers.create);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);

  const handleSave = async () => {
    if (!name.trim()) return;
    setSaving(true);
    try {
      await createCustomer({
        businessId: businessId as any,
        name: name.trim(),
        phone: phone.trim() || undefined,
      });
      setDone(true);
      setTimeout(() => {
        setDone(false);
        setSaving(false);
        setName("");
        setPhone("");
        onClose();
      }, 1200);
    } catch {
      toast.error("Could not add customer. Please try again.");
      setSaving(false);
    }
  };

  return (
    <Drawer open={open} onOpenChange={(o) => !o && onClose()}>
      <DrawerContent className="px-4 pb-8">
        <DrawerHeader className="px-0 pt-4">
          <DrawerTitle className="text-lg font-semibold">
            {done ? "Customer added ✓" : "New customer"}
          </DrawerTitle>
        </DrawerHeader>

        {done ? (
          <div className="flex flex-col items-center py-10 gap-4">
            <div className="h-16 w-16 rounded-full bg-success-light flex items-center justify-center">
              <Check className="h-8 w-8 text-success" />
            </div>
            <p className="text-lg font-semibold">{name}</p>
            <p className="text-sm text-muted-foreground">
              You can start recording for them now
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            <div>
              <label className="text-sm text-muted-foreground block mb-1.5 px-1">
                Customer name *
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Ronak, Amit"
                className="w-full px-4 py-3 bg-card rounded-2xl border border-border/50 text-base outline-none focus:ring-2 focus:ring-primary/30 transition-all"
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
                className="w-full px-4 py-3 bg-card rounded-2xl border border-border/50 text-base outline-none focus:ring-2 focus:ring-primary/30 transition-all"
              />
            </div>
            <Button
              onClick={handleSave}
              disabled={saving || !name.trim()}
              className="w-full h-14 rounded-2xl text-base font-semibold bg-primary hover:bg-primary/90 active:scale-[0.98] transition-all mt-4"
            >
              {saving ? (
                <span className="animate-pulse">Saving...</span>
              ) : (
                "Add customer"
              )}
            </Button>
          </div>
        )}
      </DrawerContent>
    </Drawer>
  );
}
