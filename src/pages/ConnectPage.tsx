import { useState, useEffect } from "react";
import { useMutation, useQuery } from "@/lib/api-client";
import { api } from "@/lib/api-client";
import { useAuth } from "@/hooks/use-auth";
import { useNavigate, useSearchParams } from "react-router";
import { Button } from "@/components/ui/button";
import { Check, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { t } from "@/lib/i18n";

export default function ConnectPage() {
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const code = searchParams.get("code");

  const connection = useQuery(
    api.connections.getByCode,
    code ? { inviteCode: code } : "skip",
  );

  const connectCustomer = useMutation(api.connections.connectCustomer);
  const [connecting, setConnecting] = useState(false);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    if (!code) {
      navigate("/");
    }
  }, [code, navigate]);

  if (!code) return null;

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  if (!isAuthenticated) {
    navigate(`/auth?returnTo=${encodeURIComponent(`/connect?code=${code}`)}`);
    return null;
  }

  if (connected) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background px-6">
        <div className="h-16 w-16 rounded-full bg-success-light flex items-center justify-center mb-4">
          <Check className="h-8 w-8 text-success" />
        </div>
        <h1 className="text-2xl font-bold mb-2">You're all set!</h1>
        <p className="text-muted-foreground text-center mb-8">
          You're now connected to {connection?.businessName ?? "the business"}.
          Enjoy Soft Ledger!
        </p>
        <Button
          onClick={() => navigate("/dashboard")}
          className="h-12 rounded-2xl px-8 bg-primary font-semibold"
        >
          Head to home
        </Button>
      </div>
    );
  }

  if (!connection) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background px-6">
        <h1 className="text-2xl font-bold mb-2">Oops, that link is invalid</h1>
        <p className="text-muted-foreground text-center">
          This invite link doesn't seem to work anymore. Ask the business to send
          you a fresh one!
        </p>
      </div>
    );
  }

  const handleConnect = async () => {
    setConnecting(true);
    try {
      await connectCustomer({ inviteCode: code });
      setConnected(true);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't connect. Give it another shot.");
      setConnecting(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background px-6">
      <div className="text-center">
        <p className="text-sm text-muted-foreground">You've been invited to connect with</p>
        <h1 className="text-3xl font-bold mt-1 mb-6">{connection.businessName}</h1>

        <Button
          onClick={handleConnect}
          disabled={connecting}
          className="h-14 rounded-2xl px-10 text-base font-semibold bg-primary hover:bg-primary/90 active:scale-[0.98] transition-all"
        >
          {connecting ? (
            <Loader2 className="h-5 w-5 animate-spin" />
          ) : (
            "Connect and get started"
          )}
        </Button>
      </div>
    </div>
  );
}
