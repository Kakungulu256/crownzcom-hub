import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Download, FileText, Calendar } from "lucide-react";

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
        {/* Generate Statement */}
        <Card>
          <CardHeader className="pb-4">
            <CardTitle className="text-lg font-semibold uppercase tracking-wider">
              Generate Custom Statement
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col md:flex-row gap-4 items-end">
              <div className="flex-1 space-y-2">
                <label className="text-sm font-medium uppercase tracking-wider">From Date</label>
                <div className="flex items-center rounded-md border border-border bg-background">
                  <Calendar className="h-4 w-4 mx-3 text-muted-foreground" />
                  <input 
                    type="date" 
                    className="flex-1 h-10 bg-transparent border-0 outline-none font-mono"
                    defaultValue="2024-01-01"
                  />
                </div>
              </div>
              <div className="flex-1 space-y-2">
                <label className="text-sm font-medium uppercase tracking-wider">To Date</label>
                <div className="flex items-center rounded-md border border-border bg-background">
                  <Calendar className="h-4 w-4 mx-3 text-muted-foreground" />
                  <input 
                    type="date" 
                    className="flex-1 h-10 bg-transparent border-0 outline-none font-mono"
                    defaultValue="2024-01-31"
                  />
                </div>
              </div>
              <Button className="md:w-auto w-full">
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
                  className="flex items-center justify-between p-4 rounded-lg border border-border hover:bg-accent/50 transition-colors"
                >
                  <div className="flex items-center gap-4">
                    <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10 text-primary">
                      <FileText className="h-6 w-6" />
                    </div>
                    <div>
                      <h4 className="font-semibold">{statement.period}</h4>
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <span>{statement.type}</span>
                        <span>•</span>
                        <span className="font-mono">{statement.date}</span>
                        <span>•</span>
                        <span className="font-mono">{statement.size}</span>
                      </div>
                    </div>
                  </div>
                  <Button variant="outline" size="sm">
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
