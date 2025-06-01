
'use server';

import { db } from '@/lib/firebase';
import type { Party, PartyLedgerEntry, MilkCollectionEntry, SaleEntry, BulkSaleEntry, PurchaseEntry, PaymentEntry } from '@/lib/types';
import { collection, addDoc, getDocs, deleteDoc, doc, query, orderBy, where, Timestamp, getDoc } from 'firebase/firestore';
import { revalidatePath } from 'next/cache';
import { parseEntryDate } from '@/lib/utils';

export async function getPartiesFromFirestore(companyId: string): Promise<Party[]> {
  console.log(`SERVER ACTION: getPartiesFromFirestore called for companyId: ${companyId}.`);
  if (!companyId) {
    console.warn("SERVER ACTION: getPartiesFromFirestore called without a companyId. Returning empty array.");
    return [];
  }
  try {
    const partiesCollection = collection(db, 'parties');
    const q = query(partiesCollection, where('companyId', '==', companyId), orderBy('name', 'asc'));
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
        companyId: data.companyId, // Ensure companyId is included
        name: data.name,
        type: data.type,
        openingBalance: numericOpeningBalance,
        openingBalanceAsOfDate: openingBalanceDate,
      } as Party;
    });
    console.log(`SERVER ACTION: Successfully fetched parties for companyId ${companyId}. Count:`, partyList.length);
    if (partyList.length > 0) {
        console.log("SERVER ACTION: Sample fetched party data (first party):", JSON.parse(JSON.stringify(partyList[0])));
    }
    return partyList;
  } catch (error) {
    console.error(`SERVER ACTION: Error fetching parties from Firestore for companyId ${companyId}:`, error);
    return [];
  }
}

