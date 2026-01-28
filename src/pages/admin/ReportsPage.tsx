import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FileText, Download, BarChart3, PieChart, TrendingUp, Users } from "lucide-react";

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
        {/* Quick Generate */}
        <Card>
          <CardHeader className="pb-4">
            <CardTitle className="text-lg font-semibold uppercase tracking-wider">
              Generate Report
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
              {reports.map((report) => (
                <div
                  key={report.id}
                  className="border-2 border-border p-4 hover:bg-accent/50 transition-colors cursor-pointer group"
                >
                  <div className="flex items-start gap-4">
                    <div className="flex h-12 w-12 items-center justify-center border-2 border-foreground bg-secondary group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                      <report.icon className="h-6 w-6" />
                    </div>
                    <div className="flex-1">
                      <h4 className="font-semibold">{report.title}</h4>
                      <p className="text-sm text-muted-foreground">{report.description}</p>
                      <div className="flex gap-2 mt-3">
                        <Button size="xs" variant="outline">
                          <Download className="h-3 w-3 mr-1" />
                          PDF
                        </Button>
                        <Button size="xs" variant="outline">
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
          <CardHeader className="pb-4">
            <CardTitle className="text-lg font-semibold uppercase tracking-wider">
              Recently Generated
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {[
                { name: "Monthly Summary - January 2024", date: "2024-01-28", size: "1.2 MB", format: "PDF" },
                { name: "Loan Portfolio Report Q4 2023", date: "2024-01-15", size: "856 KB", format: "PDF" },
                { name: "Member Export - All Active", date: "2024-01-10", size: "245 KB", format: "CSV" },
                { name: "Interest Distribution Q4 2023", date: "2023-12-22", size: "512 KB", format: "PDF" },
              ].map((report, i) => (
                <div key={i} className="flex items-center justify-between p-4 border-2 border-border hover:bg-accent/50 transition-colors">
                  <div className="flex items-center gap-4">
                    <div className="flex h-10 w-10 items-center justify-center border-2 border-foreground bg-secondary">
                      <FileText className="h-5 w-5" />
                    </div>
                    <div>
                      <h4 className="font-medium">{report.name}</h4>
                      <p className="text-sm text-muted-foreground">
                        <span className="font-mono">{report.date}</span> • {report.size}
                      </p>
                    </div>
                  </div>
                  <Button variant="outline" size="sm">
                    <Download className="h-4 w-4 mr-2" />
                    {report.format}
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
