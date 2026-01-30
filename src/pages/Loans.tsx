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
import { Clock, Plus, CreditCard, Wallet, Calendar, ArrowRight, TrendingUp } from "lucide-react";
import { StatsCard } from "@/components/dashboard/StatsCard";

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
        {/* Page Header */}
        <div className="rounded-lg p-6 bg-gradient-to-r from-[hsl(260,50%,35%)] to-[hsl(280,50%,45%)] text-white">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <h2 className="text-2xl font-bold tracking-tight">Loan Management</h2>
              <p className="text-white/80 mt-1">
                Track your active loans and repayment progress
              </p>
            </div>
            <Button className="bg-white/20 hover:bg-white/30 text-white border-white/30 border backdrop-blur-sm">
              <Plus className="h-4 w-4 mr-2" />
              Apply for Loan
            </Button>
          </div>
        </div>

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
            <Badge variant="secondary" className="font-mono">
              {activeLoans.length} Active
            </Badge>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {activeLoans.map((loan) => (
                <div key={loan.id} className="rounded-lg border border-border p-5 space-y-4 bg-card hover:shadow-md transition-shadow">
                  <div className="flex items-start justify-between">
                    <div>
                      <h4 className="font-semibold text-lg">{loan.purpose}</h4>
                      <p className="text-sm text-muted-foreground">
                        Principal: <span className="font-mono font-medium text-foreground">KES {loan.principal.toLocaleString()}</span>
                      </p>
                    </div>
                    <Badge variant="outline" className="uppercase tracking-wider bg-primary/10 text-primary border-primary/30">
                      <Clock className="h-3 w-3 mr-1" />
                      {loan.status}
                    </Badge>
                  </div>
                  
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Repayment Progress</span>
                      <span className="font-mono font-semibold text-primary">{loan.progress}%</span>
                    </div>
                    <div className="h-3 rounded-full bg-secondary relative overflow-hidden">
                      <div 
                        className="absolute inset-y-0 left-0 bg-gradient-to-r from-primary to-primary/70 rounded-full transition-all"
                        style={{ width: `${loan.progress}%` }}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-4 pt-2">
                    <div className="rounded-lg bg-secondary/50 p-3">
                      <p className="text-xs text-muted-foreground uppercase tracking-wider">Outstanding</p>
                      <p className="font-mono font-semibold text-lg">KES {loan.balance.toLocaleString()}</p>
                    </div>
                    <div className="rounded-lg bg-secondary/50 p-3">
                      <p className="text-xs text-muted-foreground uppercase tracking-wider">Monthly</p>
                      <p className="font-mono font-semibold text-lg">KES {loan.monthlyPayment.toLocaleString()}</p>
                    </div>
                    <div className="rounded-lg bg-secondary/50 p-3">
                      <p className="text-xs text-muted-foreground uppercase tracking-wider">Next Due</p>
                      <p className="font-mono font-semibold text-lg">{loan.nextDue}</p>
                    </div>
                  </div>

                  <div className="flex gap-2 pt-2">
                    <Button variant="outline" size="sm">
                      View Details
                      <ArrowRight className="h-4 w-4 ml-2" />
                    </Button>
                    <Button variant="default" size="sm">
                      <TrendingUp className="h-4 w-4 mr-2" />
                      Make Payment
                    </Button>
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
                  <TableRow className="bg-gradient-to-r from-primary to-primary/80 hover:from-primary hover:to-primary/80">
                    <TableHead className="font-semibold uppercase tracking-wider text-xs text-primary-foreground">Date</TableHead>
                    <TableHead className="font-semibold uppercase tracking-wider text-xs text-primary-foreground">Description</TableHead>
                    <TableHead className="font-semibold uppercase tracking-wider text-xs text-primary-foreground">Type</TableHead>
                    <TableHead className="font-semibold uppercase tracking-wider text-xs text-right text-primary-foreground">Amount</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loanHistory.map((record) => (
                    <TableRow key={record.id} className="border-b border-border hover:bg-muted/50">
                      <TableCell className="font-mono text-sm">{record.date}</TableCell>
                      <TableCell className="text-sm">{record.description}</TableCell>
                      <TableCell>
                        <Badge 
                          variant={record.type === "payment" ? "default" : "secondary"} 
                          className="uppercase text-xs"
                        >
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
