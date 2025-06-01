
'use server';

import { db } from '@/lib/firebase';
import type { Party, PartyLedgerEntry, MilkCollectionEntry, SaleEntry, BulkSaleEntry, PurchaseEntry, PaymentEntry } from '@/lib/types';
import { collection, addDoc, getDocs, deleteDoc, doc, query, orderBy, where, Timestamp, getDoc } from 'firebase/firestore';
import { revalidatePath } from 'next/cache';
import { parseEntryDate } from '@/lib/utils';

export async function getPartiesFromFirestore(): Promise<Party[]> {
  console.log("SERVER ACTION: getPartiesFromFirestore called.");
  try {
    const partiesCollection = collection(db, 'parties');
    const q = query(partiesCollection, orderBy('name', 'asc'));
    const partySnapshot = await getDocs(q);
    const partyList = partySnapshot.docs.map(docSnapshot => {
      const data = docSnapshot.data();
      
      const numericOpeningBalance = Number(data.openingBalance || 0);
      let openingBalanceDate: Date | undefined = undefined;

      if (data.openingBalanceAsOfDate) {
        if (data.openingBalanceAsOfDate.toDate && typeof data.openingBalanceAsOfDate.toDate === 'function') {
          openingBalanceDate = data.openingBalanceAsOfDate.toDate();
        } else if (data.openingBalanceAsOfDate instanceof Date) {
          openingBalanceDate = data.openingBalanceAsOfDate;
        } else {
          const parsed = parseEntryDate(data.openingBalanceAsOfDate);
          if (parsed && !isNaN(parsed.getTime())) {
            openingBalanceDate = parsed;
          } else {
            console.warn(`SERVER ACTION (Parties): Could not parse openingBalanceAsOfDate "${data.openingBalanceAsOfDate}" for party ${data.name} (ID: ${docSnapshot.id}).`);
          }
        }
      }

      return {
        id: docSnapshot.id,
        name: data.name,
        type: data.type,
        openingBalance: numericOpeningBalance, // Stored as per universal input convention
        openingBalanceAsOfDate: openingBalanceDate,
      } as Party;
    });
    console.log("SERVER ACTION: Successfully fetched parties. Count:", partyList.length);
    if (partyList.length > 0) {
        console.log("SERVER ACTION: Sample fetched party data (first party, raw numericOpeningBalance):", JSON.parse(JSON.stringify(partyList[0])));
    }
    return partyList;
  } catch (error) {
    console.error("SERVER ACTION: Error fetching parties from Firestore:", error);
    return [];
  }
}

export async function addPartyToFirestore(
  partyData: Omit<Party, 'id'>
): Promise<{ success: boolean; id?: string; error?: string }> {
  console.log("SERVER ACTION: addPartyToFirestore called with data (universal OB convention):", partyData);
  try {
    const partiesCollection = collection(db, 'parties');
    const q = query(partiesCollection, where('name', '==', partyData.name), where('type', '==', partyData.type));
    const existingPartySnapshot = await getDocs(q);
    if (!existingPartySnapshot.empty) {
      console.warn(`SERVER ACTION: Party with name "${partyData.name}" and type "${partyData.type}" already exists.`);
      return { success: false, error: `Party "${partyData.name}" (${partyData.type}) already exists.` };
    }

    const dataToSave: any = {
      name: partyData.name,
      type: partyData.type,
      openingBalance: Number(partyData.openingBalance || 0), 
    };

    if (partyData.openingBalanceAsOfDate) {
      dataToSave.openingBalanceAsOfDate = Timestamp.fromDate(new Date(partyData.openingBalanceAsOfDate));
    } else if (dataToSave.openingBalance !== 0) {
      dataToSave.openingBalanceAsOfDate = Timestamp.now();
    }


    const docRef = await addDoc(collection(db, 'parties'), dataToSave);
    console.log("SERVER ACTION: Party document successfully added to Firestore with ID:", docRef.id);
    revalidatePath('/parties');
    revalidatePath('/milk-collection');
    revalidatePath('/sales');
    revalidatePath('/bulk-sales');
    revalidatePath('/purchases');
    revalidatePath('/payments');
    return { success: true, id: docRef.id };
  } catch (error) {
    console.error("SERVER ACTION: Error adding party to Firestore:", error);
    if (error instanceof Error) {
        return { success: false, error: error.message };
    }
    return { success: false, error: "An unknown error occurred" };
  }
}

