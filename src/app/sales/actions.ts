
'use server';

import type { SaleEntry } from '@/lib/types';
import { collection, addDoc, getDocs, query, orderBy, Timestamp, doc, updateDoc, deleteDoc, where } from 'firebase/firestore';
import { db } from '@/lib/firebase'; 

export async function addSaleEntryToFirestore(
  entryData: Omit<SaleEntry, 'id'> & { companyId: string } // Ensure companyId is present
): Promise<{ success: boolean; id?: string; error?: string }> {
  console.log("SERVER ACTION: addSaleEntryToFirestore called with data:", JSON.parse(JSON.stringify(entryData)));
  if (!entryData.companyId) {
    console.error("SERVER ACTION: companyId is missing in addSaleEntryToFirestore.");
    return { success: false, error: "Company ID is required to add a sale entry." };
  }
  try {
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

export async function getSaleEntriesFromFirestore(companyId: string): Promise<SaleEntry[]> {
  console.log(`SERVER ACTION: getSaleEntriesFromFirestore called for companyId: ${companyId}`);
  if (!companyId) {
    console.warn("SERVER ACTION: getSaleEntriesFromFirestore called without a companyId. Returning empty array.");
    return [];
  }
  try {
    const entriesCollection = collection(db, 'salesEntries');
    const q = query(
      entriesCollection, 
      where('companyId', '==', companyId), 
      orderBy('date', 'desc')
    );
    const entrySnapshot = await getDocs(q);
    console.log(`SERVER ACTION: Fetched ${entrySnapshot.docs.length} sale documents from Firestore for companyId ${companyId}.`);

    if (entrySnapshot.empty) {
      console.log(`SERVER ACTION: No documents found in 'salesEntries' for companyId ${companyId}. Returning empty array.`);
      return [];
    }

    const entryList = entrySnapshot.docs.map(docSnapshot => {
      const data = docSnapshot.data();
      let entryDate: Date;
      if (data.date instanceof Timestamp) {
        entryDate = data.date.toDate();
      } else if (typeof data.date === 'string' || typeof data.date === 'number') {
        console.warn(`SERVER ACTION (Sales): Document ID ${docSnapshot.id} 'date' field is not a Firestore Timestamp. Attempting to parse. Value:`, data.date);
        entryDate = new Date(data.date);
      } else {
        console.error(`SERVER ACTION (Sales): Document ID ${docSnapshot.id} has an invalid 'date' field. Using current date as fallback. Value:`, data.date);
        entryDate = new Date(); 
      }

      return {
        id: docSnapshot.id,
        companyId: data.companyId, // Ensure companyId is mapped
        date: entryDate,
        customerName: data.customerName || "Unknown Customer",
        productName: data.productName || "Unknown Product",
        quantity: typeof data.quantity === 'number' ? data.quantity : 0,
        unit: data.unit || "unit",
        rate: typeof data.rate === 'number' ? data.rate : 0,
        totalAmount: typeof data.totalAmount === 'number' ? data.totalAmount : 0,
        paymentType: data.paymentType || "Cash",
      } as SaleEntry;
    });
    console.log("SERVER ACTION: Successfully processed sale entries. Mapped entries count:", entryList.length);
    return entryList;
  } catch (error) {
    console.error(`SERVER ACTION: Error fetching sale entries from Firestore for companyId ${companyId}:`, error);
     if (error instanceof Error) {
        console.error("SERVER ACTION: Error name:", error.name, "Error message:", error.message);
    }
    return [];
  }
}

export async function updateSaleEntryInFirestore(
  entryId: string,
  entryData: Omit<SaleEntry, 'id'> & { companyId: string } // Ensure companyId is present
): Promise<{ success: boolean; error?: string }> {
  console.log(`SERVER ACTION: updateSaleEntryInFirestore called for ID: ${entryId} with data:`, JSON.parse(JSON.stringify(entryData)));
  if (!entryData.companyId) {
    console.error("SERVER ACTION: companyId is missing in updateSaleEntryInFirestore.");
    return { success: false, error: "Company ID is required to update a sale entry." };
  }
  try {
    const entryRef = doc(db, 'salesEntries', entryId);
    // Firestore rules should enforce that the user can only update entries belonging to their company.
    await updateDoc(entryRef, entryData);
    console.log(`SERVER ACTION: Sale entry with ID: ${entryId} successfully updated.`);
    return { success: true };
  } catch (error) {
    console.error(`SERVER ACTION: Error updating sale entry with ID: ${entryId}:`, error);
    if (error instanceof Error) {
      return { success: false, error: error.message };
    }
    return { success: false, error: "An unknown error occurred" };
  }
}

export async function deleteSaleEntryFromFirestore(
  entryId: string
  // companyId is not strictly needed here for the action, as deletion is by ID.
  // Firestore rules will protect against unauthorized deletion.
): Promise<{ success: boolean; error?: string }> {
  console.log(`SERVER ACTION: deleteSaleEntryFromFirestore called for ID: ${entryId}`);
  try {
    const entryRef = doc(db, 'salesEntries', entryId);
    await deleteDoc(entryRef);
    console.log(`SERVER ACTION: Sale entry with ID: ${entryId} successfully deleted.`);
    return { success: true };
  } catch (error) {
    console.error(`SERVER ACTION: Error deleting sale entry with ID: ${entryId}:`, error);
    if (error instanceof Error) {
      return { success: false, error: error.message };
    }
    return { success: false, error: "An unknown error occurred" };
  }
}
