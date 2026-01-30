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
import { Search, Filter, Plus, MoreHorizontal, Mail, Phone, Users } from "lucide-react";

const members = [
  { id: 1, name: "John Doe", email: "john@example.com", phone: "+254 712 345 678", savings: 175000, loans: 33000, status: "active", joined: "2022-03-15" },
  { id: 2, name: "Jane Smith", email: "jane@example.com", phone: "+254 723 456 789", savings: 245000, loans: 0, status: "active", joined: "2021-06-20" },
  { id: 3, name: "Mike Johnson", email: "mike@example.com", phone: "+254 734 567 890", savings: 89000, loans: 75000, status: "active", joined: "2023-01-10" },
  { id: 4, name: "Sarah Williams", email: "sarah@example.com", phone: "+254 745 678 901", savings: 312000, loans: 30000, status: "active", joined: "2020-11-05" },
  { id: 5, name: "David Brown", email: "david@example.com", phone: "+254 756 789 012", savings: 56000, loans: 0, status: "inactive", joined: "2022-08-22" },
  { id: 6, name: "Emily Davis", email: "emily@example.com", phone: "+254 767 890 123", savings: 0, loans: 0, status: "pending", joined: "2024-01-25" },
];

const MembersPage = () => {
  const activeCount = members.filter(m => m.status === "active").length;
  const totalSavings = members.reduce((sum, m) => sum + m.savings, 0);

  return (
    <AppLayout title="Members">
      <div className="space-y-6">
        {/* Page Header */}
        <div className="rounded-lg p-6 bg-gradient-to-r from-[hsl(260,50%,35%)] to-[hsl(280,50%,45%)] text-white">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <h2 className="text-2xl font-bold tracking-tight">Member Management</h2>
              <p className="text-white/80 mt-1">
                View and manage all club members
              </p>
            </div>
            <div className="flex gap-3">
              <div className="bg-white/10 rounded-lg px-4 py-2 backdrop-blur-sm text-center">
                <p className="text-xs text-white/70 uppercase tracking-wider">Active</p>
                <p className="font-mono font-bold text-xl">{activeCount}</p>
              </div>
              <div className="bg-white/10 rounded-lg px-4 py-2 backdrop-blur-sm text-center">
                <p className="text-xs text-white/70 uppercase tracking-wider">Total Savings</p>
                <p className="font-mono font-bold text-xl">KES {(totalSavings / 1000).toFixed(0)}K</p>
              </div>
            </div>
          </div>
        </div>

        {/* Actions */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex flex-col md:flex-row gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input placeholder="Search members by name or email..." className="pl-9" />
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
          <CardHeader className="pb-4 flex flex-row items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
              <Users className="h-5 w-5 text-primary" />
            </div>
            <div>
              <CardTitle className="text-lg font-semibold">
                All Members
              </CardTitle>
              <p className="text-sm text-muted-foreground">{members.length} total members</p>
            </div>
          </CardHeader>
          <CardContent>
            <div className="rounded-lg border border-border overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="bg-gradient-to-r from-primary to-primary/80 hover:from-primary hover:to-primary/80">
                    <TableHead className="font-semibold uppercase tracking-wider text-xs text-primary-foreground">Member</TableHead>
                    <TableHead className="font-semibold uppercase tracking-wider text-xs text-primary-foreground">Contact</TableHead>
                    <TableHead className="font-semibold uppercase tracking-wider text-xs text-right text-primary-foreground">Savings</TableHead>
                    <TableHead className="font-semibold uppercase tracking-wider text-xs text-right text-primary-foreground">Loans</TableHead>
                    <TableHead className="font-semibold uppercase tracking-wider text-xs text-primary-foreground">Status</TableHead>
                    <TableHead className="font-semibold uppercase tracking-wider text-xs text-primary-foreground">Joined</TableHead>
                    <TableHead className="font-semibold uppercase tracking-wider text-xs w-12 text-primary-foreground"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {members.map((member) => (
                    <TableRow key={member.id} className="border-b border-border hover:bg-muted/50 transition-colors">
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <Avatar className="h-10 w-10 ring-2 ring-primary/20">
                            <AvatarFallback className="bg-gradient-to-br from-primary/20 to-primary/10 font-semibold text-sm text-primary">
                              {member.name.split(" ").map(n => n[0]).join("")}
                            </AvatarFallback>
                          </Avatar>
                          <span className="font-medium">{member.name}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="space-y-1">
                          <div className="flex items-center gap-2 text-sm">
                            <Mail className="h-3 w-3 text-primary/60" />
                            <span className="text-muted-foreground">{member.email}</span>
                          </div>
                          <div className="flex items-center gap-2 text-sm">
                            <Phone className="h-3 w-3 text-primary/60" />
                            <span className="font-mono text-muted-foreground">{member.phone}</span>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="text-right font-mono font-semibold text-success">
                        KES {member.savings.toLocaleString()}
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {member.loans > 0 ? (
                          <span className="text-destructive font-semibold">KES {member.loans.toLocaleString()}</span>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={`uppercase text-xs tracking-wider ${
                            member.status === "active"
                              ? "bg-success/10 text-success border-success/30"
                              : member.status === "inactive"
                              ? "bg-muted text-muted-foreground border-muted"
                              : "bg-warning/10 text-warning border-warning/30"
                          }`}
                        >
                          {member.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="font-mono text-sm text-muted-foreground">
                        {member.joined}
                      </TableCell>
                      <TableCell>
                        <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-primary/10">
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
