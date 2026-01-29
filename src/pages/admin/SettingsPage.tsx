import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Save, Building2, Percent, Bell, Shield, Mail, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { databases, DATABASE_ID, ALLOWED_EMAILS_COLLECTION_ID } from "@/lib/appwrite";
import { useToast } from "@/hooks/use-toast";
import { ID } from "appwrite";

const SettingsPage = () => {
  const [allowedEmails, setAllowedEmails] = useState<Array<{$id: string, email: string, isAdmin: boolean}>>([]);
  const [newEmail, setNewEmail] = useState("");
  const [isAdmin, setIsAdmin] = useState(false);
  const { toast } = useToast();

  const loadAllowedEmails = async () => {
    try {
      const response = await databases.listDocuments(DATABASE_ID, ALLOWED_EMAILS_COLLECTION_ID);
      setAllowedEmails(response.documents as any);
    } catch (error) {
      console.error('Error loading emails:', error);
    }
  };

  const addEmail = async () => {
    if (!newEmail.trim()) return;
    
    try {
      await databases.createDocument(
        DATABASE_ID,
        ALLOWED_EMAILS_COLLECTION_ID,
        ID.unique(),
        { email: newEmail.trim(), isAdmin }
      );
      
      toast({ title: "Email added successfully" });
      setNewEmail("");
      setIsAdmin(false);
      loadAllowedEmails();
    } catch (error) {
      toast({ title: "Error adding email", variant: "destructive" });
    }
  };

  const removeEmail = async (id: string) => {
    try {
      await databases.deleteDocument(DATABASE_ID, ALLOWED_EMAILS_COLLECTION_ID, id);
      toast({ title: "Email removed successfully" });
      loadAllowedEmails();
    } catch (error) {
      toast({ title: "Error removing email", variant: "destructive" });
    }
  };
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
            <TabsTrigger value="access" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground px-6 py-2">
              Access Control
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

          <TabsContent value="access">
            <Card>
              <CardHeader>
                <div className="flex items-center gap-3">
                  <Mail className="h-5 w-5" />
                  <div>
                    <CardTitle>Access Control</CardTitle>
                    <CardDescription>Manage allowed email addresses for Google authentication</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="flex gap-4 items-end">
                  <div className="flex-1 space-y-2">
                    <Label className="uppercase tracking-wider text-xs">Email Address</Label>
                    <Input 
                      value={newEmail}
                      onChange={(e) => setNewEmail(e.target.value)}
                      placeholder="user@example.com"
                      type="email"
                    />
                  </div>
                  <div className="flex items-center space-x-2">
                    <Switch 
                      checked={isAdmin}
                      onCheckedChange={setIsAdmin}
                    />
                    <Label className="text-sm">Admin</Label>
                  </div>
                  <Button onClick={addEmail}>
                    <Plus className="h-4 w-4 mr-2" />
                    Add Email
                  </Button>
                </div>

                <div className="space-y-2">
                  <h4 className="font-semibold">Allowed Emails</h4>
                  <div className="border-2 border-border rounded-lg">
                    {allowedEmails.length === 0 ? (
                      <div className="p-4 text-center text-muted-foreground">
                        No allowed emails configured. Add emails above to grant access.
                      </div>
                    ) : (
                      allowedEmails.map((emailDoc) => (
                        <div key={emailDoc.$id} className="flex items-center justify-between p-4 border-b last:border-b-0">
                          <div className="flex items-center gap-3">
                            <span className="font-mono">{emailDoc.email}</span>
                            {emailDoc.isAdmin && (
                              <span className="px-2 py-1 bg-primary text-primary-foreground text-xs rounded">
                                Admin
                              </span>
                            )}
                          </div>
                          <Button 
                            variant="destructive" 
                            size="sm"
                            onClick={() => removeEmail(emailDoc.$id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                <Button onClick={loadAllowedEmails} variant="outline">
                  Refresh List
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
