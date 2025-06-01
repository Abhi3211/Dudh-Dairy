
"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useRouter }  from "next/navigation";
import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { DatePicker } from "@/components/ui/date-picker";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { IndianRupee, Milk, Package, TrendingUp, TrendingDown, Truck, HandCoins } from "lucide-react";
import { format, subDays, startOfWeek, endOfWeek, startOfMonth, endOfMonth } from "date-fns";
import { ChartConfig, ChartContainer, ChartTooltipContent } from "@/components/ui/chart";
import type { DailySummary, ChartDataPoint, DashboardData } from "@/lib/types";
import { Skeleton } from "@/components/ui/skeleton";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { getDashboardSummaryAndChartData } from "./dashboard/actions";
import { usePageTitle } from '@/context/PageTitleContext';
import { useUserSession } from "@/context/UserSessionContext";

const chartConfig = {
  purchasedValue: { label: "Purchase Value", color: "hsl(var(--chart-4))" }, 
  soldValue: { label: "Sale Value", color: "hsl(var(--chart-3))" }, 
} satisfies ChartConfig;

export default function DashboardPage() {
  const { setPageTitle } = usePageTitle();
  const pageSpecificTitle = "Summary Dashboard";
  
  const router = useRouter();
  const { firebaseUser, authLoading, userProfile } = useUserSession();

  useEffect(() => {
    setPageTitle(pageSpecificTitle);
  }, [setPageTitle, pageSpecificTitle]);

  const [filterType, setFilterType] = useState<string>("daily");
  const [customStartDate, setCustomStartDate] = useState<Date | undefined>(undefined);
  const [customEndDate, setCustomEndDate] = useState<Date | undefined>(undefined);
  
  const [summary, setSummary] = useState<DailySummary | null>(null);
  const [chartData, setChartData] = useState<ChartDataPoint[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [displayedDateRangeString, setDisplayedDateRangeString] = useState<string>("Loading date range...");

  useEffect(() => {
    if (!authLoading && !firebaseUser) {
      router.replace("/login");
    }
  }, [firebaseUser, authLoading, router]);

  const calculateDateRange = useCallback(() => {
    const today = new Date();
    let start = customStartDate !== undefined ? customStartDate : today;
    let end = customEndDate !== undefined ? customEndDate : today;

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
    if (filterType === 'custom' && start && end && end < start) {
        end = start;
    }
    return { startDate: start, endDate: end };
  }, [filterType, customStartDate, customEndDate]);

  const fetchData = useCallback(async () => {
    if (authLoading || !firebaseUser) {
      setIsLoading(false);
      return;
    }

    console.log("CLIENT: fetchData called. filterType:", filterType);
    setIsLoading(true);
    
    const { startDate, endDate } = calculateDateRange();
    
    if (!startDate || !endDate) {
        console.warn("CLIENT: fetchData - startDate or endDate is undefined, skipping fetch.");
        setIsLoading(false);
        setDisplayedDateRangeString("Please select a valid date range.");
        setSummary(null);
        setChartData([]);
        return;
    }

    console.log(`CLIENT: Fetching data for range: ${startDate.toISOString()} to ${endDate.toISOString()}`);
    try {
      const data: DashboardData = await getDashboardSummaryAndChartData(startDate, endDate);
      console.log("CLIENT: Data received from server action:", data);
      setSummary(data.summary);
      setChartData(data.chartSeries);
    } catch (error) {
      console.error("CLIENT: Error fetching dashboard data:", error);
      setSummary(null);
      setChartData([]);
    }

    const formattedStartDate = format(startDate, "MMM dd, yyyy");
    const formattedEndDate = format(endDate, "MMM dd, yyyy");
    let periodPrefix = "";
    if (filterType === 'daily' && format(startDate, 'yyyy-MM-dd') === format(new Date(), 'yyyy-MM-dd') ) {
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
  }, [calculateDateRange, filterType, authLoading, firebaseUser]); 

  useEffect(() => {
    if (customStartDate === undefined) {
      setCustomStartDate(subDays(new Date(), 7));
    }
    if (customEndDate === undefined) {
      setCustomEndDate(new Date());
    }
  }, []); 

  useEffect(() => {
    if (filterType === 'custom' && (customStartDate === undefined || customEndDate === undefined)) {
      return;
    }
    if (!authLoading && firebaseUser) { 
        fetchData();
    } else if (!authLoading && !firebaseUser) { 
        setSummary(null);
        setChartData([]);
        setIsLoading(false);
        setDisplayedDateRangeString("Please log in to view data.");
    }
  }, [fetchData, filterType, customStartDate, customEndDate, firebaseUser, authLoading]); 

  const summaryItems = useMemo(() => {
    if (!summary) return [];
    const items = [
      { title: "Milk Purchased (Ltr)", value: summary.milkPurchasedLitres.toFixed(1), icon: Milk, unit: "Ltr" },
      { title: "Milk Purchased (Value)", value: summary.milkPurchasedAmount.toFixed(2), icon: IndianRupee, unit: "₹" },
      { title: "Retail Milk Sold (Ltr)", value: summary.milkSoldLitres.toFixed(1), icon: Milk, unit: "Ltr" },
      { title: "Retail Milk Sold (Value)", value: summary.milkSoldAmount.toFixed(2), icon: IndianRupee, unit: "₹" },
      { title: "Bulk Milk Sold (Ltr)", value: summary.bulkMilkSoldLitres.toFixed(1), icon: Truck, unit: "Ltr" },
      { title: "Bulk Milk Sold (Value)", value: summary.bulkMilkSoldAmount.toFixed(2), icon: IndianRupee, unit: "₹" },
      { title: "Ghee Sales", value: summary.gheeSalesAmount.toFixed(2), icon: Package, unit: "₹" },
      { title: "Pashu Aahar Sales", value: summary.pashuAaharSalesAmount.toFixed(2), icon: Package, unit: "₹" },
      { title: "Total Cash In", value: summary.totalCashIn.toFixed(2), icon: TrendingUp, unit: "₹" },
      { title: "Total Credit Out", value: summary.totalCreditOut.toFixed(2), icon: TrendingDown, unit: "₹" },
      { title: "Net Party Dues", value: summary.netPartyDues.toFixed(2), icon: HandCoins, unit: "₹" , highlight: summary.netPartyDues < 0},
    ];
    return items;
  }, [summary]);

  if (authLoading) {
    return <div className="flex justify-center items-center min-h-screen"><p>Loading user session...</p></div>;
  }

  if (!firebaseUser) {
     return <div className="flex justify-center items-center min-h-screen"><p>Redirecting to login...</p></div>;
  }

  return (
    <div>
      <PageHeader description={`${userProfile?.displayName ? `Welcome, ${userProfile.displayName}! ` : ''}${displayedDateRangeString}`} />
      
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
                <SelectItem value="daily">Daily (Today)</SelectItem>
                <SelectItem value="weekly">Weekly (This Week)</SelectItem>
                <SelectItem value="monthly">Monthly (This Month)</SelectItem>
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
          {Array(11).fill(0).map((_, index) => ( 
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
            <Card key={item.title} className={item.highlight ? "border-destructive shadow-lg" : "shadow-sm"}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">{item.title}</CardTitle>
                <item.icon className={`h-5 w-5 ${item.highlight ? 'text-destructive' : 'text-muted-foreground'}`} />
              </CardHeader>
              <CardContent>
                <div className={`text-2xl font-bold ${item.highlight ? 'text-destructive' : 'text-foreground'}`}>
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
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData} margin={{ top: 5, right: 20, left: -10, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false}/>
                  <XAxis dataKey="date" tickLine={false} axisLine={false} tickMargin={8} tickFormatter={(value) => value} />
                  <YAxis tickLine={false} axisLine={false} tickMargin={8} tickFormatter={(value) => `₹${value / 1000}k`} />
                  <Tooltip content={<ChartTooltipContent indicator="line" />} />
                  <Legend />
                  <Line type="monotone" dataKey="purchasedValue" stroke="var(--color-purchasedValue)" strokeWidth={2} dot={false} name="Purchase Value" />
                  <Line type="monotone" dataKey="soldValue" stroke="var(--color-soldValue)" strokeWidth={2} dot={false} name="Sale Value" />
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
    </div>
  );
}

