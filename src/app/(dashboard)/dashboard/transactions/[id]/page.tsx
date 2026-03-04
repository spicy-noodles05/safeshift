import { createClient } from "@/lib/supabase/server";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, CheckCircle2, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CopyButton } from "@/components/transactions/copy-button";

const STATUS_LABELS: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  pending: { label: "Pending", variant: "secondary" },
  pending_kyc: { label: "Pending KYC", variant: "secondary" },
  pending_payment: { label: "Awaiting Payment", variant: "secondary" },
  funds_held: { label: "Funds Held", variant: "default" },
  vehicle_inspection: { label: "Under Inspection", variant: "default" },
  title_transfer: { label: "Title Transfer", variant: "default" },
  completed: { label: "Completed", variant: "outline" },
  disputed: { label: "Disputed", variant: "destructive" },
  refunded: { label: "Refunded", variant: "outline" },
};

export default async function TransactionPage({
  params,
}: {
  params: { id: string };
}) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in");

  const { data: transaction } = await supabase
    .from("transactions")
    .select("*")
    .eq("id", params.id)
    .single();

  if (!transaction) notFound();

  if (transaction.seller_id !== user.id && transaction.buyer_id !== user.id) {
    redirect("/dashboard");
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  const payUrl = `${appUrl}/pay/${transaction.id}`;

  const status = STATUS_LABELS[transaction.status] ?? {
    label: transaction.status,
    variant: "secondary" as const,
  };

  const fmt = (n: number) =>
    n.toLocaleString("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 2,
    });

  const salePrice = parseFloat(transaction.sale_price ?? "0");

  const details = [
    ["Vehicle", `${transaction.year} ${transaction.make} ${transaction.model}`],
    ["VIN", transaction.vin],
    ["Odometer", transaction.odometer ? `${parseInt(transaction.odometer).toLocaleString()} miles` : "—"],
    ["Sale Price", salePrice ? fmt(salePrice) : "—"],
    ["SafeShift Fee", fmt(149)],
    ["Buyer Pays Total", fmt(salePrice + 149)],
    ["Buyer Email", (transaction as Record<string, unknown>).buyer_email as string ?? "—"],
  ];

  return (
    <div className="min-h-screen bg-muted/40">
      <header className="border-b bg-background">
        <div className="container flex h-16 items-center gap-2">
          <Link
            href="/dashboard"
            className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Dashboard
          </Link>
        </div>
      </header>

      <main className="container max-w-2xl space-y-6 py-10">
        {/* Success banner */}
        <div className="flex items-start gap-3 rounded-lg border border-green-200 bg-green-50 px-4 py-4 text-green-800">
          <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0" />
          <div>
            <p className="font-semibold">Transaction created successfully</p>
            <p className="text-sm text-green-700">
              A payment link has been sent to{" "}
              {(transaction as Record<string, unknown>).buyer_email as string ?? "the buyer"}.
            </p>
          </div>
        </div>

        {/* Shareable payment link */}
        <Card>
          <CardHeader>
            <CardTitle>Buyer Payment Link</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-2 rounded-lg border bg-muted/50 px-4 py-3">
              <span className="flex-1 truncate font-mono text-sm text-muted-foreground">
                {payUrl}
              </span>
              <a
                href={payUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="shrink-0 text-muted-foreground hover:text-foreground transition-colors"
              >
                <ExternalLink className="h-4 w-4" />
              </a>
            </div>

            <div className="flex flex-wrap gap-3">
              <CopyButton text={payUrl} />
              <Button asChild variant="outline">
                <Link href="/dashboard">View Dashboard</Link>
              </Button>
            </div>

            <p className="text-sm text-muted-foreground">
              Share this link with the buyer. They&apos;ll be guided through
              identity verification and secure payment.
            </p>
          </CardContent>
        </Card>

        {/* Transaction summary */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Transaction Summary</CardTitle>
              <Badge variant={status.variant}>{status.label}</Badge>
            </div>
          </CardHeader>
          <CardContent>
            <dl className="divide-y">
              {details.map(([label, value]) => (
                <div key={label} className="flex justify-between py-3">
                  <dt className="text-sm text-muted-foreground">{label}</dt>
                  <dd
                    className={`text-sm font-medium ${label === "VIN" ? "font-mono" : ""}`}
                  >
                    {value ?? "—"}
                  </dd>
                </div>
              ))}
            </dl>
            {transaction.vehicle_description && (
              <div className="border-t pt-3">
                <dt className="mb-1 text-sm text-muted-foreground">Description</dt>
                <dd className="text-sm">{transaction.vehicle_description}</dd>
              </div>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
