import { AppLayout } from "@/components/layout/AppLayout";
import { StatsCard } from "@/components/dashboard/StatsCard";
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
import {
  Users,
  PiggyBank,
  CreditCard,
  TrendingUp,
  AlertCircle,
  CheckCircle,
  ArrowRight,
  Activity,
  Sparkles,
} from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from "recharts";

const monthlyData = [
  { month: "Jul", deposits: 145000, withdrawals: 45000, loans: 80000 },
  { month: "Aug", deposits: 162000, withdrawals: 38000, loans: 95000 },
  { month: "Sep", deposits: 158000, withdrawals: 52000, loans: 72000 },
  { month: "Oct", deposits: 175000, withdrawals: 41000, loans: 110000 },
  { month: "Nov", deposits: 189000, withdrawals: 48000, loans: 85000 },
  { month: "Dec", deposits: 198000, withdrawals: 62000, loans: 125000 },
];

const memberDistribution = [
  { name: "Active", value: 42, color: "hsl(var(--chart-1))" },
  { name: "Inactive", value: 8, color: "hsl(var(--chart-2))" },
  { name: "Pending", value: 5, color: "hsl(var(--chart-3))" },
];

const pendingLoans = [
  { id: 1, member: "Jane Smith", amount: 50000, purpose: "Business", date: "2024-01-27", risk: "low" },
  { id: 2, member: "Mike Johnson", amount: 75000, purpose: "Education", date: "2024-01-26", risk: "medium" },
  { id: 3, member: "Sarah Williams", amount: 30000, purpose: "Medical", date: "2024-01-25", risk: "low" },
];

