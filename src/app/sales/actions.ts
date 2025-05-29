
'use server';

import type { SaleEntry } from '@/lib/types';
import { collection, addDoc, getDocs, query, orderBy, Timestamp } from 'firebase/firestore';
// Ensure db is imported from your firebase config. If firebase.ts was deleted, it needs to be restored.
// For now, assuming db will be available from a restored/correct firebase.ts
import { db } from '@/lib/firebase'; 

export async function addSaleEntryToFirestore(
  entryData: Omit<SaleEntry, 'id'>
): Promise<{ success: boolean; id?: string; error?: string }> {
  console.log("SERVER ACTION: addSaleEntryToFirestore called with data:", JSON.parse(JSON.stringify(entryData)));
  try {
    // Firestore SDK handles Date to Timestamp conversion automatically
    const docRef = await addDoc(collection(db, 'salesEntries'), entryData);
    console.log("SERVER ACTION: Sale entry successfully added to Firestore with ID:", docRef.id);
    return { success: true, id: docRef.id };
  } catch (error) {
    console.error("SERVER ACTION: Error adding sale entry to Firestore:", error);
    if (error instanceof Error) {
      return { success: false, error: error.message };
    }
    return { success: false, error: "An unknown error occurred" };
  }
}

export async function getSaleEntriesFromFirestore(): Promise<SaleEntry[]> {
  console.log("SERVER ACTION: getSaleEntriesFromFirestore called.");
  try {
    const entriesCollection = collection(db, 'salesEntries');
    const q = query(entriesCollection, orderBy('date', 'desc'));
    const entrySnapshot = await getDocs(q);
    console.log(`SERVER ACTION: Fetched ${entrySnapshot.docs.length} sale documents from Firestore.`);

    if (entrySnapshot.empty) {
      console.log("SERVER ACTION: No documents found in 'salesEntries'. Returning empty array.");
      return [];
    }

    const entryList = entrySnapshot.docs.map(doc => {
      const data = doc.data();
      // Ensure date conversion from Firestore Timestamp to JS Date
      let entryDate: Date;
      if (data.date instanceof Timestamp) {
        entryDate = data.date.toDate();
      } else if (typeof data.date === 'string' || typeof data.date === 'number') {
        console.warn(`SERVER ACTION (Sales): Document ID ${doc.id} 'date' field is not a Firestore Timestamp. Attempting to parse. Value:`, data.date);
        entryDate = new Date(data.date);
      } else {
        console.error(`SERVER ACTION (Sales): Document ID ${doc.id} has an invalid 'date' field. Using current date as fallback. Value:`, data.date);
        entryDate = new Date(); 
      }

      return {
        id: doc.id,
        date: entryDate,
        customerName: data.customerName || "Unknown Customer",
        productName: data.productName || "Unknown Product",
        quantity: typeof data.quantity === 'number' ? data.quantity : 0,
        unit: data.unit || "unit", // Provide a sensible default or ensure it's always set
        rate: typeof data.rate === 'number' ? data.rate : 0,
        totalAmount: typeof data.totalAmount === 'number' ? data.totalAmount : 0,
        paymentType: data.paymentType || "Cash",
      } as SaleEntry;
    });
    console.log("SERVER ACTION: Successfully processed sale entries. Mapped entries count:", entryList.length);
    return entryList;
  } catch (error) {
    console.error("SERVER ACTION: Error fetching sale entries from Firestore:", error);
     if (error instanceof Error) {
        console.error("SERVER ACTION: Error name:", error.name, "Error message:", error.message);
    }
    return [];
  }
}
