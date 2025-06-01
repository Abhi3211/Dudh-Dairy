
'use server';

import { db } from '@/lib/firebase';
import type { DailySummary, ChartDataPoint, DashboardData, MilkCollectionEntry, SaleEntry, BulkSaleEntry, PaymentEntry, PurchaseEntry, Party, UserProfile } from '@/lib/types'; 
import { collection, query, where, getDocs, Timestamp } from 'firebase/firestore';
import { eachDayOfInterval, format, startOfDay, endOfDay, isBefore, isEqual } from 'date-fns';
import { getPartiesFromFirestore } from '../parties/actions'; // This now expects companyId

async function getPashuAaharProductNamesFromPurchases(companyId: string): Promise<string[]> {
  const pashuAaharNames = new Set<string>();
  if (!companyId) return [];
  try {
    const purchasesCollection = collection(db, 'purchaseEntries');
    const q = query(purchasesCollection, where('companyId', '==', companyId), where('category', '==', 'Pashu Aahar'));
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
  clientEndDate: Date,
  companyId: string // Added companyId parameter
): Promise<DashboardData> {
  console.log(`SERVER ACTION (Dashboard): getDashboardSummaryAndChartData called for period: ${clientStartDate.toISOString()} to ${clientEndDate.toISOString()} for company: ${companyId}`);

  const defaultData: DashboardData = {
    summary: {
        milkPurchasedLitres: 0, milkPurchasedAmount: 0, milkSoldLitres: 0, milkSoldAmount: 0,
        bulkMilkSoldLitres: 0, bulkMilkSoldAmount: 0, gheeSalesAmount: 0, pashuAaharSalesAmount: 0,
        totalCashIn: 0, totalCreditOut: 0, netPartyDues: 0,
    },
    chartSeries: []
  };

  if (!companyId) {
    console.warn("SERVER ACTION (Dashboard): companyId is missing. Returning empty data.");
    return defaultData;
  }

  const firestorePeriodStart = Timestamp.fromDate(startOfDay(clientStartDate));
  const firestorePeriodEnd = Timestamp.fromDate(endOfDay(clientEndDate));
  
  const knownPashuAaharProductsLower = (await getPashuAaharProductNamesFromPurchases(companyId)).map(name => name.toLowerCase());
  console.log("SERVER ACTION (Dashboard): Fetched known Pashu Aahar product names for sales calculation:", knownPashuAaharProductsLower);

  const summary: DailySummary = {
    milkPurchasedLitres: 0, milkPurchasedAmount: 0,
    milkSoldLitres: 0, milkSoldAmount: 0,
    bulkMilkSoldLitres: 0, bulkMilkSoldAmount: 0,
    gheeSalesAmount: 0, pashuAaharSalesAmount: 0,
    totalCashIn: 0, totalCreditOut: 0,
    netPartyDues: 0, 
  };

  const daysInRange = eachDayOfInterval({ start: clientStartDate, end: clientEndDate });
  const dailyAggregator: Record<string, { purchasedValue: number; soldValue: number }> = {};
  daysInRange.forEach(day => {
    const formattedDate = format(day, "MMM dd");
    dailyAggregator[formattedDate] = { purchasedValue: 0, soldValue: 0 };
  });

  const allParties = await getPartiesFromFirestore(companyId); // Pass companyId
  console.log(`SERVER ACTION (Dashboard): Fetched ${allParties.length} parties for balance initialization for company ${companyId}.`);
  const partyBalances = new Map<string, number>(); 

  allParties.forEach(party => {
    const numericOpeningBalance = party.openingBalance || 0; 
    const obDate: Date | undefined = party.openingBalanceAsOfDate; 
    
    let initialBalanceForParty = 0; 
    let applyOB = false;

    if (numericOpeningBalance !== 0) {
      if (obDate) {
        if (isBefore(obDate, clientEndDate) || isEqual(startOfDay(obDate), startOfDay(clientEndDate))) {
          applyOB = true;
        }
      } else { 
        applyOB = true;
      }
    }

    if (applyOB) {
      initialBalanceForParty = -numericOpeningBalance; 
    }
    partyBalances.set(party.name, initialBalanceForParty);
  });

  try {
    // Filter all queries by companyId
    const milkCollectionsQuery = query(
      collection(db, 'milkCollections'),
      where('companyId', '==', companyId),
      where('date', '>=', firestorePeriodStart),
      where('date', '<=', firestorePeriodEnd)
    );
    const milkCollectionsSnapshot = await getDocs(milkCollectionsQuery);
    console.log(`SERVER ACTION (Dashboard): Fetched ${milkCollectionsSnapshot.docs.length} milk collection documents for company ${companyId}.`);
    milkCollectionsSnapshot.forEach(doc => {
      const entry = doc.data() as Omit<MilkCollectionEntry, 'id' | 'date'> & { date: Timestamp };
      summary.milkPurchasedLitres += entry.quantityLtr || 0;
      summary.milkPurchasedAmount += entry.totalAmount || 0;
      const netAmountPayable = entry.netAmountPayable || 0; 

      if (partyBalances.has(entry.customerName)) {
        const currentBalance = partyBalances.get(entry.customerName) || 0;
        partyBalances.set(entry.customerName, currentBalance - netAmountPayable); 
      }

      if (entry.date) {
        const entryDateStr = format(entry.date.toDate(), "MMM dd");
        if (dailyAggregator[entryDateStr]) {
          dailyAggregator[entryDateStr].purchasedValue += entry.totalAmount || 0;
        }
      }
    });

    const salesEntriesQuery = query(
      collection(db, 'salesEntries'),
      where('companyId', '==', companyId),
      where('date', '>=', firestorePeriodStart),
      where('date', '<=', firestorePeriodEnd)
    );
    const salesEntriesSnapshot = await getDocs(salesEntriesQuery);
    console.log(`SERVER ACTION (Dashboard): Fetched ${salesEntriesSnapshot.docs.length} sales entry documents for company ${companyId}.`);
    salesEntriesSnapshot.forEach(doc => {
      const entry = doc.data() as Omit<SaleEntry, 'id' | 'date'> & { date: Timestamp };
      const productNameLower = (entry.productName || "").toLowerCase();
      const currentSaleAmount = entry.totalAmount || 0;
      
      if (entry.unit === "Ltr" && productNameLower === "milk") { 
        summary.milkSoldLitres += entry.quantity || 0;
        summary.milkSoldAmount += currentSaleAmount;
      } else if (entry.unit === "Kg" && productNameLower === "ghee") { 
        summary.gheeSalesAmount += currentSaleAmount;
      } else if (entry.unit === "Bags" && knownPashuAaharProductsLower.includes(productNameLower)) {
        summary.pashuAaharSalesAmount += currentSaleAmount;
      }

      if (entry.paymentType === "Cash") {
        summary.totalCashIn += currentSaleAmount;
      } else if (entry.paymentType === "Credit") {
        summary.totalCreditOut += currentSaleAmount;
        if (entry.customerName && partyBalances.has(entry.customerName)) {
            const currentBalance = partyBalances.get(entry.customerName) || 0;
            partyBalances.set(entry.customerName, currentBalance + currentSaleAmount);
        }
      }
      
      if (entry.date) {
        const saleDateStr = format(entry.date.toDate(), "MMM dd");
        if (dailyAggregator[saleDateStr]) {
          dailyAggregator[saleDateStr].soldValue += currentSaleAmount;
        }
      }
    });

    const bulkSalesEntriesQuery = query(
      collection(db, 'bulkSalesEntries'),
      where('companyId', '==', companyId),
      where('date', '>=', firestorePeriodStart),
      where('date', '<=', firestorePeriodEnd)
    );
    const bulkSalesEntriesSnapshot = await getDocs(bulkSalesEntriesQuery);
    console.log(`SERVER ACTION (Dashboard): Fetched ${bulkSalesEntriesSnapshot.docs.length} bulk sales entry documents for company ${companyId}.`);
    bulkSalesEntriesSnapshot.forEach(doc => {
        const entry = doc.data() as Omit<BulkSaleEntry, 'id' | 'date'> & { date: Timestamp };
        const currentSaleAmount = entry.totalAmount || 0;
        summary.bulkMilkSoldLitres += entry.quantityLtr || 0;
        summary.bulkMilkSoldAmount += currentSaleAmount;
        
        if (entry.paymentType === "Cash") {
            summary.totalCashIn += currentSaleAmount;
        } else if (entry.paymentType === "Credit") {
            summary.totalCreditOut += currentSaleAmount;
            if (entry.customerName && partyBalances.has(entry.customerName)) {
                const currentBalance = partyBalances.get(entry.customerName) || 0;
                partyBalances.set(entry.customerName, currentBalance + currentSaleAmount); 
            }
        }
        if (entry.date) {
            const saleDateStr = format(entry.date.toDate(), "MMM dd");
            if (dailyAggregator[saleDateStr]) {
              dailyAggregator[saleDateStr].soldValue += currentSaleAmount;
            }
        }
    });

    const paymentEntriesQuery = query(
      collection(db, 'paymentEntries'),
      where('companyId', '==', companyId),
      where('date', '>=', firestorePeriodStart),
      where('date', '<=', firestorePeriodEnd)
    );
    const paymentEntriesSnapshot = await getDocs(paymentEntriesQuery);
    console.log(`SERVER ACTION (Dashboard): Fetched ${paymentEntriesSnapshot.docs.length} payment entry documents for company ${companyId}.`);
    paymentEntriesSnapshot.forEach(doc => {
      const entry = doc.data() as Omit<PaymentEntry, 'id' | 'date'> & { date: Timestamp };
      
      if (!entry.partyName || !partyBalances.has(entry.partyName) || typeof entry.amount !== 'number' || entry.amount === 0) {
        return;
      }

      const currentPartyBalance = partyBalances.get(entry.partyName) || 0;
      const paymentAmount = entry.amount;
      let newBalance = currentPartyBalance;

      if (entry.type === "Received") {
        newBalance = currentPartyBalance - paymentAmount;
        summary.totalCashIn += paymentAmount; 
      } else if (entry.type === "Paid") {
        newBalance = currentPartyBalance + paymentAmount;
      }
      partyBalances.set(entry.partyName, newBalance);
    });

  } catch (error) {
    console.error("SERVER ACTION (Dashboard): Error fetching dashboard transaction data from Firestore:", error);
    return defaultData;
  }
  
  let sumOfAllPartyBalances = 0;
  partyBalances.forEach((balance) => {
    sumOfAllPartyBalances += balance;
  });
  summary.netPartyDues = parseFloat(sumOfAllPartyBalances.toFixed(2)); 
  
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
  
  console.log("SERVER ACTION (Dashboard): Dashboard data processed. Summary:", JSON.parse(JSON.stringify(summary)), "ChartSeries Length:", chartSeries.length);
  return { summary, chartSeries };
}
