import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { DisputeForm } from "@/components/transactions/dispute-form";

export default async function DisputePage({
  params,
}: {
  params: { id: string };
}) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in");

  const admin = createAdminClient();
  const { data: transaction } = await admin
    .from("transactions")
    .select("id, year, make, model, status, seller_id, buyer_id")
    .eq("id", params.id)
    .single();

  if (!transaction) notFound();

  const isSeller = transaction.seller_id === user.id;
  const isBuyer = transaction.buyer_id === user.id;
  if (!isSeller && !isBuyer) redirect("/dashboard");

  // Only funded or disputed transactions can be disputed
  if (!["funded", "disputed"].includes(transaction.status)) {
    redirect(`/dashboard/transactions/${params.id}`);
  }

  const vehicleName = `${transaction.year} ${transaction.make} ${transaction.model}`;

  return (
    <div className="min-h-screen bg-muted/40">
      <header className="border-b bg-background">
        <div className="container flex h-16 items-center gap-2">
          <Link
            href={`/dashboard/transactions/${params.id}`}
            className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to transaction
          </Link>
        </div>
      </header>

      <main className="container max-w-xl py-10">
        <Card>
          <CardHeader>
            <CardTitle>Raise a Dispute</CardTitle>
            <CardDescription>
              {vehicleName} &mdash; transaction {transaction.id.slice(0, 8)}&hellip;
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="mb-6 text-sm text-muted-foreground">
              Describe the issue below. Our team will review your dispute and
              reach out within 1&ndash;2 business days. Funds will remain held
              in escrow until the dispute is resolved.
            </p>
            <DisputeForm transactionId={transaction.id} />
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
