import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Plus } from "lucide-react";

export default function DashboardPage() {
  return (
    <div className="container py-10 space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">My Transactions</h1>
          <p className="text-muted-foreground">Manage your active escrow transactions</p>
        </div>
        <Button>
          <Plus className="mr-2 h-4 w-4" />
          New Transaction
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>No transactions yet</CardTitle>
          <CardDescription>
            Start a new transaction to buy or sell a vehicle securely.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button variant="outline">Create your first transaction</Button>
        </CardContent>
      </Card>
    </div>
  );
}
