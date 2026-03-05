import { createAdminClient } from "@/lib/supabase/admin";
import { notFound } from "next/navigation";
import Link from "next/link";
import { Shield, CheckCircle2, ArrowRight } from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default async function PaySuccessPage({
  params,
}: {
  params: { id: string };
}) {
  const supabase = createAdminClient();

  const { data: transaction } = await supabase
    .from("transactions")
    .select("id, year, make, model, sale_price, buyer_email")
    .eq("id", params.id)
    .single();

  if (!transaction) notFound();

  const salePrice = parseFloat(transaction.sale_price ?? "0");
  const fmt = (n: number) =>
    n.toLocaleString("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 2,
    });

  const vehicleName = `${transaction.year} ${transaction.make} ${transaction.model}`;

  const nextSteps = [
    "The seller will contact you to arrange a time and place for vehicle handoff.",
    "Inspect the vehicle thoroughly before confirming receipt.",
    "Once you confirm, funds will be released to the seller.",
    "If anything is wrong, contact SafeShift support before confirming.",
  ];

  return (
    <div className="flex min-h-screen flex-col bg-muted/40">
      <header className="border-b bg-background">
        <div className="container flex h-16 items-center">
          <Link href="/" className="flex items-center gap-2 font-bold text-lg">
            <Shield className="h-5 w-5 text-primary" />
            SafeShift
          </Link>
        </div>
      </header>

      <main className="container flex flex-1 justify-center py-12">
        <div className="w-full max-w-lg space-y-4">
          <Card>
            <CardHeader className="text-center">
              <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-green-100">
                <CheckCircle2 className="h-8 w-8 text-green-600" />
              </div>
              <CardTitle className="text-2xl">Payment received</CardTitle>
              <CardDescription className="text-base">
                Your {fmt(salePrice)} payment for the{" "}
                <span className="font-medium text-foreground">{vehicleName}</span>{" "}
                is now held securely in escrow.
              </CardDescription>
            </CardHeader>

            <CardContent className="space-y-6">
              {/* Next steps */}
              <div className="rounded-lg border bg-muted/50 p-4">
                <p className="mb-3 text-sm font-semibold">What happens next</p>
                <ol className="space-y-2">
                  {nextSteps.map((step, i) => (
                    <li key={i} className="flex gap-3 text-sm text-muted-foreground">
                      <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                        {i + 1}
                      </span>
                      {step}
                    </li>
                  ))}
                </ol>
              </div>

              {/* Escrow assurance */}
              <div className="rounded-lg border border-blue-200 bg-blue-50 p-4">
                <p className="text-sm text-blue-800">
                  <span className="font-semibold">Funds are held securely.</span>{" "}
                  SafeShift will not release your payment to the seller until you
                  confirm you have received and accepted the vehicle.
                </p>
              </div>

              {/* CTA */}
              <div className="space-y-3">
                <Button asChild className="w-full">
                  <Link href="/sign-up">
                    Create an account to track this transaction
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Link>
                </Button>
                <Button asChild variant="outline" className="w-full">
                  <Link href="/">Learn more about SafeShift</Link>
                </Button>
              </div>

              <p className="text-center text-xs text-muted-foreground">
                A confirmation email has been sent to{" "}
                {transaction.buyer_email ?? "your email address"}.
              </p>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}
