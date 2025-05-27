
"use client";

import { useState, useEffect, useCallback } from "react";
import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { DatePicker } from "@/components/ui/date-picker";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { IndianRupee, Milk, Package, TrendingUp, TrendingDown, AlertCircle, CalendarIcon } from "lucide-react";
import { format, subDays, startOfWeek, endOfWeek, startOfMonth, endOfMonth, eachDayOfInterval, parseISO } from "date-fns";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { ChartConfig, ChartContainer, ChartTooltipContent } from "@/components/ui/chart";
import type { DailySummary, ChartDataPoint, DashboardData } from "@/lib/types";
import { Skeleton } from "@/components/ui/skeleton";


// Simulated data fetching function
const getDashboardData = async (startDate: Date, endDate: Date): Promise<DashboardData> => {
  // Simulate API call delay
  await new Promise(resolve => setTimeout(resolve, 500));

  const summary: DailySummary = {
    milkPurchasedLitres: 0,
    milkPurchasedAmount: 0,
    milkSoldLitres: 0,
    milkSoldAmount: 0,
    gheeSalesAmount: 0,
    pashuAaharSalesAmount: 0,
    totalCashIn: 0,
    totalCreditOut: 0,
    totalOutstandingAmount: 12000, // Static for now
  };

  const chartSeries: ChartDataPoint[] = [];
  const days = eachDayOfInterval({ start: startDate, end: endDate });

  days.forEach((day, index) => {
    const dayFactor = (index + 1) / days.length; // Create some variance
    const purchased = Math.random() * 5000 * dayFactor + 2000;
    const sold = Math.random() * 4000 * dayFactor + 3000;

    summary.milkPurchasedAmount += purchased;
    summary.milkSoldAmount += sold;
    summary.milkPurchasedLitres += purchased / 40; // Assuming avg rate 40
    summary.milkSoldLitres += sold / 60;    // Assuming avg rate 60
    summary.gheeSalesAmount += Math.random() * 500 * dayFactor;
    summary.pashuAaharSalesAmount += Math.random() * 300 * dayFactor;
    summary.totalCashIn += sold + summary.gheeSalesAmount + summary.pashuAaharSalesAmount - (Math.random() * 500); // some credit
    summary.totalCreditOut += Math.random() * 500;


    chartSeries.push({
      date: format(day, "MMM dd"),
      purchasedValue: parseFloat(purchased.toFixed(2)),
      soldValue: parseFloat(sold.toFixed(2)),
    });
  });
  
  // Ensure values are rounded for summary
  summary.milkPurchasedLitres = parseFloat(summary.milkPurchasedLitres.toFixed(1));
  summary.milkPurchasedAmount = parseFloat(summary.milkPurchasedAmount.toFixed(2));
  summary.milkSoldLitres = parseFloat(summary.milkSoldLitres.toFixed(1));
  summary.milkSoldAmount = parseFloat(summary.milkSoldAmount.toFixed(2));
  summary.gheeSalesAmount = parseFloat(summary.gheeSalesAmount.toFixed(2));
  summary.pashuAaharSalesAmount = parseFloat(summary.pashuAaharSalesAmount.toFixed(2));
  summary.totalCashIn = parseFloat(summary.totalCashIn.toFixed(2));
  summary.totalCreditOut = parseFloat(summary.totalCreditOut.toFixed(2));


  return { summary, chartSeries };
};


const chartConfig = {
  purchasedValue: { label: "Purchase Value", color: "hsl(var(--chart-4))" }, // Reddish
  soldValue: { label: "Sale Value", color: "hsl(var(--chart-3))" }, // Greenish
} satisfies ChartConfig;


