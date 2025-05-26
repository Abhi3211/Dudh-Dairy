
"use client";

import { useState, useEffect, useCallback } from "react";
import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { AlertTriangle, CalendarIcon, IndianRupee, TrendingDown, TrendingUp } from "lucide-react";
import { DatePicker } from "@/components/ui/date-picker";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { format, subDays, startOfWeek, endOfWeek, startOfMonth, endOfMonth, differenceInDays } from "date-fns";
import { Skeleton } from "@/components/ui/skeleton";

// IMPORTANT: This is a placeholder for actual role management.
const userRole: "admin" | "accountant" = "admin";

interface ProfitLossData {
  totalRevenue: number;
  milkSales: number;
  gheeSales: number;
  pashuAaharSales: number;
  costOfGoodsSold: number; // Milk purchases
  grossProfit: number;
  operatingExpenses: number;
  netProfitLoss: number;
  periodDays: number;
}

// Simulated data fetching function
const getPlData = async (startDate: Date, endDate: Date): Promise<ProfitLossData> => {
  await new Promise(resolve => setTimeout(resolve, 500)); // Simulate API delay

  const periodDays = Math.max(1, differenceInDays(endDate, startDate) + 1);
  let milkSales = 0;
  let gheeSales = 0;
  let pashuAaharSales = 0;
  let costOfGoodsSold = 0; // Milk purchases

  // Simulate daily values and sum them up for the period
  for (let i = 0; i < periodDays; i++) {
    milkSales += Math.random() * 2000 + 1000; // Daily milk sales
    gheeSales += Math.random() * 300 + 50;    // Daily ghee sales
    pashuAaharSales += Math.random() * 200 + 30; // Daily pashu aahar sales
    costOfGoodsSold += Math.random() * 1500 + 800; // Daily milk purchases
  }
  
  const totalRevenue = milkSales + gheeSales + pashuAaharSales;
  const grossProfit = totalRevenue - costOfGoodsSold;
  
  // Simulate operating expenses, e.g., 15% of revenue + some fixed daily cost
  const operatingExpenses = (totalRevenue * 0.15) + (periodDays * 100); 
  const netProfitLoss = grossProfit - operatingExpenses;

  return {
    totalRevenue: parseFloat(totalRevenue.toFixed(2)),
    milkSales: parseFloat(milkSales.toFixed(2)),
    gheeSales: parseFloat(gheeSales.toFixed(2)),
    pashuAaharSales: parseFloat(pashuAaharSales.toFixed(2)),
    costOfGoodsSold: parseFloat(costOfGoodsSold.toFixed(2)),
    grossProfit: parseFloat(grossProfit.toFixed(2)),
    operatingExpenses: parseFloat(operatingExpenses.toFixed(2)),
    netProfitLoss: parseFloat(netProfitLoss.toFixed(2)),
    periodDays,
  };
};

