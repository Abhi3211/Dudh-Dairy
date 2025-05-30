
'use server';

import { db } from '@/lib/firebase';
import type { PashuAaharTransaction } from '@/lib/types';
import { collection, addDoc, getDocs, query, orderBy, Timestamp, doc, updateDoc, deleteDoc } from 'firebase/firestore';

export async function addPashuAaharTransactionToFirestore(
  transactionData: Omit<PashuAaharTransaction, 'id'>
): Promise<{ success: boolean; id?: string; error?: string }> {
  console.log("SERVER ACTION: addPashuAaharTransactionToFirestore called with data:", JSON.parse(JSON.stringify(transactionData)));
  try {
    const docRef = await addDoc(collection(db, 'pashuAaharTransactions'), {
      ...transactionData,
      date: Timestamp.fromDate(transactionData.date), // Ensure date is a Timestamp
    });
    console.log("SERVER ACTION: Pashu Aahar transaction successfully added to Firestore with ID:", docRef.id);
    return { success: true, id: docRef.id };
  } catch (error) {
    console.error("SERVER ACTION: Error adding Pashu Aahar transaction to Firestore:", error);
    if (error instanceof Error) {
      return { success: false, error: error.message };
    }
    return { success: false, error: "An unknown error occurred" };
  }
}

export async function getPashuAaharTransactionsFromFirestore(): Promise<PashuAaharTransaction[]> {
  console.log("SERVER ACTION: Attempting to fetch Pashu Aahar transactions from Firestore.");
  try {
    const transactionsCollection = collection(db, 'pashuAaharTransactions');
    const q = query(transactionsCollection, orderBy('date', 'desc'));
    const transactionSnapshot = await getDocs(q);
    const transactionList = transactionSnapshot.docs.map(docSnapshot => {
      const data = docSnapshot.data();
      let entryDate: Date;
      if (data.date instanceof Timestamp) {
        entryDate = data.date.toDate();
      } else if (typeof data.date === 'string' || typeof data.date === 'number') {
        console.warn(`SERVER ACTION (PashuAahar): Document ID ${docSnapshot.id} 'date' field is not a Firestore Timestamp. Attempting to parse. Value:`, data.date);
        entryDate = new Date(data.date);
      } else {
        console.error(`SERVER ACTION (PashuAahar): Document ID ${docSnapshot.id} has an invalid 'date' field. Using current date as fallback. Value:`, data.date);
        entryDate = new Date();
      }
      return {
        id: docSnapshot.id,
        date: entryDate,
        type: data.type || "Purchase",
        productName: data.productName || "Unknown Product",
        supplierOrCustomerName: data.supplierOrCustomerName || "",
        quantityBags: typeof data.quantityBags === 'number' ? data.quantityBags : 0,
        pricePerBag: typeof data.pricePerBag === 'number' ? data.pricePerBag : 0,
        salePricePerBag: typeof data.salePricePerBag === 'number' ? data.salePricePerBag : undefined,
        totalAmount: typeof data.totalAmount === 'number' ? data.totalAmount : 0,
        paymentType: data.paymentType || "Credit",
      } as PashuAaharTransaction;
    });
    console.log("SERVER ACTION: Successfully fetched Pashu Aahar transactions, count:", transactionList.length);
    return transactionList;
  } catch (error) {
    console.error("SERVER ACTION: Error fetching Pashu Aahar transactions from Firestore:", error);
    return [];
  }
}

export async function updatePashuAaharTransactionInFirestore(
  transactionId: string,
  transactionData: Omit<PashuAaharTransaction, 'id'>
): Promise<{ success: boolean; error?: string }> {
  console.log(`SERVER ACTION: updatePashuAaharTransactionInFirestore called for ID: ${transactionId} with data:`, JSON.parse(JSON.stringify(transactionData)));
  try {
    const transactionRef = doc(db, 'pashuAaharTransactions', transactionId);
    await updateDoc(transactionRef, {
      ...transactionData,
      date: Timestamp.fromDate(transactionData.date), // Ensure date is a Timestamp
    });
    console.log(`SERVER ACTION: Pashu Aahar transaction with ID: ${transactionId} successfully updated.`);
    return { success: true };
  } catch (error) {
    console.error(`SERVER ACTION: Error updating Pashu Aahar transaction with ID: ${transactionId}:`, error);
    if (error instanceof Error) {
      return { success: false, error: error.message };
    }
    return { success: false, error: "An unknown error occurred" };
  }
}

export async function deletePashuAaharTransactionFromFirestore(
  transactionId: string
): Promise<{ success: boolean; error?: string }> {
  console.log(`SERVER ACTION: deletePashuAaharTransactionFromFirestore called for ID: ${transactionId}`);
  try {
    const transactionRef = doc(db, 'pashuAaharTransactions', transactionId);
    await deleteDoc(transactionRef);
    console.log(`SERVER ACTION: Pashu Aahar transaction with ID: ${transactionId} successfully deleted.`);
    return { success: true };
  } catch (error) {
    console.error(`SERVER ACTION: Error deleting Pashu Aahar transaction with ID: ${transactionId}:`, error);
    if (error instanceof Error) {
      return { success: false, error: error.message };
    }
    return { success: false, error: "An unknown error occurred" };
  }
}

export async function getUniquePashuAaharProductNamesFromFirestore(): Promise<string[]> {
  console.log("SERVER ACTION: getUniquePashuAaharProductNamesFromFirestore called.");
  try {
    const transactionsCollection = collection(db, 'pashuAaharTransactions');
    const transactionSnapshot = await getDocs(transactionsCollection);

    if (transactionSnapshot.empty) {
      console.log("SERVER ACTION: No Pashu Aahar transactions found. Returning empty array for product names.");
      return [];
    }

    const productNames = new Set<string>();
    transactionSnapshot.docs.forEach(docSnapshot => {
      const data = docSnapshot.data();
      if (data.productName && typeof data.productName === 'string') {
        productNames.add(data.productName.trim());
      }
    });

    const uniqueNamesArray = Array.from(productNames).sort((a, b) => a.localeCompare(b));
    console.log("SERVER ACTION: Successfully fetched unique Pashu Aahar product names. Count:", uniqueNamesArray.length);
    return uniqueNamesArray;
  } catch (error) {
    console.error("SERVER ACTION: Error fetching unique Pashu Aahar product names from Firestore:", error);
    return [];
  }
}
