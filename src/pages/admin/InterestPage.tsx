import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { TrendingUp, Calculator, DollarSign, Calendar, Play, Sparkles, History } from "lucide-react";
import { StatsCard } from "@/components/dashboard/StatsCard";

const InterestPage = () => {
  return (
    <AppLayout title="Interest Distribution">
      <div className="space-y-6">
        {/* Page Header */}
        <div className="rounded-lg p-6 bg-gradient-to-r from-[hsl(260,50%,35%)] to-[hsl(280,50%,45%)] text-white">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <Sparkles className="h-5 w-5 text-accent" />
                <span className="text-sm text-white/80 uppercase tracking-wider">Interest Management</span>
              </div>
              <h2 className="text-2xl font-bold tracking-tight">Interest Distribution</h2>
              <p className="text-white/80 mt-1">
                Calculate and distribute interest to eligible members
              </p>
            </div>
            <div className="bg-white/10 rounded-lg px-6 py-3 backdrop-blur-sm text-center">
              <p className="text-xs text-white/70 uppercase tracking-wider">Available Pool</p>
              <p className="font-mono font-bold text-2xl">KES 412,500</p>
            </div>
          </div>
        </div>

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
        <Card className="overflow-hidden">
          <CardHeader className="bg-gradient-to-r from-primary/5 to-primary/10">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-primary/20 flex items-center justify-center">
                <Calculator className="h-5 w-5 text-primary" />
              </div>
              <div>
                <CardTitle className="text-lg font-semibold">
                  Execute Interest Distribution
                </CardTitle>
                <CardDescription>
                  Calculate and distribute interest to all eligible members based on their average savings balance.
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="pt-6 space-y-6">
            <div className="grid md:grid-cols-2 gap-6">
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label className="uppercase tracking-wider text-xs text-muted-foreground">Distribution Period</Label>
                  <div className="flex gap-4">
                    <div className="flex-1">
                      <Input type="date" defaultValue="2024-01-01" className="font-mono" />
                    </div>
                    <span className="flex items-center text-muted-foreground font-medium">to</span>
                    <div className="flex-1">
                      <Input type="date" defaultValue="2024-01-31" className="font-mono" />
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label className="uppercase tracking-wider text-xs text-muted-foreground">Interest Rate (%)</Label>
                  <Input type="number" defaultValue="12" className="font-mono text-lg" />
                </div>

                <div className="space-y-2">
                  <Label className="uppercase tracking-wider text-xs text-muted-foreground">Distribution Type</Label>
                  <div className="flex gap-2">
                    <Button variant="default" className="flex-1">Monthly</Button>
                    <Button variant="outline" className="flex-1">Quarterly</Button>
                    <Button variant="outline" className="flex-1">Annual</Button>
                  </div>
                </div>
              </div>

              <div className="rounded-lg border-2 border-primary/20 p-6 bg-gradient-to-br from-primary/5 to-primary/10">
                <div className="flex items-center gap-2 mb-4">
                  <Sparkles className="h-4 w-4 text-primary" />
                  <h4 className="font-semibold uppercase tracking-wider text-sm">Distribution Preview</h4>
                </div>
                <div className="space-y-3">
                  <div className="flex justify-between py-2 border-b border-border">
                    <span className="text-muted-foreground">Eligible Members:</span>
                    <span className="font-mono font-semibold">42</span>
                  </div>
                  <div className="flex justify-between py-2 border-b border-border">
                    <span className="text-muted-foreground">Total Savings Base:</span>
                    <span className="font-mono font-semibold">KES 8,250,000</span>
                  </div>
                  <div className="flex justify-between py-2 border-b border-border">
                    <span className="text-muted-foreground">Monthly Interest (1%):</span>
                    <span className="font-mono font-semibold">KES 82,500</span>
                  </div>
                  <div className="pt-3 flex justify-between items-center">
                    <span className="font-semibold">Total Distribution:</span>
                    <span className="font-mono font-bold text-2xl text-primary">KES 82,500</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex gap-4 pt-4">
              <Button variant="outline" size="lg">
                <Calculator className="h-4 w-4 mr-2" />
                Calculate Preview
              </Button>
              <Button size="lg" className="bg-success hover:bg-success/90">
                <Play className="h-4 w-4 mr-2" />
                Execute Distribution
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Distribution History */}
        <Card>
          <CardHeader className="pb-4 flex flex-row items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
              <History className="h-5 w-5 text-primary" />
            </div>
            <div>
              <CardTitle className="text-lg font-semibold">
                Distribution History
              </CardTitle>
              <p className="text-sm text-muted-foreground">Previous interest distributions</p>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {[
                { date: "Dec 20, 2023", period: "Q4 2023", members: 40, amount: 385000, status: "completed" },
                { date: "Sep 20, 2023", period: "Q3 2023", members: 38, amount: 342000, status: "completed" },
                { date: "Jun 20, 2023", period: "Q2 2023", members: 35, amount: 298000, status: "completed" },
                { date: "Mar 20, 2023", period: "Q1 2023", members: 32, amount: 265000, status: "completed" },
              ].map((dist, i) => (
                <div key={i} className="flex items-center justify-between p-4 rounded-lg border border-border hover:bg-muted/50 hover:border-primary/30 transition-all">
                  <div>
                    <h4 className="font-semibold">{dist.period}</h4>
                    <p className="text-sm text-muted-foreground">
                      <span className="font-mono">{dist.date}</span> • {dist.members} members
                    </p>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="font-mono font-bold text-lg text-success">KES {dist.amount.toLocaleString()}</span>
                    <Badge className="uppercase tracking-wider bg-success/10 text-success border-success/30">{dist.status}</Badge>
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
