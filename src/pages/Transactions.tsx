import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ArrowDownLeft, ArrowUpRight, Download, Filter, Search, Activity } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

const transactions = [
  { id: 1, date: "2024-01-28", description: "Monthly Savings Deposit", type: "deposit", category: "Savings", amount: 5000, reference: "TXN001234" },
  { id: 2, date: "2024-01-25", description: "Loan Disbursement - Emergency", type: "withdrawal", category: "Loan", amount: 25000, reference: "TXN001233" },
  { id: 3, date: "2024-01-20", description: "Interest Distribution Q4 2023", type: "deposit", category: "Interest", amount: 1250, reference: "TXN001232" },
  { id: 4, date: "2024-01-15", description: "Loan Repayment - Business", type: "deposit", category: "Loan Payment", amount: 5500, reference: "TXN001231" },
  { id: 5, date: "2024-01-10", description: "Loan Repayment - Medical", type: "deposit", category: "Loan Payment", amount: 3000, reference: "TXN001230" },
  { id: 6, date: "2024-01-05", description: "Emergency Fund Contribution", type: "deposit", category: "Savings", amount: 2000, reference: "TXN001229" },
  { id: 7, date: "2023-12-28", description: "Monthly Savings Deposit", type: "deposit", category: "Savings", amount: 5000, reference: "TXN001228" },
  { id: 8, date: "2023-12-15", description: "Withdrawal - Personal", type: "withdrawal", category: "Withdrawal", amount: 10000, reference: "TXN001227" },
];

const Transactions = () => {
  const totalDeposits = transactions.filter(t => t.type === "deposit").reduce((sum, t) => sum + t.amount, 0);
  const totalWithdrawals = transactions.filter(t => t.type === "withdrawal").reduce((sum, t) => sum + t.amount, 0);

  return (
    <AppLayout title="Transactions">
      <div className="space-y-6">
        {/* Page Header */}
        <div className="rounded-lg p-6 bg-gradient-to-r from-[hsl(260,50%,35%)] to-[hsl(280,50%,45%)] text-white">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <h2 className="text-2xl font-bold tracking-tight">Transaction History</h2>
              <p className="text-white/80 mt-1">
                View and manage all your financial transactions
              </p>
            </div>
            <div className="flex gap-3">
              <div className="bg-white/10 rounded-lg px-4 py-2 backdrop-blur-sm">
                <p className="text-xs text-white/70 uppercase tracking-wider">Total In</p>
                <p className="font-mono font-bold text-success">+KES {totalDeposits.toLocaleString()}</p>
              </div>
              <div className="bg-white/10 rounded-lg px-4 py-2 backdrop-blur-sm">
                <p className="text-xs text-white/70 uppercase tracking-wider">Total Out</p>
                <p className="font-mono font-bold text-destructive">-KES {totalWithdrawals.toLocaleString()}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Filters */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex flex-col md:flex-row gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input placeholder="Search transactions..." className="pl-9" />
              </div>
              <Button variant="outline">
                <Filter className="h-4 w-4 mr-2" />
                Filter
              </Button>
              <Button variant="outline">
                <Download className="h-4 w-4 mr-2" />
                Export CSV
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Transactions Table */}
        <Card>
          <CardHeader className="pb-4 flex flex-row items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
              <Activity className="h-5 w-5 text-primary" />
            </div>
            <div>
              <CardTitle className="text-lg font-semibold">
                All Transactions
              </CardTitle>
              <p className="text-sm text-muted-foreground">{transactions.length} records found</p>
            </div>
          </CardHeader>
          <CardContent>
            <div className="rounded-lg border border-border overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="bg-gradient-to-r from-primary to-primary/80 hover:from-primary hover:to-primary/80">
                    <TableHead className="font-semibold uppercase tracking-wider text-xs w-12 text-primary-foreground"></TableHead>
                    <TableHead className="font-semibold uppercase tracking-wider text-xs text-primary-foreground">Date</TableHead>
                    <TableHead className="font-semibold uppercase tracking-wider text-xs text-primary-foreground">Description</TableHead>
                    <TableHead className="font-semibold uppercase tracking-wider text-xs text-primary-foreground">Category</TableHead>
                    <TableHead className="font-semibold uppercase tracking-wider text-xs text-primary-foreground">Reference</TableHead>
                    <TableHead className="font-semibold uppercase tracking-wider text-xs text-right text-primary-foreground">Amount</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {transactions.map((tx) => (
                    <TableRow key={tx.id} className="border-b border-border hover:bg-muted/50 transition-colors">
                      <TableCell>
                        <div
                          className={cn(
                            "flex h-9 w-9 items-center justify-center rounded-full",
                            tx.type === "deposit" 
                              ? "bg-success/15 ring-2 ring-success/20" 
                              : "bg-destructive/15 ring-2 ring-destructive/20"
                          )}
                        >
                          {tx.type === "deposit" ? (
                            <ArrowDownLeft className="h-4 w-4 text-success" />
                          ) : (
                            <ArrowUpRight className="h-4 w-4 text-destructive" />
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="font-mono text-sm">{tx.date}</TableCell>
                      <TableCell className="text-sm font-medium">{tx.description}</TableCell>
                      <TableCell>
                        <Badge variant="secondary" className="uppercase text-xs tracking-wider">
                          {tx.category}
                        </Badge>
                      </TableCell>
                      <TableCell className="font-mono text-xs text-muted-foreground">{tx.reference}</TableCell>
                      <TableCell className={cn(
                        "text-right font-mono font-semibold",
                        tx.type === "deposit" ? "text-success" : "text-destructive"
                      )}>
                        {tx.type === "deposit" ? "+" : "-"}KES {tx.amount.toLocaleString()}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
};

export default Transactions;
