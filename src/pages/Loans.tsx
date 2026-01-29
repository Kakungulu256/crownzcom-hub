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
import { Calculator, Clock, CheckCircle, AlertCircle, Plus } from "lucide-react";
import { StatsCard } from "@/components/dashboard/StatsCard";
import { Progress } from "@/components/ui/progress";
import { CreditCard, Wallet, Calendar } from "lucide-react";

const activeLoans = [
  {
    id: 1,
    purpose: "Business Expansion",
    principal: 50000,
    balance: 25000,
    monthlyPayment: 5500,
    nextDue: "2024-02-15",
    status: "active",
    progress: 50,
  },
  {
    id: 2,
    purpose: "Emergency Medical",
    principal: 20000,
    balance: 8000,
    monthlyPayment: 3000,
    nextDue: "2024-02-10",
    status: "active",
    progress: 60,
  },
];

const loanHistory = [
  { id: 1, date: "2024-01-15", description: "Loan Repayment - Business", amount: 5500, type: "payment" },
  { id: 2, date: "2024-01-10", description: "Loan Repayment - Medical", amount: 3000, type: "payment" },
  { id: 3, date: "2023-12-15", description: "Loan Repayment - Business", amount: 5500, type: "payment" },
  { id: 4, date: "2023-12-10", description: "Loan Repayment - Medical", amount: 3000, type: "payment" },
  { id: 5, date: "2023-11-20", description: "Loan Disbursement - Medical", amount: 20000, type: "disbursement" },
];

const Loans = () => {
  return (
    <AppLayout title="My Loans">
      <div className="space-y-6">
        {/* Stats */}
        <div className="grid gap-4 md:grid-cols-3">
          <StatsCard
            title="Total Outstanding"
            value="KES 33,000"
            change="2 active loans"
            changeType="neutral"
            icon={CreditCard}
          />
          <StatsCard
            title="Available Credit"
            value="KES 87,500"
            change="Based on 50% of savings"
            changeType="positive"
            icon={Wallet}
          />
          <StatsCard
            title="Next Payment"
            value="Feb 10, 2024"
            change="KES 3,000 due"
            changeType="neutral"
            icon={Calendar}
          />
        </div>

        {/* Active Loans */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-4">
            <CardTitle className="text-lg font-semibold uppercase tracking-wider">
              Active Loans
            </CardTitle>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Apply for Loan
            </Button>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {activeLoans.map((loan) => (
                <div key={loan.id} className="rounded-lg border border-border p-4 space-y-4 bg-card">
                  <div className="flex items-start justify-between">
                    <div>
                      <h4 className="font-semibold">{loan.purpose}</h4>
                      <p className="text-sm text-muted-foreground">
                        Principal: <span className="font-mono">KES {loan.principal.toLocaleString()}</span>
                      </p>
                    </div>
                    <Badge variant="outline" className="uppercase tracking-wider">
                      <Clock className="h-3 w-3 mr-1" />
                      {loan.status}
                    </Badge>
                  </div>
                  
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span>Repayment Progress</span>
                      <span className="font-mono font-semibold">{loan.progress}%</span>
                    </div>
                    <div className="h-3 rounded-full bg-secondary relative overflow-hidden">
                      <div 
                        className="absolute inset-y-0 left-0 bg-primary rounded-full transition-all"
                        style={{ width: `${loan.progress}%` }}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-4 pt-2">
                    <div>
                      <p className="text-xs text-muted-foreground uppercase tracking-wider">Outstanding</p>
                      <p className="font-mono font-semibold">KES {loan.balance.toLocaleString()}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground uppercase tracking-wider">Monthly</p>
                      <p className="font-mono font-semibold">KES {loan.monthlyPayment.toLocaleString()}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground uppercase tracking-wider">Next Due</p>
                      <p className="font-mono font-semibold">{loan.nextDue}</p>
                    </div>
                  </div>

                  <div className="flex gap-2 pt-2">
                    <Button variant="outline" size="sm">View Details</Button>
                    <Button variant="default" size="sm">Make Payment</Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Payment History */}
        <Card>
          <CardHeader className="pb-4">
            <CardTitle className="text-lg font-semibold uppercase tracking-wider">
              Payment History
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="rounded-lg border border-border overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="bg-primary hover:bg-primary">
                    <TableHead className="font-semibold uppercase tracking-wider text-xs text-primary-foreground">Date</TableHead>
                    <TableHead className="font-semibold uppercase tracking-wider text-xs text-primary-foreground">Description</TableHead>
                    <TableHead className="font-semibold uppercase tracking-wider text-xs text-primary-foreground">Type</TableHead>
                    <TableHead className="font-semibold uppercase tracking-wider text-xs text-right text-primary-foreground">Amount</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loanHistory.map((record) => (
                    <TableRow key={record.id} className="border-b border-border">
                      <TableCell className="font-mono text-sm">{record.date}</TableCell>
                      <TableCell className="text-sm">{record.description}</TableCell>
                      <TableCell>
                        <Badge variant={record.type === "payment" ? "default" : "secondary"} className="uppercase text-xs">
                          {record.type}
                        </Badge>
                      </TableCell>
                      <TableCell className={`text-right font-mono font-semibold ${record.type === "payment" ? "text-success" : "text-foreground"}`}>
                        {record.type === "payment" ? "-" : "+"}KES {record.amount.toLocaleString()}
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

export default Loans;
