
import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { SidebarProvider, Sidebar, SidebarInset, SidebarTrigger, SidebarRail } from "@/components/ui/sidebar";
import { SidebarNav } from "@/components/layout/sidebar-nav";
import { Toaster } from "@/components/ui/toaster";
import { Button } from "@/components/ui/button";
import { PanelLeft } from "lucide-react";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Dudh Dairy",
  description: "Manage your dairy business with ease.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased font-sans`}
      >
        <SidebarProvider defaultOpen={true} collapsible="icon">
          <Sidebar variant="sidebar" className="bg-sidebar text-sidebar-foreground border-r border-sidebar-border shadow-md">
            <SidebarNav />
          </Sidebar>
          <SidebarRail />
          <SidebarInset>
            <header className="sticky top-0 z-10 flex h-14 items-center gap-4 border-b bg-background/80 backdrop-blur-sm px-4 sm:h-16 md:px-6">
              <div className="md:hidden">
                <SidebarTrigger asChild>
                  <Button variant="outline" size="icon" className="h-8 w-8">
                    <PanelLeft className="h-4 w-4" />
                    <span className="sr-only">Toggle Menu</span>
                  </Button>
                </SidebarTrigger>
              </div>
              {/* You can add more header content here if needed, e.g., User Profile Dropdown */}
              <div className="flex-1 text-xl font-semibold text-foreground">
                {/* Dynamically set page title here if needed */}
              </div>
            </header>
            <main className="flex-1 p-4 md:p-6 lg:p-8">
              {children}
            </main>
          </SidebarInset>
        </SidebarProvider>
        <Toaster />
      </body>
    </html>
  );
}
