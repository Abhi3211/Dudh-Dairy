
"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LogIn, Zap, TrendingUp, Milk, Users, BarChart3 } from "lucide-react"; 
import { usePageTitle } from '@/context/PageTitleContext';
import { useEffect } from "react";
import { useUserSession } from "@/context/UserSessionContext";
import { useRouter } from "next/navigation";

export default function LandingPage() {
  const { setPageTitle } = usePageTitle();
  const pageSpecificTitle = "Welcome to Dudh Dairy";
  const { firebaseUser, authLoading, companyProfile, profilesLoading } = useUserSession();
  const router = useRouter();

  useEffect(() => {
    setPageTitle(pageSpecificTitle);
  }, [setPageTitle, pageSpecificTitle]);

  useEffect(() => {
    // If user is authenticated, profiles are loaded, and companyProfile exists,
    // redirect them from landing page to dashboard.
    if (!authLoading && firebaseUser && !profilesLoading && companyProfile) {
      router.replace("/dashboard");
    }
    // If auth is loaded, user is present, but profiles are still loading OR companyProfile is not yet available,
    // they will see the landing page briefly. Once profilesLoading is false and companyProfile is set,
    // this effect will re-run and redirect.
    // If authLoading is true, they also see the landing page (or a loading state if you add one).
  }, [firebaseUser, authLoading, companyProfile, profilesLoading, router]);


  // If still loading auth or profiles, or if user is already logged in and has a company (and will be redirected),
  // you might want to show a loading indicator or a minimal version of the landing page.
  // For simplicity, we'll let the redirect handle it. If the redirect doesn't happen immediately,
  // they see the landing page.

  return (
    <div className="flex flex-col min-h-[calc(100vh-10rem)] items-center justify-center p-4 md:p-8">
      <div className="absolute top-4 right-4 md:top-6 md:right-6">
        <Button asChild variant="outline">
          <Link href="/login">
            <LogIn className="mr-2 h-4 w-4" /> Login
          </Link>
        </Button>
      </div>

      <main className="flex flex-1 flex-col items-center justify-center text-center space-y-8">
        <Milk className="h-24 w-24 text-primary" />
        <h1 className="text-4xl font-bold tracking-tight sm:text-5xl md:text-6xl text-foreground">
          {pageSpecificTitle}
        </h1>
        <p className="max-w-2xl text-lg text-muted-foreground sm:text-xl">
          Streamline your dairy operations, manage milk collections, sales, purchases, and gain valuable insights with our all-in-one platform.
        </p>
        <Button asChild size="lg" className="shadow-lg hover:shadow-primary/50 transition-shadow">
          <Link href="/signup">
            Get Started Free <Zap className="ml-2 h-5 w-5" />
          </Link>
        </Button>
      </main>

      <section className="w-full max-w-5xl mt-16 md:mt-24">
        <h2 className="text-2xl font-semibold text-center mb-8 text-foreground">Why Choose Dudh Dairy?</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 md:gap-8">
          <Card className="shadow-md hover:shadow-lg transition-shadow">
            <CardHeader>
              <CardTitle className="flex items-center"><TrendingUp className="h-6 w-6 mr-2 text-primary" /> Efficient Management</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Track milk collections, sales, bulk orders, purchases, and payments all in one place.
              </p>
            </CardContent>
          </Card>
          <Card className="shadow-md hover:shadow-lg transition-shadow">
            <CardHeader>
              <CardTitle className="flex items-center"><Users className="h-6 w-6 mr-2 text-primary" /> Party Ledgers</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Maintain clear and accurate ledgers for all your customers and suppliers.
              </p>
            </CardContent>
          </Card>
          <Card className="shadow-md hover:shadow-lg transition-shadow">
            <CardHeader>
              <CardTitle className="flex items-center"><BarChart3 className="h-6 w-6 mr-2 text-primary" /> Insightful Reports</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Access dashboards and profit & loss statements to make informed business decisions.
              </p>
            </CardContent>
          </Card>
        </div>
      </section>

      <footer className="py-8 mt-16 text-center text-sm text-muted-foreground">
        © {new Date().getFullYear()} Dudh Dairy. All rights reserved.
      </footer>
    </div>
  );
}
