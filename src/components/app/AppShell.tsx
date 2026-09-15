import { BottomNav } from "./BottomNav";
import { type ReactNode } from "react";

export function AppShell({
  children,
  role,
}: {
  children: ReactNode;
  role: "vendor" | "customer";
}) {
  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-lg">
        <main className="pb-24 pt-2 px-4">{children}</main>
      </div>
      <BottomNav role={role} />
    </div>
  );
}
