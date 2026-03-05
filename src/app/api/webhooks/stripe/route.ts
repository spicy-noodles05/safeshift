import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { stripe } from "@/lib/stripe/client";
import { createAdminClient } from "@/lib/supabase/admin";
import { Resend } from "resend";

export async function POST(req: NextRequest) {
  const body = await req.text();
  const sig = req.headers.get("stripe-signature");

  if (!sig) {
    return NextResponse.json(
      { error: "Missing stripe-signature header" },
      { status: 400 }
    );
  }

  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!webhookSecret || webhookSecret === "placeholder_for_now") {
    console.warn(
      "STRIPE_WEBHOOK_SECRET not configured. Set it from your Stripe dashboard or Stripe CLI."
    );
    return NextResponse.json(
      { error: "Webhook secret not configured" },
      { status: 500 }
    );
  }

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, sig, webhookSecret);
  } catch (err) {
    console.error("Webhook signature verification failed:", err);
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session;
    const transactionId = session.metadata?.transactionId;

    if (!transactionId) {
      console.error("No transactionId in session metadata");
      return NextResponse.json({ received: true });
    }

    const supabase = createAdminClient();

    // Fetch transaction to check current status (idempotency guard)
    const { data: existing } = await supabase
      .from("transactions")
      .select("status, seller_id, buyer_email, year, make, model, sale_price")
      .eq("id", transactionId)
      .single();

    if (!existing) {
      console.error("Transaction not found:", transactionId);
      return NextResponse.json({ received: true });
    }

    // Idempotency: skip if already funded
    if (existing.status === "funded" || existing.status === "completed") {
      return NextResponse.json({ received: true });
    }

    const paymentIntentId =
      typeof session.payment_intent === "string"
        ? session.payment_intent
        : null;

    // Update transaction to funded
    const { error: updateError } = await supabase
      .from("transactions")
      .update({
        status: "funded",
        funded_at: new Date().toISOString(),
        stripe_payment_intent_id: paymentIntentId,
      })
      .eq("id", transactionId);

    if (updateError) {
      console.error("Failed to update transaction:", updateError);
      // Return 200 so Stripe doesn't retry — log for manual review
      return NextResponse.json({ received: true });
    }

    // Get seller email from auth.users
    const { data: sellerData } = await supabase.auth.admin.getUserById(
      existing.seller_id
    );
    const sellerEmail = sellerData?.user?.email;

    const buyerEmail =
      (existing as Record<string, unknown>).buyer_email as string | null ??
      session.customer_email;

    const vehicleName = `${existing.year} ${existing.make} ${existing.model}`;
    const salePrice = parseFloat(existing.sale_price ?? "0");
    const fmt = (n: number) =>
      n.toLocaleString("en-US", {
        style: "currency",
        currency: "USD",
        minimumFractionDigits: 2,
      });

    const resendKey = process.env.RESEND_API_KEY;
    if (resendKey && resendKey !== "your_resend_api_key") {
      const resend = new Resend(resendKey);

      const emailPromises: Promise<unknown>[] = [];

      // Email to buyer
      if (buyerEmail) {
        emailPromises.push(
          resend.emails.send({
            from: "SafeShift <onboarding@resend.dev>",
            to: buyerEmail,
            subject: `Your payment for the ${vehicleName} is secured`,
            html: buildBuyerConfirmEmail({ vehicleName, salePrice, fmt }),
          })
        );
      }

      // Email to seller
      if (sellerEmail) {
        emailPromises.push(
          resend.emails.send({
            from: "SafeShift <onboarding@resend.dev>",
            to: sellerEmail,
            subject: `Funds secured — your ${vehicleName} has a confirmed buyer`,
            html: buildSellerConfirmEmail({
              vehicleName,
              salePrice,
              buyerEmail: buyerEmail ?? "the buyer",
              fmt,
            }),
          })
        );
      }

      await Promise.allSettled(emailPromises);
    }
  }

  return NextResponse.json({ received: true });
}

