import { SidebarProvider, SidebarTrigger, SidebarInset } from "@/components/ui/sidebar";
import { AppSidebar } from "./AppSidebar";
import { Separator } from "@/components/ui/separator";
import { Bell, Search, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/contexts/AuthContext";

interface AppLayoutProps {
  children: React.ReactNode;
  title?: string;
}

export function AppLayout({ children, title }: AppLayoutProps) {
  const { logout, user } = useAuth();

  const handleLogout = async () => {
    try {
      await logout();
    } catch (error) {
      console.error('Logout failed:', error);
    }
  };
  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full">
        <AppSidebar />
        <SidebarInset className="flex flex-1 flex-col">
          <header className="flex h-14 shrink-0 items-center gap-2 bg-gradient-to-r from-[hsl(260,50%,35%)] to-[hsl(280,50%,40%)] px-4 text-white">
            <SidebarTrigger className="-ml-1 text-white hover:bg-white/10" />
            <Separator orientation="vertical" className="mr-2 h-4 bg-white/30" />
            {title && <h1 className="font-semibold text-lg">{title}</h1>}
            <div className="ml-auto flex items-center gap-2">
              <div className="relative hidden md:block">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/70" />
                <Input
                  placeholder="Search here"
                  className="w-64 pl-9 h-9 bg-white/10 border-white/20 text-white placeholder:text-white/60 focus:bg-white/20"
                />
              </div>
              <Button variant="ghost" size="icon" className="h-9 w-9 relative text-white hover:bg-white/10">
                <Bell className="h-4 w-4" />
                <span className="absolute -top-1 -right-1 h-4 w-4 bg-accent text-accent-foreground text-xs flex items-center justify-center rounded-full">
                  3
                </span>
              </Button>
              <Button 
                variant="ghost" 
                size="icon" 
                className="h-9 w-9 text-white hover:bg-white/10"
                onClick={handleLogout}
                title={`Logout ${user?.email || ''}`}
              >
                <LogOut className="h-4 w-4" />
              </Button>
            </div>
          </header>
          <main className="flex-1 overflow-auto p-6">
            {children}
          </main>
        </SidebarInset>
      </div>
    </SidebarProvider>
  );
}
