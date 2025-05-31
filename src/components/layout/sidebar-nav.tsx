
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
  UserPlus,
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
import { Skeleton } from "@/components/ui/skeleton";

interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  disabled?: boolean;
  adminOnly?: boolean;
  accountantAccess?: boolean;
}

const staticUserRole: "admin" | "accountant" | "member" = "admin"; // This will be dynamic later

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
  const { firebaseUser, authLoading, userProfile, companyProfile, profilesLoading } = useUserSession();
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

  const currentDynamicRole = userProfile?.role || staticUserRole;

  const visibleNavItems = mainNavItems
    .filter(item => {
      if (item.adminOnly && currentDynamicRole !== 'admin') {
        return false;
      }
      if (item.href === "/profit-loss" && currentDynamicRole === 'member') {
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

  if (authLoading || (firebaseUser && profilesLoading)) {
    return (
       <nav className="flex flex-col h-full">
        <div className="p-4 group-data-[collapsible=icon]:p-2 transition-all">
            <div className="flex flex-col items-start group-data-[collapsible=icon]:items-center">
                <Skeleton className="h-7 w-24 mb-1 group-data-[collapsible=icon]:h-6 group-data-[collapsible=icon]:w-6 group-data-[collapsible=icon]:mb-0" />
                <Skeleton className="h-3 w-32 group-data-[collapsible=icon]:hidden" />
            </div>
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
         <Logo companyName={companyProfile?.name} />
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
          <>
            {pathname !== "/login" && (
              <SidebarMenuItem>
                <Button
                  asChild
                  variant={pathname === "/login" ? "default" : "ghost"}
                  className="w-full justify-start gap-2 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:px-2 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                  onClick={() => setOpenMobile(false)}
                >
                  <Link href="/login">
                    <LogIn className="h-5 w-5 group-data-[collapsible=icon]:h-4 group-data-[collapsible=icon]:w-4 transition-all" />
                    <span className="group-data-[collapsible=icon]:hidden">Login</span>
                  </Link>
                </Button>
              </SidebarMenuItem>
            )}
            {pathname !== "/signup" && (
               <SidebarMenuItem>
                <Button
                  asChild
                  variant={pathname === "/signup" ? "default" : "ghost"}
                  className="w-full justify-start gap-2 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:px-2 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                  onClick={() => setOpenMobile(false)}
                >
                  <Link href="/signup">
                    <UserPlus className="h-5 w-5 group-data-[collapsible=icon]:h-4 group-data-[collapsible=icon]:w-4 transition-all" />
                    <span className="group-data-[collapsible=icon]:hidden">Sign Up</span>
                  </Link>
                </Button>
              </SidebarMenuItem>
            )}
          </>
        )}
      </SidebarMenu>
      {firebaseUser && userProfile && !profilesLoading && (
        <>
          <SidebarSeparator className="my-1" />
          <SidebarFooter className="p-2 mt-auto">
            {userProfile && (
                <div className="px-2 py-1 text-xs text-sidebar-foreground/70 group-data-[collapsible=icon]:hidden truncate">
                    Logged in as: {userProfile.displayName || userProfile.email}
                </div>
            )}
            {companyProfile && (
                <div className="px-2 py-1 text-xs text-muted-foreground group-data-[collapsible=icon]:hidden truncate">
                    Company: {companyProfile.name}
                </div>
            )}
            <SidebarMenuItem className="list-none">
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
