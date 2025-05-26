
"use client"; // This page needs to be a client component for role checking

import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertTriangle } from "lucide-react";

// IMPORTANT: This is a placeholder for actual role management.
// In a real app, this would come from your authentication system (e.g., context, hook).
const userRole: "admin" | "accountant" = "admin"; // Change to "accountant" to test non-admin view

export default function ProfitLossPage() {
  if (userRole !== "admin") {
    return (
      <div>
        <PageHeader
          title="Access Denied"
          description="You do not have permission to view this page."
        />
        <Card className="border-destructive">
          <CardHeader>
            <CardTitle className="flex items-center text-destructive">
              <AlertTriangle className="h-5 w-5 mr-2" />
              Permission Required
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-destructive">
              The Profit/Loss report is restricted to admin users only.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title="Profit & Loss Statement"
        description="Analyze your business financial performance."
      />
      <Card>
        <CardHeader>
          <CardTitle>Profit/Loss Report</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">
            This section is under development. Detailed profit and loss statements will be available here.
          </p>
          {/* Placeholder for P/L report components */}
        </CardContent>
      </Card>
    </div>
  );
}
