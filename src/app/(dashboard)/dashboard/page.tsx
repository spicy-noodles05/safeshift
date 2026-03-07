import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Plus, ArrowRight } from "lucide-react";

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

function fmt(n: number) {
  return n.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });
}

export default async function DashboardPage() {
  // Auth check
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/sign-in");

  // Fetch transactions where user is seller OR buyer.
  // Using admin client to bypass RLS, filtering in the query instead.
  const admin = createAdminClient();

  // Try OR query (seller or buyer). Fall back to seller-only if buyer_id column missing.
  let { data: transactions, error } = await admin
    .from("transactions")
    .select("id, year, make, model, sale_price, status, created_at, buyer_email")
    .or(`seller_id.eq.${user.id},buyer_id.eq.${user.id}`)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("[dashboard] OR query error (buyer_id may not exist), falling back to seller_id only:", error.message);
    ({ data: transactions, error } = await admin
      .from("transactions")
      .select("id, year, make, model, sale_price, status, created_at, buyer_email")
      .eq("seller_id", user.id)
      .order("created_at", { ascending: false }));
    if (error) {
      console.error("[dashboard] seller_id query error:", error.message);
    }
  }

  console.log("[dashboard] user.id:", user.id, "| transactions found:", transactions?.length ?? 0);

  return (
    <div className="container py-10 space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">My Transactions</h1>
          <p className="text-muted-foreground">
            Manage your active escrow transactions
          </p>
        </div>
        <Button asChild>
          <Link href="/dashboard/new-transaction">
            <Plus className="mr-2 h-4 w-4" />
            New Transaction
          </Link>
        </Button>
      </div>

      {!transactions || transactions.length === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>No transactions yet</CardTitle>
            <CardDescription>
              Start a new transaction to securely sell your vehicle.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild>
              <Link href="/dashboard/new-transaction">
                <Plus className="mr-2 h-4 w-4" />
                Start a Transaction
              </Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {transactions.map((tx) => {
            const statusCfg = STATUS_CONFIG[tx.status] ?? {
              label: tx.status,
              variant: "secondary" as const,
            };
            const salePrice = parseFloat(tx.sale_price ?? "0");
            const createdAt = tx.created_at
              ? new Date(tx.created_at).toLocaleDateString("en-US", {
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                })
              : null;

            return (
              <Link
                key={tx.id}
                href={`/dashboard/transactions/${tx.id}`}
                className="block"
              >
                <Card className="transition-colors hover:bg-muted/50">
                  <CardContent className="flex items-center justify-between gap-4 py-5">
                    <div className="min-w-0">
                      <p className="font-semibold truncate">
                        {tx.year} {tx.make} {tx.model}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {salePrice ? fmt(salePrice) : "—"}
                        {tx.buyer_email ? ` · ${tx.buyer_email}` : ""}
                        {createdAt ? ` · ${createdAt}` : ""}
                      </p>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <Badge variant={statusCfg.variant}>
                        {statusCfg.label}
                      </Badge>
                      <ArrowRight className="h-4 w-4 text-muted-foreground" />
                    </div>
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
