import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { TrendingUp, Calculator, DollarSign, Calendar, Play } from "lucide-react";
import { StatsCard } from "@/components/dashboard/StatsCard";

const InterestPage = () => {
  return (
    <AppLayout title="Interest Distribution">
      <div className="space-y-6">
        {/* Stats */}
        <div className="grid gap-4 md:grid-cols-3">
          <StatsCard
            title="Interest Pool"
            value="KES 412,500"
            change="Available for distribution"
            changeType="positive"
            icon={DollarSign}
          />
          <StatsCard
            title="Last Distribution"
            value="Dec 20, 2023"
            change="KES 385,000 distributed"
            changeType="neutral"
            icon={Calendar}
          />
          <StatsCard
            title="Annual Rate"
            value="12%"
            change="On savings balance"
            changeType="neutral"
            icon={TrendingUp}
          />
        </div>

        {/* Distribution Panel */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg font-semibold uppercase tracking-wider">
              Execute Interest Distribution
            </CardTitle>
            <CardDescription>
              Calculate and distribute interest to all eligible members based on their average savings balance.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid md:grid-cols-2 gap-6">
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label className="uppercase tracking-wider text-xs">Distribution Period</Label>
                  <div className="flex gap-4">
                    <div className="flex-1">
                      <Input type="date" defaultValue="2024-01-01" className="font-mono" />
                    </div>
                    <span className="flex items-center text-muted-foreground">to</span>
                    <div className="flex-1">
                      <Input type="date" defaultValue="2024-01-31" className="font-mono" />
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label className="uppercase tracking-wider text-xs">Interest Rate (%)</Label>
                  <Input type="number" defaultValue="12" className="font-mono" />
                </div>

                <div className="space-y-2">
                  <Label className="uppercase tracking-wider text-xs">Distribution Type</Label>
                  <div className="flex gap-2">
                    <Button variant="default" className="flex-1">Monthly</Button>
                    <Button variant="outline" className="flex-1">Quarterly</Button>
                    <Button variant="outline" className="flex-1">Annual</Button>
                  </div>
                </div>
              </div>

              <div className="border-2 border-border p-6 bg-secondary">
                <h4 className="font-semibold uppercase tracking-wider text-sm mb-4">Distribution Preview</h4>
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Eligible Members:</span>
                    <span className="font-mono font-semibold">42</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Total Savings Base:</span>
                    <span className="font-mono font-semibold">KES 8,250,000</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Monthly Interest (1%):</span>
                    <span className="font-mono font-semibold">KES 82,500</span>
                  </div>
                  <div className="border-t-2 border-border pt-3 flex justify-between">
                    <span className="font-semibold">Total Distribution:</span>
                    <span className="font-mono font-bold text-lg text-chart-2">KES 82,500</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex gap-4">
              <Button variant="outline">
                <Calculator className="h-4 w-4 mr-2" />
                Calculate Preview
              </Button>
              <Button variant="success">
                <Play className="h-4 w-4 mr-2" />
                Execute Distribution
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Distribution History */}
        <Card>
          <CardHeader className="pb-4">
            <CardTitle className="text-lg font-semibold uppercase tracking-wider">
              Distribution History
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {[
                { date: "Dec 20, 2023", period: "Q4 2023", members: 40, amount: 385000, status: "completed" },
                { date: "Sep 20, 2023", period: "Q3 2023", members: 38, amount: 342000, status: "completed" },
                { date: "Jun 20, 2023", period: "Q2 2023", members: 35, amount: 298000, status: "completed" },
                { date: "Mar 20, 2023", period: "Q1 2023", members: 32, amount: 265000, status: "completed" },
              ].map((dist, i) => (
                <div key={i} className="flex items-center justify-between p-4 border-2 border-border hover:bg-accent/50 transition-colors">
                  <div>
                    <h4 className="font-semibold">{dist.period}</h4>
                    <p className="text-sm text-muted-foreground">
                      <span className="font-mono">{dist.date}</span> • {dist.members} members
                    </p>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="font-mono font-bold text-chart-2">KES {dist.amount.toLocaleString()}</span>
                    <Badge className="uppercase tracking-wider">{dist.status}</Badge>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
};

export default InterestPage;
