import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Save, Building2, Percent, Bell, Shield } from "lucide-react";

const SettingsPage = () => {
  return (
    <AppLayout title="Settings">
      <div className="space-y-6">
        <Tabs defaultValue="general" className="space-y-6">
          <TabsList className="border-2 border-foreground p-0 h-auto bg-transparent">
            <TabsTrigger value="general" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground px-6 py-2">
              General
            </TabsTrigger>
            <TabsTrigger value="financial" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground px-6 py-2">
              Financial
            </TabsTrigger>
            <TabsTrigger value="notifications" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground px-6 py-2">
              Notifications
            </TabsTrigger>
            <TabsTrigger value="security" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground px-6 py-2">
              Security
            </TabsTrigger>
          </TabsList>

          <TabsContent value="general">
            <Card>
              <CardHeader>
                <div className="flex items-center gap-3">
                  <Building2 className="h-5 w-5" />
                  <div>
                    <CardTitle>Organization Details</CardTitle>
                    <CardDescription>Basic information about your investment club</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <Label className="uppercase tracking-wider text-xs">Club Name</Label>
                    <Input defaultValue="Crownzcom Investment Club" />
                  </div>
                  <div className="space-y-2">
                    <Label className="uppercase tracking-wider text-xs">Registration Number</Label>
                    <Input defaultValue="INV-2020-00123" className="font-mono" />
                  </div>
                  <div className="space-y-2">
                    <Label className="uppercase tracking-wider text-xs">Contact Email</Label>
                    <Input defaultValue="admin@crownzcom.club" type="email" />
                  </div>
                  <div className="space-y-2">
                    <Label className="uppercase tracking-wider text-xs">Contact Phone</Label>
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
              <CardHeader>
                <div className="flex items-center gap-3">
                  <Percent className="h-5 w-5" />
                  <div>
                    <CardTitle>Financial Settings</CardTitle>
                    <CardDescription>Configure loan and savings parameters</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <Label className="uppercase tracking-wider text-xs">Loan Interest Rate (%)</Label>
                    <Input defaultValue="12" type="number" className="font-mono" />
                  </div>
                  <div className="space-y-2">
                    <Label className="uppercase tracking-wider text-xs">Max Loan-to-Savings Ratio (%)</Label>
                    <Input defaultValue="50" type="number" className="font-mono" />
                  </div>
                  <div className="space-y-2">
                    <Label className="uppercase tracking-wider text-xs">Minimum Monthly Contribution</Label>
                    <Input defaultValue="2000" type="number" className="font-mono" />
                  </div>
                  <div className="space-y-2">
                    <Label className="uppercase tracking-wider text-xs">Maximum Loan Term (months)</Label>
                    <Input defaultValue="24" type="number" className="font-mono" />
                  </div>
                </div>

                <div className="border-2 border-border p-4 space-y-4">
                  <h4 className="font-semibold">Loan Policies</h4>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium">Require Guarantors</p>
                      <p className="text-sm text-muted-foreground">Loans above threshold require guarantors</p>
                    </div>
                    <Switch defaultChecked />
                  </div>
                  <div className="flex items-center justify-between">
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
              <CardHeader>
                <div className="flex items-center gap-3">
                  <Bell className="h-5 w-5" />
                  <div>
                    <CardTitle>Notification Preferences</CardTitle>
                    <CardDescription>Configure system notifications and alerts</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {[
                  { title: "Loan Applications", desc: "Notify admins of new loan applications" },
                  { title: "Payment Reminders", desc: "Send reminders before payment due dates" },
                  { title: "Overdue Alerts", desc: "Alert on overdue loan payments" },
                  { title: "Interest Distribution", desc: "Notify members when interest is credited" },
                  { title: "New Member Registration", desc: "Alert admins of new member signups" },
                ].map((item, i) => (
                  <div key={i} className="flex items-center justify-between p-4 border-2 border-border">
                    <div>
                      <p className="font-medium">{item.title}</p>
                      <p className="text-sm text-muted-foreground">{item.desc}</p>
                    </div>
                    <Switch defaultChecked={i < 3} />
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
              <CardHeader>
                <div className="flex items-center gap-3">
                  <Shield className="h-5 w-5" />
                  <div>
                    <CardTitle>Security Settings</CardTitle>
                    <CardDescription>Manage access control and security policies</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between p-4 border-2 border-border">
                  <div>
                    <p className="font-medium">Two-Factor Authentication</p>
                    <p className="text-sm text-muted-foreground">Require 2FA for all admin accounts</p>
                  </div>
                  <Switch defaultChecked />
                </div>
                <div className="flex items-center justify-between p-4 border-2 border-border">
                  <div>
                    <p className="font-medium">Session Timeout</p>
                    <p className="text-sm text-muted-foreground">Auto-logout after 30 minutes of inactivity</p>
                  </div>
                  <Switch defaultChecked />
                </div>
                <div className="flex items-center justify-between p-4 border-2 border-border">
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
