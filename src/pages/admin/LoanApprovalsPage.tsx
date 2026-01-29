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
import { Search, Filter, CheckCircle, XCircle, Eye, Clock } from "lucide-react";
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
        {/* Search */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex flex-col md:flex-row gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input placeholder="Search loans..." className="pl-9" />
              </div>
              <Button variant="outline">
                <Filter className="h-4 w-4 mr-2" />
                Filter
              </Button>
            </div>
          </CardContent>
        </Card>

        <Tabs defaultValue="pending" className="space-y-6">
          <TabsList className="rounded-lg border border-border p-1 h-auto bg-secondary">
            <TabsTrigger value="pending" className="rounded-md data-[state=active]:bg-primary data-[state=active]:text-primary-foreground px-6 py-2">
              Pending Approvals (3)
            </TabsTrigger>
            <TabsTrigger value="active" className="rounded-md data-[state=active]:bg-primary data-[state=active]:text-primary-foreground px-6 py-2">
              Active Loans (3)
            </TabsTrigger>
            <TabsTrigger value="history" className="rounded-md data-[state=active]:bg-primary data-[state=active]:text-primary-foreground px-6 py-2">
              History
            </TabsTrigger>
          </TabsList>

          <TabsContent value="pending" className="space-y-4">
            {pendingLoans.map((loan) => (
              <Card key={loan.id}>
                <CardContent className="pt-6">
                  <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-6">
                    <div className="space-y-4 flex-1">
                      <div className="flex items-start justify-between">
                        <div>
                          <h3 className="text-xl font-bold">{loan.member}</h3>
                          <p className="text-muted-foreground">{loan.purpose}</p>
                        </div>
                        <Badge
                          variant={loan.risk === "low" ? "default" : "secondary"}
                          className="uppercase tracking-wider"
                        >
                          {loan.risk} risk
                        </Badge>
                      </div>

                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div className="rounded-lg border border-border p-3">
                          <p className="text-xs text-muted-foreground uppercase tracking-wider">Amount</p>
                          <p className="font-mono font-bold text-lg">KES {loan.amount.toLocaleString()}</p>
                        </div>
                        <div className="rounded-lg border border-border p-3">
                          <p className="text-xs text-muted-foreground uppercase tracking-wider">Term</p>
                          <p className="font-mono font-bold text-lg">{loan.term}</p>
                        </div>
                        <div className="rounded-lg border border-border p-3">
                          <p className="text-xs text-muted-foreground uppercase tracking-wider">Interest</p>
                          <p className="font-mono font-bold text-lg">{loan.interest}% p.a.</p>
                        </div>
                        <div className="rounded-lg border border-border p-3">
                          <p className="text-xs text-muted-foreground uppercase tracking-wider">Savings Ratio</p>
                          <p className={`font-mono font-bold text-lg ${loan.savingsRatio > 0.5 ? "text-destructive" : "text-success"}`}>
                            {(loan.savingsRatio * 100).toFixed(0)}%
                          </p>
                        </div>
                      </div>

                      <p className="text-sm text-muted-foreground">
                        Applied: <span className="font-mono">{loan.date}</span>
                      </p>
                    </div>

                    <div className="flex flex-row lg:flex-col gap-2 lg:w-36">
                      <Button variant="success" className="flex-1">
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
              <CardHeader className="pb-4">
                <CardTitle className="text-lg font-semibold uppercase tracking-wider">
                  Active Loans
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="rounded-lg border border-border overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-primary hover:bg-primary">
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
                        <TableRow key={loan.id} className="border-b border-border">
                          <TableCell className="font-medium">{loan.member}</TableCell>
                          <TableCell>{loan.purpose}</TableCell>
                          <TableCell className="text-right font-mono">KES {loan.amount.toLocaleString()}</TableCell>
                          <TableCell className="text-right font-mono font-semibold">KES {loan.balance.toLocaleString()}</TableCell>
                          <TableCell className="font-mono text-sm">{loan.nextDue}</TableCell>
                          <TableCell>
                            <Badge
                              variant={loan.status === "current" ? "default" : "destructive"}
                              className="uppercase text-xs tracking-wider"
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
              <CardContent className="py-12 text-center">
                <Clock className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <h3 className="text-lg font-semibold">Loan History</h3>
                <p className="text-muted-foreground">Historical loan records will appear here.</p>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
};

export default LoanApprovalsPage;
