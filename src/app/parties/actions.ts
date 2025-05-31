
'use server';

import { db } from '@/lib/firebase';
import type { Party, PartyLedgerEntry, MilkCollectionEntry, SaleEntry, BulkSaleEntry, PurchaseEntry, PaymentEntry } from '@/lib/types';
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
    // Check if party with the same name and type already exists
    const partiesCollection = collection(db, 'parties');
    const q = query(partiesCollection, where('name', '==', partyData.name), where('type', '==', partyData.type));
    const existingPartySnapshot = await getDocs(q);
    if (!existingPartySnapshot.empty) {
      console.warn(`SERVER ACTION: Party with name "${partyData.name}" and type "${partyData.type}" already exists.`);
      return { success: false, error: `Party "${partyData.name}" (${partyData.type}) already exists.` };
    }

    const docRef = await addDoc(collection(db, 'parties'), partyData);
    console.log("SERVER ACTION: Party document successfully added to Firestore with ID:", docRef.id);
    revalidatePath('/parties');
    revalidatePath('/milk-collection'); // Revalidate related pages
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

// Helper to parse date consistently
const parseEntryDate = (dateField: Timestamp | Date | string | number): Date => {
  if (dateField instanceof Timestamp) {
    return dateField.toDate();
  }
  if (dateField instanceof Date) {
    return dateField;
  }
  return new Date(dateField);
};


