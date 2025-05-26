
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Milk,
  ShoppingCart,
  Package,
  Users,
  IndianRupee,
  BarChart3, // Added for Profit/Loss
  Receipt,   // Added for Expenses
  type LucideIcon,
} from "lucide-react";

import { cn } from "@/lib/utils";
import {
  SidebarMenu,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/icons/logo";

interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  disabled?: boolean;
  adminOnly?: boolean; // New property for role-based visibility
}

// IMPORTANT: This is a placeholder for actual role management.
// In a real app, this would come from your authentication system.
const userRole: "admin" | "accountant" = "admin"; // Change to "accountant" to test non-admin view

const navItems: NavItem[] = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/milk-collection", label: "Milk Collection", icon: Milk },
  { href: "/sales", label: "Sales Entry", icon: ShoppingCart },
  { href: "/pashu-aahar", label: "Pashu Aahar", icon: Package },
  { href: "/parties", label: "Parties", icon: Users },
  { href: "/payments", label: "Payments", icon: IndianRupee },
  { href: "/expenses", label: "Expenses", icon: Receipt },
  { href: "/profit-loss", label: "Profit/Loss", icon: BarChart3, adminOnly: true },
];

export function SidebarNav() {
  const pathname = usePathname();
  const { setOpenMobile } = useSidebar();

  const visibleNavItems = navItems.filter(item => {
    if (item.adminOnly) {
      return userRole === 'admin';
    }
    return true;
  });

  return (
    <nav className="flex flex-col h-full">
      <div className="p-4 group-data-[collapsible=icon]:p-2 transition-all">
         <Logo />
      </div>
      <SidebarMenu className="flex-1 p-2">
        {visibleNavItems.map((item) => (
          <SidebarMenuItem key={item.href}>
            <Button
              asChild
              variant={pathname === item.href ? "default" : "ghost"}
              className={cn(
                "w-full justify-start gap-2",
                pathname === item.href
                  ? "bg-primary text-primary-foreground hover:bg-primary/90 hover:text-primary-foreground"
                  : "hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                "group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:px-2"
              )}
              onClick={() => setOpenMobile(false)}
              disabled={item.disabled}
              aria-current={pathname === item.href ? "page" : undefined}
            >
              <Link href={item.href}>
                <item.icon className="h-5 w-5 group-data-[collapsible=icon]:h-4 group-data-[collapsible=icon]:w-4 transition-all" />
                <span className="group-data-[collapsible=icon]:hidden">{item.label}</span>
              </Link>
            </Button>
          </SidebarMenuItem>
        ))}
      </SidebarMenu>
    </nav>
  );
}