const AdminDashboard = () => {
  return (
    <AppLayout title="Admin Dashboard">
      <div className="space-y-6">
        {/* Page Header */}
        <div className="rounded-lg p-6 bg-gradient-to-r from-[hsl(260,50%,35%)] to-[hsl(280,50%,45%)] text-white">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <Sparkles className="h-5 w-5 text-accent" />
                <span className="text-sm text-white/80 uppercase tracking-wider">Admin Panel</span>
              </div>
              <h2 className="text-2xl font-bold tracking-tight">Welcome to Administration</h2>
              <p className="text-white/80 mt-1">
                Monitor club performance and manage member activities
              </p>
            </div>
            <div className="flex gap-3">
              <div className="bg-white/10 rounded-lg px-4 py-2 backdrop-blur-sm text-center">
                <p className="text-xs text-white/70 uppercase tracking-wider">Total Pool</p>
                <p className="font-mono font-bold text-xl">KES 10.7M</p>
              </div>
            </div>
          </div>
        </div>

        {/* KPIs */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <StatsCard
            title="Total Members"
            value="55"
            change="+3 this month"
            changeType="positive"
            icon={Users}
          />
          <StatsCard
            title="Total Savings"
            value="KES 8.2M"
            change="+15.2% from last month"
            changeType="positive"
            icon={PiggyBank}
          />
          <StatsCard
            title="Active Loans"
            value="KES 2.1M"
            change="23 active loans"
            changeType="neutral"
            icon={CreditCard}
          />
          <StatsCard
            title="Interest Pool"
            value="KES 412K"
            change="Ready for distribution"
            changeType="positive"
            icon={TrendingUp}
          />
        </div>

        {/* Charts */}
        <div className="grid gap-6 lg:grid-cols-3">
          <Card className="lg:col-span-2">
            <CardHeader className="pb-4 flex flex-row items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <Activity className="h-5 w-5 text-primary" />
              </div>
              <div>
                <CardTitle className="text-lg font-semibold">
                  Monthly Overview
                </CardTitle>
                <p className="text-sm text-muted-foreground">Financial activity for the past 6 months</p>
              </div>
            </CardHeader>
            <CardContent>
              <div className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={monthlyData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis
                      dataKey="month"
                      tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }}
                      axisLine={{ stroke: "hsl(var(--border))" }}
                    />
                    <YAxis
                      tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }}
                      axisLine={{ stroke: "hsl(var(--border))" }}
                      tickFormatter={(value) => `${(value / 1000).toFixed(0)}k`}
                    />
                    <Tooltip
                      contentStyle={{
                        background: "hsl(var(--card))",
                        border: "1px solid hsl(var(--border))",
                        borderRadius: "8px",
                        boxShadow: "var(--shadow-md)",
                      }}
                      formatter={(value: number) => [`KES ${value.toLocaleString()}`, ""]}
                    />
                    <Bar dataKey="deposits" fill="hsl(var(--chart-1))" name="Deposits" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="loans" fill="hsl(var(--chart-3))" name="Loans" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="withdrawals" fill="hsl(var(--chart-2))" name="Withdrawals" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-4">
              <CardTitle className="text-lg font-semibold uppercase tracking-wider">
                Member Status
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-[200px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={memberDistribution}
                      cx="50%"
                      cy="50%"
                      innerRadius={50}
                      outerRadius={80}
                      paddingAngle={4}
                      dataKey="value"
                    >
                      {memberDistribution.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} stroke="hsl(var(--background))" strokeWidth={2} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{
                        background: "hsl(var(--card))",
                        border: "1px solid hsl(var(--border))",
                        borderRadius: "8px",
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="flex items-center justify-center gap-4 mt-4">
                {memberDistribution.map((item) => (
                  <div key={item.name} className="flex items-center gap-2">
                    <div className="h-3 w-3 rounded-sm" style={{ backgroundColor: item.color }} />
                    <span className="text-sm font-medium">{item.name} ({item.value})</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Pending Actions */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-warning/20 flex items-center justify-center">
                <AlertCircle className="h-5 w-5 text-warning" />
              </div>
              <div>
                <CardTitle className="text-lg font-semibold">
                  Pending Loan Approvals
                </CardTitle>
                <p className="text-sm text-muted-foreground">Requires your attention</p>
              </div>
            </div>
            <Button variant="outline" size="sm">
              View All
              <ArrowRight className="h-4 w-4 ml-2" />
            </Button>
          </CardHeader>
          <CardContent>
            <div className="rounded-lg border border-border overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="bg-gradient-to-r from-primary to-primary/80 hover:from-primary hover:to-primary/80">
                    <TableHead className="font-semibold uppercase tracking-wider text-xs text-primary-foreground">Member</TableHead>
                    <TableHead className="font-semibold uppercase tracking-wider text-xs text-primary-foreground">Purpose</TableHead>
                    <TableHead className="font-semibold uppercase tracking-wider text-xs text-primary-foreground">Amount</TableHead>
                    <TableHead className="font-semibold uppercase tracking-wider text-xs text-primary-foreground">Risk</TableHead>
                    <TableHead className="font-semibold uppercase tracking-wider text-xs text-primary-foreground">Date</TableHead>
                    <TableHead className="font-semibold uppercase tracking-wider text-xs text-right text-primary-foreground">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pendingLoans.map((loan) => (
                    <TableRow key={loan.id} className="border-b border-border hover:bg-muted/50">
                      <TableCell className="font-medium">{loan.member}</TableCell>
                      <TableCell>{loan.purpose}</TableCell>
                      <TableCell className="font-mono font-semibold">KES {loan.amount.toLocaleString()}</TableCell>
                      <TableCell>
                        <Badge
                          variant={loan.risk === "low" ? "default" : "secondary"}
                          className={`uppercase text-xs tracking-wider ${loan.risk === "low" ? "bg-success/20 text-success border-success/30" : "bg-warning/20 text-warning border-warning/30"}`}
                        >
                          {loan.risk}
                        </Badge>
                      </TableCell>
                      <TableCell className="font-mono text-sm">{loan.date}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex gap-2 justify-end">
                          <Button variant="default" size="xs" className="bg-success hover:bg-success/90">
                            <CheckCircle className="h-3 w-3 mr-1" />
                            Approve
                          </Button>
                          <Button variant="outline" size="xs">
                            <AlertCircle className="h-3 w-3 mr-1" />
                            Review
                          </Button>
                        </div>
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

export default AdminDashboard;
