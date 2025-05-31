
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Milk,
  ShoppingCart,
  Package, // Kept for Pashu Aahar or other general product stock
  Users,
  IndianRupee,
  BarChart3,
  Receipt, 
  Truck,
  Building, // Icon for Purchases (general supplies)
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
// Removed useLanguage and translations imports

interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  disabled?: boolean;
  adminOnly?: boolean;
  accountantAccess?: boolean; // New property for accountant
}

// This should ideally come from a context or auth service
// For now, keeping it here to demonstrate role-based visibility
const userRole: "admin" | "accountant" | "member" = "admin"; 

const navItems: NavItem[] = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/milk-collection", label: "Milk Collection", icon: Milk },
  { href: "/sales", label: "Sales Entry", icon: ShoppingCart },
  { href: "/bulk-sales", label: "Bulk Sales", icon: Truck },
  { href: "/purchases", label: "Purchases", icon: Building }, // Changed icon
  { href: "/payments", label: "Payments", icon: IndianRupee },
  { href: "/expenses", label: "Expenses", icon: Receipt },
  { href: "/parties", label: "Parties", icon: Users },
  { href: "/profit-loss", label: "Profit/Loss", icon: BarChart3, adminOnly: true, accountantAccess: true },
];

export function SidebarNav() {
  const pathname = usePathname();
  const { setOpenMobile } = useSidebar();
  // const { language, translations } = useLanguage(); // Removed

  // Define a desired order for items that are not Dashboard or Profit/Loss
  const middleItemsOrder = [
    "/milk-collection",
    "/sales",
    "/bulk-sales",
    "/purchases",
    "/payments",
    "/expenses",
    "/parties",
  ];

  const visibleNavItems = navItems
    .filter(item => {
      if (item.adminOnly && userRole !== 'admin') { // Strict admin only
        return false;
      }
      if (item.href === "/profit-loss" && userRole === 'member') { // P&L hidden from member
          return false;
      }
      return true;
    })
    .sort((a, b) => {
      if (a.href === "/") return -1;
      if (b.href === "/") return 1;

      if (a.href === "/profit-loss") return 1;
      if (b.href === "/profit-loss") return -1;
      
      const indexA = middleItemsOrder.indexOf(a.href);
      const indexB = middleItemsOrder.indexOf(b.href);

      if (indexA !== -1 && indexB !== -1) {
        return indexA - indexB;
      }
      if (indexA !== -1) return -1;
      if (indexB !== -1) return 1;
      
      return a.label.localeCompare(b.label);
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
                {/* Reverted to direct label, removed translation logic */}
                <span className="group-data-[collapsible=icon]:hidden">{item.label}</span>
              </Link>
            </Button>
          </SidebarMenuItem>
        ))}
      </SidebarMenu>
    </nav>
  );
}
