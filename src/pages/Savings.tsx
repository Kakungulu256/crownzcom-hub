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
import { Download, Filter, Plus, TrendingUp } from "lucide-react";
import { StatsCard } from "@/components/dashboard/StatsCard";
import { PiggyBank, Calendar, Target } from "lucide-react";

const savingsHistory = [
  { id: 1, date: "2024-01-28", description: "Monthly Contribution", amount: 5000, balance: 175000, type: "credit" },
  { id: 2, date: "2024-01-20", description: "Interest Distribution", amount: 1250, balance: 170000, type: "credit" },
  { id: 3, date: "2023-12-28", description: "Monthly Contribution", amount: 5000, balance: 168750, type: "credit" },
  { id: 4, date: "2023-12-15", description: "Emergency Withdrawal", amount: 10000, balance: 163750, type: "debit" },
  { id: 5, date: "2023-11-28", description: "Monthly Contribution", amount: 5000, balance: 173750, type: "credit" },
  { id: 6, date: "2023-11-20", description: "Interest Distribution", amount: 1100, balance: 168750, type: "credit" },
];

const Savings = () => {
  return (
    <AppLayout title="My Savings">
      <div className="space-y-6">
        {/* Stats */}
        <div className="grid gap-4 md:grid-cols-3">
          <StatsCard
            title="Total Savings"
            value="KES 175,000"
            change="Target: KES 200,000"
            changeType="neutral"
            icon={PiggyBank}
          />
          <StatsCard
            title="This Year"
            value="KES 62,500"
            change="+18.2% vs last year"
            changeType="positive"
            icon={TrendingUp}
          />
          <StatsCard
            title="Next Contribution"
            value="Feb 28, 2024"
            change="KES 5,000 scheduled"
            changeType="neutral"
            icon={Calendar}
          />
        </div>

        {/* Savings Progress */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-4">
            <CardTitle className="text-lg font-semibold uppercase tracking-wider">
              Savings Goal Progress
            </CardTitle>
            <Badge variant="secondary" className="uppercase tracking-wider">87.5% Complete</Badge>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center justify-between text-sm">
                <span>Current: <strong className="font-mono">KES 175,000</strong></span>
                <span>Target: <strong className="font-mono">KES 200,000</strong></span>
              </div>
              <div className="h-4 rounded-full bg-secondary relative overflow-hidden">
                <div 
                  className="absolute inset-y-0 left-0 bg-primary rounded-full transition-all"
                  style={{ width: "87.5%" }}
                />
              </div>
              <p className="text-sm text-muted-foreground">
                You need <strong className="font-mono">KES 25,000</strong> more to reach your goal. At your current rate, you'll reach it in 5 months.
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Savings History */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-4">
            <CardTitle className="text-lg font-semibold uppercase tracking-wider">
              Savings History
            </CardTitle>
            <div className="flex gap-2">
              <Button variant="outline" size="sm">
                <Filter className="h-4 w-4 mr-2" />
                Filter
              </Button>
              <Button variant="outline" size="sm">
                <Download className="h-4 w-4 mr-2" />
                Export
              </Button>
              <Button size="sm">
                <Plus className="h-4 w-4 mr-2" />
                New Deposit
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="rounded-lg border border-border overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="bg-primary hover:bg-primary">
                    <TableHead className="font-semibold uppercase tracking-wider text-xs text-primary-foreground">Date</TableHead>
                    <TableHead className="font-semibold uppercase tracking-wider text-xs text-primary-foreground">Description</TableHead>
                    <TableHead className="font-semibold uppercase tracking-wider text-xs text-right text-primary-foreground">Amount</TableHead>
                    <TableHead className="font-semibold uppercase tracking-wider text-xs text-right text-primary-foreground">Balance</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {savingsHistory.map((record) => (
                    <TableRow key={record.id} className="border-b border-border">
                      <TableCell className="font-mono text-sm">{record.date}</TableCell>
                      <TableCell className="text-sm">{record.description}</TableCell>
                      <TableCell className={`text-right font-mono font-semibold ${record.type === "credit" ? "text-success" : "text-destructive"}`}>
                        {record.type === "credit" ? "+" : "-"}KES {record.amount.toLocaleString()}
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        KES {record.balance.toLocaleString()}
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

export default Savings;
