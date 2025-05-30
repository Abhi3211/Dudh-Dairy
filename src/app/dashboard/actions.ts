
'use server';

import { db } from '@/lib/firebase';
import type { DailySummary, ChartDataPoint, DashboardData, MilkCollectionEntry, SaleEntry, BulkSaleEntry, PaymentEntry } from '@/lib/types';
import { collection, query, where, getDocs, Timestamp } from 'firebase/firestore';
import { eachDayOfInterval, format, startOfDay, endOfDay } from 'date-fns';

// This list should ideally be shared or managed centrally if used in multiple places
const knownPashuAaharProducts: string[] = [
  "Gold Coin Feed",
  "Super Pallet",
  "Nutri Plus Feed",
  "Kisan Special Churi",
  "Dairy Delight Mix",
];

export async function getDashboardSummaryAndChartData(
  clientStartDate: Date,
  clientEndDate: Date
): Promise<DashboardData> {
  console.log(`SERVER ACTION: getDashboardSummaryAndChartData called for range: ${clientStartDate.toISOString()} to ${clientEndDate.toISOString()}`);

  const startDate = Timestamp.fromDate(startOfDay(clientStartDate));
  const endDate = Timestamp.fromDate(endOfDay(clientEndDate));

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
      // Dairy owes the customer for milk, so this reduces what customer owes dairy, or increases dairy's liability
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

      if (productNameLower === "milk") {
        summary.milkSoldLitres += entry.quantity || 0;
        summary.milkSoldAmount += currentSaleAmount;
      } else if (productNameLower === "ghee") {
        summary.gheeSalesAmount += currentSaleAmount;
      } else if (productNameLower.includes("pashu aahar") || knownPashuAaharProducts.some(p => productNameLower === p.toLowerCase())) {
        summary.pashuAaharSalesAmount += currentSaleAmount;
      }

      if (entry.paymentType === "Cash") {
        summary.totalCashIn += currentSaleAmount;
      } else if (entry.paymentType === "Credit") {
        summary.totalCreditOut += currentSaleAmount;
        const currentPartyBalance = partyBalances.get(entry.customerName) || 0;
        // Customer owes dairy for credit sale
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
            // Customer owes dairy for credit bulk sale
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
      // We only care about payments involving "Customer" type parties for "Total Outstanding" (receivables)
      if (entry.partyType === "Customer") {
        const currentPartyBalance = partyBalances.get(entry.partyName) || 0;
        if (entry.type === "Received") { // Customer paid the dairy
          partyBalances.set(entry.partyName, currentPartyBalance - entry.amount);
          summary.totalCashIn += entry.amount; // Assuming all received payments are cash in for this summary
        } else if (entry.type === "Paid") { // Dairy paid the customer (e.g. refund, advance settlement)
          partyBalances.set(entry.partyName, currentPartyBalance + entry.amount);
          // This payment 'paid' by dairy would also be an expense or reduction of liability,
          // but totalCashIn and totalCreditOut are more about sales transactions directly.
          // For simplicity, we are not directly adjusting totalCreditOut for "Paid" payments here,
          // as it might overcomplicate the summary without full ledger context.
        }
      }
      // Note: totalCashIn for payments is only if type is "Received". If it's cash paid out by dairy,
      // it would be an expense or cash outflow, not directly affecting totalCashIn from sales.
      // The current logic updates totalCashIn for "Received" payments if party is Customer.
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
  for (const balance of partyBalances.values()) {
    if (balance > 0) { // Only sum positive balances (what customers owe the dairy)
      calculatedOutstanding += balance;
    }
  }
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

    