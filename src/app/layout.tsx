
import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { SidebarProvider, Sidebar, SidebarInset, SidebarTrigger, SidebarRail } from "@/components/ui/sidebar";
import { SidebarNav } from "@/components/layout/sidebar-nav";
import { Toaster } from "@/components/ui/toaster";
import { Button } from "@/components/ui/button";
import { PanelLeft, Menu } from "lucide-react";
import { PageTitleProvider } from '@/context/PageTitleContext';
import { HeaderTitle } from '@/components/layout/HeaderTitle';
// Removed LanguageProvider and LanguageToggle imports
import { UserSessionProvider } from "@/context/UserSessionContext"; 

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
        <UserSessionProvider> 
          <PageTitleProvider>
            {/* Removed LanguageProvider wrapper */}
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
                          <Menu className="h-4 w-4" />
                          <span className="sr-only">Toggle Menu</span>
                        </Button>
                      </SidebarTrigger>
                    </div>

                    <div className="hidden md:flex">
                      <SidebarTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          <PanelLeft className="h-4 w-4" />
                          <span className="sr-only">Toggle Sidebar</span>
                        </Button>
                      </SidebarTrigger>
                    </div>

                    <HeaderTitle />
                    <div className="ml-auto">
                      {/* Removed LanguageToggle component */}
                    </div>
                  </header>
                  <main className="flex-1 pt-2 md:pt-4 lg:pt-6 px-4 md:px-6 lg:px-8 pb-4 md:pb-6 lg:pb-8">
                    {children}
                  </main>
                </SidebarInset>
              </SidebarProvider>
          </PageTitleProvider>
        </UserSessionProvider>
        <Toaster />
      </body>
    </html>
  );
}
