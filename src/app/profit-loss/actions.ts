
'use server';

import { db } from '@/lib/firebase';
import type { FullProfitLossData, ProfitLossSummaryData, PlChartDataPoint, SaleEntry, BulkSaleEntry, MilkCollectionEntry, PurchaseEntry } from '@/lib/types';
import { collection, query, where, getDocs, Timestamp } from 'firebase/firestore';
import { startOfDay, endOfDay, eachDayOfInterval, format, differenceInDays, addDays } from 'date-fns';

async function getPashuAaharProductNamesFromPurchasesForPL(): Promise<string[]> {
  const pashuAaharNames = new Set<string>();
  try {
    const purchasesCollection = collection(db, 'purchaseEntries');
    const q = query(purchasesCollection, where('category', '==', 'Pashu Aahar'));
    const snapshot = await getDocs(q);
    snapshot.forEach(doc => {
      const data = doc.data() as PurchaseEntry;
      if (data.productName) {
        pashuAaharNames.add(data.productName.toLowerCase());
      }
    });
  } catch (error) {
    console.error("SERVER ACTION (P&L): Error fetching Pashu Aahar product names from purchases:", error);
  }
  return Array.from(pashuAaharNames);
}


export async function getProfitLossDataFromFirestore(
  clientStartDate: Date,
  clientEndDate: Date
): Promise<FullProfitLossData> {
  console.log(`SERVER ACTION (P&L): getProfitLossDataFromFirestore called for range: ${clientStartDate.toISOString()} to ${clientEndDate.toISOString()}`);

  const startDate = Timestamp.fromDate(startOfDay(clientStartDate));
  const endDateTimestamp = Timestamp.fromDate(endOfDay(clientEndDate));

  const summary: ProfitLossSummaryData = {
    totalRevenue: 0,
    milkSalesRetail: 0,
    milkSalesBulk: 0,
    gheeSales: 0,
    pashuAaharSales: 0,
    costOfGoodsSold: 0,
    cogsMilk: 0,
    cogsGhee: 0,
    cogsPashuAahar: 0,
    grossProfit: 0,
    operatingExpenses: 0, // Placeholder for now
    netProfitLoss: 0,
    periodDays: Math.max(1, differenceInDays(endOfDay(clientEndDate), startOfDay(clientStartDate)) + 1),
  };

  const daysInRange = eachDayOfInterval({ start: startOfDay(clientStartDate), end: endOfDay(clientEndDate) });
  const dailyAggregator: Record<string, { revenue: number; cogs: number; netProfit: number }> = {};

  daysInRange.forEach(day => {
    const formattedDate = format(day, "MMM dd");
    dailyAggregator[formattedDate] = { revenue: 0, cogs: 0, netProfit: 0 };
  });
  
  const knownPashuAaharProductsLower = (await getPashuAaharProductNamesFromPurchasesForPL()).map(name => name.toLowerCase());
  console.log("SERVER ACTION (P&L): Fetched known Pashu Aahar product names for P&L:", knownPashuAaharProductsLower);


  try {
    // Revenue: Retail Sales
    const salesEntriesQuery = query(
      collection(db, 'salesEntries'),
      where('date', '>=', startDate),
      where('date', '<=', endDateTimestamp)
    );
    const salesEntriesSnapshot = await getDocs(salesEntriesQuery);
    salesEntriesSnapshot.forEach(doc => {
      const entry = doc.data() as Omit<SaleEntry, 'id' | 'date'> & { date: Timestamp };
      const saleAmount = entry.totalAmount || 0;
      summary.totalRevenue += saleAmount;
      
      const saleDate = entry.date.toDate();
      const formattedSaleDate = format(saleDate, "MMM dd");
      if (dailyAggregator[formattedSaleDate]) {
        dailyAggregator[formattedSaleDate].revenue += saleAmount;
      }

      const productNameLower = (entry.productName || "").toLowerCase();
      if (entry.unit === "Ltr" && productNameLower === "milk") {
        summary.milkSalesRetail += saleAmount;
      } else if (entry.unit === "Kg" && productNameLower === "ghee") {
        summary.gheeSales += saleAmount;
      } else if (entry.unit === "Bags" && knownPashuAaharProductsLower.includes(productNameLower)) {
        summary.pashuAaharSales += saleAmount;
      }
    });

    // Revenue: Bulk Sales
    const bulkSalesEntriesQuery = query(
      collection(db, 'bulkSalesEntries'),
      where('date', '>=', startDate),
      where('date', '<=', endDateTimestamp)
    );
    const bulkSalesEntriesSnapshot = await getDocs(bulkSalesEntriesQuery);
    bulkSalesEntriesSnapshot.forEach(doc => {
      const entry = doc.data() as Omit<BulkSaleEntry, 'id' | 'date'> & { date: Timestamp };
      const saleAmount = entry.totalAmount || 0;
      summary.totalRevenue += saleAmount;
      summary.milkSalesBulk += saleAmount;
      
      const saleDate = entry.date.toDate();
      const formattedSaleDate = format(saleDate, "MMM dd");
      if (dailyAggregator[formattedSaleDate]) {
        dailyAggregator[formattedSaleDate].revenue += saleAmount;
      }
    });

    // COGS: Milk Collections
    const milkCollectionsQuery = query(
      collection(db, 'milkCollections'),
      where('date', '>=', startDate),
      where('date', '<=', endDateTimestamp)
    );
    const milkCollectionsSnapshot = await getDocs(milkCollectionsQuery);
    milkCollectionsSnapshot.forEach(doc => {
      const entry = doc.data() as Omit<MilkCollectionEntry, 'id' | 'date'> & { date: Timestamp };
      const costAmount = entry.totalAmount || 0; // Net amount payable might be better for direct costs
      summary.cogsMilk += costAmount;
      summary.costOfGoodsSold += costAmount;

      const collectionDate = entry.date.toDate();
      const formattedCollectionDate = format(collectionDate, "MMM dd");
      if (dailyAggregator[formattedCollectionDate]) {
        dailyAggregator[formattedCollectionDate].cogs += costAmount;
      }
    });

    // COGS: Purchases (for Ghee and Pashu Aahar)
    const purchaseEntriesQuery = query(
        collection(db, 'purchaseEntries'),
        where('date', '>=', startDate),
        where('date', '<=', endDateTimestamp)
    );
    const purchaseEntriesSnapshot = await getDocs(purchaseEntriesQuery);
    purchaseEntriesSnapshot.forEach(doc => {
        const entry = doc.data() as Omit<PurchaseEntry, 'id' | 'date'> & { date: Timestamp };
        const purchaseAmount = entry.totalAmount || 0;
        const categoryLower = (entry.category || "").toLowerCase();
        const productNameLower = (entry.productName || "").toLowerCase();
        let costAttributed = false;

        if (categoryLower === "ghee" || (entry.unit === "Kg" && productNameLower === "ghee") ) {
            summary.cogsGhee += purchaseAmount;
            summary.costOfGoodsSold += purchaseAmount;
            costAttributed = true;
        } else if (categoryLower === "pashu aahar" || (entry.unit === "Bags" && knownPashuAaharProductsLower.includes(productNameLower))) {
            summary.cogsPashuAahar += purchaseAmount;
            summary.costOfGoodsSold += purchaseAmount;
            costAttributed = true;
        }
        
        if(costAttributed) {
            const purchaseDate = entry.date.toDate();
            const formattedPurchaseDate = format(purchaseDate, "MMM dd");
            if (dailyAggregator[formattedPurchaseDate]) {
                dailyAggregator[formattedPurchaseDate].cogs += purchaseAmount;
            }
        }
    });

    // COGS: Specific Expenses - Currently, operatingExpenses are 0.
    // If a specific expense category was directly tied to COGS, it would be added here.


  } catch (error) {
    console.error("SERVER ACTION (P&L): Error fetching P&L data from Firestore:", error);
    // Return empty/zeroed summary if error
    const errorSummary: FullProfitLossData = {
      summary: {
        totalRevenue: 0, milkSalesRetail: 0, milkSalesBulk: 0, gheeSales: 0, pashuAaharSales: 0,
        costOfGoodsSold: 0, cogsMilk: 0, cogsGhee: 0, cogsPashuAahar: 0,
        grossProfit: 0, operatingExpenses: 0, netProfitLoss: 0, periodDays: 0,
      },
      chartSeries: []
    };
    return errorSummary;
  }

  summary.grossProfit = summary.totalRevenue - summary.costOfGoodsSold;
  // summary.netProfitLoss = summary.grossProfit - summary.operatingExpenses; // Since operatingExpenses is 0

  // Calculate daily net profit for chart
  daysInRange.forEach(day => {
    const formattedDate = format(day, "MMM dd");
    const dailyData = dailyAggregator[formattedDate];
    if (dailyData) {
      // For now, assume daily operating expenses are 0 for chart simplicity
      dailyData.netProfit = dailyData.revenue - dailyData.cogs; 
    }
  });

  const chartSeries: PlChartDataPoint[] = daysInRange.map(day => {
    const formattedDate = format(day, "MMM dd");
    return {
      date: formattedDate,
      netProfit: parseFloat((dailyAggregator[formattedDate]?.netProfit || 0).toFixed(2)),
    };
  });
  
  // Final overall net profit (summary.operatingExpenses is 0)
  summary.netProfitLoss = summary.grossProfit - summary.operatingExpenses;


  // Round final summary figures
  summary.totalRevenue = parseFloat(summary.totalRevenue.toFixed(2));
  summary.milkSalesRetail = parseFloat(summary.milkSalesRetail.toFixed(2));
  summary.milkSalesBulk = parseFloat(summary.milkSalesBulk.toFixed(2));
  summary.gheeSales = parseFloat(summary.gheeSales.toFixed(2));
  summary.pashuAaharSales = parseFloat(summary.pashuAaharSales.toFixed(2));
  summary.costOfGoodsSold = parseFloat(summary.costOfGoodsSold.toFixed(2));
  summary.cogsMilk = parseFloat(summary.cogsMilk.toFixed(2));
  summary.cogsGhee = parseFloat(summary.cogsGhee.toFixed(2));
  summary.cogsPashuAahar = parseFloat(summary.cogsPashuAahar.toFixed(2));
  summary.grossProfit = parseFloat(summary.grossProfit.toFixed(2));
  summary.operatingExpenses = parseFloat(summary.operatingExpenses.toFixed(2));
  summary.netProfitLoss = parseFloat(summary.netProfitLoss.toFixed(2));


  console.log("SERVER ACTION (P&L): P&L data processed. Summary:", JSON.parse(JSON.stringify(summary)), "ChartSeries Length:", chartSeries.length);
  return { summary, chartSeries };
}
