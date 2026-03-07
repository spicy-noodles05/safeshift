"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";

const REASONS = [
  "Vehicle condition doesn't match listing",
  "Vehicle not received",
  "Title or paperwork issues",
  "Seller is unresponsive",
  "Other",
];

export function DisputeForm({ transactionId }: { transactionId: string }) {
  const [reason, setReason] = useState("");
  const [details, setDetails] = useState("");
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!reason) {
      setError("Please select a reason for the dispute.");
      return;
    }
    if (details.trim().length < 20) {
      setError("Please provide at least a brief description (20+ characters).");
      return;
    }

    setLoading(true);
    setError(null);

    const res = await fetch(`/api/transactions/${transactionId}/dispute`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reason, details }),
    });

    if (res.ok) {
      setSubmitted(true);
      router.refresh();
    } else {
      const data = await res.json().catch(() => ({}));
      setError(
        (data as { error?: string }).error ?? "Failed to submit dispute. Please try again."
      );
      setLoading(false);
    }
  }

  if (submitted) {
    return (
      <div className="rounded-lg border border-green-200 bg-green-50 px-4 py-5 text-green-800">
        <p className="font-semibold">Dispute submitted</p>
        <p className="mt-1 text-sm text-green-700">
          We&apos;ve received your dispute. Our team will review it and reach
          out within 1&ndash;2 business days. Funds will remain held in escrow
          until resolved.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div className="space-y-2">
        <Label>Reason for dispute</Label>
        <div className="space-y-2">
          {REASONS.map((r) => (
            <label key={r} className="flex items-center gap-3 cursor-pointer">
              <input
                type="radio"
                name="reason"
                value={r}
                checked={reason === r}
                onChange={() => setReason(r)}
                className="accent-primary"
              />
              <span className="text-sm">{r}</span>
            </label>
          ))}
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="details">Describe the issue</Label>
        <Textarea
          id="details"
          placeholder="Please provide as much detail as possible…"
          value={details}
          onChange={(e) => setDetails(e.target.value)}
          rows={5}
          required
        />
        <p className="text-xs text-muted-foreground">
          Include dates, what was agreed, and what went wrong.
        </p>
      </div>

      {error && (
        <p className="text-sm text-destructive rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2">
          {error}
        </p>
      )}

      <Button type="submit" variant="destructive" className="w-full" disabled={loading}>
        {loading ? "Submitting…" : "Submit Dispute"}
      </Button>
    </form>
  );
}
