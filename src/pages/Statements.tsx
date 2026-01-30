import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Download, FileText, Calendar, Clock, FileCheck } from "lucide-react";
import { Badge } from "@/components/ui/badge";

const statements = [
  { id: 1, period: "January 2024", type: "Monthly Statement", date: "2024-01-31", size: "245 KB" },
  { id: 2, period: "December 2023", type: "Monthly Statement", date: "2023-12-31", size: "312 KB" },
  { id: 3, period: "Q4 2023", type: "Quarterly Report", date: "2023-12-31", size: "1.2 MB" },
  { id: 4, period: "November 2023", type: "Monthly Statement", date: "2023-11-30", size: "198 KB" },
  { id: 5, period: "October 2023", type: "Monthly Statement", date: "2023-10-31", size: "267 KB" },
  { id: 6, period: "Q3 2023", type: "Quarterly Report", date: "2023-09-30", size: "1.1 MB" },
  { id: 7, period: "Annual 2023", type: "Annual Statement", date: "2023-12-31", size: "2.8 MB" },
];

const Statements = () => {
  return (
    <AppLayout title="Statements">
      <div className="space-y-6">
        {/* Page Header */}
        <div className="rounded-lg p-6 bg-gradient-to-r from-[hsl(260,50%,35%)] to-[hsl(280,50%,45%)] text-white">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <h2 className="text-2xl font-bold tracking-tight">Statements & Reports</h2>
              <p className="text-white/80 mt-1">
                Download and generate your financial statements
              </p>
            </div>
            <div className="flex items-center gap-2 bg-white/10 rounded-lg px-4 py-2 backdrop-blur-sm">
              <FileCheck className="h-5 w-5" />
              <span className="font-mono">{statements.length} Available</span>
            </div>
          </div>
        </div>

        {/* Generate Statement */}
        <Card className="overflow-hidden">
          <CardHeader className="pb-4 bg-gradient-to-r from-primary/5 to-primary/10">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-primary/20 flex items-center justify-center">
                <FileText className="h-5 w-5 text-primary" />
              </div>
              <CardTitle className="text-lg font-semibold">
                Generate Custom Statement
              </CardTitle>
            </div>
          </CardHeader>
          <CardContent className="pt-6">
            <div className="flex flex-col md:flex-row gap-4 items-end">
              <div className="flex-1 space-y-2">
                <label className="text-sm font-medium uppercase tracking-wider text-muted-foreground">From Date</label>
                <div className="flex items-center rounded-lg border border-border bg-background hover:border-primary/50 transition-colors">
                  <Calendar className="h-4 w-4 mx-3 text-muted-foreground" />
                  <input 
                    type="date" 
                    className="flex-1 h-11 bg-transparent border-0 outline-none font-mono"
                    defaultValue="2024-01-01"
                  />
                </div>
              </div>
              <div className="flex-1 space-y-2">
                <label className="text-sm font-medium uppercase tracking-wider text-muted-foreground">To Date</label>
                <div className="flex items-center rounded-lg border border-border bg-background hover:border-primary/50 transition-colors">
                  <Calendar className="h-4 w-4 mx-3 text-muted-foreground" />
                  <input 
                    type="date" 
                    className="flex-1 h-11 bg-transparent border-0 outline-none font-mono"
                    defaultValue="2024-01-31"
                  />
                </div>
              </div>
              <Button className="md:w-auto w-full h-11">
                <Download className="h-4 w-4 mr-2" />
                Generate PDF
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Available Statements */}
        <Card>
          <CardHeader className="pb-4">
            <CardTitle className="text-lg font-semibold uppercase tracking-wider">
              Available Statements
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {statements.map((statement) => (
                <div
                  key={statement.id}
                  className="flex items-center justify-between p-4 rounded-lg border border-border hover:bg-accent/30 hover:border-primary/30 transition-all group"
                >
                  <div className="flex items-center gap-4">
                    <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10 text-primary group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                      <FileText className="h-6 w-6" />
                    </div>
                    <div>
                      <h4 className="font-semibold">{statement.period}</h4>
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Badge variant="secondary" className="text-xs">
                          {statement.type}
                        </Badge>
                        <span>•</span>
                        <span className="font-mono flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {statement.date}
                        </span>
                        <span>•</span>
                        <span className="font-mono">{statement.size}</span>
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

export default Statements;
