"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, Loader2, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { createTransactionAction } from "@/app/actions/transactions";

interface FormState {
  vin: string;
  year: string;
  make: string;
  model: string;
  odometer: string;
  vehicle_description: string;
  sale_price: string;
  buyer_email: string;
}

const INITIAL: FormState = {
  vin: "",
  year: "",
  make: "",
  model: "",
  odometer: "",
  vehicle_description: "",
  sale_price: "",
  buyer_email: "",
};

const STEP_TITLES = ["Vehicle Details", "Sale Details", "Review & Confirm"];
const SAFESHIFT_FEE = 149;

export default function NewTransactionPage() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [form, setForm] = useState<FormState>(INITIAL);
  const [isVinLoading, setIsVinLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const update = (field: keyof FormState, value: string) =>
    setForm((prev) => ({ ...prev, [field]: value }));

  const decodeVin = async (vin: string) => {
    setIsVinLoading(true);
    try {
      const res = await fetch(
        `https://vpic.nhtsa.dot.gov/api/vehicles/decodevin/${vin}?format=json`
      );
      const json = await res.json();
      const results: Array<{ Variable: string; Value: string | null }> =
        json.Results;

      const get = (variable: string) => {
        const val = results.find((r) => r.Variable === variable)?.Value;
        return val && val !== "0" && val !== "Not Applicable" ? val : "";
      };

      setForm((prev) => ({
        ...prev,
        year: get("Model Year") || prev.year,
        make: get("Make") || prev.make,
        model: get("Model") || prev.model,
      }));
    } catch {
      // Silent fail — user can fill in manually
    } finally {
      setIsVinLoading(false);
    }
  };

  const handleVinChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "");
    update("vin", val);
    if (val.length === 17) decodeVin(val);
  };

  const validate = (n: number): string | null => {
    if (n === 1) {
      if (form.vin.length !== 17) return "VIN must be exactly 17 characters.";
      if (!form.year) return "Please enter the vehicle year.";
      if (!form.make) return "Please enter the vehicle make.";
      if (!form.model) return "Please enter the vehicle model.";
      if (!form.odometer || parseInt(form.odometer) < 0)
        return "Please enter a valid odometer reading.";
    }
    if (n === 2) {
      const price = parseFloat(form.sale_price);
      if (!form.sale_price || isNaN(price) || price <= 0)
        return "Please enter a valid sale price.";
      if (!form.buyer_email.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/))
        return "Please enter a valid buyer email address.";
    }
    return null;
  };

  const handleNext = () => {
    const err = validate(step);
    if (err) {
      setError(err);
      return;
    }
    setError(null);
    setStep((s) => s + 1);
  };

  const handleBack = () => {
    setError(null);
    setStep((s) => s - 1);
  };

  const handleSubmit = async () => {
    setError(null);
    setIsSubmitting(true);
    try {
      const result = await createTransactionAction({
        vin: form.vin,
        year: parseInt(form.year),
        make: form.make,
        model: form.model,
        odometer: parseInt(form.odometer),
        vehicle_description: form.vehicle_description,
        sale_price: parseFloat(form.sale_price),
        buyer_email: form.buyer_email,
      });
      if (result.error) {
        setError(result.error);
        return;
      }
      router.push(`/dashboard/transactions/${result.transactionId}`);
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const salePrice = parseFloat(form.sale_price) || 0;
  const fmt = (n: number) =>
    n.toLocaleString("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 2,
    });

  return (
    <div className="min-h-screen bg-muted/40">
      {/* Header */}
      <header className="border-b bg-background">
        <div className="container flex h-16 items-center gap-2">
          <Link
            href="/dashboard"
            className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Dashboard
          </Link>
          <span className="text-muted-foreground">/</span>
          <span className="text-sm font-medium">New Transaction</span>
        </div>
      </header>

      <main className="container max-w-2xl py-10">
        {/* Step progress */}
        <div className="mb-8">
          <div className="mb-2 flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Step {step} of 3</span>
            <span className="font-medium">{STEP_TITLES[step - 1]}</span>
          </div>
          <div className="flex gap-2">
            {[1, 2, 3].map((n) => (
              <div
                key={n}
                className={`h-1.5 flex-1 rounded-full transition-colors duration-300 ${
                  step >= n ? "bg-primary" : "bg-muted-foreground/20"
                }`}
              />
            ))}
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>{STEP_TITLES[step - 1]}</CardTitle>
            <CardDescription>
              {step === 1 && "Enter your vehicle information. VIN auto-decodes year, make & model."}
              {step === 2 && "Set the sale price and enter the buyer's contact email."}
              {step === 3 && "Review everything before creating your transaction."}
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-5">
            {error && (
              <div className="rounded-md bg-destructive/10 px-4 py-3 text-sm text-destructive">
                {error}
              </div>
            )}

            {/* ── Step 1: Vehicle Details ── */}
            {step === 1 && (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="vin">VIN Number</Label>
                  <div className="relative">
                    <Input
                      id="vin"
                      value={form.vin}
                      onChange={handleVinChange}
                      placeholder="17-character VIN"
                      maxLength={17}
                      className="pr-10 font-mono tracking-widest uppercase"
                    />
                    {isVinLoading && (
                      <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-muted-foreground" />
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {form.vin.length}/17 — auto-populates year, make & model
                  </p>
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <div className="space-y-2">
                    <Label htmlFor="year">Year</Label>
                    <Input
                      id="year"
                      value={form.year}
                      onChange={(e) => update("year", e.target.value)}
                      placeholder="2020"
                      type="number"
                      min="1900"
                      max={new Date().getFullYear() + 1}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="make">Make</Label>
                    <Input
                      id="make"
                      value={form.make}
                      onChange={(e) => update("make", e.target.value)}
                      placeholder="Honda"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="model">Model</Label>
                    <Input
                      id="model"
                      value={form.model}
                      onChange={(e) => update("model", e.target.value)}
                      placeholder="Civic"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="odometer">Odometer (miles)</Label>
                  <Input
                    id="odometer"
                    value={form.odometer}
                    onChange={(e) => update("odometer", e.target.value)}
                    placeholder="45000"
                    type="number"
                    min="0"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="vehicle_description">
                    Vehicle Description{" "}
                    <span className="font-normal text-muted-foreground">
                      (optional)
                    </span>
                  </Label>
                  <Textarea
                    id="vehicle_description"
                    value={form.vehicle_description}
                    onChange={(e) =>
                      update("vehicle_description", e.target.value)
                    }
                    placeholder="Describe condition, features, known issues, service history..."
                    rows={4}
                  />
                </div>
              </div>
            )}

            {/* ── Step 2: Sale Details ── */}
            {step === 2 && (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="sale_price">Agreed Sale Price</Label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                      $
                    </span>
                    <Input
                      id="sale_price"
                      value={form.sale_price}
                      onChange={(e) => update("sale_price", e.target.value)}
                      placeholder="0.00"
                      type="number"
                      min="0"
                      step="0.01"
                      className="pl-7"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="buyer_email">Buyer&apos;s Email Address</Label>
                  <Input
                    id="buyer_email"
                    value={form.buyer_email}
                    onChange={(e) => update("buyer_email", e.target.value)}
                    placeholder="buyer@example.com"
                    type="email"
                    autoComplete="off"
                  />
                </div>

                <div className="rounded-lg border bg-muted/50 p-4">
                  <p className="text-sm leading-relaxed text-muted-foreground">
                    <span className="font-medium text-foreground">
                      How it works:
                    </span>{" "}
                    The buyer will receive an email with a secure payment link.
                    Their funds are held in escrow by SafeShift until you hand
                    over the car and both parties confirm the transaction is
                    complete.
                  </p>
                </div>
              </div>
            )}

            {/* ── Step 3: Review ── */}
            {step === 3 && (
              <div className="space-y-5">
                <div className="divide-y rounded-lg border">
                  <div className="grid grid-cols-2 gap-x-6 gap-y-4 p-4">
                    <div>
                      <p className="mb-1 text-xs text-muted-foreground">Vehicle</p>
                      <p className="font-medium">
                        {form.year} {form.make} {form.model}
                      </p>
                    </div>
                    <div>
                      <p className="mb-1 text-xs text-muted-foreground">VIN</p>
                      <p className="font-mono text-sm">{form.vin}</p>
                    </div>
                    <div>
                      <p className="mb-1 text-xs text-muted-foreground">Odometer</p>
                      <p className="font-medium">
                        {parseInt(form.odometer).toLocaleString()} miles
                      </p>
                    </div>
                    <div>
                      <p className="mb-1 text-xs text-muted-foreground">Buyer Email</p>
                      <p className="break-all font-medium">{form.buyer_email}</p>
                    </div>
                  </div>

                  {form.vehicle_description && (
                    <div className="p-4">
                      <p className="mb-1 text-xs text-muted-foreground">Description</p>
                      <p className="text-sm">{form.vehicle_description}</p>
                    </div>
                  )}

                  <div className="space-y-2 p-4">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Sale Price</span>
                      <span className="font-medium">{fmt(salePrice)}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">
                        SafeShift fee{" "}
                        <span className="text-xs">(paid by buyer)</span>
                      </span>
                      <span className="font-medium">{fmt(SAFESHIFT_FEE)}</span>
                    </div>
                    <div className="flex justify-between border-t pt-2 text-sm">
                      <span className="font-semibold">Buyer pays total</span>
                      <span className="font-bold text-primary">
                        {fmt(salePrice + SAFESHIFT_FEE)}
                      </span>
                    </div>
                  </div>
                </div>

                <p className="text-center text-xs text-muted-foreground">
                  By creating this transaction you agree to the SafeShift Terms
                  of Service.
                </p>
              </div>
            )}

            {/* Navigation */}
            <div className="flex items-center justify-between pt-2">
              {step > 1 ? (
                <Button variant="outline" onClick={handleBack} disabled={isSubmitting}>
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  Back
                </Button>
              ) : (
                <div />
              )}

              {step < 3 ? (
                <Button onClick={handleNext}>
                  Next
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              ) : (
                <Button onClick={handleSubmit} disabled={isSubmitting} size="lg">
                  {isSubmitting ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Creating Transaction…
                    </>
                  ) : (
                    "Create Transaction"
                  )}
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
