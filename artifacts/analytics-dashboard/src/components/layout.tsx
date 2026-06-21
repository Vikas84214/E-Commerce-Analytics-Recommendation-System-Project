import { Link, useLocation } from "wouter";
import { 
  BarChart3, 
  Box, 
  Users, 
  ShoppingCart, 
  TrendingUp, 
  LineChart, 
  PieChart, 
  Lightbulb, 
  LogOut,
  Menu,
  Activity
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import { useGetMe } from "@workspace/api-client-react";

export function Layout({ children }: { children: React.ReactNode }) {
  const [location, setLocation] = useLocation();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const { data: user } = useGetMe();

  const navigation = [
    { name: "Dashboard", href: "/dashboard", icon: Activity },
    { name: "Products", href: "/products", icon: Box },
    { name: "Customers", href: "/customers", icon: Users },
    { name: "Orders", href: "/orders", icon: ShoppingCart },
    { name: "Sales Analytics", href: "/analytics/sales", icon: LineChart },
    { name: "Customer Analytics", href: "/analytics/customers", icon: PieChart },
    { name: "Recommendations", href: "/recommendations", icon: Lightbulb },
    { name: "Forecasting", href: "/forecasting", icon: TrendingUp },
  ];

  const handleLogout = () => {
    // Basic logout handling
    setLocation("/login");
  };

  return (
    <div className="min-h-screen bg-background text-foreground flex">
      {/* Sidebar */}
      <aside className={`fixed inset-y-0 left-0 z-50 w-64 bg-sidebar border-r border-sidebar-border transition-transform duration-200 ease-in-out md:translate-x-0 ${isMobileMenuOpen ? "translate-x-0" : "-translate-x-full"} md:static md:block`}>
        <div className="flex h-16 items-center px-6 border-b border-sidebar-border">
          <div className="flex items-center gap-2 font-bold text-xl text-sidebar-primary tracking-tight font-mono">
            <BarChart3 className="w-6 h-6" />
            <span>CommerceIQ</span>
          </div>
        </div>
        
        <div className="p-4">
          <div className="mb-4 px-2 py-3 bg-sidebar-accent/50 rounded-md border border-sidebar-accent">
            <p className="text-xs text-sidebar-foreground/60 uppercase tracking-wider font-semibold mb-1">Logged in as</p>
            <p className="text-sm font-medium text-sidebar-foreground truncate">{user?.name || "Admin"}</p>
          </div>

          <nav className="space-y-1 mt-6">
            {navigation.map((item) => {
              const isActive = location.startsWith(item.href);
              return (
                <Link
                  key={item.name}
                  href={item.href}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium transition-colors ${
                    isActive 
                      ? "bg-sidebar-primary/10 text-sidebar-primary border border-sidebar-primary/20" 
                      : "text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent"
                  }`}
                  onClick={() => setIsMobileMenuOpen(false)}
                >
                  <item.icon className={`w-5 h-5 ${isActive ? "text-sidebar-primary" : "text-sidebar-foreground/50"}`} />
                  {item.name}
                </Link>
              );
            })}
          </nav>
        </div>

        <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-sidebar-border">
          <Button 
            variant="ghost" 
            className="w-full justify-start text-sidebar-foreground/70 hover:text-destructive hover:bg-destructive/10"
            onClick={handleLogout}
          >
            <LogOut className="w-5 h-5 mr-3" />
            Sign Out
          </Button>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0 h-screen overflow-hidden">
        {/* Mobile header */}
        <header className="md:hidden flex h-16 items-center px-4 border-b border-border bg-card">
          <Button variant="ghost" size="icon" onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}>
            <Menu className="w-6 h-6" />
          </Button>
          <span className="ml-4 font-bold font-mono text-primary">CommerceIQ</span>
        </header>

        {/* Page Content */}
        <main className="flex-1 overflow-auto bg-background p-6 md:p-8">
          <div className="max-w-7xl mx-auto">
            {children}
          </div>
        </main>
      </div>
      
      {/* Mobile backdrop */}
      {isMobileMenuOpen && (
        <div 
          className="fixed inset-0 bg-background/80 backdrop-blur-sm z-40 md:hidden"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}
    </div>
  );
}
