"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

function fmt(n: number) {
  return n.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });
}

export function ConfirmReceiptButton({
  transactionId,
  salePrice,
}: {
  transactionId: string;
  salePrice: number;
}) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  async function handleConfirm() {
    setLoading(true);
    setError(null);
    const res = await fetch(`/api/transactions/${transactionId}/release-funds`, {
      method: "POST",
    });
    if (res.ok) {
      setOpen(false);
      router.refresh();
    } else {
      const data = await res.json().catch(() => ({}));
      setError((data as { error?: string }).error ?? "Something went wrong. Please try again.");
      setLoading(false);
    }
  }

  return (
    <>
      <Button
        onClick={() => setOpen(true)}
        className="w-full bg-green-600 hover:bg-green-700 text-white"
        size="lg"
      >
        Confirm Receipt &amp; Release Funds
      </Button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-background rounded-xl shadow-xl p-6 max-w-md w-full">
            <h2 className="text-lg font-semibold mb-1">Confirm receipt of vehicle?</h2>
            <p className="text-sm text-muted-foreground mb-4">
              By confirming receipt you are releasing{" "}
              <strong className="text-foreground">{fmt(salePrice)}</strong> to the
              seller. <span className="font-medium text-foreground">This cannot be undone.</span>
            </p>
            <p className="text-sm text-muted-foreground mb-5">
              Only confirm once you have physically received the vehicle and verified
              it matches the listing.
            </p>
            {error && (
              <p className="text-sm text-destructive mb-4 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2">
                {error}
              </p>
            )}
            <div className="flex gap-3 justify-end">
              <Button
                variant="outline"
                onClick={() => { setOpen(false); setError(null); }}
                disabled={loading}
              >
                Cancel
              </Button>
              <Button
                className="bg-green-600 hover:bg-green-700 text-white"
                onClick={handleConfirm}
                disabled={loading}
              >
                {loading ? "Processing…" : "Yes, Release Funds"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
