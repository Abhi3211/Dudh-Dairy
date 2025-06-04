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
    const partiesCollection = collection(db, 'companies', companyId, 'parties');
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
        companyId, // Add back the companyId for consistency
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
    const partiesCollection = collection(db, 'companies', partyData.companyId, 'parties');
    const q = query(
      partiesCollection, 
      where('name', '==', partyData.name), 
      where('type', '==', partyData.type)
    );
    const existingPartySnapshot = await getDocs(q);
    if (!existingPartySnapshot.empty) {
      console.warn(`SERVER ACTION: Party with name "${partyData.name}", type "${partyData.type}" already exists in this company.`);
      return { success: false, error: `Party "${partyData.name}" (${partyData.type}) already exists for this company.` };
    }

    const { companyId, ...dataToSave } = {
      ...partyData,
      openingBalance: Number(partyData.openingBalance || 0),
      openingBalanceAsOfDate: partyData.openingBalanceAsOfDate ? 
        Timestamp.fromDate(new Date(partyData.openingBalanceAsOfDate)) :
        (Number(partyData.openingBalance || 0) !== 0 ? Timestamp.now() : null)
    };

    const docRef = await addDoc(partiesCollection, dataToSave);
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

export async function deletePartyFromFirestore(
  partyId: string,
  companyId: string
): Promise<{ success: boolean; error?: string }> {
  console.log("SERVER ACTION: deletePartyFromFirestore called with partyId:", partyId);
  if (!companyId) {
    console.error("SERVER ACTION: companyId is missing in deletePartyFromFirestore.");
    return { success: false, error: "Company ID is required to delete a party." };
  }
  try {
    await deleteDoc(doc(db, 'companies', companyId, 'parties', partyId));
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

export async function getPartyTransactions(partyId: string, companyId: string): Promise<PartyLedgerEntry[]> {
  console.log(`SERVER ACTION: getPartyTransactions called for partyId: ${partyId}`);
  const ledgerEntries: PartyLedgerEntry[] = [];

  try {
    const partyDocRef = doc(db, 'companies', companyId, 'parties', partyId);
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
    const numericOpeningBalance = typeof partyData.openingBalance === 'number' ? partyData.openingBalance : 0;

    if (numericOpeningBalance !== 0) {
      const openingDate = openingBalanceDateFromPartyDoc || new Date(0); 
      let openingDebit = 0;
      let openingCredit = 0;
      if (numericOpeningBalance > 0) openingCredit = numericOpeningBalance;
      else if (numericOpeningBalance < 0) openingDebit = Math.abs(numericOpeningBalance);

      ledgerEntries.push({
        id: `ob-${partyId}`,
        companyId,
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
        collection(db, 'companies', companyId, 'milkCollections'), 
        where('customerName', '==', partyName),
        orderBy('date', 'asc')
      );
      const milkCollectionsSnapshot = await getDocs(milkCollectionsQuery);
      milkCollectionsSnapshot.forEach(docSnapshot => {
        const data = docSnapshot.data() as MilkCollectionEntry;
        ledgerEntries.push({
          id: `mc-${docSnapshot.id}`,
          companyId,
          date: parseEntryDate(data.date),
          description: `Milk Supplied (${data.quantityLtr} Ltr, ${data.fatPercentage}% FAT, Rate ${data.ratePerLtr.toFixed(2)})`,
          shift: data.shift,
          milkQuantityLtr: data.quantityLtr,
          credit: data.netAmountPayable, 
          debit: 0, 
          balance: 0,
        });
      });
    }

    // Fetch Sales (for this party & company)
    const salesQuery = query(
      collection(db, 'companies', companyId, 'sales'),
      where('customerName', '==', partyName),
      orderBy('date', 'asc')
    );
    const salesSnapshot = await getDocs(salesQuery);
    salesSnapshot.forEach(docSnapshot => {
      const data = docSnapshot.data() as SaleEntry;
      ledgerEntries.push({
        id: `s-${docSnapshot.id}`,
        companyId,
        date: parseEntryDate(data.date),
        description: `Sale (${data.description || 'No description'})`,
        debit: data.totalAmount,
        credit: 0,
        balance: 0,
      });
    });

    // Fetch Bulk Sales (for this party & company)
    const bulkSalesQuery = query(
      collection(db, 'companies', companyId, 'bulkSales'),
      where('customerName', '==', partyName),
      orderBy('date', 'asc')
    );
    const bulkSalesSnapshot = await getDocs(bulkSalesQuery);
    bulkSalesSnapshot.forEach(docSnapshot => {
      const data = docSnapshot.data() as BulkSaleEntry;
      ledgerEntries.push({
        id: `bs-${docSnapshot.id}`,
        companyId,
        date: parseEntryDate(data.date),
        description: `Bulk Sale (${data.quantityLtr} Ltr, ${data.fatPercentage}% FAT)`,
        debit: data.totalAmount,
        credit: 0,
        balance: 0,
      });
    });

    // Fetch Purchases (for this party & company)
    const purchasesQuery = query(
      collection(db, 'companies', companyId, 'purchases'),
      where('supplierName', '==', partyName),
      orderBy('date', 'asc')
    );
    const purchasesSnapshot = await getDocs(purchasesQuery);
    purchasesSnapshot.forEach(docSnapshot => {
      const data = docSnapshot.data() as PurchaseEntry;
      ledgerEntries.push({
        id: `p-${docSnapshot.id}`,
        companyId,
        date: parseEntryDate(data.date),
        description: `Purchase (${data.description || 'No description'})`,
        credit: data.totalAmount,
        debit: 0,
        balance: 0,
      });
    });

    // Fetch Payments (for this party & company)
    const paymentsQuery = query(
      collection(db, 'companies', companyId, 'payments'),
      where('partyName', '==', partyName),
      orderBy('date', 'asc')
    );
    const paymentsSnapshot = await getDocs(paymentsQuery);
    paymentsSnapshot.forEach(docSnapshot => {
      const data = docSnapshot.data() as PaymentEntry;
      ledgerEntries.push({
        id: `py-${docSnapshot.id}`,
        companyId,
        date: parseEntryDate(data.date),
        description: `Payment (${data.paymentType}) - ${data.remarks || 'No remarks'}`,
        debit: data.type === 'Paid' ? data.amount : 0,
        credit: data.type === 'Received' ? data.amount : 0,
        balance: 0,
      });
    });

    // Sort all entries by date and calculate running balance
    ledgerEntries.sort((a, b) => a.date.getTime() - b.date.getTime());
    let runningBalance = 0;
    ledgerEntries.forEach(entry => {
      runningBalance = runningBalance + entry.credit - entry.debit;
      entry.balance = runningBalance;
    });

    return ledgerEntries;
  } catch (error) {
    console.error("SERVER ACTION: Error fetching party transactions:", error);
    return [];
  }
}