export async function deletePartyFromFirestore(partyId: string): Promise<{ success: boolean; error?: string }> {
  console.log("SERVER ACTION: deletePartyFromFirestore called with partyId:", partyId);
  try {
    await deleteDoc(doc(db, 'parties', partyId));
    console.log("SERVER ACTION: Party document successfully deleted from Firestore.");
    revalidatePath('/parties');
    return { success: true };
  } catch (error) {
    console.error("SERVER ACTION: Error deleting party from Firestore:", error);
     if (error instanceof Error) {
        return { success: false, error: error.message };
    }
    return { success: false, error: "An unknown error occurred" };
  }
}


export async function getPartyTransactions(partyId: string): Promise<PartyLedgerEntry[]> {
  console.log(`SERVER ACTION: getPartyTransactions called for partyId: ${partyId}`);
  const ledgerEntries: PartyLedgerEntry[] = [];

  try {
    const partyDocRef = doc(db, 'parties', partyId);
    const partyDocSnap = await getDoc(partyDocRef);

    if (!partyDocSnap.exists()) {
      console.error(`SERVER ACTION: Party with ID ${partyId} not found.`);
      return [];
    }
    const partyData = partyDocSnap.data() as Party; 
    const partyName = partyData.name;
    const partyType = partyData.type;

    let openingBalanceDateFromPartyDoc: Date | undefined = undefined;
    if (partyData.openingBalanceAsOfDate) { 
        openingBalanceDateFromPartyDoc = parseEntryDate(partyData.openingBalanceAsOfDate);
    }
    // numericOpeningBalance is as entered by user: +ve means Dairy owes, -ve means Party owes.
    const numericOpeningBalance = typeof partyData.openingBalance === 'number' ? partyData.openingBalance : 0;

    if (numericOpeningBalance !== 0) {
      const openingDate = openingBalanceDateFromPartyDoc || new Date(0); 

      let openingDebit = 0;
      let openingCredit = 0;

      // Universal Input Convention:
      // numericOpeningBalance > 0 means Dairy owes Party -> This is a CREDIT in the ledger entry (Dairy's liability)
      // numericOpeningBalance < 0 means Party owes Dairy -> This is a DEBIT in the ledger entry (Dairy's asset)
      if (numericOpeningBalance > 0) {
        openingCredit = numericOpeningBalance;
      } else if (numericOpeningBalance < 0) {
        openingDebit = Math.abs(numericOpeningBalance);
      }

      ledgerEntries.push({
        id: `ob-${partyId}`,
        date: openingDate,
        description: "Opening Balance",
        debit: openingDebit,
        credit: openingCredit,
        balance: 0, // Will be calculated later
      });
    }


    // Fetch Milk Collections (Dairy purchases from 'Customer' type party)
    if (partyType === "Customer") {
      const milkCollectionsQuery = query(
        collection(db, 'milkCollections'), 
        where('customerName', '==', partyName),
        orderBy('date', 'asc')
      );
      const milkCollectionsSnapshot = await getDocs(milkCollectionsQuery);
      milkCollectionsSnapshot.forEach(docSnapshot => {
        const data = docSnapshot.data() as MilkCollectionEntry;
        const entryDate = parseEntryDate(data.date);
        // Dairy owes for milk collected -> Credit entry
        ledgerEntries.push({
          id: `mc-${docSnapshot.id}`,
          date: entryDate,
          description: `Milk Supplied (${data.quantityLtr} Ltr, ${data.fatPercentage}% FAT, Rate ${data.ratePerLtr.toFixed(2)})`,
          shift: data.shift,
          milkQuantityLtr: data.quantityLtr,
          credit: data.netAmountPayable,
          debit: 0,
          balance: 0,
        });
      });
    }

    // Fetch Retail Sales (Dairy sells to 'Customer' type party on credit)
    if (partyType === "Customer") {
      const salesQuery = query(
        collection(db, 'salesEntries'), 
        where('customerName', '==', partyName),
        where('paymentType', '==', 'Credit'),
        orderBy('date', 'asc')
      );
      const salesSnapshot = await getDocs(salesQuery);
      salesSnapshot.forEach(docSnapshot => {
        const data = docSnapshot.data() as SaleEntry;
        const entryDate = parseEntryDate(data.date);
        // Customer owes for credit sale -> Debit entry
        ledgerEntries.push({
          id: `rs-${docSnapshot.id}`,
          date: entryDate,
          description: `Retail Sale: ${data.productName} (${data.quantity} ${data.unit})`,
          debit: data.totalAmount,
          credit: 0,
          balance: 0,
        });
      });
    }

    // Fetch Bulk Sales (Dairy sells to 'Customer' type party on credit)
    if (partyType === "Customer") {
      const bulkSalesQuery = query(
        collection(db, 'bulkSalesEntries'), 
        where('customerName', '==', partyName),
        where('paymentType', '==', 'Credit'),
        orderBy('date', 'asc')
      );
      const bulkSalesSnapshot = await getDocs(bulkSalesQuery);
      bulkSalesSnapshot.forEach(docSnapshot => {
        const data = docSnapshot.data() as BulkSaleEntry;
        const entryDate = parseEntryDate(data.date);
        // Customer owes for credit sale -> Debit entry
        ledgerEntries.push({
          id: `bs-${docSnapshot.id}`,
          date: entryDate,
          description: `Bulk Milk Sale (${data.quantityLtr} Ltr)`,
          shift: data.shift,
          debit: data.totalAmount,
          credit: 0,
          balance: 0,
        });
      });
    }

    // Fetch Purchases (Dairy purchases from 'Supplier' type party on credit)
    if (partyType === "Supplier") {
      const purchasesQuery = query(
        collection(db, 'purchaseEntries'), 
        where('supplierName', '==', partyName),
        where('paymentType', '==', 'Credit'),
        orderBy('date', 'asc')
      );
      const purchasesSnapshot = await getDocs(purchasesQuery);
      purchasesSnapshot.forEach(docSnapshot => {
        const data = docSnapshot.data() as PurchaseEntry;
        const entryDate = parseEntryDate(data.date);
        // Dairy owes for credit purchase -> Credit entry
        ledgerEntries.push({
          id: `pu-${docSnapshot.id}`,
          date: entryDate,
          description: `Purchase: ${data.productName} (${data.quantity} ${data.unit})`,
          credit: data.totalAmount,
          debit: 0,
          balance: 0,
        });
      });
    }

    // Fetch Payment Entries
    const paymentsQuery = query(
      collection(db, 'paymentEntries'), 
      where('partyName', '==', partyName),
      where('partyType', '==', partyType),
      orderBy('date', 'asc')
    );
    const paymentsSnapshot = await getDocs(paymentsQuery);
    paymentsSnapshot.forEach(docSnapshot => {
      const data = docSnapshot.data() as PaymentEntry;
      const entryDate = parseEntryDate(data.date);
      let debit = 0;
      let credit = 0;
      let description = "";

      // From Dairy's perspective for ledger:
      // Payment Received BY Dairy -> Reduces party's due to dairy (Credit for party) OR reduces dairy's advance to party (Credit for party)
      // Payment Paid BY Dairy -> Reduces dairy's due to party (Debit for party) OR reduces party's advance to dairy (Debit for party)

      if (data.type === "Received") { // Dairy received money
        credit = data.amount; // This reduces party's debit balance or increases dairy's liability (e.g. customer advance)
        description = `Payment Received by Dairy (${data.mode})`;
      } else if (data.type === "Paid") { // Dairy paid money
        debit = data.amount; // This reduces dairy's credit balance or increases party's liability (e.g. loan to employee)
        description = `Payment Paid by Dairy (${data.mode})`;
      }


      if (description) {
        ledgerEntries.push({
          id: `pa-${docSnapshot.id}`,
          date: entryDate,
          description: description,
          debit: debit,
          credit: credit,
          balance: 0,
        });
      }
    });

    ledgerEntries.sort((a, b) => {
      const dateDiff = a.date.getTime() - b.date.getTime();
      if (dateDiff !== 0) return dateDiff;

      if (a.id.startsWith('ob-')) return -1;
      if (b.id.startsWith('ob-')) return 1;
      
      const typeOrder = (id: string) => {
        if (id.startsWith('mc-') || id.startsWith('pu-')) return 1; 
        if (id.startsWith('rs-') || id.startsWith('bs-')) return 2; 
        if (id.startsWith('pa-')) return 3; // Payments after transactions
        return 4;
      };
      return typeOrder(a.id) - typeOrder(b.id);
    });

    let runningBalance = 0; // Dairy's perspective: positive = party owes dairy, negative = dairy owes party
    const finalLedgerEntries = ledgerEntries.map(entry => {
      // Debit increases amount party owes dairy / decreases amount dairy owes party
      // Credit decreases amount party owes dairy / increases amount dairy owes party
      runningBalance += (entry.debit || 0) - (entry.credit || 0);
      return { ...entry, balance: runningBalance };
    });

    console.log(`SERVER ACTION: Processed ${finalLedgerEntries.length} ledger entries for ${partyName} (${partyType}). Last balance (dairy's perspective): ${runningBalance.toFixed(2)}`);
    return finalLedgerEntries;

  } catch (error) {
    console.error(`SERVER ACTION: Error fetching transactions for party ${partyName} (${partyType}):`, error);
    return [];
  }
}


    