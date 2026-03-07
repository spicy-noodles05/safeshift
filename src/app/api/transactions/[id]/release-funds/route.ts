import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { Resend } from "resend";

export async function POST(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  // Auth: verify session
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = createAdminClient();

  // Fetch transaction
  const { data: transaction } = await admin
    .from("transactions")
    .select("*")
    .eq("id", params.id)
    .single();

  if (!transaction) {
    return NextResponse.json({ error: "Transaction not found" }, { status: 404 });
  }

  // Only the buyer can confirm receipt
  if (transaction.buyer_id !== user.id) {
    return NextResponse.json(
      { error: "Only the buyer can confirm receipt" },
      { status: 403 }
    );
  }

  // Only funded transactions can be completed
  if (transaction.status !== "funded") {
    return NextResponse.json(
      { error: "Transaction must be in funded state to release funds" },
      { status: 400 }
    );
  }

  // Update to completed
  const { error: updateError } = await admin
    .from("transactions")
    .update({
      status: "completed",
      completed_at: new Date().toISOString(),
    })
    .eq("id", params.id);

  if (updateError) {
    console.error("[release-funds] update error:", updateError.message);
    return NextResponse.json(
      { error: "Failed to update transaction" },
      { status: 500 }
    );
  }

  // Send confirmation emails
  const resendKey = process.env.RESEND_API_KEY;
  if (resendKey && resendKey !== "your_resend_api_key") {
    const resend = new Resend(resendKey);

    const vehicleName = `${transaction.year} ${transaction.make} ${transaction.model}`;
    const salePrice = parseFloat(transaction.sale_price ?? "0");
    const fmt = (n: number) =>
      n.toLocaleString("en-US", {
        style: "currency",
        currency: "USD",
        minimumFractionDigits: 2,
      });

    const { data: sellerData } = await admin.auth.admin.getUserById(
      transaction.seller_id
    );
    const sellerEmail = sellerData?.user?.email;
    const buyerEmail =
      (transaction as Record<string, unknown>).buyer_email as string | null ??
      user.email;

    const emails: Promise<unknown>[] = [];

    if (sellerEmail) {
      emails.push(
        resend.emails.send({
          from: "SafeShift <onboarding@resend.dev>",
          to: sellerEmail,
          subject: `Funds released — ${vehicleName} sale complete`,
          html: buildSellerReleaseEmail({ vehicleName, salePrice, fmt }),
        })
      );
    }

    if (buyerEmail) {
      emails.push(
        resend.emails.send({
          from: "SafeShift <onboarding@resend.dev>",
          to: buyerEmail,
          subject: `Transaction complete — ${vehicleName}`,
          html: buildBuyerReleaseEmail({ vehicleName, salePrice, fmt }),
        })
      );
    }

    await Promise.allSettled(emails);
  }

  return NextResponse.json({ success: true });
}

function buildSellerReleaseEmail({
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
    <p style="margin:0;color:#fff;font-size:22px;font-weight:700;">SafeShift</p>
  </td></tr>
  <tr><td style="padding:32px;">
    <div style="text-align:center;margin-bottom:24px;">
      <div style="display:inline-block;background:#dcfce7;border-radius:50%;padding:16px;margin-bottom:12px;">
        <span style="font-size:32px;">&#x1F4B8;</span>
      </div>
      <h2 style="margin:0;color:#111827;font-size:22px;">Funds released to you</h2>
    </div>
    <p style="color:#374151;line-height:1.6;margin:0 0 20px;">
      The buyer has confirmed receipt of the <strong>${vehicleName}</strong>. Your payment of
      <strong>${fmt(salePrice)}</strong> has been released from escrow.
    </p>
    <div style="background:#dcfce7;border:1px solid #86efac;border-radius:8px;padding:16px;margin-bottom:24px;">
      <p style="margin:0;color:#166534;font-size:15px;font-weight:600;">Transaction complete. Funds are on their way.</p>
    </div>
    <p style="color:#6b7280;font-size:14px;">Thank you for using SafeShift. We hope your sale went smoothly.</p>
  </td></tr>
  <tr><td style="border-top:1px solid #e5e7eb;padding:16px 32px;background:#f9fafb;">
    <p style="margin:0;color:#9ca3af;font-size:12px;text-align:center;">SafeShift &bull; Secure Private Party Car Sales</p>
  </td></tr>
</table>
</td></tr>
</table>
</body>
</html>`;
}

function buildBuyerReleaseEmail({
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
    <p style="margin:0;color:#fff;font-size:22px;font-weight:700;">SafeShift</p>
  </td></tr>
  <tr><td style="padding:32px;">
    <div style="text-align:center;margin-bottom:24px;">
      <div style="display:inline-block;background:#dcfce7;border-radius:50%;padding:16px;margin-bottom:12px;">
        <span style="font-size:32px;">&#x2705;</span>
      </div>
      <h2 style="margin:0;color:#111827;font-size:22px;">Transaction complete</h2>
    </div>
    <p style="color:#374151;line-height:1.6;margin:0 0 20px;">
      You have successfully received the <strong>${vehicleName}</strong> and released
      <strong>${fmt(salePrice)}</strong> to the seller. This transaction is now closed.
    </p>
    <p style="color:#6b7280;font-size:14px;">Thank you for using SafeShift. Enjoy your vehicle!</p>
  </td></tr>
  <tr><td style="border-top:1px solid #e5e7eb;padding:16px 32px;background:#f9fafb;">
    <p style="margin:0;color:#9ca3af;font-size:12px;text-align:center;">SafeShift &bull; Secure Private Party Car Sales</p>
  </td></tr>
</table>
</td></tr>
</table>
</body>
</html>`;
}
