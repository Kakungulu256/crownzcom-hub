import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Search, Filter, CheckCircle, XCircle, Eye, Clock, FileCheck, AlertTriangle } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const pendingLoans = [
  { id: 1, member: "Jane Smith", amount: 50000, purpose: "Business Expansion", term: "12 months", interest: 12, date: "2024-01-27", risk: "low", savingsRatio: 0.2 },
  { id: 2, member: "Mike Johnson", amount: 75000, purpose: "Education Fees", term: "18 months", interest: 12, date: "2024-01-26", risk: "medium", savingsRatio: 0.84 },
  { id: 3, member: "Sarah Williams", amount: 30000, purpose: "Medical Emergency", term: "6 months", interest: 10, date: "2024-01-25", risk: "low", savingsRatio: 0.1 },
];

const activeLoans = [
  { id: 4, member: "John Doe", amount: 50000, balance: 25000, purpose: "Business", nextDue: "2024-02-15", status: "current" },
  { id: 5, member: "John Doe", amount: 20000, balance: 8000, purpose: "Medical", nextDue: "2024-02-10", status: "current" },
  { id: 6, member: "David Brown", amount: 100000, balance: 85000, purpose: "Investment", nextDue: "2024-02-05", status: "overdue" },
];

const LoanApprovalsPage = () => {
  return (
    <AppLayout title="Loan Management">
      <div className="space-y-6">
        {/* Page Header */}
        <div className="rounded-lg p-6 bg-gradient-to-r from-[hsl(260,50%,35%)] to-[hsl(280,50%,45%)] text-white">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <h2 className="text-2xl font-bold tracking-tight">Loan Management</h2>
              <p className="text-white/80 mt-1">
                Review, approve, and manage member loans
              </p>
            </div>
            <div className="flex gap-3">
              <div className="bg-white/10 rounded-lg px-4 py-2 backdrop-blur-sm text-center">
                <p className="text-xs text-white/70 uppercase tracking-wider">Pending</p>
                <p className="font-mono font-bold text-xl">{pendingLoans.length}</p>
              </div>
              <div className="bg-white/10 rounded-lg px-4 py-2 backdrop-blur-sm text-center">
                <p className="text-xs text-white/70 uppercase tracking-wider">Active</p>
                <p className="font-mono font-bold text-xl">{activeLoans.length}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Search */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex flex-col md:flex-row gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input placeholder="Search loans by member or purpose..." className="pl-9" />
              </div>
              <Button variant="outline">
                <Filter className="h-4 w-4 mr-2" />
                Filter
              </Button>
            </div>
          </CardContent>
        </Card>

        <Tabs defaultValue="pending" className="space-y-6">
          <TabsList className="rounded-lg border border-border p-1 h-auto bg-secondary/50">
            <TabsTrigger value="pending" className="rounded-md data-[state=active]:bg-primary data-[state=active]:text-primary-foreground px-6 py-2.5">
              <AlertTriangle className="h-4 w-4 mr-2" />
              Pending Approvals ({pendingLoans.length})
            </TabsTrigger>
            <TabsTrigger value="active" className="rounded-md data-[state=active]:bg-primary data-[state=active]:text-primary-foreground px-6 py-2.5">
              <FileCheck className="h-4 w-4 mr-2" />
              Active Loans ({activeLoans.length})
            </TabsTrigger>
            <TabsTrigger value="history" className="rounded-md data-[state=active]:bg-primary data-[state=active]:text-primary-foreground px-6 py-2.5">
              <Clock className="h-4 w-4 mr-2" />
              History
            </TabsTrigger>
          </TabsList>

          <TabsContent value="pending" className="space-y-4">
            {pendingLoans.map((loan) => (
              <Card key={loan.id} className="overflow-hidden hover:shadow-md transition-shadow">
                <CardContent className="pt-6">
                  <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-6">
                    <div className="space-y-4 flex-1">
                      <div className="flex items-start justify-between">
                        <div>
                          <h3 className="text-xl font-bold">{loan.member}</h3>
                          <p className="text-muted-foreground">{loan.purpose}</p>
                        </div>
                        <Badge
                          variant="outline"
                          className={`uppercase tracking-wider ${
                            loan.risk === "low" 
                              ? "bg-success/10 text-success border-success/30" 
                              : "bg-warning/10 text-warning border-warning/30"
                          }`}
                        >
                          {loan.risk} risk
                        </Badge>
                      </div>

                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div className="rounded-lg border border-border p-3 bg-muted/30">
                          <p className="text-xs text-muted-foreground uppercase tracking-wider">Amount</p>
                          <p className="font-mono font-bold text-lg">KES {loan.amount.toLocaleString()}</p>
                        </div>
                        <div className="rounded-lg border border-border p-3 bg-muted/30">
                          <p className="text-xs text-muted-foreground uppercase tracking-wider">Term</p>
                          <p className="font-mono font-bold text-lg">{loan.term}</p>
                        </div>
                        <div className="rounded-lg border border-border p-3 bg-muted/30">
                          <p className="text-xs text-muted-foreground uppercase tracking-wider">Interest</p>
                          <p className="font-mono font-bold text-lg">{loan.interest}% p.a.</p>
                        </div>
                        <div className="rounded-lg border border-border p-3 bg-muted/30">
                          <p className="text-xs text-muted-foreground uppercase tracking-wider">Savings Ratio</p>
                          <p className={`font-mono font-bold text-lg ${loan.savingsRatio > 0.5 ? "text-destructive" : "text-success"}`}>
                            {(loan.savingsRatio * 100).toFixed(0)}%
                          </p>
                        </div>
                      </div>

                      <p className="text-sm text-muted-foreground">
                        Applied: <span className="font-mono font-medium">{loan.date}</span>
                      </p>
                    </div>

                    <div className="flex flex-row lg:flex-col gap-2 lg:w-36">
                      <Button className="flex-1 bg-success hover:bg-success/90">
                        <CheckCircle className="h-4 w-4 mr-2" />
                        Approve
                      </Button>
                      <Button variant="outline" className="flex-1">
                        <Eye className="h-4 w-4 mr-2" />
                        Review
                      </Button>
                      <Button variant="destructive" className="flex-1">
                        <XCircle className="h-4 w-4 mr-2" />
                        Reject
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </TabsContent>

          <TabsContent value="active">
            <Card>
              <CardHeader className="pb-4 flex flex-row items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                  <FileCheck className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <CardTitle className="text-lg font-semibold">
                    Active Loans
                  </CardTitle>
                  <p className="text-sm text-muted-foreground">Currently outstanding loans</p>
                </div>
              </CardHeader>
              <CardContent>
                <div className="rounded-lg border border-border overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-gradient-to-r from-primary to-primary/80 hover:from-primary hover:to-primary/80">
                        <TableHead className="font-semibold uppercase tracking-wider text-xs text-primary-foreground">Member</TableHead>
                        <TableHead className="font-semibold uppercase tracking-wider text-xs text-primary-foreground">Purpose</TableHead>
                        <TableHead className="font-semibold uppercase tracking-wider text-xs text-right text-primary-foreground">Principal</TableHead>
                        <TableHead className="font-semibold uppercase tracking-wider text-xs text-right text-primary-foreground">Balance</TableHead>
                        <TableHead className="font-semibold uppercase tracking-wider text-xs text-primary-foreground">Next Due</TableHead>
                        <TableHead className="font-semibold uppercase tracking-wider text-xs text-primary-foreground">Status</TableHead>
                        <TableHead className="font-semibold uppercase tracking-wider text-xs text-right text-primary-foreground">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {activeLoans.map((loan) => (
                        <TableRow key={loan.id} className="border-b border-border hover:bg-muted/50">
                          <TableCell className="font-medium">{loan.member}</TableCell>
                          <TableCell>{loan.purpose}</TableCell>
                          <TableCell className="text-right font-mono">KES {loan.amount.toLocaleString()}</TableCell>
                          <TableCell className="text-right font-mono font-semibold">KES {loan.balance.toLocaleString()}</TableCell>
                          <TableCell className="font-mono text-sm">{loan.nextDue}</TableCell>
                          <TableCell>
                            <Badge
                              variant="outline"
                              className={`uppercase text-xs tracking-wider ${
                                loan.status === "current" 
                                  ? "bg-success/10 text-success border-success/30" 
                                  : "bg-destructive/10 text-destructive border-destructive/30"
                              }`}
                            >
                              {loan.status}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            <Button variant="outline" size="sm">
                              Record Payment
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="history">
            <Card>
              <CardContent className="py-16 text-center">
                <div className="h-16 w-16 mx-auto rounded-full bg-muted flex items-center justify-center mb-4">
                  <Clock className="h-8 w-8 text-muted-foreground" />
                </div>
                <h3 className="text-lg font-semibold mb-2">Loan History</h3>
                <p className="text-muted-foreground max-w-sm mx-auto">Historical loan records and completed loans will appear here.</p>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
};

export default LoanApprovalsPage;
