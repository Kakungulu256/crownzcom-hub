import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Save, Building2, Percent, Bell, Shield, Settings2, Sparkles } from "lucide-react";

const SettingsPage = () => {
  return (
    <AppLayout title="Settings">
      <div className="space-y-6">
        {/* Page Header */}
        <div className="rounded-lg p-6 bg-gradient-to-r from-[hsl(260,50%,35%)] to-[hsl(280,50%,45%)] text-white">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <Sparkles className="h-5 w-5 text-accent" />
                <span className="text-sm text-white/80 uppercase tracking-wider">Configuration</span>
              </div>
              <h2 className="text-2xl font-bold tracking-tight">System Settings</h2>
              <p className="text-white/80 mt-1">
                Configure your investment club parameters and preferences
              </p>
            </div>
            <div className="bg-white/10 rounded-lg px-4 py-2 backdrop-blur-sm">
              <p className="text-xs text-white/70">Last updated</p>
              <p className="font-mono font-medium">Jan 15, 2024</p>
            </div>
          </div>
        </div>

        <Tabs defaultValue="general" className="space-y-6">
          <TabsList className="rounded-lg border border-border p-1 h-auto bg-secondary/50 flex-wrap">
            <TabsTrigger value="general" className="rounded-md data-[state=active]:bg-primary data-[state=active]:text-primary-foreground px-4 py-2.5">
              <Building2 className="h-4 w-4 mr-2" />
              General
            </TabsTrigger>
            <TabsTrigger value="financial" className="rounded-md data-[state=active]:bg-primary data-[state=active]:text-primary-foreground px-4 py-2.5">
              <Percent className="h-4 w-4 mr-2" />
              Financial
            </TabsTrigger>
            <TabsTrigger value="notifications" className="rounded-md data-[state=active]:bg-primary data-[state=active]:text-primary-foreground px-4 py-2.5">
              <Bell className="h-4 w-4 mr-2" />
              Notifications
            </TabsTrigger>
            <TabsTrigger value="security" className="rounded-md data-[state=active]:bg-primary data-[state=active]:text-primary-foreground px-4 py-2.5">
              <Shield className="h-4 w-4 mr-2" />
              Security
            </TabsTrigger>
          </TabsList>

          <TabsContent value="general">
            <Card>
              <CardHeader className="flex flex-row items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Building2 className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <CardTitle>Organization Details</CardTitle>
                  <CardDescription>Basic information about your investment club</CardDescription>
                </div>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <Label className="uppercase tracking-wider text-xs text-muted-foreground">Club Name</Label>
                    <Input defaultValue="Crownzcom Investment Club" />
                  </div>
                  <div className="space-y-2">
                    <Label className="uppercase tracking-wider text-xs text-muted-foreground">Registration Number</Label>
                    <Input defaultValue="INV-2020-00123" className="font-mono" />
                  </div>
                  <div className="space-y-2">
                    <Label className="uppercase tracking-wider text-xs text-muted-foreground">Contact Email</Label>
                    <Input defaultValue="crownzcom@gmail.com" type="email" />
                  </div>
                  <div className="space-y-2">
                    <Label className="uppercase tracking-wider text-xs text-muted-foreground">Contact Phone</Label>
                    <Input defaultValue="+254 700 000 000" className="font-mono" />
                  </div>
                </div>
                <Button>
                  <Save className="h-4 w-4 mr-2" />
                  Save Changes
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="financial">
            <Card>
              <CardHeader className="flex flex-row items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Percent className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <CardTitle>Financial Settings</CardTitle>
                  <CardDescription>Configure loan and savings parameters</CardDescription>
                </div>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <Label className="uppercase tracking-wider text-xs text-muted-foreground">Loan Interest Rate (%)</Label>
                    <Input defaultValue="12" type="number" className="font-mono text-lg" />
                  </div>
                  <div className="space-y-2">
                    <Label className="uppercase tracking-wider text-xs text-muted-foreground">Max Loan-to-Savings Ratio (%)</Label>
                    <Input defaultValue="50" type="number" className="font-mono text-lg" />
                  </div>
                  <div className="space-y-2">
                    <Label className="uppercase tracking-wider text-xs text-muted-foreground">Minimum Monthly Contribution</Label>
                    <Input defaultValue="2000" type="number" className="font-mono text-lg" />
                  </div>
                  <div className="space-y-2">
                    <Label className="uppercase tracking-wider text-xs text-muted-foreground">Maximum Loan Term (months)</Label>
                    <Input defaultValue="24" type="number" className="font-mono text-lg" />
                  </div>
                </div>

                <div className="rounded-lg border border-border p-4 space-y-4 bg-muted/30">
                  <div className="flex items-center gap-2">
                    <Settings2 className="h-4 w-4 text-primary" />
                    <h4 className="font-semibold">Loan Policies</h4>
                  </div>
                  <div className="flex items-center justify-between p-3 rounded-lg bg-background border border-border">
                    <div>
                      <p className="font-medium">Require Guarantors</p>
                      <p className="text-sm text-muted-foreground">Loans above threshold require guarantors</p>
                    </div>
                    <Switch defaultChecked />
                  </div>
                  <div className="flex items-center justify-between p-3 rounded-lg bg-background border border-border">
                    <div>
                      <p className="font-medium">Auto-deduct Repayments</p>
                      <p className="text-sm text-muted-foreground">Automatically deduct from savings</p>
                    </div>
                    <Switch />
                  </div>
                </div>

                <Button>
                  <Save className="h-4 w-4 mr-2" />
                  Save Changes
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="notifications">
            <Card>
              <CardHeader className="flex flex-row items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Bell className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <CardTitle>Notification Preferences</CardTitle>
                  <CardDescription>Configure system notifications and alerts</CardDescription>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {[
                  { title: "Loan Applications", desc: "Notify admins of new loan applications", enabled: true },
                  { title: "Payment Reminders", desc: "Send reminders before payment due dates", enabled: true },
                  { title: "Overdue Alerts", desc: "Alert on overdue loan payments", enabled: true },
                  { title: "Interest Distribution", desc: "Notify members when interest is credited", enabled: false },
                  { title: "New Member Registration", desc: "Alert admins of new member signups", enabled: false },
                ].map((item, i) => (
                  <div key={i} className="flex items-center justify-between p-4 rounded-lg border border-border hover:bg-muted/30 transition-colors">
                    <div>
                      <p className="font-medium">{item.title}</p>
                      <p className="text-sm text-muted-foreground">{item.desc}</p>
                    </div>
                    <Switch defaultChecked={item.enabled} />
                  </div>
                ))}
                <Button>
                  <Save className="h-4 w-4 mr-2" />
                  Save Changes
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="security">
            <Card>
              <CardHeader className="flex flex-row items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Shield className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <CardTitle>Security Settings</CardTitle>
                  <CardDescription>Manage access control and security policies</CardDescription>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between p-4 rounded-lg border border-border hover:bg-muted/30 transition-colors">
                  <div>
                    <p className="font-medium">Two-Factor Authentication</p>
                    <p className="text-sm text-muted-foreground">Require 2FA for all admin accounts</p>
                  </div>
                  <Switch defaultChecked />
                </div>
                <div className="flex items-center justify-between p-4 rounded-lg border border-border hover:bg-muted/30 transition-colors">
                  <div>
                    <p className="font-medium">Session Timeout</p>
                    <p className="text-sm text-muted-foreground">Auto-logout after 30 minutes of inactivity</p>
                  </div>
                  <Switch defaultChecked />
                </div>
                <div className="flex items-center justify-between p-4 rounded-lg border border-border hover:bg-muted/30 transition-colors">
                  <div>
                    <p className="font-medium">Audit Logging</p>
                    <p className="text-sm text-muted-foreground">Log all administrative actions</p>
                  </div>
                  <Switch defaultChecked />
                </div>
                <Button>
                  <Save className="h-4 w-4 mr-2" />
                  Save Changes
                </Button>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
};

export default SettingsPage;