export async function addPartyToFirestore(
  partyData: Omit<Party, 'id'> & { companyId: string }
): Promise<{ success: boolean; id?: string; error?: string }> {
  console.log("SERVER ACTION: addPartyToFirestore called with data:", JSON.parse(JSON.stringify(partyData)));
  if (!partyData.companyId) {
    console.error("SERVER ACTION: companyId is missing in addPartyToFirestore.");
    return { success: false, error: "Company ID is required to add a party." };
  }
  try {
    const partiesCollection = collection(db, 'parties');
    const q = query(
      partiesCollection, 
      where('name', '==', partyData.name), 
      where('type', '==', partyData.type),
      where('companyId', '==', partyData.companyId) // Check within the same company
    );
    const existingPartySnapshot = await getDocs(q);
    if (!existingPartySnapshot.empty) {
      console.warn(`SERVER ACTION: Party with name "${partyData.name}", type "${partyData.type}" and companyId "${partyData.companyId}" already exists.`);
      return { success: false, error: `Party "${partyData.name}" (${partyData.type}) already exists for this company.` };
    }

    const dataToSave: any = {
      companyId: partyData.companyId,
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
    revalidatePath('/milk-collection'); // Parties used in many places
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

// deletePartyFromFirestore: No change needed for companyId here, rules protect.
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
    if (!partyData.companyId) {
        console.error(`SERVER ACTION: Party with ID ${partyId} is missing companyId. Cannot generate ledger.`);
        return [];
    }
    const partyCompanyId = partyData.companyId;
    const partyName = partyData.name;
    const partyType = partyData.type;

    let openingBalanceDateFromPartyDoc: Date | undefined = undefined;
    if (partyData.openingBalanceAsOfDate) { 
        openingBalanceDateFromPartyDoc = parseEntryDate(partyData.openingBalanceAsOfDate);
    }
    const numericOpeningBalance = typeof partyData.openingBalance === 'number' ? partyData.openingBalance : 0;

    if (numericOpeningBalance !== 0) {
      const openingDate = openingBalanceDateFromPartyDoc || new Date(0); 
      let openingDebit = 0;
      let openingCredit = 0;
      if (numericOpeningBalance > 0) openingCredit = numericOpeningBalance;
      else if (numericOpeningBalance < 0) openingDebit = Math.abs(numericOpeningBalance);

      ledgerEntries.push({
        id: `ob-${partyId}`,
        companyId: partyCompanyId,
        date: openingDate,
        description: "Opening Balance",
        debit: openingDebit,
        credit: openingCredit,
        balance: 0,
      });
    }

    // Fetch Milk Collections (for this party & company)
    if (partyType === "Customer") { // Milk collection customers are suppliers to the dairy
      const milkCollectionsQuery = query(
        collection(db, 'milkCollections'), 
        where('customerName', '==', partyName),
        where('companyId', '==', partyCompanyId), // Ensure companyId match
        orderBy('date', 'asc')
      );
      const milkCollectionsSnapshot = await getDocs(milkCollectionsQuery);
      milkCollectionsSnapshot.forEach(docSnapshot => {
        const data = docSnapshot.data() as MilkCollectionEntry;
        ledgerEntries.push({
          id: `mc-${docSnapshot.id}`,
          companyId: partyCompanyId,
          date: parseEntryDate(data.date),
          description: `Milk Supplied (${data.quantityLtr} Ltr, ${data.fatPercentage}% FAT, Rate ${data.ratePerLtr.toFixed(2)})`,
          shift: data.shift,
          milkQuantityLtr: data.quantityLtr,
          credit: data.netAmountPayable, debit: 0, balance: 0,
        });
      });
    }

    // Fetch Retail Sales (for this party & company on credit)
    if (partyType === "Customer") {
      const salesQuery = query(
        collection(db, 'salesEntries'), 
        where('customerName', '==', partyName),
        where('paymentType', '==', 'Credit'),
        where('companyId', '==', partyCompanyId), // Ensure companyId match
        orderBy('date', 'asc')
      );
      const salesSnapshot = await getDocs(salesQuery);
      salesSnapshot.forEach(docSnapshot => {
        const data = docSnapshot.data() as SaleEntry;
        ledgerEntries.push({
          id: `rs-${docSnapshot.id}`,
          companyId: partyCompanyId,
          date: parseEntryDate(data.date),
          description: `Retail Sale: ${data.productName} (${data.quantity} ${data.unit})`,
          debit: data.totalAmount, credit: 0, balance: 0,
        });
      });
    }

    // Fetch Bulk Sales (for this party & company on credit)
    if (partyType === "Customer") {
      const bulkSalesQuery = query(
        collection(db, 'bulkSalesEntries'), 
        where('customerName', '==', partyName),
        where('paymentType', '==', 'Credit'),
        where('companyId', '==', partyCompanyId), // Ensure companyId match
        orderBy('date', 'asc')
      );
      const bulkSalesSnapshot = await getDocs(bulkSalesQuery);
      bulkSalesSnapshot.forEach(docSnapshot => {
        const data = docSnapshot.data() as BulkSaleEntry;
        ledgerEntries.push({
          id: `bs-${docSnapshot.id}`,
          companyId: partyCompanyId,
          date: parseEntryDate(data.date),
          description: `Bulk Milk Sale (${data.quantityLtr} Ltr)`,
          shift: data.shift,
          debit: data.totalAmount, credit: 0, balance: 0,
        });
      });
    }

    // Fetch Purchases (for this party & company on credit)
    if (partyType === "Supplier") {
      const purchasesQuery = query(
        collection(db, 'purchaseEntries'), 
        where('supplierName', '==', partyName),
        where('paymentType', '==', 'Credit'),
        where('companyId', '==', partyCompanyId), // Ensure companyId match
        orderBy('date', 'asc')
      );
      const purchasesSnapshot = await getDocs(purchasesQuery);
      purchasesSnapshot.forEach(docSnapshot => {
        const data = docSnapshot.data() as PurchaseEntry;
        ledgerEntries.push({
          id: `pu-${docSnapshot.id}`,
          companyId: partyCompanyId,
          date: parseEntryDate(data.date),
          description: `Purchase: ${data.productName} (${data.quantity} ${data.unit})`,
          credit: data.totalAmount, debit: 0, balance: 0,
        });
      });
    }

    // Fetch Payment Entries (for this party & company)
    const paymentsQuery = query(
      collection(db, 'paymentEntries'), 
      where('partyName', '==', partyName),
      where('partyType', '==', partyType),
      where('companyId', '==', partyCompanyId), // Ensure companyId match
      orderBy('date', 'asc')
    );
    const paymentsSnapshot = await getDocs(paymentsQuery);
    paymentsSnapshot.forEach(docSnapshot => {
      const data = docSnapshot.data() as PaymentEntry;
      let debit = 0; let credit = 0; let description = "";
      if (data.type === "Received") { credit = data.amount; description = `Payment Received by Dairy (${data.mode})`; }
      else if (data.type === "Paid") { debit = data.amount; description = `Payment Paid by Dairy (${data.mode})`; }
      if (description) {
        ledgerEntries.push({
          id: `pa-${docSnapshot.id}`,
          companyId: partyCompanyId,
          date: parseEntryDate(data.date),
          description, debit, credit, balance: 0,
        });
      }
    });

    ledgerEntries.sort((a, b) => {
      const dateDiff = a.date.getTime() - b.date.getTime();
      if (dateDiff !== 0) return dateDiff;
      if (a.id.startsWith('ob-')) return -1; if (b.id.startsWith('ob-')) return 1;
      const typeOrder = (id: string) => {
        if (id.startsWith('mc-') || id.startsWith('pu-')) return 1; 
        if (id.startsWith('rs-') || id.startsWith('bs-')) return 2; 
        if (id.startsWith('pa-')) return 3;
        return 4;
      };
      return typeOrder(a.id) - typeOrder(b.id);
    });

    let runningBalance = 0;
    const finalLedgerEntries = ledgerEntries.map(entry => {
      runningBalance += (entry.debit || 0) - (entry.credit || 0);
      return { ...entry, balance: runningBalance };
    });

    console.log(`SERVER ACTION: Processed ${finalLedgerEntries.length} ledger entries for ${partyName} (${partyType}, company ${partyCompanyId}). Last balance: ${runningBalance.toFixed(2)}`);
    return finalLedgerEntries;

  } catch (error) {
    console.error(`SERVER ACTION: Error fetching transactions for party ${partyId}:`, error);
    return [];
  }
}
