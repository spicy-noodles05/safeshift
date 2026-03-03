import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  await req.json();

  // TODO: Verify Persona webhook signature and handle KYC status updates
  // Reference: https://docs.withpersona.com/reference/webhooks

  return NextResponse.json({ received: true });
}
