import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import Link from "next/link";
import { Shield } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default async function PayPage({
  params,
}: {
  params: { id: string };
}) {
  // Use service-role-level access so unauthenticated buyers can view the listing
  const supabase = createClient();

  const { data: transaction } = await supabase
    .from("transactions")
    .select("id, year, make, model, vin, odometer, sale_price, vehicle_description, status")
    .eq("id", params.id)
    .single();

  if (!transaction) notFound();

  const salePrice = parseFloat(transaction.sale_price ?? "0");
  const fee = 149;
  const fmt = (n: number) =>
    n.toLocaleString("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 2,
    });

  const rows = [
    ["VIN", transaction.vin],
    ["Odometer", transaction.odometer ? `${parseInt(transaction.odometer).toLocaleString()} miles` : "—"],
    ["Sale Price", fmt(salePrice)],
    ["SafeShift Fee", fmt(fee)],
    ["Total", fmt(salePrice + fee)],
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

      <main className="container flex flex-1 items-start justify-center py-12">
        <div className="w-full max-w-lg space-y-4">
          <Card>
            <CardHeader>
              <div className="mb-1 flex items-center gap-2">
                <Shield className="h-4 w-4 text-primary" />
                <span className="text-sm font-medium text-primary">
                  Secure Escrow Payment
                </span>
              </div>
              <CardTitle className="text-2xl">
                {transaction.year} {transaction.make} {transaction.model}
              </CardTitle>
              <CardDescription>
                Review the vehicle details before proceeding to payment
              </CardDescription>
            </CardHeader>

            <CardContent className="space-y-6">
              <dl className="divide-y rounded-lg border">
                {rows.map(([label, value]) => (
                  <div
                    key={label}
                    className={`flex justify-between px-4 py-3 ${
                      label === "Total"
                        ? "bg-muted/50 font-semibold"
                        : ""
                    }`}
                  >
                    <dt
                      className={`text-sm ${
                        label === "Total"
                          ? "font-semibold"
                          : "text-muted-foreground"
                      }`}
                    >
                      {label}
                    </dt>
                    <dd
                      className={`text-sm font-medium ${
                        label === "Total" ? "text-primary" : ""
                      } ${label === "VIN" ? "font-mono" : ""}`}
                    >
                      {value ?? "—"}
                    </dd>
                  </div>
                ))}
              </dl>

              {transaction.vehicle_description && (
                <div>
                  <p className="mb-1 text-sm font-medium">
                    Seller&apos;s Description
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {transaction.vehicle_description}
                  </p>
                </div>
              )}

              <div className="rounded-lg border border-blue-200 bg-blue-50 p-4">
                <p className="text-sm text-blue-800">
                  <span className="font-semibold">
                    Your payment is protected.
                  </span>{" "}
                  SafeShift holds your funds in secure escrow and only releases
                  them after you inspect and confirm you&apos;ve received the
                  vehicle.
                </p>
              </div>

              <Button className="w-full" size="lg" disabled>
                Proceed to Payment{" "}
                <span className="ml-2 text-xs opacity-70">(coming soon)</span>
              </Button>
            </CardContent>
          </Card>

          <p className="text-center text-xs text-muted-foreground">
            Questions?{" "}
            <Link href="/" className="underline hover:text-foreground">
              Learn how SafeShift works
            </Link>
          </p>
        </div>
      </main>
    </div>
  );
}