export async function getPartyTransactions(partyName: string, partyType: Party['type']): Promise<PartyLedgerEntry[]> {
  console.log(`SERVER ACTION: getPartyTransactions called for partyName: ${partyName}, type: ${partyType}`);
  const ledgerEntries: PartyLedgerEntry[] = [];

  try {
    // Fetch Milk Collections (Party is a milk supplier)
    if (partyType === "Customer") { // Assuming 'Customer' type in Parties collection can also be a milk supplier
      const milkCollectionsQuery = query(
        collection(db, 'milkCollections'),
        where('customerName', '==', partyName),
        orderBy('date', 'asc')
      );
      const milkCollectionsSnapshot = await getDocs(milkCollectionsQuery);
      milkCollectionsSnapshot.forEach(docSnapshot => {
        const data = docSnapshot.data() as MilkCollectionEntry;
        const entryDate = parseEntryDate(data.date);
        ledgerEntries.push({
          id: `mc-${docSnapshot.id}`,
          date: entryDate,
          description: `Milk Supplied (${data.quantityLtr} Ltr, ${data.fatPercentage}% FAT, Rate ${data.ratePerLtr.toFixed(2)})`,
          shift: data.shift,
          milkQuantityLtr: data.quantityLtr,
          credit: data.netAmountPayable, // Dairy owes the party
          debit: 0,
          balance: 0,
        });
      });
    }

    // Fetch Retail Sales (Party is a customer buying goods)
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
        ledgerEntries.push({
          id: `rs-${docSnapshot.id}`,
          date: entryDate,
          description: `Retail Sale: ${data.productName} (${data.quantity} ${data.unit})`,
          debit: data.totalAmount, // Party owes the dairy
          credit: 0,
          balance: 0,
        });
      });
    }
    
    // Fetch Bulk Sales (Party is a customer buying bulk milk)
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
        ledgerEntries.push({
          id: `bs-${docSnapshot.id}`,
          date: entryDate,
          description: `Bulk Milk Sale (${data.quantityLtr} Ltr)`,
          shift: data.shift,
          debit: data.totalAmount, // Party owes the dairy
          credit: 0,
          balance: 0,
        });
      });
    }

    // Fetch Purchases (Party is a supplier from whom dairy bought goods)
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
        ledgerEntries.push({
          id: `pu-${docSnapshot.id}`,
          date: entryDate,
          description: `Purchase: ${data.productName} (${data.quantity} ${data.unit})`,
          credit: data.totalAmount, // Dairy owes the party
          debit: 0,
          balance: 0,
        });
      });
    }

    // Fetch Payment Entries
    const paymentsQuery = query(
      collection(db, 'paymentEntries'),
      where('partyName', '==', partyName),
      where('partyType', '==', partyType), // Ensure payment is for the correct party type context
      orderBy('date', 'asc')
    );
    const paymentsSnapshot = await getDocs(paymentsQuery);
    paymentsSnapshot.forEach(docSnapshot => {
      const data = docSnapshot.data() as PaymentEntry;
      const entryDate = parseEntryDate(data.date);
      let debit = 0;
      let credit = 0;
      let description = "";

      if (partyType === "Customer") {
        if (data.type === "Received") { // Customer paid dairy
          credit = data.amount;
          description = `Payment Received (${data.mode})`;
        } else if (data.type === "Paid") { // Dairy paid customer (e.g., refund)
          debit = data.amount;
          description = `Payment Paid/Refund (${data.mode})`;
        }
      } else if (partyType === "Supplier") {
        if (data.type === "Paid") { // Dairy paid supplier
          debit = data.amount;
          description = `Payment Paid (${data.mode})`;
        } else if (data.type === "Received") { // Dairy received from supplier (e.g., refund)
          credit = data.amount;
          description = `Payment Received/Refund (${data.mode})`;
        }
      }
      // For 'Employee' type, payments 'Paid' would be debits (reducing what's owed to them if advances were credits)
      // or direct debits representing salary payments. 'Received' would be credits (e.g. employee repaying advance).
      // Current ledger focuses on Customer/Supplier. Employee ledger might need different perspective.
      // For now, employee payments don't create entries in this ledger unless extended.

      if (description) { // Only add if payment type makes sense for this party ledger
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

    // Sort all combined entries by date (primary) and then by a rough transaction type order for same-day
    ledgerEntries.sort((a, b) => {
      const dateDiff = a.date.getTime() - b.date.getTime();
      if (dateDiff !== 0) return dateDiff;
      // Define a sort order for transaction types if dates are the same
      const typeOrder = (id: string) => {
        if (id.startsWith('mc-')) return 1; // milk collection (credit to party)
        if (id.startsWith('pu-')) return 2; // purchase (credit to party)
        if (id.startsWith('rs-') || id.startsWith('bs-')) return 3; // sales (debit to party)
        if (id.startsWith('pa-') && (a.credit || 0) > 0) return 4; // payment received by dairy (credit to party)
        if (id.startsWith('pa-') && (a.debit || 0) > 0) return 5; // payment paid by dairy (debit to party)
        return 6;
      };
      return typeOrder(a.id) - typeOrder(b.id);
    });
    
    // Calculate running balance
    let runningBalance = 0;
    const finalLedgerEntries = ledgerEntries.map(entry => {
      runningBalance += (entry.debit || 0) - (entry.credit || 0);
      // If party is a supplier, a positive balance means dairy owes them.
      // If party is a customer, a positive balance means customer owes dairy.
      // The interpretation of "positive means owes us" vs "positive means we owe" depends on perspective.
      // For this ledger, let's make it consistent:
      // Debit increases balance (Party owes more, or we owe less)
      // Credit decreases balance (Party owes less, or we owe more)
      // So, for a supplier, a purchase makes our debt to them increase (credit), so balance decreases (becomes more negative).
      // A payment to supplier (debit) makes our debt decrease (balance increases, becomes less negative or positive).
      
      // Re-evaluating balance logic for clarity:
      // Let positive balance mean: Party owes Dairy.
      // Let negative balance mean: Dairy owes Party.

      // Milk Collection (from Customer as supplier of milk): netAmountPayable is credit to party -> balance decreases (more negative)
      // Retail/Bulk Sale (to Customer, on credit): totalAmount is debit to party -> balance increases (more positive)
      // Purchase (from Supplier, on credit): totalAmount is credit to party -> balance decreases (more negative as Dairy owes Supplier)
      // Payment Received (from Customer): credit to party -> balance decreases (less positive)
      // Payment Paid (to Supplier): debit to party -> balance increases (less negative, as Dairy paid off some debt)

      return { ...entry, balance: runningBalance };
    });

    console.log(`SERVER ACTION: Processed ${finalLedgerEntries.length} ledger entries for ${partyName}. Last balance: ${runningBalance}`);
    return finalLedgerEntries;

  } catch (error) {
    console.error(`SERVER ACTION: Error fetching transactions for party ${partyName}:`, error);
    return []; 
  }
}


    