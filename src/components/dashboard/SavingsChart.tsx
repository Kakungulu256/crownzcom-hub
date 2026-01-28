import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

const data = [
  { month: "Jan", savings: 45000, target: 50000 },
  { month: "Feb", savings: 52000, target: 55000 },
  { month: "Mar", savings: 61000, target: 60000 },
  { month: "Apr", savings: 73000, target: 70000 },
  { month: "May", savings: 85000, target: 80000 },
  { month: "Jun", savings: 92000, target: 90000 },
  { month: "Jul", savings: 98000, target: 100000 },
  { month: "Aug", savings: 115000, target: 110000 },
  { month: "Sep", savings: 128000, target: 120000 },
  { month: "Oct", savings: 142000, target: 130000 },
  { month: "Nov", savings: 156000, target: 145000 },
  { month: "Dec", savings: 175000, target: 160000 },
];

export function SavingsChart() {
  return (
    <Card>
      <CardHeader className="pb-4">
        <CardTitle className="text-lg font-semibold uppercase tracking-wider">
          Savings Growth
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-[300px]">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="savingsGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(var(--chart-2))" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="hsl(var(--chart-2))" stopOpacity={0} />
                </linearGradient>
              </defs>
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
                  border: "2px solid hsl(var(--border))",
                  boxShadow: "var(--shadow-sm)",
                }}
                formatter={(value: number) => [`KES ${value.toLocaleString()}`, ""]}
                labelStyle={{ fontWeight: 600 }}
              />
              <Area
                type="monotone"
                dataKey="savings"
                stroke="hsl(var(--chart-2))"
                strokeWidth={2}
                fill="url(#savingsGradient)"
                name="Actual Savings"
              />
              <Area
                type="monotone"
                dataKey="target"
                stroke="hsl(var(--muted-foreground))"
                strokeWidth={2}
                strokeDasharray="5 5"
                fill="transparent"
                name="Target"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
