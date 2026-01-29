import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";

const data = [
  { month: "Jan", repaid: 28000, outstanding: 72000 },
  { month: "Feb", repaid: 35000, outstanding: 65000 },
  { month: "Mar", repaid: 42000, outstanding: 58000 },
  { month: "Apr", repaid: 48000, outstanding: 52000 },
  { month: "May", repaid: 56000, outstanding: 44000 },
  { month: "Jun", repaid: 63000, outstanding: 37000 },
];

export function LoanRepaymentChart() {
  return (
    <Card>
      <CardHeader className="pb-4">
        <CardTitle className="text-lg font-semibold uppercase tracking-wider">
          Loan Repayment Progress
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-[300px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis
                dataKey="month"
                tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }}
                axisLine={{ stroke: "hsl(var(--border))" }}
                tickLine={{ stroke: "hsl(var(--border))" }}
              />
              <YAxis
                tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }}
                axisLine={{ stroke: "hsl(var(--border))" }}
                tickLine={{ stroke: "hsl(var(--border))" }}
                tickFormatter={(value) => `${(value / 1000).toFixed(0)}k`}
              />
              <Tooltip
                contentStyle={{
                  background: "hsl(var(--card))",
                  border: "1px solid hsl(var(--border))",
                  borderRadius: "0.5rem",
                }}
                formatter={(value: number) => [`KES ${value.toLocaleString()}`, ""]}
                labelStyle={{ fontWeight: 600 }}
              />
              <Bar dataKey="repaid" name="Repaid" stackId="a" fill="hsl(var(--success))" radius={[0, 0, 0, 0]} />
              <Bar dataKey="outstanding" name="Outstanding" stackId="a" fill="hsl(var(--chart-2))" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="flex items-center justify-center gap-6 mt-4">
          <div className="flex items-center gap-2">
            <div className="h-3 w-3 rounded bg-success" />
            <span className="text-sm text-muted-foreground">Repaid</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="h-3 w-3 rounded bg-chart-2" />
            <span className="text-sm text-muted-foreground">Outstanding</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
