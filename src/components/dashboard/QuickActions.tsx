import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PlusCircle, FileText, Send, Calculator } from "lucide-react";

const actions = [
  {
    title: "New Deposit",
    description: "Add savings contribution",
    icon: PlusCircle,
    variant: "default" as const,
  },
  {
    title: "Apply for Loan",
    description: "Submit loan application",
    icon: Calculator,
    variant: "outline" as const,
  },
  {
    title: "View Statement",
    description: "Download financial statement",
    icon: FileText,
    variant: "outline" as const,
  },
  {
    title: "Send Money",
    description: "Transfer to member",
    icon: Send,
    variant: "outline" as const,
  },
];

export function QuickActions() {
  return (
    <Card>
      <CardHeader className="pb-4">
        <CardTitle className="text-lg font-semibold uppercase tracking-wider">
          Quick Actions
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid gap-3">
          {actions.map((action) => (
            <Button
              key={action.title}
              variant={action.variant}
              className="justify-start h-auto py-3 px-4"
            >
              <action.icon className="h-5 w-5 mr-3" />
              <div className="text-left">
                <p className="font-medium">{action.title}</p>
                <p className="text-xs text-muted-foreground">{action.description}</p>
              </div>
            </Button>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
