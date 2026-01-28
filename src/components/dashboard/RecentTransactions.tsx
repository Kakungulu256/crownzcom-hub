import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowDownLeft, ArrowUpRight } from "lucide-react";
import { cn } from "@/lib/utils";

const transactions = [
  {
    id: 1,
    type: "deposit",
    description: "Monthly Savings Deposit",
    amount: 5000,
    date: "2024-01-28",
    status: "completed",
  },
  {
    id: 2,
    type: "withdrawal",
    description: "Loan Disbursement",
    amount: 25000,
    date: "2024-01-25",
    status: "completed",
  },
  {
    id: 3,
    type: "deposit",
    description: "Interest Distribution",
    amount: 1250,
    date: "2024-01-20",
    status: "completed",
  },
  {
    id: 4,
    type: "deposit",
    description: "Loan Repayment",
    amount: 3500,
    date: "2024-01-15",
    status: "completed",
  },
  {
    id: 5,
    type: "deposit",
    description: "Emergency Fund Contribution",
    amount: 2000,
    date: "2024-01-10",
    status: "pending",
  },
];

export function RecentTransactions() {
  return (
    <Card>
      <CardHeader className="pb-4">
        <CardTitle className="text-lg font-semibold uppercase tracking-wider">
          Recent Transactions
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {transactions.map((transaction) => (
            <div
              key={transaction.id}
              className="flex items-center justify-between p-3 border-2 border-border hover:bg-accent/50 transition-colors"
            >
              <div className="flex items-center gap-3">
                <div
                  className={cn(
                    "flex h-10 w-10 items-center justify-center border-2 border-foreground",
                    transaction.type === "deposit" ? "bg-chart-2/20" : "bg-chart-1/20"
                  )}
                >
                  {transaction.type === "deposit" ? (
                    <ArrowDownLeft className="h-5 w-5 text-chart-2" />
                  ) : (
                    <ArrowUpRight className="h-5 w-5 text-chart-1" />
                  )}
                </div>
                <div>
                  <p className="font-medium text-sm">{transaction.description}</p>
                  <p className="text-xs text-muted-foreground">{transaction.date}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span
                  className={cn(
                    "font-mono font-semibold",
                    transaction.type === "deposit" ? "text-chart-2" : "text-chart-1"
                  )}
                >
                  {transaction.type === "deposit" ? "+" : "-"}KES{" "}
                  {transaction.amount.toLocaleString()}
                </span>
                <Badge
                  variant={transaction.status === "completed" ? "default" : "secondary"}
                  className="uppercase text-xs tracking-wider"
                >
                  {transaction.status}
                </Badge>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
