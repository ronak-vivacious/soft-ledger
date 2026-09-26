import { useMutation, useQuery } from "@/lib/api-client";
import { api } from "@/lib/api-client";
import { useAuth } from "@/hooks/use-auth";
import { AppShell } from "@/components/app/AppShell";
import { SkeletonCard } from "@/components/app/SkeletonCard";
import { EmptyState } from "@/components/app/EmptyState";
import { formatDate } from "@/components/app/timeAgo";
import { useNavigate } from "react-router";
import { Button } from "@/components/ui/button";
import { CheckCheck } from "lucide-react";
import { t } from "@/lib/i18n";
import { cn } from "@/lib/utils";

type Notification = {
  _id: string;
  type: string;
  title: string;
  body?: string;
  read?: boolean;
  relatedType?: string;
  relatedId?: string;
  _creationTime: number;
};

const TYPE_ICON: Record<string, string> = {
  payment_verify_request: "🔔",
  payment_confirmed: "✅",
  payment_rejected: "⚠️",
  payment_reversed: "↩️",
  payment_reminder: "💸",
  verification_reminder: "🔔",
  connection_request: "🤝",
  connection_accepted: "🎉",
  connection_rejected: "🙂",
  subscription_started: "🔁",
  subscription_paused: "⏸️",
  subscription_resumed: "▶️",
  subscription_ended: "⏹️",
  purchase: "📦",
  transaction_reversed: "↩️",
  bill_generated: "🧾",
  invite: "✉️",
};

export default function Notifications() {
  const { user } = useAuth();
  const notifications = useQuery(api.notifications.list);
  const markRead = useMutation(api.notifications.markRead);
  const markAllRead = useMutation(api.notifications.markAllRead);
  const navigate = useNavigate();

  const unread = notifications?.filter((n: any) => !n.read).length ?? 0;

  const handleOpen = (n: Notification) => {
    if (!n.read) {
      markRead({ notificationId: n._id as never }).catch(() => {});
    }
    if (n.relatedType === "payment") {
      navigate("/dashboard");
    }
  };

  return (
    <AppShell role={user?.role === "vendor" ? "vendor" : "customer"}>
      <div className="space-y-4 pt-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">{t("notifications")}</h1>
            {unread > 0 && (
              <p className="text-sm text-muted-foreground mt-0.5">{unread} unread</p>
            )}
          </div>
          {unread > 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => markAllRead({})}
              className="rounded-full"
            >
              <CheckCheck className="h-4 w-4 mr-1" />
              {t("markAllRead")}
            </Button>
          )}
        </div>

        {!notifications ? (
          <SkeletonCard />
        ) : notifications.length === 0 ? (
          <EmptyState
            icon="🔔"
            title={t("noNotifications")}
            description={t("noNotificationsDesc")}
          />
        ) : (
          <div className="space-y-2 pb-8">
            {notifications.map((n: any) => (
              <button
                key={n._id}
                onClick={() => handleOpen(n)}
                className={cn(
                  "w-full text-left bg-card rounded-2xl p-4 soft-shadow border transition-all active:scale-[0.99]",
                  n.read ? "border-border/20" : "border-primary/30 bg-primary/5",
                )}
              >
                <div className="flex items-start gap-3">
                  <span className="text-xl shrink-0">{TYPE_ICON[n.type] ?? "🔔"}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">{n.title}</p>
                    {n.body && (
                      <p className="text-xs text-muted-foreground mt-0.5">{n.body}</p>
                    )}
                    <p className="text-xs text-muted-foreground mt-1">
                      {timeAgoStr(n._creationTime)}
                    </p>
                  </div>
                  {!n.read && <span className="h-2 w-2 rounded-full bg-primary shrink-0 mt-1" />}
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </AppShell>
  );
}

function timeAgoStr(creationTime: number): string {
  const diff = Date.now() - creationTime;
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return t("justNow");
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return formatDate(new Date(creationTime).toISOString().split("T")[0]);
}
