
'use server';

import { db } from '@/lib/firebase';
import type { BulkSaleEntry } from '@/lib/types';
import { collection, addDoc, getDocs, query, orderBy, Timestamp, doc, updateDoc, deleteDoc } from 'firebase/firestore';

export async function addBulkSaleEntryToFirestore(
  entryData: Omit<BulkSaleEntry, 'id'>
): Promise<{ success: boolean; id?: string; error?: string }> {
  console.log("SERVER ACTION: addBulkSaleEntryToFirestore called with data:", JSON.parse(JSON.stringify(entryData)));
  try {
    const docRef = await addDoc(collection(db, 'bulkSalesEntries'), entryData);
    console.log("SERVER ACTION: Bulk sale entry successfully added to Firestore with ID:", docRef.id);
    return { success: true, id: docRef.id };
  } catch (error) {
    console.error("SERVER ACTION: Error adding bulk sale entry to Firestore:", error);
    if (error instanceof Error) {
      return { success: false, error: error.message };
    }
    return { success: false, error: "An unknown error occurred" };
  }
}

export async function getBulkSaleEntriesFromFirestore(): Promise<BulkSaleEntry[]> {
  console.log("SERVER ACTION: getBulkSaleEntriesFromFirestore called.");
  try {
    const entriesCollection = collection(db, 'bulkSalesEntries');
    const q = query(entriesCollection, orderBy('date', 'desc'));
    const entrySnapshot = await getDocs(q);
    console.log(`SERVER ACTION: Fetched ${entrySnapshot.docs.length} bulk sale documents from Firestore.`);

    if (entrySnapshot.empty) {
      console.log("SERVER ACTION: No documents found in 'bulkSalesEntries'. Returning empty array.");
      return [];
    }

    const entryList = entrySnapshot.docs.map(docSnapshot => {
      const data = docSnapshot.data();
      let entryDate: Date;
      if (data.date instanceof Timestamp) {
        entryDate = data.date.toDate();
      } else if (typeof data.date === 'string' || typeof data.date === 'number') {
        entryDate = new Date(data.date);
      } else {
        entryDate = new Date();
      }

      return {
        id: docSnapshot.id,
        date: entryDate,
        customerName: data.customerName || "Unknown Customer",
        quantityLtr: typeof data.quantityLtr === 'number' ? data.quantityLtr : 0,
        fatPercentage: typeof data.fatPercentage === 'number' ? data.fatPercentage : 0,
        rateFactor: typeof data.rateFactor === 'number' ? data.rateFactor : 0,
        totalAmount: typeof data.totalAmount === 'number' ? data.totalAmount : 0,
        paymentType: data.paymentType || "Cash",
        remarks: typeof data.remarks === 'string' ? data.remarks : "",
      } as BulkSaleEntry;
    });
    console.log("SERVER ACTION: Successfully processed bulk sale entries. Count:", entryList.length);
    return entryList;
  } catch (error) {
    console.error("SERVER ACTION: Error fetching bulk sale entries from Firestore:", error);
    return [];
  }
}

export async function updateBulkSaleEntryInFirestore(
  entryId: string,
  entryData: Omit<BulkSaleEntry, 'id'>
): Promise<{ success: boolean; error?: string }> {
  console.log(`SERVER ACTION: updateBulkSaleEntryInFirestore called for ID: ${entryId} with data:`, JSON.parse(JSON.stringify(entryData)));
  try {
    const entryRef = doc(db, 'bulkSalesEntries', entryId);
    await updateDoc(entryRef, entryData);
    console.log(`SERVER ACTION: Bulk sale entry with ID: ${entryId} successfully updated.`);
    return { success: true };
  } catch (error) {
    console.error(`SERVER ACTION: Error updating bulk sale entry with ID: ${entryId}:`, error);
    if (error instanceof Error) {
      return { success: false, error: error.message };
    }
    return { success: false, error: "An unknown error occurred" };
  }
}

export async function deleteBulkSaleEntryFromFirestore(
  entryId: string
): Promise<{ success: boolean; error?: string }> {
  console.log(`SERVER ACTION: deleteBulkSaleEntryFromFirestore called for ID: ${entryId}`);
  try {
    const entryRef = doc(db, 'bulkSalesEntries', entryId);
    await deleteDoc(entryRef);
    console.log(`SERVER ACTION: Bulk sale entry with ID: ${entryId} successfully deleted.`);
    return { success: true };
  } catch (error) {
    console.error(`SERVER ACTION: Error deleting bulk sale entry with ID: ${entryId}:`, error);
    if (error instanceof Error) {
      return { success: false, error: error.message };
    }
    return { success: false, error: "An unknown error occurred" };
  }
}