function buildBuyerConfirmEmail({
  vehicleName,
  salePrice,
  fmt,
}: {
  vehicleName: string;
  salePrice: number;
  fmt: (n: number) => string;
}) {
  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#f5f5f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f5f5f5;padding:40px 0;">
<tr><td align="center">
<table width="600" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:12px;overflow:hidden;max-width:600px;width:100%;">
  <tr><td style="background:#2563eb;padding:24px 32px;">
    <p style="margin:0;color:#fff;font-size:22px;font-weight:700;">🛡️ SafeShift</p>
  </td></tr>
  <tr><td style="padding:32px;">
    <div style="text-align:center;margin-bottom:24px;">
      <div style="display:inline-block;background:#dcfce7;border-radius:50%;padding:16px;margin-bottom:12px;">
        <span style="font-size:32px;">✅</span>
      </div>
      <h2 style="margin:0;color:#111827;font-size:22px;">Payment received — funds secured</h2>
    </div>
    <p style="color:#374151;line-height:1.6;margin:0 0 20px;">
      Your payment of <strong>${fmt(salePrice)}</strong> for the <strong>${vehicleName}</strong> has been received and is now held securely in escrow by SafeShift.
    </p>
    <div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;padding:20px;margin-bottom:24px;">
      <p style="margin:0 0 12px;font-weight:600;color:#111827;">What happens next</p>
      <ol style="margin:0;padding-left:20px;color:#374151;font-size:14px;line-height:2;">
        <li>The seller will contact you to arrange vehicle handoff</li>
        <li>Inspect the vehicle thoroughly</li>
        <li>Confirm receipt in SafeShift to release funds to the seller</li>
        <li>If anything is wrong, contact us before confirming</li>
      </ol>
    </div>
    <div style="background:#eff6ff;border:1px solid #bfdbfe;border-radius:8px;padding:16px;">
      <p style="margin:0;color:#1e40af;font-size:14px;"><strong>Funds are protected.</strong> SafeShift will not release your payment until you confirm receipt of the vehicle.</p>
    </div>
  </td></tr>
  <tr><td style="border-top:1px solid #e5e7eb;padding:16px 32px;background:#f9fafb;">
    <p style="margin:0;color:#9ca3af;font-size:12px;text-align:center;">SafeShift • Secure Private Party Car Sales</p>
  </td></tr>
</table>
</td></tr>
</table>
</body>
</html>`;
}

function buildSellerConfirmEmail({
  vehicleName,
  salePrice,
  buyerEmail,
  fmt,
}: {
  vehicleName: string;
  salePrice: number;
  buyerEmail: string;
  fmt: (n: number) => string;
}) {
  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#f5f5f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f5f5f5;padding:40px 0;">
<tr><td align="center">
<table width="600" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:12px;overflow:hidden;max-width:600px;width:100%;">
  <tr><td style="background:#2563eb;padding:24px 32px;">
    <p style="margin:0;color:#fff;font-size:22px;font-weight:700;">🛡️ SafeShift</p>
  </td></tr>
  <tr><td style="padding:32px;">
    <div style="text-align:center;margin-bottom:24px;">
      <div style="display:inline-block;background:#dcfce7;border-radius:50%;padding:16px;margin-bottom:12px;">
        <span style="font-size:32px;">💰</span>
      </div>
      <h2 style="margin:0;color:#111827;font-size:22px;">Funds secured — you have a confirmed buyer</h2>
    </div>
    <p style="color:#374151;line-height:1.6;margin:0 0 20px;">
      Great news! <strong>${buyerEmail}</strong> has paid <strong>${fmt(salePrice)}</strong> for your <strong>${vehicleName}</strong>. The funds are now held securely in escrow.
    </p>
    <div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;padding:20px;margin-bottom:24px;">
      <p style="margin:0 0 12px;font-weight:600;color:#111827;">Next steps</p>
      <ol style="margin:0;padding-left:20px;color:#374151;font-size:14px;line-height:2;">
        <li>Contact the buyer to arrange a time and place for handoff</li>
        <li>Complete the vehicle handoff and transfer the title</li>
        <li>The buyer will confirm receipt in SafeShift</li>
        <li>Funds will be released to you upon confirmation</li>
      </ol>
    </div>
    <div style="background:#eff6ff;border:1px solid #bfdbfe;border-radius:8px;padding:16px;">
      <p style="margin:0;color:#1e40af;font-size:14px;"><strong>Funds are held securely.</strong> ${fmt(salePrice)} will be released to you once the buyer confirms receipt of the vehicle.</p>
    </div>
  </td></tr>
  <tr><td style="border-top:1px solid #e5e7eb;padding:16px 32px;background:#f9fafb;">
    <p style="margin:0;color:#9ca3af;font-size:12px;text-align:center;">SafeShift • Secure Private Party Car Sales</p>
  </td></tr>
</table>
</td></tr>
</table>
</body>
</html>`;
}
