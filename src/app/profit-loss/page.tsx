
"use client";

import { useState, useEffect, useCallback } from "react";
import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { AlertTriangle, CalendarIcon, IndianRupee } from "lucide-react";
import { DatePicker } from "@/components/ui/date-picker";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { format, subDays, startOfWeek, endOfWeek, startOfMonth, endOfMonth, differenceInDays, addDays } from "date-fns";
import { Skeleton } from "@/components/ui/skeleton";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from "recharts";
import { ChartConfig, ChartContainer, ChartTooltipContent } from "@/components/ui/chart";
import type { FullProfitLossData, ProfitLossSummaryData, PlChartDataPoint } from "@/lib/types";

// IMPORTANT: This is a placeholder for actual role management.
const userRole: "admin" | "accountant" = "admin";


// Simulated data fetching function
const getPlData = async (startDate: Date, endDate: Date): Promise<FullProfitLossData> => {
  // await new Promise(resolve => setTimeout(resolve, 500)); // Simulate API delay - REMOVED

  const periodDays = Math.max(1, differenceInDays(endDate, startDate) + 1);
  
  let totalMilkSales = 0;
  let totalGheeSales = 0;
  let totalPashuAaharSales = 0;
  let totalCostOfGoodsSold = 0;
  let totalOperatingExpenses = 0;

  const chartSeries: PlChartDataPoint[] = [];

  for (let i = 0; i < periodDays; i++) {
    const currentDate = addDays(startDate, i);
    const dailyMilkSales = Math.random() * 1500 + 800; // Daily milk sales
    const dailyGheeSales = Math.random() * 200 + 40;    // Daily ghee sales
    const dailyPashuAaharSales = Math.random() * 150 + 20; // Daily pashu aahar sales
    const dailyCostOfGoodsSold = Math.random() * 1200 + 600; // Daily milk purchases

    totalMilkSales += dailyMilkSales;
    totalGheeSales += dailyGheeSales;
    totalPashuAaharSales += dailyPashuAaharSales;
    totalCostOfGoodsSold += dailyCostOfGoodsSold;
    
    const dailyRevenue = dailyMilkSales + dailyGheeSales + dailyPashuAaharSales;
    const dailyGrossProfit = dailyRevenue - dailyCostOfGoodsSold;
    // Simulate daily operating expenses, e.g., 10% of daily revenue + some fixed daily cost
    const dailyOperatingExpenses = (dailyRevenue * 0.10) + (Math.random() * 50 + 50); 
    totalOperatingExpenses += dailyOperatingExpenses;
    
    const dailyNetProfitLoss = dailyGrossProfit - dailyOperatingExpenses;

    chartSeries.push({
      date: format(currentDate, "MMM dd"),
      netProfit: parseFloat(dailyNetProfitLoss.toFixed(2)),
    });
  }
  
  const summaryTotalRevenue = totalMilkSales + totalGheeSales + totalPashuAaharSales;
  const summaryGrossProfit = summaryTotalRevenue - totalCostOfGoodsSold;
  const summaryNetProfitLoss = summaryGrossProfit - totalOperatingExpenses;

  const summary: ProfitLossSummaryData = {
    totalRevenue: parseFloat(summaryTotalRevenue.toFixed(2)),
    milkSales: parseFloat(totalMilkSales.toFixed(2)),
    gheeSales: parseFloat(totalGheeSales.toFixed(2)),
    pashuAaharSales: parseFloat(totalPashuAaharSales.toFixed(2)),
    costOfGoodsSold: parseFloat(totalCostOfGoodsSold.toFixed(2)),
    grossProfit: parseFloat(summaryGrossProfit.toFixed(2)),
    operatingExpenses: parseFloat(totalOperatingExpenses.toFixed(2)),
    netProfitLoss: parseFloat(summaryNetProfitLoss.toFixed(2)),
    periodDays,
  };

  return { summary, chartSeries };
};

const chartConfig = {
  netProfit: { label: "Net Profit/Loss", color: "hsl(var(--chart-1))" }, // Using chart-1 (Saffron)
} satisfies ChartConfig;


