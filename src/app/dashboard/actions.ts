
'use server';

import { db } from '@/lib/firebase';
import type { DailySummary, ChartDataPoint, DashboardData, MilkCollectionEntry, SaleEntry, BulkSaleEntry, PaymentEntry, PurchaseEntry, Party } from '@/lib/types'; 
import { collection, query, where, getDocs, Timestamp } from 'firebase/firestore';
import { eachDayOfInterval, format, startOfDay, endOfDay, isBefore, isEqual } from 'date-fns';
import { getPartiesFromFirestore } from '../parties/actions';

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
  console.log(`SERVER ACTION (Dashboard): getDashboardSummaryAndChartData called for period: ${clientStartDate.toISOString()} to ${clientEndDate.toISOString()}`);

  const firestorePeriodStart = Timestamp.fromDate(startOfDay(clientStartDate));
  const firestorePeriodEnd = Timestamp.fromDate(endOfDay(clientEndDate));
  
  const knownPashuAaharProductsLower = (await getPashuAaharProductNamesFromPurchases()).map(name => name.toLowerCase());
  console.log("SERVER ACTION (Dashboard): Fetched known Pashu Aahar product names for sales calculation:", knownPashuAaharProductsLower);

  const summary: DailySummary = {
    milkPurchasedLitres: 0, milkPurchasedAmount: 0,
    milkSoldLitres: 0, milkSoldAmount: 0,
    bulkMilkSoldLitres: 0, bulkMilkSoldAmount: 0,
    gheeSalesAmount: 0, pashuAaharSalesAmount: 0,
    totalCashIn: 0, totalCreditOut: 0,
    totalPartyAdvance: 0, // New field initialized
  };

  const daysInRange = eachDayOfInterval({ start: clientStartDate, end: clientEndDate });
  const dailyAggregator: Record<string, { purchasedValue: number; soldValue: number }> = {};
  daysInRange.forEach(day => {
    const formattedDate = format(day, "MMM dd");
    dailyAggregator[formattedDate] = { purchasedValue: 0, soldValue: 0 };
  });

  const allParties = await getPartiesFromFirestore();
  console.log(`SERVER ACTION (Dashboard): Fetched ${allParties.length} parties for balance initialization.`);
  const partyBalances = new Map<string, number>();

  allParties.forEach(party => {
    const numericOpeningBalance = party.openingBalance || 0; // Ensured numeric in getPartiesFromFirestore
    const obDate: Date | undefined = party.openingBalanceAsOfDate; // Ensured Date or undefined

    console.log(`SERVER ACTION (Dashboard): Processing OB for Party: ${party.name} (Type: ${party.type}, ID: ${party.id}). Raw Numeric OB: ${numericOpeningBalance}, OB Date: ${obDate?.toISOString()}`);
    
    let initialBalanceForParty = 0;
    let applyOB = false;

    if (numericOpeningBalance !== 0) {
      if (obDate) {
        // Opening balance is relevant if its 'as of' date is on or before the dashboard period's end date.
        if (isBefore(obDate, clientEndDate) || isEqual(startOfDay(obDate), startOfDay(clientEndDate))) {
          applyOB = true;
          console.log(`SERVER ACTION (Dashboard): OB for ${party.name} IS relevant for period end. Date condition: (OB Date ${obDate.toISOString()} <= Period End Date ${clientEndDate.toISOString()}) is TRUE.`);
        } else {
          console.log(`SERVER ACTION (Dashboard): OB for ${party.name} NOT relevant for period end. Date condition: (OB Date ${obDate.toISOString()} > Period End Date ${clientEndDate.toISOString()}) is FALSE.`);
        }
      } else { // obDate is undefined, but numericOpeningBalance is non-zero (historical balance)
        applyOB = true;
        console.log(`SERVER ACTION (Dashboard): OB for ${party.name} IS relevant for period end. OB Date is undefined, applying as pre-existing historical balance.`);
      }
    }


    if (applyOB) {
      if (party.type === 'Customer' || party.type === 'Employee') {
        initialBalanceForParty = numericOpeningBalance; // Positive = party owes dairy
      } else if (party.type === 'Supplier') {
        initialBalanceForParty = -numericOpeningBalance; // Positive OB (dairy owes supplier) becomes negative in map
      }
      console.log(`SERVER ACTION (Dashboard): --> Initial balance for ${party.name} (from OB) set to: ${initialBalanceForParty.toFixed(2)} (Based on Raw Numeric OB: ${numericOpeningBalance})`);
    } else {
      if (numericOpeningBalance !== 0) { // Only log if there was an OB that wasn't applied
         console.log(`SERVER ACTION (Dashboard): OB for ${party.name} of ${numericOpeningBalance} NOT applied as initial for this period. Initial balance remains ${initialBalanceForParty.toFixed(2)}.`);
      }
    }
    partyBalances.set(party.name, initialBalanceForParty);
  });

  try {
    const milkCollectionsQuery = query(
      collection(db, 'milkCollections'),
      where('date', '>=', firestorePeriodStart),
      where('date', '<=', firestorePeriodEnd)
    );
    const milkCollectionsSnapshot = await getDocs(milkCollectionsQuery);
    console.log(`SERVER ACTION (Dashboard): Fetched ${milkCollectionsSnapshot.docs.length} milk collection documents for the period.`);
    milkCollectionsSnapshot.forEach(doc => {
      const entry = doc.data() as Omit<MilkCollectionEntry, 'id' | 'date'> & { date: Timestamp };
      summary.milkPurchasedLitres += entry.quantityLtr || 0;
      summary.milkPurchasedAmount += entry.totalAmount || 0;
      const netAmountPayable = entry.netAmountPayable || 0;

      if (!partyBalances.has(entry.customerName)) {
        console.warn(`SERVER ACTION (Dashboard): Unknown party (milk supplier) "${entry.customerName}" in milk collection entry ID ${doc.id}. Balance not updated from this transaction.`);
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

    const salesEntriesQuery = query(
      collection(db, 'salesEntries'),
      where('date', '>=', firestorePeriodStart),
      where('date', '<=', firestorePeriodEnd)
    );
    const salesEntriesSnapshot = await getDocs(salesEntriesQuery);
    console.log(`SERVER ACTION (Dashboard): Fetched ${salesEntriesSnapshot.docs.length} sales entry documents for the period.`);
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
                console.warn(`SERVER ACTION (Dashboard): Unknown customer "${entry.customerName}" (from retail sales entry ID ${doc.id}) not found in partyBalances. Balance not updated from this credit sale.`);
            } else {
                const currentBalance = partyBalances.get(entry.customerName) || 0;
                console.log(`SERVER ACTION (Dashboard): Processing Credit Sale for ${entry.customerName} (Retail). Original Balance from map: ${currentBalance.toFixed(2)}, Sale Amount: ${currentSaleAmount.toFixed(2)}`);
                partyBalances.set(entry.customerName, currentBalance + currentSaleAmount);
                console.log(`SERVER ACTION (Dashboard): Credit Sale to ${entry.customerName} (Retail). Balance updated to ${(currentBalance + currentSaleAmount).toFixed(2)}`);
            }
        } else {
            console.warn(`SERVER ACTION (Dashboard): Retail sales entry ID ${doc.id} is 'Credit' but has no customerName. Balance not updated from this credit sale.`);
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
      where('date', '>=', firestorePeriodStart),
      where('date', '<=', firestorePeriodEnd)
    );
    const bulkSalesEntriesSnapshot = await getDocs(bulkSalesEntriesQuery);
    console.log(`SERVER ACTION (Dashboard): Fetched ${bulkSalesEntriesSnapshot.docs.length} bulk sales entry documents for the period.`);
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
                    console.warn(`SERVER ACTION (Dashboard): Unknown customer "${entry.customerName}" (from bulk sales entry ID ${doc.id}) not found in partyBalances. Balance not updated from this credit sale.`);
                } else {
                    const currentBalance = partyBalances.get(entry.customerName) || 0;
                    console.log(`SERVER ACTION (Dashboard): Processing Credit Sale for ${entry.customerName} (Bulk). Original Balance from map: ${currentBalance.toFixed(2)}, Sale Amount: ${currentSaleAmount.toFixed(2)}`);
                    partyBalances.set(entry.customerName, currentBalance + currentSaleAmount); 
                    console.log(`SERVER ACTION (Dashboard): Credit Sale to ${entry.customerName} (Bulk). Balance updated to ${(currentBalance + currentSaleAmount).toFixed(2)}`);
                }
            } else {
                 console.warn(`SERVER ACTION (Dashboard): Bulk sales entry ID ${doc.id} is 'Credit' but has no customerName. Balance not updated from this credit sale.`);
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
      where('date', '>=', firestorePeriodStart),
      where('date', '<=', firestorePeriodEnd)
    );
    const paymentEntriesSnapshot = await getDocs(paymentEntriesQuery);
    console.log(`SERVER ACTION (Dashboard): Fetched ${paymentEntriesSnapshot.docs.length} payment entry documents for the period.`);
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
      let newBalance = currentPartyBalance;
      let validPartyType = true;
      let validPaymentType = true;

      if (entry.partyType === "Customer") {
        if (entry.type === "Received") { 
          newBalance = currentPartyBalance - paymentAmount; // Customer paid, so their due to dairy decreases
          summary.totalCashIn += paymentAmount; 
        } else if (entry.type === "Paid") { // Dairy paid customer (e.g. refund)
          newBalance = currentPartyBalance + paymentAmount; // Customer's due to dairy effectively increases, or dairy's liability to them decreases
        } else { validPaymentType = false; }
      } else if (entry.partyType === "Supplier") {
         if (entry.type === "Paid") { // Dairy paid supplier
            newBalance = currentPartyBalance + paymentAmount; // Dairy's liability to supplier decreases (balance becomes less negative or more positive)
         } else if (entry.type === "Received") { // Supplier paid dairy (e.g. refund)
            newBalance = currentPartyBalance - paymentAmount; // Dairy's liability to supplier increases
            summary.totalCashIn += paymentAmount; 
         } else { validPaymentType = false; }
      } else if (entry.partyType === "Employee") {
         if (entry.type === "Paid") { // Dairy paid employee
            newBalance = currentPartyBalance + paymentAmount; // Dairy's liability to employee decreases
         } else if (entry.type === "Received") { // Employee paid dairy
            newBalance = currentPartyBalance - paymentAmount; 
            summary.totalCashIn += paymentAmount;
         } else { validPaymentType = false; }
      } else { validPartyType = false; }

      if (validPartyType && validPaymentType) {
        partyBalances.set(entry.partyName, newBalance);
        console.log(`SERVER ACTION (Dashboard): Payment for ${entry.partyName} (${entry.type} ${entry.partyType}). Balance updated from ${currentPartyBalance.toFixed(2)} to ${newBalance.toFixed(2)}`);
      } else {
        if (!validPartyType) console.warn(`SERVER ACTION (Dashboard): Payment entry ID ${doc.id} has invalid partyType: "${entry.partyType}". Balance not updated.`);
        if (!validPaymentType) console.warn(`SERVER ACTION (Dashboard): Payment entry ID ${doc.id} for partyType "${entry.partyType}" has invalid payment type: "${entry.type}". Balance not updated.`);
      }
    });

  } catch (error) {
    console.error("SERVER ACTION (Dashboard): Error fetching dashboard transaction data from Firestore:", error);
    // Return summary with all zeros in case of error
    const defaultSummary: DailySummary = {
        milkPurchasedLitres: 0, milkPurchasedAmount: 0, milkSoldLitres: 0, milkSoldAmount: 0,
        bulkMilkSoldLitres: 0, bulkMilkSoldAmount: 0, gheeSalesAmount: 0, pashuAaharSalesAmount: 0,
        totalCashIn: 0, totalCreditOut: 0, totalPartyAdvance: 0,
    };
    return { summary: defaultSummary, chartSeries: [] };
  }
  
  let sumOfAllPartyBalances = 0;
  console.log("SERVER ACTION (Dashboard): Calculating Total Party Advance from final party balances:");
  partyBalances.forEach((balance, partyName) => {
    const partyDetails = allParties.find(p => p.name === partyName);
    console.log(`SERVER ACTION (Dashboard): Final balance for ${partyName} (Type: ${partyDetails?.type || 'Unknown'}, ID: ${partyDetails?.id || 'N/A'}): ${balance.toFixed(2)}`);
    sumOfAllPartyBalances += balance;
  });
  summary.totalPartyAdvance = parseFloat((-sumOfAllPartyBalances).toFixed(2)); // Negative sum of balances
  console.log("SERVER ACTION (Dashboard): Sum of all party balances:", sumOfAllPartyBalances.toFixed(2));
  console.log("SERVER ACTION (Dashboard): Final Calculated Total Party Advance:", summary.totalPartyAdvance);
  
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
