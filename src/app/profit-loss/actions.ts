
'use server';

import { db } from '@/lib/firebase';
import type { FullProfitLossData, ProfitLossSummaryData, PlChartDataPoint, SaleEntry, BulkSaleEntry, MilkCollectionEntry, PurchaseEntry } from '@/lib/types';
import { collection, query, where, getDocs, Timestamp } from 'firebase/firestore';
import { startOfDay, endOfDay, eachDayOfInterval, format, differenceInDays, addDays, isWithinInterval } from 'date-fns';

async function getPashuAaharProductNamesFromPurchasesForPL(): Promise<string[]> {
  const pashuAaharNames = new Set<string>();
  try {
    const purchasesCollection = collection(db, 'purchaseEntries');
    // Fetch all purchase entries and filter locally if category isn't always set,
    // or rely on productName if category is broad. For now, assuming 'Pashu Aahar' category exists.
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

interface DailyData {
  revenue: number;
  milkCollectionValue: number;
  gheePurchaseValue: number;
  pashuAaharPurchaseValue: number;
  milkSoldLtr: number;
  gheeSoldKg: number;
  pashuAaharSoldBags: Record<string, number>; // productName: quantity
}

interface CumulativeStockData {
  milkCollectedLtr: number;
  milkCollectionCost: number;
  gheePurchasedKg: number;
  gheePurchaseCost: number;
  pashuAaharPurchasedBags: Record<string, { qty: number; cost: number }>; // productName: {qty, cost}
}

export async function getProfitLossDataFromFirestore(
  clientStartDate: Date,
  clientEndDate: Date
): Promise<FullProfitLossData> {
  console.log(`SERVER ACTION (P&L): getProfitLossDataFromFirestore called for range: ${clientStartDate.toISOString()} to ${clientEndDate.toISOString()}`);

  const periodStart = startOfDay(clientStartDate);
  const periodEnd = endOfDay(clientEndDate);
  const firestoreStartDate = Timestamp.fromDate(periodStart);
  const firestoreEndDate = Timestamp.fromDate(periodEnd);

  const summary: ProfitLossSummaryData = {
    totalRevenue: 0, milkSalesRetail: 0, milkSalesBulk: 0, gheeSales: 0, pashuAaharSales: 0,
    purchasesMilkCollectionValue: 0, purchasesGheeValue: 0, purchasesPashuAaharValue: 0, totalPurchasesValue: 0,
    closingStockValueMilk: 0, closingStockValueGhee: 0, closingStockValuePashuAahar: 0, totalClosingStockValue: 0,
    costOfGoodsSold: 0, grossProfit: 0, operatingExpenses: 0, netProfitLoss: 0,
    periodDays: Math.max(1, differenceInDays(periodEnd, periodStart) + 1),
  };

  const knownPashuAaharProductsLower = (await getPashuAaharProductNamesFromPurchasesForPL()).map(name => name.toLowerCase());

  const daysInRange = eachDayOfInterval({ start: periodStart, end: periodEnd });
  const dailyAggregator: Record<string, DailyData> = {};
  daysInRange.forEach(day => {
    const formattedDate = format(day, "MMM dd");
    dailyAggregator[formattedDate] = { 
        revenue: 0, milkCollectionValue: 0, gheePurchaseValue: 0, pashuAaharPurchaseValue: 0,
        milkSoldLtr: 0, gheeSoldKg: 0, pashuAaharSoldBags: {}
    };
  });

  // Fetch all relevant data for the period
  const salesEntriesSnapshot = await getDocs(query(collection(db, 'salesEntries'), where('date', '>=', firestoreStartDate), where('date', '<=', firestoreEndDate)));
  const bulkSalesEntriesSnapshot = await getDocs(query(collection(db, 'bulkSalesEntries'), where('date', '>=', firestoreStartDate), where('date', '<=', firestoreEndDate)));
  const milkCollectionsSnapshot = await getDocs(query(collection(db, 'milkCollections'), where('date', '>=', firestoreStartDate), where('date', '<=', firestoreEndDate)));
  const purchaseEntriesSnapshot = await getDocs(query(collection(db, 'purchaseEntries'), where('date', '>=', firestoreStartDate), where('date', '<=', firestoreEndDate)));

  // --- Process data for Daily Aggregator and Summary Purchases/Revenue ---
  salesEntriesSnapshot.forEach(doc => {
    const entry = doc.data() as Omit<SaleEntry, 'id'|'date'> & {date: Timestamp};
    const saleDate = entry.date.toDate();
    const formattedSaleDate = format(saleDate, "MMM dd");
    const saleAmount = entry.totalAmount || 0;

    summary.totalRevenue += saleAmount;
    if (dailyAggregator[formattedSaleDate]) dailyAggregator[formattedSaleDate].revenue += saleAmount;

    const productNameLower = (entry.productName || "").toLowerCase();
    if (entry.unit === "Ltr" && productNameLower === "milk") {
      summary.milkSalesRetail += saleAmount;
      if (dailyAggregator[formattedSaleDate]) dailyAggregator[formattedSaleDate].milkSoldLtr += entry.quantity;
    } else if (entry.unit === "Kg" && productNameLower === "ghee") {
      summary.gheeSales += saleAmount;
      if (dailyAggregator[formattedSaleDate]) dailyAggregator[formattedSaleDate].gheeSoldKg += entry.quantity;
    } else if (entry.unit === "Bags" && knownPashuAaharProductsLower.includes(productNameLower)) {
      summary.pashuAaharSales += saleAmount;
      if (dailyAggregator[formattedSaleDate]) {
        dailyAggregator[formattedSaleDate].pashuAaharSoldBags[entry.productName] = 
          (dailyAggregator[formattedSaleDate].pashuAaharSoldBags[entry.productName] || 0) + entry.quantity;
      }
    }
  });

  bulkSalesEntriesSnapshot.forEach(doc => {
    const entry = doc.data() as Omit<BulkSaleEntry, 'id'|'date'> & {date: Timestamp};
    const saleDate = entry.date.toDate();
    const formattedSaleDate = format(saleDate, "MMM dd");
    const saleAmount = entry.totalAmount || 0;
    summary.totalRevenue += saleAmount;
    summary.milkSalesBulk += saleAmount;
    if (dailyAggregator[formattedSaleDate]) {
        dailyAggregator[formattedSaleDate].revenue += saleAmount;
        dailyAggregator[formattedSaleDate].milkSoldLtr += entry.quantityLtr;
    }
  });

  milkCollectionsSnapshot.forEach(doc => {
    const entry = doc.data() as Omit<MilkCollectionEntry, 'id'|'date'> & {date: Timestamp};
    const collectionDate = entry.date.toDate();
    const formattedCollectionDate = format(collectionDate, "MMM dd");
    const costAmount = entry.totalAmount || 0;
    summary.purchasesMilkCollectionValue += costAmount;
    if (dailyAggregator[formattedCollectionDate]) dailyAggregator[formattedCollectionDate].milkCollectionValue += costAmount;
  });
  
  purchaseEntriesSnapshot.forEach(doc => {
    const entry = doc.data() as Omit<PurchaseEntry, 'id'|'date'> & {date: Timestamp};
    const purchaseDate = entry.date.toDate();
    const formattedPurchaseDate = format(purchaseDate, "MMM dd");
    const purchaseAmount = entry.totalAmount || 0;
    const categoryLower = (entry.category || "").toLowerCase();
    const productNameLower = (entry.productName || "").toLowerCase();

    if (categoryLower === "ghee" || (entry.unit === "Kg" && productNameLower === "ghee")) {
        summary.purchasesGheeValue += purchaseAmount;
        if (dailyAggregator[formattedPurchaseDate]) dailyAggregator[formattedPurchaseDate].gheePurchaseValue += purchaseAmount;
    } else if (categoryLower === "pashu aahar" || (entry.unit === "Bags" && knownPashuAaharProductsLower.includes(productNameLower))) {
        summary.purchasesPashuAaharValue += purchaseAmount;
        if (dailyAggregator[formattedPurchaseDate]) dailyAggregator[formattedPurchaseDate].pashuAaharPurchaseValue += purchaseAmount;
    }
  });
  summary.totalPurchasesValue = summary.purchasesMilkCollectionValue + summary.purchasesGheeValue + summary.purchasesPashuAaharValue;

  // --- Calculate Closing Stock Value for Summary ---
  let cumulativeStock: CumulativeStockData = {
    milkCollectedLtr: 0, milkCollectionCost: 0,
    gheePurchasedKg: 0, gheePurchaseCost: 0,
    pashuAaharPurchasedBags: {}
  };

  // Accumulate all purchases within the period
  milkCollectionsSnapshot.forEach(doc => {
    const data = doc.data() as MilkCollectionEntry;
    cumulativeStock.milkCollectedLtr += data.quantityLtr;
    cumulativeStock.milkCollectionCost += data.totalAmount;
  });
  purchaseEntriesSnapshot.forEach(doc => {
    const data = doc.data() as PurchaseEntry;
    const pName = data.productName.trim();
    if (data.category === "Ghee" || (data.unit === "Kg" && data.productName.toLowerCase() === "ghee")) {
        cumulativeStock.gheePurchasedKg += data.quantity;
        cumulativeStock.gheePurchaseCost += data.totalAmount;
    } else if (data.category === "Pashu Aahar" || (data.unit === "Bags" && knownPashuAaharProductsLower.includes(data.productName.toLowerCase()))) {
        if (!cumulativeStock.pashuAaharPurchasedBags[pName]) cumulativeStock.pashuAaharPurchasedBags[pName] = { qty: 0, cost: 0 };
        cumulativeStock.pashuAaharPurchasedBags[pName].qty += data.quantity;
        cumulativeStock.pashuAaharPurchasedBags[pName].cost += data.totalAmount;
    }
  });

  // Sum all sales within the period
  let totalMilkSoldLtr = 0;
  let totalGheeSoldKg = 0;
  const totalPashuAaharSoldBags: Record<string, number> = {};

  salesEntriesSnapshot.forEach(doc => {
    const data = doc.data() as SaleEntry;
    const pNameLower = data.productName.toLowerCase();
    if (data.unit === "Ltr" && pNameLower === "milk") totalMilkSoldLtr += data.quantity;
    else if (data.unit === "Kg" && pNameLower === "ghee") totalGheeSoldKg += data.quantity;
    else if (data.unit === "Bags" && knownPashuAaharProductsLower.includes(pNameLower)) {
        totalPashuAaharSoldBags[data.productName] = (totalPashuAaharSoldBags[data.productName] || 0) + data.quantity;
    }
  });
  bulkSalesEntriesSnapshot.forEach(doc => {
    const data = doc.data() as BulkSaleEntry;
    totalMilkSoldLtr += data.quantityLtr;
  });
  
  // Milk Closing Stock
  const remainingMilkLtr = Math.max(0, cumulativeStock.milkCollectedLtr - totalMilkSoldLtr);
  const avgMilkCost = cumulativeStock.milkCollectedLtr > 0 ? cumulativeStock.milkCollectionCost / cumulativeStock.milkCollectedLtr : 0;
  summary.closingStockValueMilk = remainingMilkLtr * avgMilkCost;

  // Ghee Closing Stock
  const remainingGheeKg = Math.max(0, cumulativeStock.gheePurchasedKg - totalGheeSoldKg);
  const avgGheeCost = cumulativeStock.gheePurchasedKg > 0 ? cumulativeStock.gheePurchaseCost / cumulativeStock.gheePurchasedKg : 0;
  summary.closingStockValueGhee = remainingGheeKg * avgGheeCost;
  
  // Pashu Aahar Closing Stock
  Object.keys(cumulativeStock.pashuAaharPurchasedBags).forEach(pName => {
    const purchased = cumulativeStock.pashuAaharPurchasedBags[pName];
    const soldQty = totalPashuAaharSoldBags[pName] || 0;
    const remainingQty = Math.max(0, purchased.qty - soldQty);
    const avgCost = purchased.qty > 0 ? purchased.cost / purchased.qty : 0;
    summary.closingStockValuePashuAahar += remainingQty * avgCost;
  });
  summary.totalClosingStockValue = summary.closingStockValueMilk + summary.closingStockValueGhee + summary.closingStockValuePashuAahar;
  
  // Final Summary Calculations
  summary.costOfGoodsSold = summary.totalPurchasesValue - summary.totalClosingStockValue;
  summary.grossProfit = summary.totalRevenue - summary.costOfGoodsSold;
  summary.operatingExpenses = 0; // Still hardcoded
  summary.netProfitLoss = summary.grossProfit - summary.operatingExpenses;

  // --- Calculate Chart Series Data ---
  const chartSeries: PlChartDataPoint[] = [];
  let cumStockMilkLtr = 0, cumStockMilkValue = 0;
  let cumStockGheeKg = 0, cumStockGheeValue = 0;
  const cumStockPashuAahar: Record<string, {qty: number, value: number}> = {}; // productName: {qty, value}

  for (const day of daysInRange) {
    const formattedDate = format(day, "MMM dd");
    const dailyData = dailyAggregator[formattedDate];
    let dailyRevenue = 0;
    let dailyPurchasesValue = 0;
    let dailyCogs = 0;

    if (dailyData) {
      dailyRevenue = dailyData.revenue;
      dailyPurchasesValue = dailyData.milkCollectionValue + dailyData.gheePurchaseValue + dailyData.pashuAaharPurchaseValue;
      
      // Simplified daily COGS for chart: daily purchases - (change in stock value for that day based on daily sales)
      // This is complex to do perfectly daily without full inventory state per day.
      // For now, let's use a simpler daily "profit" for chart: dailyRevenue - dailyPurchases.
      // This won't exactly sum to the summary Net Profit but shows daily operational flow.
      // Or, use a running COGS. Let's refine the daily COGS for chart.

      let dailyChangeInStockValue = 0;

      // Milk stock change for the day
      const milkCollectionsToday = milkCollectionsSnapshot.docs
          .filter(d => format(d.data().date.toDate(), "MMM dd") === formattedDate)
          .reduce((sum, d) => sum + d.data().totalAmount, 0);
      const milkQtyCollectedToday = milkCollectionsSnapshot.docs
          .filter(d => format(d.data().date.toDate(), "MMM dd") === formattedDate)
          .reduce((sum, d) => sum + d.data().quantityLtr, 0);
      
      const milkValueSoldToday = (dailyData.milkSoldLtr * avgMilkCost); // Approx value of milk sold
      const netMilkStockValueChangeToday = milkCollectionsToday - milkValueSoldToday; // If positive, stock value increased
      dailyChangeInStockValue += netMilkStockValueChangeToday;

      // Ghee stock change for the day
      const gheePurchasesToday = purchaseEntriesSnapshot.docs
          .filter(d => format(d.data().date.toDate(), "MMM dd") === formattedDate && (d.data().category === "Ghee" || d.data().productName.toLowerCase() === "ghee"))
          .reduce((sum, d) => sum + d.data().totalAmount, 0);
      const gheeValueSoldToday = (dailyData.gheeSoldKg * avgGheeCost);
      const netGheeStockValueChangeToday = gheePurchasesToday - gheeValueSoldToday;
      dailyChangeInStockValue += netGheeStockValueChangeToday;
      
      // Pashu Aahar stock change for the day
      const pashuAaharPurchasesTodayValue = purchaseEntriesSnapshot.docs
        .filter(d => {
            const purchaseDocDate = d.data().date.toDate();
            const formattedPurchaseDocDate = format(purchaseDocDate, "MMM dd");
            return formattedPurchaseDocDate === formattedDate && 
                   (d.data().category === "Pashu Aahar" || (d.data().unit === "Bags" && knownPashuAaharProductsLower.includes(d.data().productName.toLowerCase())));
        })
        .reduce((sum, d) => sum + d.data().totalAmount, 0);

      let pashuAaharValueSoldToday = 0;
      Object.entries(dailyData.pashuAaharSoldBags).forEach(([pName, soldQty]) => {
          const pAvgCost = (cumulativeStock.pashuAaharPurchasedBags[pName]?.qty > 0) 
              ? cumulativeStock.pashuAaharPurchasedBags[pName].cost / cumulativeStock.pashuAaharPurchasedBags[pName].qty 
              : 0;
          pashuAaharValueSoldToday += soldQty * pAvgCost;
      });
      const netPashuAaharStockValueChangeToday = pashuAaharPurchasesTodayValue - pashuAaharValueSoldToday;
      dailyChangeInStockValue += netPashuAaharStockValueChangeToday;

      // COGS for the day = Purchases - IncreaseInStock OR Purchases + DecreaseInStock
      // COGS = Purchases - (EndingStock - OpeningStock).
      // For simplicity: dailyCOGS = dailyPurchases - (value of sold items based on avg cost) is wrong
      // Correct: dailyCOGS = cost of items sold that day.
      // Value of Milk Sold + Value of Ghee Sold + Value of PA Sold
      dailyCogs = milkValueSoldToday + gheeValueSoldToday + pashuAaharValueSoldToday;


      const dailyNetProfit = dailyRevenue - dailyCogs; // Operating expenses are 0

      chartSeries.push({
        date: formattedDate,
        netProfit: parseFloat(dailyNetProfit.toFixed(2)),
        revenue: parseFloat(dailyRevenue.toFixed(2)),
        cogs: parseFloat(dailyCogs.toFixed(2))
      });
    } else {
       chartSeries.push({ date: formattedDate, netProfit: 0, revenue: 0, cogs: 0 });
    }
  }


  // Round final summary figures
  Object.keys(summary).forEach(key => {
    const K = key as keyof ProfitLossSummaryData;
    if (typeof summary[K] === 'number') {
      (summary[K] as number) = parseFloat((summary[K] as number).toFixed(2));
    }
  });

  console.log("SERVER ACTION (P&L): P&L data processed. Summary:", JSON.parse(JSON.stringify(summary)), "ChartSeries Length:", chartSeries.length);
  return { summary, chartSeries };
}
