export type TransactionStatus =
  | "pending_kyc"
  | "pending_payment"
  | "funds_held"
  | "vehicle_inspection"
  | "title_transfer"
  | "completed"
  | "disputed"
  | "refunded";

export type UserRole = "buyer" | "seller";

export interface Transaction {
  id: string;
  buyer_id: string;
  seller_id: string;
  vehicle_make: string;
  vehicle_model: string;
  vehicle_year: number;
  vehicle_vin: string;
  agreed_price: number;
  status: TransactionStatus;
  stripe_payment_intent_id?: string;
  created_at: string;
  updated_at: string;
}

export interface Profile {
  id: string;
  email: string;
  full_name: string;
  phone?: string;
  kyc_status: "pending" | "approved" | "rejected";
  persona_inquiry_id?: string;
  created_at: string;
}
