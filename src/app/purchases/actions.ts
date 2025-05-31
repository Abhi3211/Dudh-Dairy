
'use server';

import { db } from '@/lib/firebase';
import type { PurchaseEntry } from '@/lib/types';
import { collection, addDoc, getDocs, query, orderBy, Timestamp, doc, updateDoc, deleteDoc, where, writeBatch } from 'firebase/firestore';

export async function addPurchaseEntryToFirestore(
  entryData: Omit<PurchaseEntry, 'id'>
): Promise<{ success: boolean; id?: string; error?: string }> {
  console.log("SERVER ACTION: addPurchaseEntryToFirestore called with data:", JSON.parse(JSON.stringify(entryData)));
  try {
    const docRef = await addDoc(collection(db, 'purchaseEntries'), {
      ...entryData,
      date: Timestamp.fromDate(entryData.date), // Ensure date is a Timestamp
    });
    console.log("SERVER ACTION: Purchase entry successfully added to Firestore with ID:", docRef.id);
    return { success: true, id: docRef.id };
  } catch (error) {
    console.error("SERVER ACTION: Error adding purchase entry to Firestore:", error);
    if (error instanceof Error) {
      return { success: false, error: error.message };
    }
    return { success: false, error: "An unknown error occurred" };
  }
}

export async function getPurchaseEntriesFromFirestore(): Promise<PurchaseEntry[]> {
  console.log("SERVER ACTION: Attempting to fetch purchase entries from Firestore.");
  try {
    const entriesCollection = collection(db, 'purchaseEntries');
    const q = query(entriesCollection, orderBy('date', 'desc'));
    const entrySnapshot = await getDocs(q);
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
        category: data.category || "Unknown",
        productName: data.productName || "Unknown Product",
        supplierName: data.supplierName || "",
        quantity: typeof data.quantity === 'number' ? data.quantity : 0,
        unit: data.unit || "unit",
        pricePerUnit: typeof data.pricePerUnit === 'number' ? data.pricePerUnit : 0,
        defaultSalePricePerUnit: typeof data.defaultSalePricePerUnit === 'number' ? data.defaultSalePricePerUnit : undefined,
        totalAmount: typeof data.totalAmount === 'number' ? data.totalAmount : 0,
        paymentType: data.paymentType || "Credit",
      } as PurchaseEntry;
    });
    console.log("SERVER ACTION: Successfully fetched purchase entries, count:", entryList.length);
    return entryList;
  } catch (error) {
    console.error("SERVER ACTION: Error fetching purchase entries from Firestore:", error);
    return [];
  }
}

export async function updatePurchaseEntryInFirestore(
  entryId: string,
  entryData: Omit<PurchaseEntry, 'id'>
): Promise<{ success: boolean; error?: string }> {
  console.log(`SERVER ACTION: updatePurchaseEntryInFirestore called for ID: ${entryId} with data:`, JSON.parse(JSON.stringify(entryData)));
  try {
    const entryRef = doc(db, 'purchaseEntries', entryId);
    await updateDoc(entryRef, {
      ...entryData,
      date: Timestamp.fromDate(entryData.date), // Ensure date is a Timestamp
    });
    console.log(`SERVER ACTION: Purchase entry with ID: ${entryId} successfully updated.`);
    return { success: true };
  } catch (error) {
    console.error(`SERVER ACTION: Error updating purchase entry with ID: ${entryId}:`, error);
    if (error instanceof Error) {
      return { success: false, error: error.message };
    }
    return { success: false, error: "An unknown error occurred" };
  }
}

export async function deletePurchaseEntryFromFirestore(
  entryId: string
): Promise<{ success: boolean; error?: string }> {
  console.log(`SERVER ACTION: deletePurchaseEntryFromFirestore called for ID: ${entryId}`);
  try {
    const entryRef = doc(db, 'purchaseEntries', entryId);
    await deleteDoc(entryRef);
    console.log(`SERVER ACTION: Purchase entry with ID: ${entryId} successfully deleted.`);
    return { success: true };
  } catch (error) {
    console.error(`SERVER ACTION: Error deleting purchase entry with ID: ${entryId}:`, error);
    if (error instanceof Error) {
      return { success: false, error: error.message };
    }
    return { success: false, error: "An unknown error occurred" };
  }
}

