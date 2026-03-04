"use server";

import { createClient } from "@/lib/supabase/server";
import { Resend } from "resend";

export interface CreateTransactionData {
  vin: string;
  year: number;
  make: string;
  model: string;
  odometer: number;
  vehicle_description: string;
  sale_price: number;
  buyer_email: string;
}

export async function createTransactionAction(
  data: CreateTransactionData
): Promise<{ transactionId?: string; error?: string }> {
  const supabase = createClient();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user)
    return { error: "You must be signed in to create a transaction." };

  // Get seller name for the email
  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name")
    .eq("id", user.id)
    .single();

  const sellerName = profile?.full_name || user.email || "A SafeShift user";

  // Insert transaction
  // Note: buyer_email must exist on your transactions table.
  // Run in Supabase SQL editor: ALTER TABLE transactions ADD COLUMN buyer_email text;
  const { data: transaction, error: txError } = await supabase
    .from("transactions")
    .insert({
      seller_id: user.id,
      vin: data.vin,
      vehicle_description: data.vehicle_description,
      year: data.year,
      make: data.make,
      model: data.model,
      odometer: data.odometer,
      sale_price: data.sale_price,
      buyer_email: data.buyer_email,
      status: "pending",
    })
    .select("id")
    .single();

  if (txError) return { error: txError.message };

  const transactionId = transaction.id;
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  const payUrl = `${appUrl}/pay/${transactionId}`;
  const vehicleName = `${data.year} ${data.make} ${data.model}`;

  // Send buyer email if Resend is configured
  const resendKey = process.env.RESEND_API_KEY;
  if (resendKey && resendKey !== "your_resend_api_key") {
    try {
      const resend = new Resend(resendKey);
      await resend.emails.send({
        from: "SafeShift <onboarding@resend.dev>",
        to: data.buyer_email,
        subject: `${sellerName} has sent you a secure payment link for their ${vehicleName}`,
        html: buildBuyerEmail({ sellerName, vehicleName, payUrl, data }),
      });
    } catch (emailError) {
      console.error("Failed to send buyer email:", emailError);
    }
  }

  return { transactionId };
}

function buildBuyerEmail({
  sellerName,
  vehicleName,
  payUrl,
  data,
}: {
  sellerName: string;
  vehicleName: string;
  payUrl: string;
  data: CreateTransactionData;
}) {
  const fmt = (n: number) =>
    n.toLocaleString("en-US", { style: "currency", currency: "USD" });

  const steps = [
    ["✅", "Your payment is held in secure escrow — never sent directly to the seller"],
    ["🪪", "Both parties verify their identity before any money moves"],
    ["🚗", "Funds are only released after you inspect and accept the vehicle"],
    ["⚖️", "Dispute protection if anything goes wrong"],
  ];

  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f5f5f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f5f5f5;padding:40px 0;">
<tr><td align="center">
<table width="600" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:12px;overflow:hidden;max-width:600px;width:100%;">
  <tr><td style="background:#2563eb;padding:24px 32px;">
    <p style="margin:0;color:#fff;font-size:22px;font-weight:700;">🛡️ SafeShift</p>
    <p style="margin:4px 0 0;color:#bfdbfe;font-size:13px;">Secure Private Party Car Sales</p>
  </td></tr>
  <tr><td style="padding:32px;">
    <h2 style="margin:0 0 16px;font-size:22px;color:#111827;">You received a secure payment request</h2>
    <p style="margin:0 0 24px;color:#374151;line-height:1.6;">
      <strong>${sellerName}</strong> has invited you to purchase their <strong>${vehicleName}</strong> through SafeShift — a trusted escrow platform that protects both buyers and sellers in private party car transactions.
    </p>
    <table width="100%" cellpadding="0" cellspacing="0" style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;margin-bottom:24px;">
      <tr><td style="padding:20px;">
        <p style="margin:0 0 12px;font-weight:600;color:#111827;font-size:16px;">${vehicleName}</p>
        <table width="100%" cellpadding="0" cellspacing="0">
          <tr>
            <td style="color:#6b7280;font-size:14px;padding:4px 0;">Odometer</td>
            <td style="color:#111827;font-size:14px;text-align:right;padding:4px 0;">${data.odometer.toLocaleString()} miles</td>
          </tr>
          <tr>
            <td style="color:#6b7280;font-size:14px;padding:4px 0;">VIN</td>
            <td style="color:#111827;font-size:14px;font-family:monospace;text-align:right;padding:4px 0;">${data.vin}</td>
          </tr>
          <tr>
            <td style="color:#6b7280;font-size:14px;font-weight:600;padding:4px 0;">Sale Price</td>
            <td style="color:#2563eb;font-size:16px;font-weight:700;text-align:right;padding:4px 0;">${fmt(data.sale_price)}</td>
          </tr>
        </table>
      </td></tr>
    </table>
    <p style="margin:0 0 8px;font-weight:600;color:#111827;">How SafeShift protects you:</p>
    <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:28px;">
      ${steps.map(([icon, text]) => `
      <tr>
        <td style="padding:6px 0;vertical-align:top;width:28px;color:#374151;font-size:14px;">${icon}</td>
        <td style="padding:6px 0;color:#374151;font-size:14px;line-height:1.5;">${text}</td>
      </tr>`).join("")}
    </table>
    <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px;">
      <tr><td align="center">
        <a href="${payUrl}" style="display:inline-block;background:#2563eb;color:#fff;text-decoration:none;padding:14px 32px;border-radius:8px;font-weight:600;font-size:16px;">
          View Secure Payment Link →
        </a>
      </td></tr>
    </table>
    <p style="margin:0;color:#9ca3af;font-size:13px;line-height:1.5;">
      If you were not expecting this email, you can safely ignore it. Your information has not been shared with anyone.
    </p>
  </td></tr>
  <tr><td style="border-top:1px solid #e5e7eb;padding:16px 32px;background:#f9fafb;">
    <p style="margin:0;color:#9ca3af;font-size:12px;text-align:center;">
      SafeShift • Secure Private Party Car Sales<br>
      <a href="${payUrl}" style="color:#6b7280;">${payUrl}</a>
    </p>
  </td></tr>
</table>
</td></tr>
</table>
</body>
</html>`;
}
