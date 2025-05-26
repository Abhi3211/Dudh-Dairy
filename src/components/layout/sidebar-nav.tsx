
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Milk,
  ShoppingCart,
  Package,
  BookUser,
  IndianRupee,
  type LucideIcon,
} from "lucide-react";

import { cn } from "@/lib/utils";
import {
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  useSidebar,
} from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button"; // Import Button
import { Logo } from "@/components/icons/logo"; // Import Logo

interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  disabled?: boolean;
}

const navItems: NavItem[] = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/milk-collection", label: "Milk Collection", icon: Milk },
  { href: "/sales", label: "Sales Entry", icon: ShoppingCart },
  { href: "/pashu-aahar", label: "Pashu Aahar", icon: Package },
  { href: "/dealer-ledger", label: "Dealer Ledger", icon: BookUser },
  { href: "/payments", label: "Payments", icon: IndianRupee },
];

export function SidebarNav() {
  const pathname = usePathname();
  const { setOpenMobile } = useSidebar();

  return (
    <nav className="flex flex-col h-full">
      <div className="p-4 group-data-[collapsible=icon]:p-2 transition-all">
         <Logo />
      </div>
      <SidebarMenu className="flex-1 p-2">
        {navItems.map((item) => (
          <SidebarMenuItem key={item.href}>
            <Button // Using Button for consistent styling and asChild pattern if Link is direct child
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
