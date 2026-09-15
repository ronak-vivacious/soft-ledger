import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { SkeletonCard } from "@/components/app/SkeletonCard";
import { useAuth } from "@/hooks/use-auth";
import { ArrowLeft, Copy, Check } from "lucide-react";
import { useNavigate } from "react-router";
import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";

function QRCode({ value }: { value: string }) {
  const size = 21;
  const cells: boolean[][] = [];
  for (let row = 0; row < size; row++) {
    cells[row] = [];
    for (let col = 0; col < size; col++) {
      if (
        (row < 7 && col < 7) ||
        (row < 7 && col >= size - 7) ||
        (row >= size - 7 && col < 7)
      ) {
        const inBorder =
          row < 7 && col < 7
            ? row === 0 ||
              row === 6 ||
              col === 0 ||
              col === 6 ||
              (row >= 2 && row <= 4 && col >= 2 && col <= 4)
            : row < 7 && col >= size - 7
              ? row === 0 ||
                row === 6 ||
                col === size - 7 ||
                col === size - 1 ||
                (row >= 2 && row <= 4 && col >= size - 5 && col <= size - 3)
              : row === size - 7 ||
                row === size - 1 ||
                col === 0 ||
                col === 6 ||
                (row >= size - 5 && row <= size - 3 && col >= 2 && col <= 4);
        cells[row][col] = inBorder;
      } else {
        const charCode = value.charCodeAt(row * size + col) || 0;
        cells[row][col] = (charCode + row * 7 + col * 13) % 3 === 0;
      }
    }
  }

  const cellSize = 6;
  const totalSize = size * cellSize;

  return (
    <svg
      viewBox={`0 0 ${totalSize} ${totalSize}`}
      className="w-full h-full"
      role="img"
      aria-label="QR Code"
    >
      <rect width={totalSize} height={totalSize} fill="white" />
      {cells.map((row, rowIdx) =>
        row.map((filled, colIdx) =>
          filled ? (
            <rect
              key={`${rowIdx}-${colIdx}`}
              x={colIdx * cellSize}
              y={rowIdx * cellSize}
              width={cellSize}
              height={cellSize}
              fill="#1A1A2E"
              rx={1}
            />
          ) : null,
        ),
      )}
    </svg>
  );
}

export default function InvitePage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const business = useQuery(api.businesses.getByUser);
  const connections = useQuery(
    api.connections.getByBusiness,
    business ? { businessId: business._id } : "skip",
  );
  const [copied, setCopied] = useState(false);

  const inviteCode = connections?.[0]?.inviteCode || "";
  const inviteLink = `${window.location.origin}/connect?code=${inviteCode}`;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(inviteLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      const textArea = document.createElement("textarea");
      textArea.value = inviteLink;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand("copy");
      document.body.removeChild(textArea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  if (!business) {
    return (
      <div className="min-h-screen bg-background px-4">
        <div className="mx-auto max-w-lg pt-4">
          <SkeletonCard />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-lg px-4">
        <div className="flex items-center gap-3 pt-4 pb-2">
          <button
            onClick={() => navigate(-1)}
            className="h-10 w-10 rounded-full bg-card soft-shadow flex items-center justify-center hover:bg-muted transition-all"
            aria-label="Go back"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <h1 className="text-xl font-bold">Invite customers</h1>
        </div>

        <div className="flex flex-col items-center pt-8 gap-6">
          <div className="text-center">
            <p className="text-sm text-muted-foreground">Connect with</p>
            <h2 className="text-2xl font-bold mt-1">{business.name}</h2>
          </div>

          {/* QR Code */}
          <Card className="w-full max-w-[280px] border-border/30 soft-shadow-lg">
            <CardContent className="p-6">
              <QRCode value={inviteCode} />
            </CardContent>
          </Card>

          <p className="text-sm text-muted-foreground">
            Have them scan this to get connected
          </p>

          <p className="text-sm text-muted-foreground">or</p>

          <button
            onClick={handleCopy}
            className="flex items-center gap-2 px-6 py-3 rounded-full bg-primary/10 text-primary font-medium text-sm hover:bg-primary/15 active:scale-95 transition-all"
          >
            {copied ? (
              <>
                <Check className="h-4 w-4" />
                Copied to clipboard!
              </>
            ) : (
              <>
                <Copy className="h-4 w-4" />
                Copy the invite link
              </>
            )}
          </button>

          <div className="bg-muted rounded-2xl px-5 py-3 text-center">
            <p className="text-xs text-muted-foreground mb-1">Invite code</p>
            <p className="text-lg font-mono font-bold tracking-widest">
              {inviteCode}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
