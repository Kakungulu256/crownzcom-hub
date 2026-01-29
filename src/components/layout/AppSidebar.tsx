import { useState } from "react";
import {
  LayoutDashboard,
  Users,
  Wallet,
  CreditCard,
  TrendingUp,
  Settings,
  FileText,
  ChevronDown,
  LogOut,
  Shield,
  PiggyBank,
  Calculator,
} from "lucide-react";
import { NavLink } from "@/components/NavLink";
import { useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";

import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarTrigger,
  SidebarHeader,
  SidebarFooter,
  useSidebar,
} from "@/components/ui/sidebar";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";

const memberItems = [
  { title: "Dashboard", url: "/", icon: LayoutDashboard },
  { title: "My Savings", url: "/savings", icon: PiggyBank },
  { title: "My Loans", url: "/loans", icon: CreditCard },
  { title: "Transactions", url: "/transactions", icon: Wallet },
  { title: "Statements", url: "/statements", icon: FileText },
];

const adminItems = [
  { title: "Admin Dashboard", url: "/admin", icon: Shield },
  { title: "Members", url: "/admin/members", icon: Users },
  { title: "Loan Approvals", url: "/admin/loans", icon: Calculator },
  { title: "Interest", url: "/admin/interest", icon: TrendingUp },
  { title: "Reports", url: "/admin/reports", icon: FileText },
  { title: "Settings", url: "/admin/settings", icon: Settings },
];

export function AppSidebar() {
  const { state } = useSidebar();
  const { user, isAdmin, logout } = useAuth();
  const collapsed = state === "collapsed";
  const location = useLocation();
  const currentPath = location.pathname;
  const [adminOpen, setAdminOpen] = useState(currentPath.startsWith("/admin"));

  const isActive = (path: string) => currentPath === path;

  const handleLogout = () => {
    logout();
  };

  const getUserInitials = (name: string) => {
    return name.split(' ').map(n => n[0]).join('').toUpperCase();
  };

  return (
    <Sidebar collapsible="icon" className="border-r border-sidebar-border">
      <SidebarHeader className="border-b border-sidebar-border p-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-primary to-accent text-primary-foreground font-bold text-lg">
            C
          </div>
          {!collapsed && (
            <div className="flex flex-col">
              <span className="font-bold text-lg tracking-tight text-sidebar-foreground">Crownzcom</span>
              <span className="text-xs text-sidebar-foreground/70 uppercase tracking-widest">Investment Club</span>
            </div>
          )}
        </div>
      </SidebarHeader>

      <SidebarContent className="px-2">
        <SidebarGroup>
          <SidebarGroupLabel className="uppercase tracking-widest text-xs font-semibold text-muted-foreground px-2">
            Member
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {memberItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild isActive={isActive(item.url)}>
                    <NavLink
                      to={item.url}
                      end
                      className="flex items-center gap-3 px-3 py-2 hover:bg-accent transition-colors"
                      activeClassName="bg-accent font-medium"
                    >
                      <item.icon className="h-4 w-4" />
                      {!collapsed && <span>{item.title}</span>}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {isAdmin && (
          <Collapsible open={adminOpen} onOpenChange={setAdminOpen} className="group/collapsible">
            <SidebarGroup>
              <CollapsibleTrigger asChild>
                <SidebarGroupLabel className="uppercase tracking-widest text-xs font-semibold text-muted-foreground px-2 cursor-pointer hover:text-foreground flex items-center justify-between w-full">
                  <span>Admin</span>
                  <ChevronDown className="h-4 w-4 transition-transform group-data-[state=open]/collapsible:rotate-180" />
                </SidebarGroupLabel>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <SidebarGroupContent>
                  <SidebarMenu>
                    {adminItems.map((item) => (
                      <SidebarMenuItem key={item.title}>
                        <SidebarMenuButton asChild isActive={isActive(item.url)}>
                          <NavLink
                            to={item.url}
                            end
                            className="flex items-center gap-3 px-3 py-2 hover:bg-accent transition-colors"
                            activeClassName="bg-accent font-medium"
                          >
                            <item.icon className="h-4 w-4" />
                            {!collapsed && <span>{item.title}</span>}
                          </NavLink>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    ))}
                  </SidebarMenu>
                </SidebarGroupContent>
              </CollapsibleContent>
            </SidebarGroup>
          </Collapsible>
        )}
      </SidebarContent>

      <SidebarFooter className="border-t border-sidebar-border p-4">
        <div className="flex items-center gap-3">
          <Avatar className="h-9 w-9 border-2 border-primary">
            <AvatarFallback className="bg-primary/20 text-sidebar-foreground font-semibold">
              {user ? getUserInitials(user.name) : 'U'}
            </AvatarFallback>
          </Avatar>
          {!collapsed && (
            <div className="flex flex-1 flex-col">
              <span className="text-sm font-medium text-sidebar-foreground">{user?.name || 'User'}</span>
              <span className="text-xs text-sidebar-foreground/70 capitalize">{user?.role || 'Member'}</span>
            </div>
          )}
          {!collapsed && (
            <Button 
              variant="ghost" 
              size="icon" 
              className="h-8 w-8 text-sidebar-foreground hover:bg-sidebar-accent"
              onClick={handleLogout}
            >
              <LogOut className="h-4 w-4" />
            </Button>
          )}
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
