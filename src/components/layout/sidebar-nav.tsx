
"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard,
  Milk,
  ShoppingCart,
  Users,
  IndianRupee,
  BarChart3,
  Receipt,
  Truck,
  Building,
  LogOut,
  LogIn,
  type LucideIcon,
} from "lucide-react";

import { cn } from "@/lib/utils";
import {
  SidebarMenu,
  SidebarMenuItem,
  SidebarFooter,
  SidebarSeparator,
  useSidebar,
} from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/icons/logo";
import { useUserSession } from "@/context/UserSessionContext";
import { auth } from "@/lib/firebase";
import { signOut } from "firebase/auth";
import { useToast } from "@/hooks/use-toast";
import { Skeleton } from "@/components/ui/skeleton"; // Ensure this import is present

interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  disabled?: boolean;
  adminOnly?: boolean;
  accountantAccess?: boolean;
}

// This should ideally come from userProfile.role after it's fetched
const userRole: "admin" | "accountant" | "member" = "admin";

const mainNavItems: NavItem[] = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/milk-collection", label: "Milk Collection", icon: Milk },
  { href: "/sales", label: "Sales Entry", icon: ShoppingCart },
  { href: "/bulk-sales", label: "Bulk Sales", icon: Truck },
  { href: "/purchases", label: "Purchases", icon: Building },
  { href: "/payments", label: "Payments", icon: IndianRupee },
  { href: "/expenses", label: "Expenses", icon: Receipt },
  { href: "/parties", label: "Parties", icon: Users },
  { href: "/profit-loss", label: "Profit/Loss", icon: BarChart3, adminOnly: true, accountantAccess: true },
];

export function SidebarNav() {
  const pathname = usePathname();
  const router = useRouter();
  const { setOpenMobile } = useSidebar();
  const { firebaseUser, authLoading, userProfile } = useUserSession();
  const { toast } = useToast();

  const handleLogout = async () => {
    try {
      await signOut(auth);
      toast({ title: "Logged Out", description: "You have been successfully logged out." });
      router.push("/login");
      setOpenMobile(false);
    } catch (error) {
      console.error("Logout error:", error);
      toast({ title: "Logout Failed", description: "Could not log you out. Please try again.", variant: "destructive" });
    }
  };

  const middleItemsOrder = [
    "/milk-collection", "/sales", "/bulk-sales", "/purchases",
    "/payments", "/expenses", "/parties",
  ];

  const visibleNavItems = mainNavItems
    .filter(item => {
      const currentRole = userProfile?.role || userRole;
      if (item.adminOnly && currentRole !== 'admin') {
        return false;
      }
      if (item.href === "/profit-loss" && currentRole === 'member') {
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
      if (indexA !== -1 && indexB !== -1) return indexA - indexB;
      if (indexA !== -1) return -1;
      if (indexB !== -1) return 1;
      return a.label.localeCompare(b.label);
    });

  if (authLoading) {
    return (
       <nav className="flex flex-col h-full">
        <div className="p-4 group-data-[collapsible=icon]:p-2 transition-all">
            <Logo />
        </div>
        <SidebarMenu className="flex-1 p-2 space-y-1">
            {Array(8).fill(0).map((_, i) => <Skeleton key={i} className="h-9 w-full rounded-md" />)}
        </SidebarMenu>
       </nav>
    );
  }

  return (
    <nav className="flex flex-col h-full">
      <div className="p-4 group-data-[collapsible=icon]:p-2 transition-all">
         <Logo />
      </div>
      <SidebarMenu className="flex-1 p-2">
        {firebaseUser ? (
          visibleNavItems.map((item) => (
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
          ))
        ) : (
          pathname !== "/login" && (
            <SidebarMenuItem>
              <Button
                asChild
                variant="default"
                className="w-full justify-start gap-2 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:px-2"
                onClick={() => setOpenMobile(false)}
              >
                <Link href="/login">
                  <LogIn className="h-5 w-5 group-data-[collapsible=icon]:h-4 group-data-[collapsible=icon]:w-4 transition-all" />
                  <span className="group-data-[collapsible=icon]:hidden">Login</span>
                </Link>
              </Button>
            </SidebarMenuItem>
          )
        )}
      </SidebarMenu>
      {firebaseUser && (
        <>
          <SidebarSeparator className="my-1" />
          <SidebarFooter className="p-2 mt-auto">
            {userProfile && (
                <div className="px-2 py-1 text-xs text-sidebar-foreground/70 group-data-[collapsible=icon]:hidden truncate">
                    Logged in as: {userProfile.displayName || userProfile.email}
                </div>
            )}
            <SidebarMenuItem>
              <Button
                variant="ghost"
                className="w-full justify-start gap-2 text-destructive hover:bg-destructive/10 hover:text-destructive group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:px-2"
                onClick={handleLogout}
              >
                <LogOut className="h-5 w-5 group-data-[collapsible=icon]:h-4 group-data-[collapsible=icon]:w-4 transition-all" />
                <span className="group-data-[collapsible=icon]:hidden">Logout</span>
              </Button>
            </SidebarMenuItem>
          </SidebarFooter>
        </>
      )}
    </nav>
  );
}
