
"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { AlertTriangle, IndianRupee } from "lucide-react"; // Removed CalendarIcon as it's implicitly handled by DatePicker
import { DatePicker } from "@/components/ui/date-picker";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { format, subDays, startOfWeek, endOfWeek, startOfMonth, endOfMonth } from "date-fns";
import { Skeleton } from "@/components/ui/skeleton";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { ChartConfig, ChartContainer, ChartTooltipContent } from "@/components/ui/chart";
import type { FullProfitLossData, PlChartDataPoint, ProfitLossSummaryData } from "@/lib/types"; // Ensure ProfitLossSummaryData is imported
import { getProfitLossDataFromFirestore } from "./actions";
import { usePageTitle } from '@/context/PageTitleContext';

// IMPORTANT: This should ideally come from an auth context after login
const userRole: "admin" | "accountant" | "member" = "admin";


const chartConfig = {
  netProfit: { label: "Net Profit/Loss", color: "hsl(var(--chart-1))" }, 
} satisfies ChartConfig;


export default function ProfitLossPage() {
  const { setPageTitle } = usePageTitle();
  const pageSpecificTitle = userRole === "admin" || userRole === "accountant" ? "Profit & Loss Statement" : "Access Denied";

  useEffect(() => {
    setPageTitle(pageSpecificTitle);
  }, [setPageTitle, pageSpecificTitle]);

  const [filterType, setFilterType] = useState<string>("monthly");
  const [customStartDate, setCustomStartDate] = useState<Date | undefined>(undefined);
  const [customEndDate, setCustomEndDate] = useState<Date | undefined>(undefined);
  
  const [plData, setPlData] = useState<FullProfitLossData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [displayedDateRangeString, setDisplayedDateRangeString] = useState<string>("Loading date range...");


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
        if (start && end && start > end) end = start; 
        break;
    }
    return { startDate: start, endDate: end };
  }, [filterType, customStartDate, customEndDate]);

  const fetchData = useCallback(async () => {
    if (userRole !== "admin" && userRole !== "accountant") {
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    const { startDate, endDate } = calculateDateRange();
    
    if (!startDate || !endDate) {
        console.warn("ProfitLossPage: fetchData - startDate or endDate is undefined, skipping fetch.");
        setIsLoading(false);
        setDisplayedDateRangeString("Please select a valid date range.");
        setPlData(null);
        return;
    }
    
    console.log(`ProfitLossPage: Fetching data for range: ${startDate.toISOString()} to ${endDate.toISOString()}`);
    const data = await getProfitLossDataFromFirestore(startDate, endDate);
    console.log("ProfitLossPage: Data received from server action:", JSON.parse(JSON.stringify(data)));
    setPlData(data);

    const formattedStartDate = format(startDate, "MMM dd, yyyy");
    const formattedEndDate = format(endDate, "MMM dd, yyyy");
    let periodPrefix = "";
     if (filterType === 'daily' && format(startDate, 'yyyy-MM-dd') === format(new Date(), 'yyyy-MM-dd')) {
      periodPrefix = "today's";
    } else if (filterType === 'daily' && formattedStartDate === formattedEndDate) {
       periodPrefix = `for ${formattedStartDate}`;
    } else {
      periodPrefix = `for the period`;
    }
    setDisplayedDateRangeString(
      `Financial performance ${periodPrefix}: ${formattedStartDate}${startDate.getTime() !== endDate.getTime() ? ` to ${formattedEndDate}` : ''}`
    );

    setIsLoading(false);
  }, [calculateDateRange, filterType]); 


  useEffect(() => {
    if (customStartDate === undefined) {
      setCustomStartDate(startOfMonth(new Date()));
    }
    if (customEndDate === undefined) {
      setCustomEndDate(endOfMonth(new Date()));
    }
  }, []);

  useEffect(() => {
     if (filterType === 'custom' && (!customStartDate || !customEndDate)) {
      return; 
    }
    fetchData();
  }, [fetchData, filterType, customStartDate, customEndDate]);

  const isDataEffectivelyEmpty = (summary: ProfitLossSummaryData | undefined | null): boolean => {
    if (!summary) return true;
    return (
      summary.totalRevenue === 0 &&
      summary.costOfGoodsSold === 0 &&
      summary.operatingExpenses === 0 && // Though this is always 0 for now
      summary.netProfitLoss === 0
    );
  };


  if (userRole !== "admin" && userRole !== "accountant") {
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
              The Profit/Loss report is restricted to admin and accountant users only.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title={pageSpecificTitle}
        description={displayedDateRangeString}
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
                <SelectItem value="daily">Daily (Today)</SelectItem>
                <SelectItem value="weekly">This Week</SelectItem>
                <SelectItem value="monthly">This Month</SelectItem>
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
            {displayedDateRangeString}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {isLoading ? (
            <div className="space-y-4">
              <Skeleton className="h-8 w-3/4 mb-2" /> 
              <Skeleton className="h-6 w-1/2 mb-1" />
              <Skeleton className="h-6 w-1/2 mb-1" />
              <Skeleton className="h-6 w-1/2 mb-4" />
              <Skeleton className="h-8 w-3/4 mb-2" />
              <Skeleton className="h-6 w-1/2 mb-4" />
              <Skeleton className="h-8 w-3/4" />
            </div>
          ) : plData && plData.summary && !isDataEffectivelyEmpty(plData.summary) ? (
            <>
              <div>
                <h3 className="text-lg font-semibold text-foreground mb-2">Revenue</h3>
                <div className="space-y-1 pl-4">
                  <div className="flex justify-between"><span>Milk Sales (Retail):</span> <span className="font-medium">₹{plData.summary.milkSalesRetail.toFixed(2)}</span></div>
                  <div className="flex justify-between"><span>Milk Sales (Bulk):</span> <span className="font-medium">₹{plData.summary.milkSalesBulk.toFixed(2)}</span></div>
                  <div className="flex justify-between"><span>Ghee Sales:</span> <span className="font-medium">₹{plData.summary.gheeSales.toFixed(2)}</span></div>
                  <div className="flex justify-between"><span>Pashu Aahar Sales:</span> <span className="font-medium">₹{plData.summary.pashuAaharSales.toFixed(2)}</span></div>
                  <div className="flex justify-between border-t pt-1 mt-1">
                    <span className="font-semibold">Total Revenue:</span>
                    <span className="font-bold text-chart-3">₹{plData.summary.totalRevenue.toFixed(2)}</span>
                  </div>
                </div>
              </div>
              <div>
                <h3 className="text-lg font-semibold text-foreground mb-2">Cost of Goods Sold (COGS)</h3>
                 <p className="text-xs text-muted-foreground pl-4 mb-1">(Simplified COGS based on collections & purchases in period)</p>
                <div className="space-y-1 pl-4">
                  <div className="flex justify-between"><span>Milk COGS:</span> <span className="font-medium">₹{plData.summary.cogsMilk.toFixed(2)}</span></div>
                  <div className="flex justify-between"><span>Ghee COGS:</span> <span className="font-medium">₹{plData.summary.cogsGhee.toFixed(2)}</span></div>
                  <div className="flex justify-between"><span>Pashu Aahar COGS:</span> <span className="font-medium">₹{plData.summary.cogsPashuAahar.toFixed(2)}</span></div>
                  <div className="flex justify-between border-t pt-1 mt-1">
                    <span className="font-semibold">Total COGS:</span>
                    <span className="font-bold text-chart-4">₹{plData.summary.costOfGoodsSold.toFixed(2)}</span>
                  </div>
                </div>
              </div>
              <div className="border-t pt-4">
                <div className="flex justify-between text-lg">
                  <span className="font-semibold text-foreground">Gross Profit:</span>
                  <span className={`font-bold ${plData.summary.grossProfit >= 0 ? 'text-chart-3' : 'text-chart-4'}`}>
                    ₹{plData.summary.grossProfit.toFixed(2)}
                  </span>
                </div>
              </div>
              <div>
                <h3 className="text-lg font-semibold text-foreground mb-2">Operating Expenses</h3>
                <div className="space-y-1 pl-4">
                  <div className="flex justify-between"><span>Total Operating Expenses:</span> <span className="font-medium">₹{plData.summary.operatingExpenses.toFixed(2)}</span></div>
                  <p className="text-xs text-muted-foreground pt-1">(Note: Detailed operating expense tracking from live data is not yet fully implemented. This figure is currently ₹0.00 unless manually set in actions.)</p>
                </div>
              </div>
              <div className="border-t pt-4">
                <div className="flex justify-between text-xl">
                  <span className="font-bold text-foreground">Net Profit / (Loss):</span>
                  <span className={`font-extrabold ${plData.summary.netProfitLoss >= 0 ? 'text-chart-3' : 'text-chart-4'}`}>
                    ₹{plData.summary.netProfitLoss.toFixed(2)}
                  </span>
                </div>
                {plData.summary.netProfitLoss < 0 && <p className="text-sm text-chart-4 text-right">(Loss is shown with a minus sign)</p>}
              </div>
            </>
          ) : (
            <p className="text-muted-foreground text-center py-8">
              {isLoading ? "Loading financial data..." : "No financial data available for the selected period."}
            </p>
          )}
        </CardContent>
      </Card>

      {(userRole === "admin" || userRole === "accountant") && (
        <Card className="mt-6">
          <CardHeader>
            <CardTitle>Net Profit/Loss Trend</CardTitle>
            <CardDescription>
              Daily net profit/loss for the period: {displayedDateRangeString.substring(displayedDateRangeString.indexOf(':') + 1).trim()}
            </CardDescription>
          </CardHeader>
          <CardContent className="h-[300px] sm:h-[400px]">
            {isLoading ? (
              <div className="flex items-center justify-center h-full">
                <Skeleton className="h-full w-full" />
              </div>
            ) : plData && plData.chartSeries && plData.chartSeries.length > 0 ? (
              <ChartContainer config={chartConfig} className="w-full h-full">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={plData.chartSeries} margin={{ top: 5, right: 30, left: 0, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false}/>
                    <XAxis dataKey="date" tickLine={false} axisLine={false} tickMargin={8} />
                    <YAxis 
                      tickLine={false} 
                      axisLine={false} 
                      tickMargin={8} 
                      tickFormatter={(value) => `₹${value >= 1000 || value <= -1000 ? (value / 1000).toFixed(0) + 'k' : value.toFixed(0)}`}
                      allowDecimals={false} 
                    />
                    <Tooltip 
                      content={<ChartTooltipContent 
                        indicator="line" 
                        formatter={(value, name, entry) => {
                          const dataPoint = entry.payload as PlChartDataPoint | undefined;
                          return (
                            <div className="flex flex-col">
                              <span className="text-xs text-muted-foreground">{dataPoint?.date}</span>
                              <span className="font-bold">Net Profit: ₹{Number(value).toFixed(2)}</span>
                            </div>
                          );
                        }}
                      />} 
                    />
                    <Legend />
                    <Line type="monotone" dataKey="netProfit" stroke="var(--color-netProfit)" strokeWidth={2} dot={false} name="Net Profit/Loss" />
                  </LineChart>
                </ResponsiveContainer>
              </ChartContainer>
            ) : (
              <div className="flex items-center justify-center h-full">
                <p className="text-muted-foreground">No chart data available for the selected period.</p>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