export default function ProfitLossPage() {
  const [filterType, setFilterType] = useState<string>("monthly");
  const [customStartDate, setCustomStartDate] = useState<Date | undefined>(startOfMonth(new Date()));
  const [customEndDate, setCustomEndDate] = useState<Date | undefined>(endOfMonth(new Date()));
  
  const [plData, setPlData] = useState<ProfitLossData | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const calculateDateRange = useCallback(() => {
    const today = new Date();
    let start = today;
    let end = today;

    switch (filterType) {
      case "daily":
        start = today;
        end = today;
        break;
      case "weekly":
        start = startOfWeek(today, { weekStartsOn: 1 });
        end = endOfWeek(today, { weekStartsOn: 1 });
        break;
      case "monthly":
        start = startOfMonth(today);
        end = endOfMonth(today);
        break;
      case "custom":
        start = customStartDate || subDays(today, 7);
        end = customEndDate || today;
        break;
    }
    return { startDate: start, endDate: end };
  }, [filterType, customStartDate, customEndDate]);

  const fetchData = useCallback(async () => {
    if (userRole !== "admin") {
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    const { startDate, endDate } = calculateDateRange();
    let effectiveEndDate = endDate;
    if (filterType === 'custom' && startDate && endDate && endDate < startDate) {
        effectiveEndDate = startDate;
    }
    const data = await getPlData(startDate, effectiveEndDate);
    setPlData(data);
    setIsLoading(false);
  }, [calculateDateRange, filterType]); // Added filterType

  useEffect(() => {
    fetchData();
  }, [fetchData]);

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

  const { startDate, endDate } = calculateDateRange();
  const formattedPeriod = `${format(startDate, "MMM dd, yyyy")} - ${format(endDate, "MMM dd, yyyy")}`;

  return (
    <div>
      <PageHeader
        title="Profit & Loss Statement"
        description={`Financial performance for the period: ${formattedPeriod}`}
      />
      
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="text-lg">Filter Data</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col sm:flex-row gap-4 items-end">
          <div className="flex-1 min-w-[150px]">
            <Label htmlFor="filterType">Period</Label>
            <Select value={filterType} onValueChange={setFilterType}>
              <SelectTrigger id="filterType"><SelectValue placeholder="Select period" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="daily">Daily</SelectItem>
                <SelectItem value="weekly">Weekly</SelectItem>
                <SelectItem value="monthly">Monthly</SelectItem>
                <SelectItem value="custom">Custom Range</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {filterType === "custom" && (
            <>
              <div className="flex-1 min-w-[150px]">
                <Label htmlFor="startDate">Start Date</Label>
                <DatePicker date={customStartDate} setDate={setCustomStartDate} />
              </div>
              <div className="flex-1 min-w-[150px]">
                <Label htmlFor="endDate">End Date</Label>
                <DatePicker date={customEndDate} setDate={setCustomEndDate} />
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Profit/Loss Report</CardTitle>
          <CardDescription>
            Showing data for {filterType === 'daily' ? 'today' : `the selected ${filterType}`} period.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {isLoading ? (
            <div className="space-y-4">
              <Skeleton className="h-8 w-3/4" />
              <Skeleton className="h-6 w-1/2" />
              <Skeleton className="h-6 w-1/2" />
              <Skeleton className="h-6 w-1/2" />
              <Skeleton className="h-8 w-3/4 mt-4" />
              <Skeleton className="h-6 w-1/2" />
              <Skeleton className="h-8 w-3/4 mt-4" />
              <Skeleton className="h-6 w-1/2 mt-4" />
              <Skeleton className="h-8 w-3/4 mt-4" />
            </div>
          ) : plData ? (
            <>
              {/* Revenue Section */}
              <div>
                <h3 className="text-lg font-semibold text-foreground mb-2">Revenue</h3>
                <div className="space-y-1 pl-4">
                  <div className="flex justify-between"><span>Milk Sales:</span> <span className="font-medium">₹{plData.milkSales.toFixed(2)}</span></div>
                  <div className="flex justify-between"><span>Ghee Sales:</span> <span className="font-medium">₹{plData.gheeSales.toFixed(2)}</span></div>
                  <div className="flex justify-between"><span>Pashu Aahar Sales:</span> <span className="font-medium">₹{plData.pashuAaharSales.toFixed(2)}</span></div>
                  <div className="flex justify-between border-t pt-1 mt-1">
                    <span className="font-semibold">Total Revenue:</span>
                    <span className="font-bold text-chart-3">₹{plData.totalRevenue.toFixed(2)}</span>
                  </div>
                </div>
              </div>

              {/* COGS Section */}
              <div>
                <h3 className="text-lg font-semibold text-foreground mb-2">Cost of Goods Sold (COGS)</h3>
                <div className="space-y-1 pl-4">
                  <div className="flex justify-between"><span>Milk Purchases:</span> <span className="font-medium">₹{plData.costOfGoodsSold.toFixed(2)}</span></div>
                  <div className="flex justify-between border-t pt-1 mt-1">
                    <span className="font-semibold">Total COGS:</span>
                    <span className="font-bold text-chart-4">₹{plData.costOfGoodsSold.toFixed(2)}</span>
                  </div>
                </div>
              </div>
              
              {/* Gross Profit Section */}
              <div className="border-t pt-4">
                <div className="flex justify-between text-lg">
                  <span className="font-semibold text-foreground">Gross Profit:</span>
                  <span className={`font-bold ${plData.grossProfit >= 0 ? 'text-chart-3' : 'text-chart-4'}`}>
                    ₹{plData.grossProfit.toFixed(2)}
                  </span>
                </div>
              </div>

              {/* Operating Expenses Section */}
              <div>
                <h3 className="text-lg font-semibold text-foreground mb-2">Operating Expenses</h3>
                <div className="space-y-1 pl-4">
                  <div className="flex justify-between"><span>Simulated Expenses:</span> <span className="font-medium">₹{plData.operatingExpenses.toFixed(2)}</span></div>
                   <div className="flex justify-between border-t pt-1 mt-1">
                    <span className="font-semibold">Total Operating Expenses:</span>
                    <span className="font-bold text-chart-4">₹{plData.operatingExpenses.toFixed(2)}</span>
                  </div>
                </div>
              </div>

              {/* Net Profit/Loss Section */}
              <div className="border-t pt-4">
                <div className="flex justify-between text-xl">
                  <span className="font-bold text-foreground">Net Profit / (Loss):</span>
                  <span className={`font-extrabold ${plData.netProfitLoss >= 0 ? 'text-chart-3' : 'text-chart-4'}`}>
                    ₹{plData.netProfitLoss.toFixed(2)}
                  </span>
                </div>
                {plData.netProfitLoss < 0 && <p className="text-sm text-chart-4 text-right">(Loss is shown in parentheses or with a minus sign)</p>}
              </div>
            </>
          ) : (
            <p className="text-muted-foreground text-center">No data available for the selected period.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}


    