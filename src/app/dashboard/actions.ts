
'use server';

import { db } from '@/lib/firebase';
import type { DailySummary, ChartDataPoint, DashboardData, MilkCollectionEntry, SaleEntry, BulkSaleEntry, PaymentEntry, PurchaseEntry, Party } from '@/lib/types'; // Added PurchaseEntry, Party
import { collection, query, where, getDocs, Timestamp } from 'firebase/firestore';
import { eachDayOfInterval, format, startOfDay, endOfDay } from 'date-fns';
import { getPartiesFromFirestore } from '../parties/actions'; // Import to get party details

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
  console.log(`SERVER ACTION (Dashboard): getDashboardSummaryAndChartData called for range: ${clientStartDate.toISOString()} to ${clientEndDate.toISOString()}`);

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
    totalRevenue: 0, 
  };

  const daysInRange = eachDayOfInterval({ start: clientStartDate, end: clientEndDate });
  const dailyAggregator: Record<string, { purchasedValue: number; soldValue: number }> = {};
  
  daysInRange.forEach(day => {
    const formattedDate = format(day, "MMM dd");
    dailyAggregator[formattedDate] = { purchasedValue: 0, soldValue: 0 };
  });

  const partyBalances = new Map<string, number>();
  const allParties = await getPartiesFromFirestore(); // This now returns parties with numeric openingBalance

  console.log("SERVER ACTION (Dashboard): Initializing party balances. Client End Date for OB check:", clientEndDate.toISOString());
  allParties.forEach(party => {
    let initialBalance = 0;
    // party.openingBalance is now guaranteed to be a number by getPartiesFromFirestore
    const numericOpeningBalance = party.openingBalance || 0; 
    const obDate: Date | undefined = party.openingBalanceAsOfDate; // This is now Date | undefined

    console.log(`SERVER ACTION (Dashboard): Processing party ${party.name} (Type: ${party.type}) for OB. Numeric OB Value: ${numericOpeningBalance}, OB Date: ${obDate?.toISOString()}`);

    if (numericOpeningBalance !== 0 && obDate && obDate <= clientEndDate) {
      console.log(`SERVER ACTION (Dashboard): OB for ${party.name} IS relevant. Condition: (OB Date ${obDate.toISOString()} <= Client End Date ${clientEndDate.toISOString()}) is TRUE.`);
      if (party.type === 'Customer' || party.type === 'Employee') {
        initialBalance = numericOpeningBalance;
      } else if (party.type === 'Supplier') {
        initialBalance = -numericOpeningBalance; 
      }
      console.log(`SERVER ACTION (Dashboard): --> Initial balance for ${party.name} set to: ${initialBalance} (Raw Numeric OB: ${numericOpeningBalance})`);
    } else {
      const reasonParts = [];
      if (numericOpeningBalance === 0) reasonParts.push("OB is zero");
      if (!obDate) reasonParts.push("OB Date is undefined");
      if (obDate && !(obDate <= clientEndDate)) reasonParts.push(`OB Date ${obDate.toISOString()} > Client End Date ${clientEndDate.toISOString()}`);
      const reason = reasonParts.length > 0 ? reasonParts.join("; ") : "Unknown reason or OB is zero/undefined";
      console.log(`SERVER ACTION (Dashboard): OB for ${party.name} NOT relevant or not applied. Reason: ${reason}. Raw Numeric OB: ${numericOpeningBalance}.`);
    }
    partyBalances.set(party.name, initialBalance); // initialBalance is now definitely a number
  });


  try {
    // Fetch Milk Collections
    const milkCollectionsQuery = query(
      collection(db, 'milkCollections'),
      where('date', '>=', startDate),
      where('date', '<=', endDate)
    );
    const milkCollectionsSnapshot = await getDocs(milkCollectionsQuery);
    console.log(`SERVER ACTION (Dashboard): Fetched ${milkCollectionsSnapshot.docs.length} milk collection documents.`);

    milkCollectionsSnapshot.forEach(doc => {
      const entry = doc.data() as Omit<MilkCollectionEntry, 'id' | 'date'> & { date: Timestamp };
      summary.milkPurchasedLitres += entry.quantityLtr || 0;
      summary.milkPurchasedAmount += entry.totalAmount || 0;

      const currentBalance = partyBalances.get(entry.customerName) || 0; // customerName here is the milk supplier party
      partyBalances.set(entry.customerName, currentBalance - (entry.netAmountPayable || 0)); // Ensure numeric operation

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
    console.log(`SERVER ACTION (Dashboard): Fetched ${salesEntriesSnapshot.docs.length} sales entry documents.`);

    salesEntriesSnapshot.forEach(doc => {
      const entry = doc.data() as Omit<SaleEntry, 'id' | 'date'> & { date: Timestamp };
      const productNameLower = (entry.productName || "").toLowerCase();
      const currentSaleAmount = entry.totalAmount || 0;

      summary.totalRevenue += currentSaleAmount;

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
      } else if (entry.paymentType === "Credit" && entry.customerName) {
        summary.totalCreditOut += currentSaleAmount;
        const currentBalance = partyBalances.get(entry.customerName) || 0;
        partyBalances.set(entry.customerName, currentBalance + currentSaleAmount); // Ensure numeric operation
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
    console.log(`SERVER ACTION (Dashboard): Fetched ${bulkSalesEntriesSnapshot.docs.length} bulk sales entry documents.`);

    bulkSalesEntriesSnapshot.forEach(doc => {
        const entry = doc.data() as Omit<BulkSaleEntry, 'id' | 'date'> & { date: Timestamp };
        const currentSaleAmount = entry.totalAmount || 0;

        summary.bulkMilkSoldLitres += entry.quantityLtr || 0;
        summary.bulkMilkSoldAmount += currentSaleAmount;
        summary.totalRevenue += currentSaleAmount;

        if (entry.paymentType === "Cash") {
            summary.totalCashIn += currentSaleAmount;
        } else if (entry.paymentType === "Credit" && entry.customerName) {
            summary.totalCreditOut += currentSaleAmount;
            const currentBalance = partyBalances.get(entry.customerName) || 0;
            partyBalances.set(entry.customerName, currentBalance + currentSaleAmount); // Ensure numeric operation
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
    console.log(`SERVER ACTION (Dashboard): Fetched ${paymentEntriesSnapshot.docs.length} payment entry documents.`);

    paymentEntriesSnapshot.forEach(doc => {
      const entry = doc.data() as Omit<PaymentEntry, 'id' | 'date'> & { date: Timestamp };
      const currentPartyBalance = partyBalances.get(entry.partyName) || 0;
      const paymentAmount = entry.amount || 0;
      
      if (entry.partyType === "Customer") {
        if (entry.type === "Received") { 
          partyBalances.set(entry.partyName, currentPartyBalance - paymentAmount); 
          summary.totalCashIn += paymentAmount; 
        } else if (entry.type === "Paid") { 
          partyBalances.set(entry.partyName, currentPartyBalance + paymentAmount); 
        }
      } else if (entry.partyType === "Supplier") {
         if (entry.type === "Paid") { 
            partyBalances.set(entry.partyName, currentPartyBalance + paymentAmount); 
         } else if (entry.type === "Received") { 
            partyBalances.set(entry.partyName, currentPartyBalance - paymentAmount); 
         }
      } else if (entry.partyType === "Employee") {
         if (entry.type === "Paid") { 
            partyBalances.set(entry.partyName, currentPartyBalance + paymentAmount); 
         } else if (entry.type === "Received") { 
            partyBalances.set(entry.partyName, currentPartyBalance - paymentAmount); 
         }
      }
    });


  } catch (error) {
    console.error("SERVER ACTION (Dashboard): Error fetching dashboard data from Firestore:", error);
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
        totalRevenue: 0,
    };
    return { summary: defaultSummary, chartSeries: [] };
  }
  
  let calculatedOutstanding = 0;
  console.log("SERVER ACTION (Dashboard): Calculating Total Outstanding Amount from final party balances:");
  partyBalances.forEach((balance, partyName) => { // balance is now definitely a number
    const partyDetails = allParties.find(p => p.name === partyName);
    console.log(`SERVER ACTION (Dashboard): Final balance for ${partyName} (${partyDetails?.type || 'Unknown Type'}): ${balance.toFixed(2)}`);
    if (balance > 0) { 
      calculatedOutstanding += balance;
      console.log(`SERVER ACTION (Dashboard): --> Added ${balance.toFixed(2)} to outstanding. Current calculatedOutstanding: ${calculatedOutstanding.toFixed(2)}`);
    }
  });
  summary.totalOutstandingAmount = parseFloat(calculatedOutstanding.toFixed(2));
  console.log("SERVER ACTION (Dashboard): Final Calculated Total Outstanding Amount (Receivables):", summary.totalOutstandingAmount);
  
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
  summary.totalRevenue = parseFloat(summary.totalRevenue.toFixed(2));


  console.log("SERVER ACTION (Dashboard): Dashboard data processed. Summary:", JSON.parse(JSON.stringify(summary)), "ChartSeries Length:", chartSeries.length);
  return { summary, chartSeries };
}

    