export default function ProfitLossPage() {
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
        if (start > end) end = start; 
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
    const data = await getPlData(startDate, endDate);
    setPlData(data);

    const formattedStartDate = format(startDate, "MMM dd, yyyy");
    const formattedEndDate = format(endDate, "MMM dd, yyyy");
    let periodPrefix = "";
     if (filterType === 'daily' && formattedStartDate === formattedEndDate) {
      periodPrefix = "today's";
    } else if (filterType === 'daily') {
       periodPrefix = `for ${formattedStartDate}`;
    } else {
      periodPrefix = `the selected ${filterType}`;
    }
    setDisplayedDateRangeString(
      `Showing data for ${periodPrefix}: ${formattedStartDate}${startDate.getTime() !== endDate.getTime() ? ` - ${formattedEndDate}` : ''}`
    );

    setIsLoading(false);
  }, [calculateDateRange, filterType]); // filterType added as it affects periodPrefix


  useEffect(() => {
    // Initialize custom dates on client mount
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
        description={displayedDateRangeString.replace("Showing data for ", "Financial performance for the period: ")}
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

      {/* P/L Summary Card */}
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
          ) : plData && plData.summary ? (
            <>
              <div>
                <h3 className="text-lg font-semibold text-foreground mb-2">Revenue</h3>
                <div className="space-y-1 pl-4">
                  <div className="flex justify-between"><span>Milk Sales:</span> <span className="font-medium">₹{plData.summary.milkSales.toFixed(2)}</span></div>
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
                <div className="space-y-1 pl-4">
                  <div className="flex justify-between"><span>Milk Purchases:</span> <span className="font-medium">₹{plData.summary.costOfGoodsSold.toFixed(2)}</span></div>
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
                  <div className="flex justify-between"><span>Simulated Expenses:</span> <span className="font-medium">₹{plData.summary.operatingExpenses.toFixed(2)}</span></div>
                   <div className="flex justify-between border-t pt-1 mt-1">
                    <span className="font-semibold">Total Operating Expenses:</span>
                    <span className="font-bold text-chart-4">₹{plData.summary.operatingExpenses.toFixed(2)}</span>
                  </div>
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
            <p className="text-muted-foreground text-center">No data available for the selected period.</p>
          )}
        </CardContent>
      </Card>

      {/* Trend Chart Card */}
      {userRole === "admin" && (
        <Card className="mt-6">
          <CardHeader>
            <CardTitle>Net Profit/Loss Trend</CardTitle>
            <CardDescription>
              {displayedDateRangeString.replace("Showing data for ", "Daily net profit/loss for the period: ")}
            </CardDescription>
          </CardHeader>
          <CardContent className="h-[300px] sm:h-[400px]">
            {isLoading ? (
              <div className="flex items-center justify-center h-full">
                <Skeleton className="h-full w-full" />
              </div>
            ) : plData && plData.chartSeries && plData.chartSeries.length > 0 ? (
              <ChartContainer config={chartConfig} className="w-full h-full">
                <LineChart data={plData.chartSeries} margin={{ top: 5, right: 30, left: 0, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false}/>
                  <XAxis dataKey="date" tickLine={false} axisLine={false} tickMargin={8} />
                  <YAxis 
                    tickLine={false} 
                    axisLine={false} 
                    tickMargin={8} 
                    tickFormatter={(value) => `₹${value >= 1000 || value <= -1000 ? (value / 1000).toFixed(1) + 'k' : value.toFixed(0)}`}
                    allowDecimals={false} 
                  />
                  <Tooltip 
                    content={<ChartTooltipContent 
                      indicator="line" 
                      formatter={(value, name, entry) => {
                        const dataPoint = entry.payload as PlChartDataPoint | undefined;
                        return (
                          <div className="flex flex-col">
                            <span className="text-xs text-muted-foreground">{name} ({dataPoint?.date})</span>
                            <span className="font-bold">₹{Number(value).toFixed(2)}</span>
                          </div>
                        );
                      }}
                    />} 
                  />
                  <Legend />
                  <Line type="monotone" dataKey="netProfit" stroke="var(--color-netProfit)" strokeWidth={2} dot={false} name="Net Profit/Loss" />
                </LineChart>
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
