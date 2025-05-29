
'use server';

import { db } from '@/lib/firebase';
import type { Party, PartyLedgerEntry, MilkCollectionEntry } from '@/lib/types';
import { collection, addDoc, getDocs, deleteDoc, doc, query, orderBy, where, Timestamp } from 'firebase/firestore';
import { revalidatePath } from 'next/cache';

export async function getPartiesFromFirestore(): Promise<Party[]> {
  console.log("SERVER ACTION: getPartiesFromFirestore called.");
  try {
    const partiesCollection = collection(db, 'parties');
    const q = query(partiesCollection, orderBy('name', 'asc'));
    const partySnapshot = await getDocs(q);
    const partyList = partySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Party));
    console.log("SERVER ACTION: Successfully fetched parties. Count:", partyList.length);
    return partyList;
  } catch (error) {
    console.error("SERVER ACTION: Error fetching parties from Firestore:", error);
    return [];
  }
}

export async function addPartyToFirestore(partyData: Omit<Party, 'id'>): Promise<{ success: boolean; id?: string; error?: string }> {
  console.log("SERVER ACTION: addPartyToFirestore called with data:", partyData);
  try {
    const docRef = await addDoc(collection(db, 'parties'), partyData);
    console.log("SERVER ACTION: Party document successfully added to Firestore with ID:", docRef.id);
    revalidatePath('/parties'); // Revalidate to update client-side cache
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
    revalidatePath('/parties'); // Revalidate to update client-side cache
    return { success: true };
  } catch (error) {
    console.error("SERVER ACTION: Error deleting party from Firestore:", error);
     if (error instanceof Error) {
        return { success: false, error: error.message };
    }
    return { success: false, error: "An unknown error occurred" };
  }
}

export async function getPartyTransactions(partyName: string): Promise<PartyLedgerEntry[]> {
  console.log(`SERVER ACTION: getPartyTransactions called for partyName: ${partyName}`);
  const ledgerEntries: PartyLedgerEntry[] = [];

  try {
    // Fetch Milk Collections for this party
    const milkCollectionsQuery = query(
      collection(db, 'milkCollections'),
      where('customerName', '==', partyName),
      orderBy('date', 'asc') // Fetch in ascending order to calculate running balance correctly
    );
    const milkCollectionsSnapshot = await getDocs(milkCollectionsQuery);
    console.log(`SERVER ACTION: Fetched ${milkCollectionsSnapshot.docs.length} milk collection documents for ${partyName}.`);

    milkCollectionsSnapshot.forEach(docSnapshot => {
      const data = docSnapshot.data() as MilkCollectionEntry; // Assume MilkCollectionEntry structure
      let entryDate: Date;
      if (data.date instanceof Timestamp) {
        entryDate = data.date.toDate();
      } else if (typeof data.date === 'string' || typeof data.date === 'number') {
        entryDate = new Date(data.date);
      } else {
        entryDate = new Date(); // Fallback, should ideally not happen
      }

      ledgerEntries.push({
        id: `mc-${docSnapshot.id}`, // Prefix to ensure unique IDs if other transaction types are added
        date: entryDate,
        description: `Milk Supplied (${data.quantityLtr} Ltr, ${data.fatPercentage}% FAT, Rate ${data.ratePerLtr.toFixed(2)})`,
        shift: data.shift,
        milkQuantityLtr: data.quantityLtr,
        // For milk collection, dairy owes the party, so it's a credit to the party's account in the ledger
        credit: data.netAmountPayable, 
        debit: 0,
        balance: 0, // Balance will be calculated client-side or in a final processing step
      });
    });

    // TODO: Fetch Sales Entries (where partyName is customerName and paymentType is 'Credit')
    // TODO: Fetch Payment Entries (where partyName is partyName)
    // TODO: Fetch Bulk Sales (where partyName is customerName and paymentType is 'Credit')
    // TODO: Fetch Pashu Aahar Purchases (if party is a supplier and dairy bought on credit)
    // TODO: Fetch Expenses (if party is an employee and it's a salary payment or advance)

    // Sort all combined entries by date
    ledgerEntries.sort((a, b) => a.date.getTime() - b.date.getTime());
    
    // Calculate running balance
    let runningBalance = 0;
    const finalLedgerEntries = ledgerEntries.map(entry => {
      runningBalance += (entry.debit || 0) - (entry.credit || 0);
      return { ...entry, balance: runningBalance };
    });

    console.log(`SERVER ACTION: Processed ${finalLedgerEntries.length} ledger entries for ${partyName}.`);
    return finalLedgerEntries;

  } catch (error) {
    console.error(`SERVER ACTION: Error fetching transactions for party ${partyName}:`, error);
    return []; // Return empty array on error
  }
}
