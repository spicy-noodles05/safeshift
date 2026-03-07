import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  ExternalLink,
  Car,
  DollarSign,
  User,
  Clock,
  CheckCircle2,
  Circle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CopyButton } from "@/components/transactions/copy-button";

const SAFESHIFT_FEE = 149;

const STATUS_CONFIG: Record<
  string,
  { label: string; variant: "default" | "secondary" | "destructive" | "outline" }
> = {
  pending: { label: "Pending", variant: "secondary" },
  pending_payment: { label: "Awaiting Payment", variant: "secondary" },
  funded: { label: "Funds Held", variant: "default" },
  completed: { label: "Completed", variant: "outline" },
  disputed: { label: "Disputed", variant: "destructive" },
  refunded: { label: "Refunded", variant: "outline" },
  cancelled: { label: "Cancelled", variant: "destructive" },
};

const TIMELINE_STEPS = [
  { key: "created", label: "Transaction created", description: "Buyer payment link generated" },
  { key: "funded", label: "Payment received", description: "Funds held securely in escrow" },
  { key: "completed", label: "Sale completed", description: "Funds released to seller" },
];

function fmt(n: number) {
  return n.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
  });
}

function formatDate(iso: string | null | undefined) {
  if (!iso) return null;
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export default async function TransactionPage({
  params,
}: {
  params: { id: string };
}) {
  // Auth check via server client
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in");

  // Fetch transaction with seller profile via admin client (bypasses RLS for joins)
  const admin = createAdminClient();
  const { data: transaction } = await admin
    .from("transactions")
    .select("*")
    .eq("id", params.id)
    .single();

  if (!transaction) notFound();

  // Authorization: only seller or buyer can view
  const isSeller = transaction.seller_id === user.id;
  const isBuyer = transaction.buyer_id === user.id;
  if (!isSeller && !isBuyer) redirect("/dashboard");

  // Fetch seller profile
  const { data: sellerProfile } = await admin
    .from("profiles")
    .select("full_name, phone")
    .eq("id", transaction.seller_id)
    .single();

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  const payUrl = `${appUrl}/pay/${transaction.id}`;

  const statusCfg = STATUS_CONFIG[transaction.status] ?? {
    label: transaction.status,
    variant: "secondary" as const,
  };

  const salePrice = parseFloat(transaction.sale_price ?? "0");
  const totalDue = salePrice + SAFESHIFT_FEE;

  // Determine timeline step completion
  const fundedStatuses = ["funded", "completed", "refunded"];
  const completedStatuses = ["completed"];
  const timelineState = {
    created: true,
    funded: fundedStatuses.includes(transaction.status),
    completed: completedStatuses.includes(transaction.status),
  };

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
        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold">
              {transaction.year} {transaction.make} {transaction.model}
            </h1>
            <p className="mt-1 text-sm text-muted-foreground font-mono">
              {transaction.vin}
            </p>
          </div>
          <Badge variant={statusCfg.variant} className="shrink-0 mt-1">
            {statusCfg.label}
          </Badge>
        </div>

        {/* Buyer payment link (only show to seller while awaiting payment) */}
        {isSeller && !fundedStatuses.includes(transaction.status) && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Buyer Payment Link</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
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
              </div>
              <p className="text-xs text-muted-foreground">
                Share this link with the buyer. They&apos;ll complete payment
                through Stripe&apos;s secure checkout.
              </p>
            </CardContent>
          </Card>
        )}

        {/* Status Timeline */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Clock className="h-4 w-4" />
              Transaction Timeline
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ol className="relative space-y-0">
              {TIMELINE_STEPS.map((step, i) => {
                const done = timelineState[step.key as keyof typeof timelineState];
                const isLast = i === TIMELINE_STEPS.length - 1;
                return (
                  <li key={step.key} className="flex gap-4 pb-6 last:pb-0">
                    <div className="flex flex-col items-center">
                      {done ? (
                        <CheckCircle2 className="h-5 w-5 text-green-600 shrink-0" />
                      ) : (
                        <Circle className="h-5 w-5 text-muted-foreground/40 shrink-0" />
                      )}
                      {!isLast && (
                        <div
                          className={`mt-1 w-px flex-1 ${
                            done ? "bg-green-200" : "bg-border"
                          }`}
                        />
                      )}
                    </div>
                    <div className="pb-1">
                      <p
                        className={`text-sm font-medium ${
                          done ? "text-foreground" : "text-muted-foreground"
                        }`}
                      >
                        {step.label}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {step.description}
                      </p>
                      {step.key === "created" && transaction.created_at && (
                        <p className="mt-0.5 text-xs text-muted-foreground/70">
                          {formatDate(transaction.created_at)}
                        </p>
                      )}
                      {step.key === "funded" && transaction.funded_at && (
                        <p className="mt-0.5 text-xs text-muted-foreground/70">
                          {formatDate(transaction.funded_at)}
                        </p>
                      )}
                    </div>
                  </li>
                );
              })}
            </ol>
          </CardContent>
        </Card>

        {/* Vehicle Details */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Car className="h-4 w-4" />
              Vehicle Details
            </CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="divide-y">
              {[
                ["Year / Make / Model", `${transaction.year} ${transaction.make} ${transaction.model}`],
                ["VIN", transaction.vin],
                [
                  "Odometer",
                  transaction.odometer
                    ? `${parseInt(transaction.odometer).toLocaleString()} miles`
                    : "—",
                ],
              ].map(([label, value]) => (
                <div key={label} className="flex justify-between py-3">
                  <dt className="text-sm text-muted-foreground">{label}</dt>
                  <dd
                    className={`text-sm font-medium ${
                      label === "VIN" ? "font-mono text-xs" : ""
                    }`}
                  >
                    {value ?? "—"}
                  </dd>
                </div>
              ))}
              {transaction.vehicle_description && (
                <div className="py-3">
                  <dt className="mb-1 text-sm text-muted-foreground">
                    Description
                  </dt>
                  <dd className="text-sm">{transaction.vehicle_description}</dd>
                </div>
              )}
            </dl>
          </CardContent>
        </Card>

        {/* Price Breakdown */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <DollarSign className="h-4 w-4" />
              Price Breakdown
            </CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="divide-y">
              <div className="flex justify-between py-3">
                <dt className="text-sm text-muted-foreground">Sale price</dt>
                <dd className="text-sm font-medium">{fmt(salePrice)}</dd>
              </div>
              <div className="flex justify-between py-3">
                <dt className="text-sm text-muted-foreground">
                  SafeShift escrow fee
                </dt>
                <dd className="text-sm font-medium">{fmt(SAFESHIFT_FEE)}</dd>
              </div>
              <div className="flex justify-between py-3">
                <dt className="text-sm font-semibold">Buyer total</dt>
                <dd className="text-sm font-semibold">{fmt(totalDue)}</dd>
              </div>
              <div className="flex justify-between py-3">
                <dt className="text-sm text-muted-foreground">
                  Seller receives
                </dt>
                <dd className="text-sm font-medium text-green-700">
                  {fmt(salePrice)}
                </dd>
              </div>
            </dl>
          </CardContent>
        </Card>

        {/* Parties */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <User className="h-4 w-4" />
              Parties
            </CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="divide-y">
              <div className="flex justify-between py-3">
                <dt className="text-sm text-muted-foreground">Seller</dt>
                <dd className="text-right text-sm">
                  <p className="font-medium">
                    {sellerProfile?.full_name ?? "—"}
                  </p>
                  {sellerProfile?.phone && (
                    <p className="text-xs text-muted-foreground">
                      {sellerProfile.phone}
                    </p>
                  )}
                </dd>
              </div>
              <div className="flex justify-between py-3">
                <dt className="text-sm text-muted-foreground">Buyer email</dt>
                <dd className="text-sm font-medium">
                  {(transaction as Record<string, unknown>).buyer_email as string ?? "—"}
                </dd>
              </div>
              {transaction.stripe_payment_intent_id && (
                <div className="flex justify-between py-3">
                  <dt className="text-sm text-muted-foreground">Payment ID</dt>
                  <dd className="font-mono text-xs text-muted-foreground">
                    {transaction.stripe_payment_intent_id}
                  </dd>
                </div>
              )}
            </dl>
          </CardContent>
        </Card>

        <Button asChild variant="outline" className="w-full">
          <Link href="/dashboard">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Dashboard
          </Link>
        </Button>
      </main>
    </div>
  );
}