export async function getUniquePurchasedProductNames(category?: string): Promise<string[]> {
  console.log(`SERVER ACTION: getUniquePurchasedProductNames called. Category: ${category}`);
  const productNames = new Set<string>();
  try {
    const entriesCollection = collection(db, 'purchaseEntries');
    let q = query(entriesCollection);
    if (category) {
      q = query(entriesCollection, where('category', '==', category));
    }
    const entrySnapshot = await getDocs(q);
    if (!entrySnapshot.empty) {
      entrySnapshot.docs.forEach(docSnapshot => {
        const data = docSnapshot.data();
        if (data.productName && typeof data.productName === 'string') {
          productNames.add(data.productName.trim());
        }
      });
    }
    const uniqueNamesArray = Array.from(productNames).sort((a, b) => a.localeCompare(b));
    console.log(`SERVER ACTION: Found ${uniqueNamesArray.length} unique purchased product names. Category: ${category}`);
    return uniqueNamesArray;
  } catch (error) {
    console.error("SERVER ACTION: Error fetching unique purchased product names:", error);
    return [];
  }
}

export async function getUniqueCategoriesFromFirestore(): Promise<string[]> {
  console.log(`SERVER ACTION: getUniqueCategoriesFromFirestore called.`);
  const categoryNames = new Set<string>();
  try {
    const entriesCollection = collection(db, 'purchaseEntries');
    const q = query(entriesCollection); // No specific where clause, get all
    const entrySnapshot = await getDocs(q);
    if (!entrySnapshot.empty) {
      entrySnapshot.docs.forEach(docSnapshot => {
        const data = docSnapshot.data();
        if (data.category && typeof data.category === 'string') {
          categoryNames.add(data.category.trim());
        }
      });
    }
    const uniqueNamesArray = Array.from(categoryNames).sort((a, b) => a.localeCompare(b));
    console.log(`SERVER ACTION: Found ${uniqueNamesArray.length} unique category names.`);
    return uniqueNamesArray;
  } catch (error) {
    console.error("SERVER ACTION: Error fetching unique category names:", error);
    return [];
  }
}

// If you had data in 'pashuAaharTransactions' and want to migrate it to 'purchaseEntries'
// This is a one-time utility function. Do not call it repeatedly.
// Ensure 'category' and 'unit' are set appropriately for Pashu Aahar.
export async function migratePashuAaharToPurchases(): Promise<{ success: boolean; count: number; error?: string }> {
  console.log("SERVER ACTION: Starting migration of pashuAaharTransactions to purchaseEntries.");
  const oldCollectionRef = collection(db, 'pashuAaharTransactions');
  const newCollectionRef = collection(db, 'purchaseEntries');
  let migratedCount = 0;

  try {
    const snapshot = await getDocs(oldCollectionRef);
    if (snapshot.empty) {
      console.log("SERVER ACTION: No documents in pashuAaharTransactions to migrate.");
      return { success: true, count: 0 };
    }

    const batch = writeBatch(db);
    snapshot.forEach(docSnapshot => {
      const oldData = docSnapshot.data();
      const newEntryData: Omit<PurchaseEntry, 'id'> = {
        date: oldData.date instanceof Timestamp ? oldData.date.toDate() : new Date(oldData.date),
        category: "Pashu Aahar", // Assuming all old entries were Pashu Aahar
        productName: oldData.productName || "Unknown Pashu Aahar",
        supplierName: oldData.supplierOrCustomerName || "",
        quantity: typeof oldData.quantityBags === 'number' ? oldData.quantityBags : 0,
        unit: "Bags", // Assuming all old entries were in Bags
        pricePerUnit: typeof oldData.pricePerBag === 'number' ? oldData.pricePerBag : 0,
        defaultSalePricePerUnit: typeof oldData.salePricePerBag === 'number' ? oldData.salePricePerBag : undefined,
        totalAmount: typeof oldData.totalAmount === 'number' ? oldData.totalAmount : 0,
        paymentType: oldData.paymentType || "Credit",
      };
      const newDocRef = doc(newCollectionRef); // Create a new doc reference in the target collection
      batch.set(newDocRef, { ...newEntryData, date: Timestamp.fromDate(newEntryData.date) });
      migratedCount++;
    });

    await batch.commit();
    console.log(`SERVER ACTION: Successfully migrated ${migratedCount} documents from pashuAaharTransactions to purchaseEntries.`);
    return { success: true, count: migratedCount };
  } catch (error) {
    console.error("SERVER ACTION: Error migrating pashuAaharTransactions:", error);
    if (error instanceof Error) {
      return { success: false, count: 0, error: error.message };
    }
    return { success: false, count: 0, error: "An unknown migration error occurred" };
  }
}
