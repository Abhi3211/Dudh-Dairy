
import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { IndianRupee, Milk, Package, TrendingUp, TrendingDown, AlertCircle } from "lucide-react";
import type { DailySummary } from "@/lib/types";

// Placeholder data - replace with actual data fetching
const getDailySummary = async (): Promise<DailySummary> => {
  return {
    milkPurchasedLitres: 120.5,
    milkPurchasedAmount: 4820,
    milkSoldLitres: 95.0,
    milkSoldAmount: 5700,
    gheeSalesAmount: 1500,
    pashuAaharSalesAmount: 850,
    totalCashIn: 7500,
    totalCreditOut: 550,
    totalOutstandingAmount: 12000,
  };
};

export default async function DashboardPage() {
  const summary = await getDailySummary();

  const summaryItems = [
    { title: "Milk Purchased (Ltr)", value: summary.milkPurchasedLitres.toFixed(1), icon: Milk, unit: "Ltr" },
    { title: "Milk Purchased (Value)", value: summary.milkPurchasedAmount.toFixed(2), icon: IndianRupee, unit: "₹" },
    { title: "Milk Sold (Ltr)", value: summary.milkSoldLitres.toFixed(1), icon: Milk, unit: "Ltr" },
    { title: "Milk Sold (Value)", value: summary.milkSoldAmount.toFixed(2), icon: IndianRupee, unit: "₹" },
    { title: "Ghee Sales", value: summary.gheeSalesAmount.toFixed(2), icon: Package, unit: "₹" }, // Using Package for Ghee
    { title: "Pashu Aahar Sales", value: summary.pashuAaharSalesAmount.toFixed(2), icon: Package, unit: "₹" }, // Using Package for Pashu Aahar
    { title: "Total Cash In", value: summary.totalCashIn.toFixed(2), icon: TrendingUp, unit: "₹" },
    { title: "Total Credit Out", value: summary.totalCreditOut.toFixed(2), icon: TrendingDown, unit: "₹" },
    { title: "Total Outstanding", value: summary.totalOutstandingAmount.toFixed(2), icon: AlertCircle, unit: "₹", highlight: true },
  ];

  return (
    <div>
      <PageHeader title="Daily Summary Dashboard" description="Overview of today's dairy operations." />
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {summaryItems.map((item) => (
          <Card key={item.title} className={item.highlight ? "border-primary shadow-lg" : "shadow-sm"}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {item.title}
              </CardTitle>
              <item.icon className={`h-5 w-5 ${item.highlight ? 'text-primary' : 'text-muted-foreground'}`} />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-foreground">
                {item.unit === "₹" && `${item.unit} `}{item.value}{item.unit !== "₹" && ` ${item.unit}`}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
      {/* TODO: Add charts or more detailed summaries later */}
    </div>
  );
}
