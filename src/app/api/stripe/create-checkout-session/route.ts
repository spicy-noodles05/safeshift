import { NextRequest, NextResponse } from "next/server";
import { stripe } from "@/lib/stripe/client";
import { createAdminClient } from "@/lib/supabase/admin";

const SAFESHIFT_FEE = 149;

export async function POST(req: NextRequest) {
  try {
    const { transactionId } = await req.json();

    if (!transactionId) {
      return NextResponse.json(
        { error: "Missing transactionId" },
        { status: 400 }
      );
    }

    const supabase = createAdminClient();
    const { data: transaction, error } = await supabase
      .from("transactions")
      .select("id, year, make, model, sale_price, status, buyer_email, vin")
      .eq("id", transactionId)
      .single();

    if (error || !transaction) {
      return NextResponse.json(
        { error: "Transaction not found" },
        { status: 404 }
      );
    }

    if (transaction.status === "funded" || transaction.status === "completed") {
      return NextResponse.json(
        { error: "Payment has already been received for this transaction" },
        { status: 400 }
      );
    }

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
    const salePrice = parseFloat(transaction.sale_price ?? "0");
    const vehicleName = `${transaction.year} ${transaction.make} ${transaction.model}`;

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card", "us_bank_account"],
      mode: "payment",
      customer_email: transaction.buyer_email ?? undefined,
      line_items: [
        {
          price_data: {
            currency: "usd",
            product_data: {
              name: vehicleName,
              description: `VIN: ${transaction.vin} — Private party vehicle purchase via SafeShift escrow`,
            },
            unit_amount: Math.round(salePrice * 100),
          },
          quantity: 1,
        },
        {
          price_data: {
            currency: "usd",
            product_data: {
              name: "SafeShift Escrow Fee",
              description:
                "Secure escrow, identity verification, and buyer protection",
            },
            unit_amount: SAFESHIFT_FEE * 100,
          },
          quantity: 1,
        },
      ],
      metadata: {
        transactionId: transaction.id,
      },
      success_url: `${appUrl}/pay/${transaction.id}/success`,
      cancel_url: `${appUrl}/pay/${transaction.id}`,
    });

    return NextResponse.json({ url: session.url });
  } catch (err) {
    console.error("Stripe checkout session error:", err);
    return NextResponse.json(
      { error: "Failed to create checkout session" },
      { status: 500 }
    );
  }
}
