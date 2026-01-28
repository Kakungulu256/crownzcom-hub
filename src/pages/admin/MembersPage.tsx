import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Search, Filter, Plus, MoreHorizontal, Mail, Phone } from "lucide-react";

const members = [
  { id: 1, name: "John Doe", email: "john@example.com", phone: "+254 712 345 678", savings: 175000, loans: 33000, status: "active", joined: "2022-03-15" },
  { id: 2, name: "Jane Smith", email: "jane@example.com", phone: "+254 723 456 789", savings: 245000, loans: 0, status: "active", joined: "2021-06-20" },
  { id: 3, name: "Mike Johnson", email: "mike@example.com", phone: "+254 734 567 890", savings: 89000, loans: 75000, status: "active", joined: "2023-01-10" },
  { id: 4, name: "Sarah Williams", email: "sarah@example.com", phone: "+254 745 678 901", savings: 312000, loans: 30000, status: "active", joined: "2020-11-05" },
  { id: 5, name: "David Brown", email: "david@example.com", phone: "+254 756 789 012", savings: 56000, loans: 0, status: "inactive", joined: "2022-08-22" },
  { id: 6, name: "Emily Davis", email: "emily@example.com", phone: "+254 767 890 123", savings: 0, loans: 0, status: "pending", joined: "2024-01-25" },
];

const MembersPage = () => {
  return (
    <AppLayout title="Members">
      <div className="space-y-6">
        {/* Actions */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex flex-col md:flex-row gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input placeholder="Search members..." className="pl-9" />
              </div>
              <Button variant="outline">
                <Filter className="h-4 w-4 mr-2" />
                Filter
              </Button>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Add Member
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Members Table */}
        <Card>
          <CardHeader className="pb-4">
            <CardTitle className="text-lg font-semibold uppercase tracking-wider">
              All Members ({members.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="border-2 border-border">
              <Table>
                <TableHeader>
                  <TableRow className="border-b-2 border-border hover:bg-transparent">
                    <TableHead className="font-semibold uppercase tracking-wider text-xs">Member</TableHead>
                    <TableHead className="font-semibold uppercase tracking-wider text-xs">Contact</TableHead>
                    <TableHead className="font-semibold uppercase tracking-wider text-xs text-right">Savings</TableHead>
                    <TableHead className="font-semibold uppercase tracking-wider text-xs text-right">Loans</TableHead>
                    <TableHead className="font-semibold uppercase tracking-wider text-xs">Status</TableHead>
                    <TableHead className="font-semibold uppercase tracking-wider text-xs">Joined</TableHead>
                    <TableHead className="font-semibold uppercase tracking-wider text-xs w-12"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {members.map((member) => (
                    <TableRow key={member.id} className="border-b border-border">
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <Avatar className="h-9 w-9 border-2 border-foreground">
                            <AvatarFallback className="bg-secondary font-semibold text-sm">
                              {member.name.split(" ").map(n => n[0]).join("")}
                            </AvatarFallback>
                          </Avatar>
                          <span className="font-medium">{member.name}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="space-y-1">
                          <div className="flex items-center gap-2 text-sm">
                            <Mail className="h-3 w-3 text-muted-foreground" />
                            <span className="text-muted-foreground">{member.email}</span>
                          </div>
                          <div className="flex items-center gap-2 text-sm">
                            <Phone className="h-3 w-3 text-muted-foreground" />
                            <span className="font-mono text-muted-foreground">{member.phone}</span>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="text-right font-mono font-semibold text-chart-2">
                        KES {member.savings.toLocaleString()}
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {member.loans > 0 ? (
                          <span className="text-chart-1 font-semibold">KES {member.loans.toLocaleString()}</span>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            member.status === "active"
                              ? "default"
                              : member.status === "inactive"
                              ? "secondary"
                              : "outline"
                          }
                          className="uppercase text-xs tracking-wider"
                        >
                          {member.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="font-mono text-sm text-muted-foreground">
                        {member.joined}
                      </TableCell>
                      <TableCell>
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
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

export default MembersPage;
