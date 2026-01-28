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
import { ArrowDownLeft, ArrowUpRight, Download, Filter, Search } from "lucide-react";
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
  return (
    <AppLayout title="Transactions">
      <div className="space-y-6">
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
          <CardHeader className="pb-4">
            <CardTitle className="text-lg font-semibold uppercase tracking-wider">
              All Transactions
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="border-2 border-border">
              <Table>
                <TableHeader>
                  <TableRow className="border-b-2 border-border hover:bg-transparent">
                    <TableHead className="font-semibold uppercase tracking-wider text-xs w-12"></TableHead>
                    <TableHead className="font-semibold uppercase tracking-wider text-xs">Date</TableHead>
                    <TableHead className="font-semibold uppercase tracking-wider text-xs">Description</TableHead>
                    <TableHead className="font-semibold uppercase tracking-wider text-xs">Category</TableHead>
                    <TableHead className="font-semibold uppercase tracking-wider text-xs">Reference</TableHead>
                    <TableHead className="font-semibold uppercase tracking-wider text-xs text-right">Amount</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {transactions.map((tx) => (
                    <TableRow key={tx.id} className="border-b border-border">
                      <TableCell>
                        <div
                          className={cn(
                            "flex h-8 w-8 items-center justify-center border-2 border-foreground",
                            tx.type === "deposit" ? "bg-chart-2/20" : "bg-chart-1/20"
                          )}
                        >
                          {tx.type === "deposit" ? (
                            <ArrowDownLeft className="h-4 w-4 text-chart-2" />
                          ) : (
                            <ArrowUpRight className="h-4 w-4 text-chart-1" />
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
                        tx.type === "deposit" ? "text-chart-2" : "text-chart-1"
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
