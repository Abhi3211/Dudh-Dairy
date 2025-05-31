
'use server';

import { db } from '@/lib/firebase';
import type { DailySummary, ChartDataPoint, DashboardData, MilkCollectionEntry, SaleEntry, BulkSaleEntry, PaymentEntry, PurchaseEntry } from '@/lib/types'; // Added PurchaseEntry
import { collection, query, where, getDocs, Timestamp } from 'firebase/firestore';
import { eachDayOfInterval, format, startOfDay, endOfDay } from 'date-fns';

async function getPashuAaharProductNamesFromPurchases(): Promise<string[]> {
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
    console.error("SERVER ACTION (Dashboard): Error fetching Pashu Aahar product names from purchases:", error);
  }
  return Array.from(pashuAaharNames);
}


export async function getDashboardSummaryAndChartData(
  clientStartDate: Date,
  clientEndDate: Date
): Promise<DashboardData> {
  console.log(`SERVER ACTION: getDashboardSummaryAndChartData called for range: ${clientStartDate.toISOString()} to ${clientEndDate.toISOString()}`);

  const startDate = Timestamp.fromDate(startOfDay(clientStartDate));
  const endDate = Timestamp.fromDate(endOfDay(clientEndDate));
  
  const knownPashuAaharProductsLower = (await getPashuAaharProductNamesFromPurchases()).map(name => name.toLowerCase());
  console.log("SERVER ACTION (Dashboard): Fetched known Pashu Aahar product names for sales calculation:", knownPashuAaharProductsLower);


  const summary: DailySummary = {
    milkPurchasedLitres: 0,
    milkPurchasedAmount: 0,
    milkSoldLitres: 0,
    milkSoldAmount: 0,
    bulkMilkSoldLitres: 0,
    bulkMilkSoldAmount: 0,
    gheeSalesAmount: 0,
    pashuAaharSalesAmount: 0,
    totalCashIn: 0,
    totalCreditOut: 0,
    totalOutstandingAmount: 0,
  };

  const daysInRange = eachDayOfInterval({ start: clientStartDate, end: clientEndDate });
  const dailyAggregator: Record<string, { purchasedValue: number; soldValue: number }> = {};
  const partyBalances = new Map<string, number>();

  daysInRange.forEach(day => {
    const formattedDate = format(day, "MMM dd");
    dailyAggregator[formattedDate] = { purchasedValue: 0, soldValue: 0 };
  });

  try {
    // Fetch Milk Collections
    const milkCollectionsQuery = query(
      collection(db, 'milkCollections'),
      where('date', '>=', startDate),
      where('date', '<=', endDate)
    );
    const milkCollectionsSnapshot = await getDocs(milkCollectionsQuery);
    console.log(`SERVER ACTION: Fetched ${milkCollectionsSnapshot.docs.length} milk collection documents.`);

    milkCollectionsSnapshot.forEach(doc => {
      const entry = doc.data() as Omit<MilkCollectionEntry, 'id' | 'date'> & { date: Timestamp };
      summary.milkPurchasedLitres += entry.quantityLtr || 0;
      summary.milkPurchasedAmount += entry.totalAmount || 0;

      const currentPartyBalance = partyBalances.get(entry.customerName) || 0;
      partyBalances.set(entry.customerName, currentPartyBalance - (entry.netAmountPayable || 0));

      if (entry.date) {
        const entryDateStr = format(entry.date.toDate(), "MMM dd");
        if (dailyAggregator[entryDateStr]) {
          dailyAggregator[entryDateStr].purchasedValue += entry.totalAmount || 0;
        }
      }
    });

    // Fetch Sales Entries (Retail Sales)
    const salesEntriesQuery = query(
      collection(db, 'salesEntries'),
      where('date', '>=', startDate),
      where('date', '<=', endDate)
    );
    const salesEntriesSnapshot = await getDocs(salesEntriesQuery);
    console.log(`SERVER ACTION: Fetched ${salesEntriesSnapshot.docs.length} sales entry documents.`);

    salesEntriesSnapshot.forEach(doc => {
      const entry = doc.data() as Omit<SaleEntry, 'id' | 'date'> & { date: Timestamp };
      const productNameLower = (entry.productName || "").toLowerCase();
      const currentSaleAmount = entry.totalAmount || 0;

      if (entry.unit === "Ltr" && productNameLower === "milk") { // More specific for milk
        summary.milkSoldLitres += entry.quantity || 0;
        summary.milkSoldAmount += currentSaleAmount;
      } else if (entry.unit === "Kg" && productNameLower === "ghee") { // More specific for ghee
        summary.gheeSalesAmount += currentSaleAmount;
      } else if (entry.unit === "Bags" && knownPashuAaharProductsLower.includes(productNameLower)) {
        summary.pashuAaharSalesAmount += currentSaleAmount;
      }


      if (entry.paymentType === "Cash") {
        summary.totalCashIn += currentSaleAmount;
      } else if (entry.paymentType === "Credit") {
        summary.totalCreditOut += currentSaleAmount;
        const currentPartyBalance = partyBalances.get(entry.customerName) || 0;
        partyBalances.set(entry.customerName, currentPartyBalance + currentSaleAmount);
      }
      
      if (entry.date) {
        const saleDateStr = format(entry.date.toDate(), "MMM dd");
        if (dailyAggregator[saleDateStr]) {
          dailyAggregator[saleDateStr].soldValue += currentSaleAmount;
        }
      }
    });

    // Fetch Bulk Sales Entries
    const bulkSalesEntriesQuery = query(
      collection(db, 'bulkSalesEntries'),
      where('date', '>=', startDate),
      where('date', '<=', endDate)
    );
    const bulkSalesEntriesSnapshot = await getDocs(bulkSalesEntriesQuery);
    console.log(`SERVER ACTION: Fetched ${bulkSalesEntriesSnapshot.docs.length} bulk sales entry documents.`);

    bulkSalesEntriesSnapshot.forEach(doc => {
        const entry = doc.data() as Omit<BulkSaleEntry, 'id' | 'date'> & { date: Timestamp };
        const currentSaleAmount = entry.totalAmount || 0;

        summary.bulkMilkSoldLitres += entry.quantityLtr || 0;
        summary.bulkMilkSoldAmount += currentSaleAmount;

        if (entry.paymentType === "Cash") {
            summary.totalCashIn += currentSaleAmount;
        } else if (entry.paymentType === "Credit") {
            summary.totalCreditOut += currentSaleAmount;
            const currentPartyBalance = partyBalances.get(entry.customerName) || 0;
            partyBalances.set(entry.customerName, currentPartyBalance + currentSaleAmount);
        }

        if (entry.date) {
            const saleDateStr = format(entry.date.toDate(), "MMM dd");
            if (dailyAggregator[saleDateStr]) {
              dailyAggregator[saleDateStr].soldValue += currentSaleAmount;
            }
        }
    });

    // Fetch Payment Entries
    const paymentEntriesQuery = query(
      collection(db, 'paymentEntries'),
      where('date', '>=', startDate),
      where('date', '<=', endDate)
    );
    const paymentEntriesSnapshot = await getDocs(paymentEntriesQuery);
    console.log(`SERVER ACTION: Fetched ${paymentEntriesSnapshot.docs.length} payment entry documents.`);

    paymentEntriesSnapshot.forEach(doc => {
      const entry = doc.data() as Omit<PaymentEntry, 'id' | 'date'> & { date: Timestamp };
      
      if (entry.partyType === "Customer") { // Payments involving customers affect their balance
        const currentPartyBalance = partyBalances.get(entry.partyName) || 0;
        if (entry.type === "Received") { 
          partyBalances.set(entry.partyName, currentPartyBalance - entry.amount);
          summary.totalCashIn += entry.amount; 
        } else if (entry.type === "Paid") { 
          partyBalances.set(entry.partyName, currentPartyBalance + entry.amount);
        }
      } else if (entry.partyType === "Supplier") { // Payments involving suppliers affect their balance
         const currentPartyBalance = partyBalances.get(entry.partyName) || 0;
         if (entry.type === "Paid") { // Dairy paid the supplier
            partyBalances.set(entry.partyName, currentPartyBalance + entry.amount); // Reduces what dairy owes supplier
         } else if (entry.type === "Received") { // Supplier paid the dairy (e.g. refund)
            partyBalances.set(entry.partyName, currentPartyBalance - entry.amount); // Increases what dairy owes supplier
         }
      }
    });


  } catch (error) {
    console.error("SERVER ACTION: Error fetching dashboard data from Firestore:", error);
    const defaultSummary: DailySummary = {
        milkPurchasedLitres: 0,
        milkPurchasedAmount: 0,
        milkSoldLitres: 0,
        milkSoldAmount: 0,
        bulkMilkSoldLitres: 0,
        bulkMilkSoldAmount: 0,
        gheeSalesAmount: 0,
        pashuAaharSalesAmount: 0,
        totalCashIn: 0,
        totalCreditOut: 0,
        totalOutstandingAmount: 0,
    };
    return { summary: defaultSummary, chartSeries: [] };
  }
  
  let calculatedOutstanding = 0;
  partyBalances.forEach((balance, partyName) => {
    console.log(`SERVER ACTION: Party Balance for ${partyName}: ${balance}`);
    if (balance > 0) { 
      calculatedOutstanding += balance;
    }
  });
  summary.totalOutstandingAmount = parseFloat(calculatedOutstanding.toFixed(2));
  console.log("SERVER ACTION: Calculated outstanding (sum of positive party balances):", summary.totalOutstandingAmount);
  
  const chartSeries: ChartDataPoint[] = daysInRange.map(day => {
    const formattedDate = format(day, "MMM dd");
    return {
      date: formattedDate,
      purchasedValue: parseFloat((dailyAggregator[formattedDate]?.purchasedValue || 0).toFixed(2)),
      soldValue: parseFloat((dailyAggregator[formattedDate]?.soldValue || 0).toFixed(2)),
    };
  });
  
  summary.milkPurchasedLitres = parseFloat(summary.milkPurchasedLitres.toFixed(1));
  summary.milkPurchasedAmount = parseFloat(summary.milkPurchasedAmount.toFixed(2));
  summary.milkSoldLitres = parseFloat(summary.milkSoldLitres.toFixed(1));
  summary.milkSoldAmount = parseFloat(summary.milkSoldAmount.toFixed(2));
  summary.bulkMilkSoldLitres = parseFloat(summary.bulkMilkSoldLitres.toFixed(1));
  summary.bulkMilkSoldAmount = parseFloat(summary.bulkMilkSoldAmount.toFixed(2));
  summary.gheeSalesAmount = parseFloat(summary.gheeSalesAmount.toFixed(2));
  summary.pashuAaharSalesAmount = parseFloat(summary.pashuAaharSalesAmount.toFixed(2));
  summary.totalCashIn = parseFloat(summary.totalCashIn.toFixed(2));
  summary.totalCreditOut = parseFloat(summary.totalCreditOut.toFixed(2));

  console.log("SERVER ACTION: Dashboard data processed. Summary:", JSON.parse(JSON.stringify(summary)), "ChartSeries Length:", chartSeries.length);
  return { summary, chartSeries };
}

    
