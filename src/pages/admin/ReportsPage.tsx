import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FileText, Download, BarChart3, PieChart, TrendingUp, Users, Clock, Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";

const reports = [
  { id: 1, title: "Monthly Financial Summary", description: "Complete overview of all financial activities", icon: BarChart3, type: "Financial" },
  { id: 2, title: "Member Savings Report", description: "Detailed savings analysis by member", icon: PieChart, type: "Savings" },
  { id: 3, title: "Loan Portfolio Report", description: "Active loans, repayments, and defaults", icon: TrendingUp, type: "Loans" },
  { id: 4, title: "Member Activity Report", description: "Member engagement and transaction activity", icon: Users, type: "Members" },
  { id: 5, title: "Interest Distribution Report", description: "Historical interest distributions", icon: FileText, type: "Interest" },
  { id: 6, title: "Annual Financial Statement", description: "Comprehensive yearly financial report", icon: FileText, type: "Annual" },
];

const ReportsPage = () => {
  return (
    <AppLayout title="Reports">
      <div className="space-y-6">
        {/* Page Header */}
        <div className="rounded-lg p-6 bg-gradient-to-r from-[hsl(260,50%,35%)] to-[hsl(280,50%,45%)] text-white">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <Sparkles className="h-5 w-5 text-accent" />
                <span className="text-sm text-white/80 uppercase tracking-wider">Analytics</span>
              </div>
              <h2 className="text-2xl font-bold tracking-tight">Reports & Analytics</h2>
              <p className="text-white/80 mt-1">
                Generate and download comprehensive financial reports
              </p>
            </div>
            <div className="flex gap-3">
              <div className="bg-white/10 rounded-lg px-4 py-2 backdrop-blur-sm text-center">
                <p className="text-xs text-white/70 uppercase tracking-wider">Available</p>
                <p className="font-mono font-bold text-xl">{reports.length}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Quick Generate */}
        <Card>
          <CardHeader className="pb-4 flex flex-row items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
              <BarChart3 className="h-5 w-5 text-primary" />
            </div>
            <div>
              <CardTitle className="text-lg font-semibold">
                Generate Report
              </CardTitle>
              <p className="text-sm text-muted-foreground">Select a report type to generate</p>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
              {reports.map((report) => (
                <div
                  key={report.id}
                  className="rounded-lg border border-border p-4 hover:bg-accent/30 hover:border-primary/30 transition-all cursor-pointer group"
                >
                  <div className="flex items-start gap-4">
                    <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10 text-primary group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                      <report.icon className="h-6 w-6" />
                    </div>
                    <div className="flex-1">
                      <h4 className="font-semibold">{report.title}</h4>
                      <p className="text-sm text-muted-foreground mb-3">{report.description}</p>
                      <div className="flex gap-2">
                        <Button size="xs" variant="outline" className="group-hover:border-primary/50">
                          <Download className="h-3 w-3 mr-1" />
                          PDF
                        </Button>
                        <Button size="xs" variant="outline" className="group-hover:border-primary/50">
                          <Download className="h-3 w-3 mr-1" />
                          CSV
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Recent Reports */}
        <Card>
          <CardHeader className="pb-4 flex flex-row items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
              <Clock className="h-5 w-5 text-primary" />
            </div>
            <div>
              <CardTitle className="text-lg font-semibold">
                Recently Generated
              </CardTitle>
              <p className="text-sm text-muted-foreground">Your recent report downloads</p>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {[
                { name: "Monthly Summary - January 2024", date: "2024-01-28", size: "1.2 MB", format: "PDF" },
                { name: "Loan Portfolio Report Q4 2023", date: "2024-01-15", size: "856 KB", format: "PDF" },
                { name: "Member Export - All Active", date: "2024-01-10", size: "245 KB", format: "CSV" },
                { name: "Interest Distribution Q4 2023", date: "2023-12-22", size: "512 KB", format: "PDF" },
              ].map((report, i) => (
                <div key={i} className="flex items-center justify-between p-4 rounded-lg border border-border hover:bg-muted/50 hover:border-primary/30 transition-all group">
                  <div className="flex items-center gap-4">
                    <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-primary/10 text-primary group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                      <FileText className="h-5 w-5" />
                    </div>
                    <div>
                      <h4 className="font-medium">{report.name}</h4>
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <span className="font-mono">{report.date}</span>
                        <span>•</span>
                        <span className="font-mono">{report.size}</span>
                        <Badge variant="secondary" className="text-xs">{report.format}</Badge>
                      </div>
                    </div>
                  </div>
                  <Button variant="outline" size="sm" className="group-hover:bg-primary group-hover:text-primary-foreground group-hover:border-primary transition-colors">
                    <Download className="h-4 w-4 mr-2" />
                    Download
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
};

export default ReportsPage;
