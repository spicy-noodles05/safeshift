import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { Resend } from "resend";

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({})) as { reason?: string; details?: string };
  const { reason, details } = body;

  if (!reason || !details || details.trim().length < 20) {
    return NextResponse.json(
      { error: "reason and details (20+ chars) are required" },
      { status: 400 }
    );
  }

  const admin = createAdminClient();

  const { data: transaction } = await admin
    .from("transactions")
    .select("*")
    .eq("id", params.id)
    .single();

  if (!transaction) {
    return NextResponse.json({ error: "Transaction not found" }, { status: 404 });
  }

  const isSeller = transaction.seller_id === user.id;
  const isBuyer = transaction.buyer_id === user.id;
  if (!isSeller && !isBuyer) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (!["funded", "disputed"].includes(transaction.status)) {
    return NextResponse.json(
      { error: "Only funded transactions can be disputed" },
      { status: 400 }
    );
  }

  // Mark as disputed
  const { error: updateError } = await admin
    .from("transactions")
    .update({ status: "disputed" })
    .eq("id", params.id);

  if (updateError) {
    console.error("[dispute] update error:", updateError.message);
    return NextResponse.json({ error: "Failed to update transaction" }, { status: 500 });
  }

  // Notify support via email
  const resendKey = process.env.RESEND_API_KEY;
  const supportEmail = process.env.SUPPORT_EMAIL ?? "support@safeshift.app";

  if (resendKey && resendKey !== "your_resend_api_key") {
    const resend = new Resend(resendKey);
    const vehicleName = `${transaction.year} ${transaction.make} ${transaction.model}`;
    const role = isBuyer ? "Buyer" : "Seller";

    await resend.emails
      .send({
        from: "SafeShift <onboarding@resend.dev>",
        to: supportEmail,
        subject: `[DISPUTE] ${vehicleName} — ${reason}`,
        html: `
<p><strong>Transaction ID:</strong> ${transaction.id}</p>
<p><strong>Vehicle:</strong> ${vehicleName}</p>
<p><strong>Raised by:</strong> ${role} (${user.email})</p>
<p><strong>Reason:</strong> ${reason}</p>
<hr>
<p>${details.replace(/\n/g, "<br>")}</p>
        `.trim(),
      })
      .catch((err: unknown) =>
        console.error("[dispute] support email error:", err)
      );
  }

  return NextResponse.json({ success: true });
}
