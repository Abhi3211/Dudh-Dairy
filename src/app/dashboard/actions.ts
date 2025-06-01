
'use server';

import { db } from '@/lib/firebase';
import type { DailySummary, ChartDataPoint, DashboardData, MilkCollectionEntry, SaleEntry, BulkSaleEntry, PaymentEntry, PurchaseEntry, Party } from '@/lib/types'; 
import { collection, query, where, getDocs, Timestamp } from 'firebase/firestore';
import { eachDayOfInterval, format, startOfDay, endOfDay } from 'date-fns';
import { getPartiesFromFirestore } from '../parties/actions'; // Correctly import getPartiesFromFirestore

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
    
  };

  const daysInRange = eachDayOfInterval({ start: clientStartDate, end: clientEndDate });
  const dailyAggregator: Record<string, { purchasedValue: number; soldValue: number }> = {};
  
  daysInRange.forEach(day => {
    const formattedDate = format(day, "MMM dd");
    dailyAggregator[formattedDate] = { purchasedValue: 0, soldValue: 0 };
  });

  const partyBalances = new Map<string, number>();
  const allParties = await getPartiesFromFirestore(); // **CRITICAL FIX: Fetch all parties here**
  console.log(`SERVER ACTION (Dashboard): Fetched ${allParties.length} parties for balance initialization.`);


  console.log("SERVER ACTION (Dashboard): Initializing party balances. Client End Date for OB check:", clientEndDate.toISOString());
  allParties.forEach(party => {
    let initialBalance = 0;
    const numericOpeningBalance = party.openingBalance || 0; 
    const obDate: Date | undefined = party.openingBalanceAsOfDate;

    console.log(`SERVER ACTION (Dashboard): Processing party ${party.name} (Type: ${party.type}, ID: ${party.id}) for OB. Raw OB Value: ${numericOpeningBalance}, OB Date: ${obDate?.toISOString()}`);

    if (numericOpeningBalance !== 0 && obDate && obDate <= clientEndDate) {
      console.log(`SERVER ACTION (Dashboard): OB for ${party.name} IS relevant. Condition: (OB Date ${obDate.toISOString()} <= Client End Date ${clientEndDate.toISOString()}) is TRUE.`);
      if (party.type === 'Customer' || party.type === 'Employee') {
        initialBalance = numericOpeningBalance; // Positive: Party owes Dairy
      } else if (party.type === 'Supplier') {
        initialBalance = -numericOpeningBalance; // Positive party.openingBalance means Dairy owes Supplier -> negative on dairy's books
      }
      console.log(`SERVER ACTION (Dashboard): --> Initial balance for ${party.name} set to: ${initialBalance.toFixed(2)} (Based on Raw Numeric OB: ${numericOpeningBalance})`);
    } else {
      const reasonParts = [];
      if (numericOpeningBalance === 0) reasonParts.push("OB is zero");
      if (!obDate && numericOpeningBalance !==0) reasonParts.push("OB Date is undefined but OB is non-zero");
      if (obDate && !(obDate <= clientEndDate)) reasonParts.push(`OB Date ${obDate.toISOString()} > Client End Date ${clientEndDate.toISOString()}`);
      const reason = reasonParts.length > 0 ? reasonParts.join("; ") : "OB is zero or OB date not relevant";
      console.log(`SERVER ACTION (Dashboard): OB for ${party.name} NOT relevant or not applied. Reason: ${reason}. Raw Numeric OB: ${numericOpeningBalance}. Initial balance remains ${initialBalance.toFixed(2)}.`);
    }
    partyBalances.set(party.name, initialBalance); 
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
      const netAmountPayable = entry.netAmountPayable || 0;

      if (!partyBalances.has(entry.customerName)) { // customerName here refers to the milk supplier Party
        console.warn(`SERVER ACTION (Dashboard): Unknown party (milk supplier) "${entry.customerName}" in milk collection entry ID ${doc.id}. Balance not updated.`);
      } else {
        const currentBalance = partyBalances.get(entry.customerName) || 0;
        partyBalances.set(entry.customerName, currentBalance - netAmountPayable); 
        console.log(`SERVER ACTION (Dashboard): Milk Collection from ${entry.customerName}. Balance updated from ${currentBalance.toFixed(2)} to ${(currentBalance - netAmountPayable).toFixed(2)} (Dairy owes more/paid less)`);
      }


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
        if (entry.customerName) {
            if (!partyBalances.has(entry.customerName)) {
                console.warn(`SERVER ACTION (Dashboard): Unknown customer "${entry.customerName}" (from retail sales entry ID ${doc.id}) not found in partyBalances. Balance not updated for credit sale.`);
            } else {
                const currentBalance = partyBalances.get(entry.customerName) || 0;
                console.log(`SERVER ACTION (Dashboard): Processing Credit Sale for ${entry.customerName} (Retail). Original Balance from map: ${currentBalance.toFixed(2)}, Sale Amount: ${currentSaleAmount.toFixed(2)}`);
                partyBalances.set(entry.customerName, currentBalance + currentSaleAmount);
                console.log(`SERVER ACTION (Dashboard): Credit Sale to ${entry.customerName} (Retail). Balance updated to ${(currentBalance + currentSaleAmount).toFixed(2)}`);
            }
        } else {
            console.warn(`SERVER ACTION (Dashboard): Retail sales entry ID ${doc.id} is 'Credit' but has no customerName. Balance not updated.`);
        }
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
        

        if (entry.paymentType === "Cash") {
            summary.totalCashIn += currentSaleAmount;
        } else if (entry.paymentType === "Credit") {
            summary.totalCreditOut += currentSaleAmount;
            if (entry.customerName) {
                if (!partyBalances.has(entry.customerName)) {
                    console.warn(`SERVER ACTION (Dashboard): Unknown customer "${entry.customerName}" (from bulk sales entry ID ${doc.id}) not found in partyBalances. Balance not updated for credit sale.`);
                } else {
                    const currentBalance = partyBalances.get(entry.customerName) || 0;
                    console.log(`SERVER ACTION (Dashboard): Processing Credit Sale for ${entry.customerName} (Bulk). Original Balance from map: ${currentBalance.toFixed(2)}, Sale Amount: ${currentSaleAmount.toFixed(2)}`);
                    partyBalances.set(entry.customerName, currentBalance + currentSaleAmount); 
                    console.log(`SERVER ACTION (Dashboard): Credit Sale to ${entry.customerName} (Bulk). Balance updated to ${(currentBalance + currentSaleAmount).toFixed(2)}`);
                }
            } else {
                 console.warn(`SERVER ACTION (Dashboard): Bulk sales entry ID ${doc.id} is 'Credit' but has no customerName. Balance not updated.`);
            }
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
      console.log(`SERVER ACTION (Dashboard): Processing payment entry ID ${doc.id}: Party "${entry.partyName}", Type "${entry.type}", PartyType "${entry.partyType}", Amount ${entry.amount}`);
      
      if (!entry.partyName) {
        console.warn(`SERVER ACTION (Dashboard): Payment entry ID ${doc.id} has no partyName. Skipping balance update.`);
        return;
      }
      if (!partyBalances.has(entry.partyName)) {
        console.warn(`SERVER ACTION (Dashboard): Unknown party "${entry.partyName}" in payment entry ID ${doc.id}. Skipping balance update.`);
        return;
      }
      if (typeof entry.amount !== 'number' || entry.amount === 0) {
          console.warn(`SERVER ACTION (Dashboard): Payment entry ID ${doc.id} for party "${entry.partyName}" has missing, zero, or invalid amount: ${entry.amount}. Skipping balance update.`);
          return;
      }

      const currentPartyBalance = partyBalances.get(entry.partyName) || 0;
      const paymentAmount = entry.amount;
      
      let validPartyType = true;
      let validPaymentType = true;
      let newBalance = currentPartyBalance;

      if (entry.partyType === "Customer") {
        if (entry.type === "Received") { 
          newBalance = currentPartyBalance - paymentAmount; 
          summary.totalCashIn += paymentAmount; 
        } else if (entry.type === "Paid") { // e.g. refund to customer
          newBalance = currentPartyBalance + paymentAmount; 
        } else {
            validPaymentType = false;
        }
      } else if (entry.partyType === "Supplier") {
         if (entry.type === "Paid") { 
            newBalance = currentPartyBalance + paymentAmount; 
         } else if (entry.type === "Received") { // e.g. refund from supplier
            newBalance = currentPartyBalance - paymentAmount; 
            summary.totalCashIn += paymentAmount; 
         } else {
             validPaymentType = false;
         }
      } else if (entry.partyType === "Employee") {
         if (entry.type === "Paid") { // e.g. salary
            newBalance = currentPartyBalance + paymentAmount; 
         } else if (entry.type === "Received") { // e.g. employee paying back loan
            newBalance = currentPartyBalance - paymentAmount; 
            summary.totalCashIn += paymentAmount;
         } else {
            validPaymentType = false;
         }
      } else {
          validPartyType = false;
      }

      if (validPartyType && validPaymentType) {
        partyBalances.set(entry.partyName, newBalance);
        console.log(`SERVER ACTION (Dashboard): Payment for ${entry.partyName} (${entry.type} ${entry.partyType}). Balance updated from ${currentPartyBalance.toFixed(2)} to ${newBalance.toFixed(2)}`);
      } else {
        if (!validPartyType) console.warn(`SERVER ACTION (Dashboard): Payment entry ID ${doc.id} has invalid partyType: "${entry.partyType}". Balance not updated.`);
        if (!validPaymentType) console.warn(`SERVER ACTION (Dashboard): Payment entry ID ${doc.id} for partyType "${entry.partyType}" has invalid payment type: "${entry.type}". Balance not updated.`);
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
        
    };
    return { summary: defaultSummary, chartSeries: [] };
  }
  
  let calculatedOutstanding = 0;
  console.log("SERVER ACTION (Dashboard): Calculating Total Outstanding Amount from final party balances:");
  partyBalances.forEach((balance, partyName) => { 
    const partyDetails = allParties.find(p => p.name === partyName);
    console.log(`SERVER ACTION (Dashboard): Final balance for ${partyName} (Type: ${partyDetails?.type || 'Unknown Type'}, ID: ${partyDetails?.id || 'N/A'}): ${balance.toFixed(2)}`);
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
  


  console.log("SERVER ACTION (Dashboard): Dashboard data processed. Summary:", JSON.parse(JSON.stringify(summary)), "ChartSeries Length:", chartSeries.length);
  return { summary, chartSeries };
}

    

    