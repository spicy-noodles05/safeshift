import Link from "next/link";
import { Shield, Lock, CheckCircle, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Navbar } from "@/components/layout/navbar";
import { Footer } from "@/components/layout/footer";

const features = [
  {
    icon: Shield,
    title: "Funds Held Securely",
    description:
      "Buyer deposits funds into escrow before the vehicle changes hands. Money is only released when both parties confirm.",
  },
  {
    icon: Lock,
    title: "Identity Verified",
    description:
      "Every buyer and seller is KYC-verified via Persona before a transaction begins — no anonymous parties.",
  },
  {
    icon: CheckCircle,
    title: "Dispute Protection",
    description:
      "Our team mediates any disputes. If something goes wrong, funds are never released without resolution.",
  },
];

export default function HomePage() {
  return (
    <div className="flex min-h-screen flex-col">
      <Navbar />

      <main className="flex-1">
        {/* Hero */}
        <section className="container py-24 text-center md:py-32">
          <div className="mx-auto max-w-3xl space-y-6">
            <div className="inline-flex items-center gap-2 rounded-full border bg-muted px-4 py-1.5 text-sm text-muted-foreground">
              <Shield className="h-3.5 w-3.5" />
              Trusted escrow for private party car sales
            </div>
            <h1 className="text-4xl font-bold tracking-tight sm:text-6xl">
              Buy or sell a car with{" "}
              <span className="text-primary">zero risk</span>
            </h1>
            <p className="text-lg text-muted-foreground">
              SafeShift holds your money in escrow until every step of the
              transaction is complete — verified IDs, inspection, and title
              transfer.
            </p>
            <div className="flex flex-col gap-4 sm:flex-row sm:justify-center">
              <Button asChild size="lg">
                <Link href="/register">
                  Start a transaction <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
              <Button asChild variant="outline" size="lg">
                <Link href="#how-it-works">How it works</Link>
              </Button>
            </div>
          </div>
        </section>

        {/* Features */}
        <section id="how-it-works" className="container py-20">
          <h2 className="mb-12 text-center text-3xl font-bold tracking-tight">
            Built for trust at every step
          </h2>
          <div className="grid gap-6 md:grid-cols-3">
            {features.map((feature) => (
              <Card key={feature.title}>
                <CardHeader>
                  <feature.icon className="h-8 w-8 text-primary" />
                  <CardTitle className="mt-4">{feature.title}</CardTitle>
                </CardHeader>
                <CardContent>
                  <CardDescription className="text-base">
                    {feature.description}
                  </CardDescription>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}