export default function DashboardPage() {
  const [filterType, setFilterType] = useState<string>("daily");
  const [customStartDate, setCustomStartDate] = useState<Date | undefined>(undefined);
  const [customEndDate, setCustomEndDate] = useState<Date | undefined>(undefined);
  
  const [summary, setSummary] = useState<DailySummary | null>(null);
  const [chartData, setChartData] = useState<ChartDataPoint[]>([]);
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
        start = startOfWeek(today, { weekStartsOn: 1 }); // Monday
        end = endOfWeek(today, { weekStartsOn: 1 }); // Sunday
        break;
      case "monthly":
        start = startOfMonth(today);
        end = endOfMonth(today);
        break;
      case "custom":
        start = customStartDate || subDays(today, 7); // Fallback for initial undefined state
        end = customEndDate || today; // Fallback for initial undefined state
        break;
    }
     // Ensure endDate is not before startDate for custom ranges if dates are set
    if (filterType === 'custom' && start && end && end < start) {
        end = start;
    }
    return { startDate: start, endDate: end };
  }, [filterType, customStartDate, customEndDate]);

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    const { startDate, endDate } = calculateDateRange();
    
    const data = await getDashboardData(startDate, endDate);
    setSummary(data.summary);
    setChartData(data.chartSeries);

    const formattedStartDate = format(startDate, "MMM dd, yyyy");
    const formattedEndDate = format(endDate, "MMM dd, yyyy");
    let periodPrefix = "";
    if (filterType === 'daily' && formattedStartDate === formattedEndDate) {
      periodPrefix = "today";
    } else if (filterType === 'daily') {
       periodPrefix = `for ${formattedStartDate}`;
    } else {
      periodPrefix = `the selected ${filterType}`;
    }
    setDisplayedDateRangeString(
      `Showing ${periodPrefix} period: ${formattedStartDate} - ${formattedEndDate}`
    );

    setIsLoading(false);
  }, [calculateDateRange, filterType]);

  useEffect(() => {
    // Initialize custom dates on client mount if they are undefined
    // This helps prevent hydration issues with new Date()
    if (customStartDate === undefined) {
      setCustomStartDate(subDays(new Date(), 7));
    }
    if (customEndDate === undefined) {
      setCustomEndDate(new Date());
    }
    // Fetch data once custom dates are potentially set, or if filterType changes
  }, []); // Runs once on mount


  useEffect(() => {
    // Only fetch if custom dates are set when filterType is custom, or for other filter types
    if (filterType === 'custom' && (!customStartDate || !customEndDate)) {
      return; // Don't fetch if custom dates are not ready
    }
    fetchData();
  }, [fetchData, filterType, customStartDate, customEndDate]); // Added customStartDate and customEndDate here too

  const summaryItems = summary ? [
    { title: "Milk Purchased (Ltr)", value: summary.milkPurchasedLitres.toFixed(1), icon: Milk, unit: "Ltr" },
    { title: "Milk Purchased (Value)", value: summary.milkPurchasedAmount.toFixed(2), icon: IndianRupee, unit: "₹" },
    { title: "Milk Sold (Ltr)", value: summary.milkSoldLitres.toFixed(1), icon: Milk, unit: "Ltr" },
    { title: "Milk Sold (Value)", value: summary.milkSoldAmount.toFixed(2), icon: IndianRupee, unit: "₹" },
    { title: "Ghee Sales", value: summary.gheeSalesAmount.toFixed(2), icon: Package, unit: "₹" },
    { title: "Pashu Aahar Sales", value: summary.pashuAaharSalesAmount.toFixed(2), icon: Package, unit: "₹" },
    { title: "Total Cash In", value: summary.totalCashIn.toFixed(2), icon: TrendingUp, unit: "₹" },
    { title: "Total Credit Out", value: summary.totalCreditOut.toFixed(2), icon: TrendingDown, unit: "₹" },
    { title: "Total Outstanding", value: summary.totalOutstandingAmount.toFixed(2), icon: AlertCircle, unit: "₹", highlight: true },
  ] : [];

  return (
    <div>
      <PageHeader title="Summary Dashboard" description="Overview of dairy operations." />
      
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="text-lg">Filter Data</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col sm:flex-row gap-4 items-end">
          <div className="flex-1 min-w-[150px]">
            <Label htmlFor="filterType">Period</Label>
            <Select value={filterType} onValueChange={setFilterType}>
              <SelectTrigger id="filterType">
                <SelectValue placeholder="Select period" />
              </SelectTrigger>
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

      {isLoading ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 mb-6">
          {Array(9).fill(0).map((_, index) => (
            <Card key={index}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <Skeleton className="h-4 w-3/5" /> <Skeleton className="h-5 w-5 rounded-full" />
              </CardHeader>
              <CardContent><Skeleton className="h-8 w-4/5" /></CardContent>
            </Card>
          ))}
        </div>
      ) : summary ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 mb-6">
          {summaryItems.map((item) => (
            <Card key={item.title} className={item.highlight ? "border-primary shadow-lg" : "shadow-sm"}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">{item.title}</CardTitle>
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
      ) : (
         <p className="text-muted-foreground text-center mb-6">No summary data available for the selected period.</p>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Purchase vs. Sale Value Trends</CardTitle>
          <CardDescription>
            {displayedDateRangeString}
          </CardDescription>
        </CardHeader>
        <CardContent className="h-[300px] sm:h-[400px]">
          {isLoading ? (
            <div className="flex items-center justify-center h-full">
               <Skeleton className="h-full w-full" />
            </div>
          ) : chartData.length > 0 ? (
            <ChartContainer config={chartConfig} className="w-full h-full">
              <LineChart data={chartData} margin={{ top: 5, right: 20, left: -10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false}/>
                <XAxis dataKey="date" tickLine={false} axisLine={false} tickMargin={8} tickFormatter={(value) => value} />
                <YAxis tickLine={false} axisLine={false} tickMargin={8} tickFormatter={(value) => `₹${value / 1000}k`} />
                <Tooltip content={<ChartTooltipContent indicator="line" />} />
                <Legend />
                <Line type="monotone" dataKey="purchasedValue" stroke="var(--color-purchasedValue)" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="soldValue" stroke="var(--color-soldValue)" strokeWidth={2} dot={false} />
              </LineChart>
            </ChartContainer>
          ) : (
             <div className="flex items-center justify-center h-full">
                <p className="text-muted-foreground">No chart data available for the selected period.</p>
             </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
