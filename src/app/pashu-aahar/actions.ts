
'use server';

import { db } from '@/lib/firebase';
import type { PashuAaharTransaction } from '@/lib/types';
import { collection, addDoc, getDocs, query, orderBy, Timestamp } from 'firebase/firestore';

export async function addPashuAaharTransactionToFirestore(
  transactionData: Omit<PashuAaharTransaction, 'id'>
): Promise<{ success: boolean; id?: string; error?: string }> {
  console.log("addPashuAaharTransactionToFirestore called with data:", transactionData);
  try {
    // Firestore SDK converts JS Date to Timestamp automatically
    const docRef = await addDoc(collection(db, 'pashuAaharTransactions'), transactionData);
    console.log("Pashu Aahar transaction successfully added to Firestore with ID:", docRef.id);
    return { success: true, id: docRef.id };
  } catch (error) {
    console.error("Error adding Pashu Aahar transaction to Firestore:", error);
    if (error instanceof Error) {
      return { success: false, error: error.message };
    }
    return { success: false, error: "An unknown error occurred" };
  }
}

export async function getPashuAaharTransactionsFromFirestore(): Promise<PashuAaharTransaction[]> {
  console.log("Attempting to fetch Pashu Aahar transactions from Firestore.");
  try {
    const transactionsCollection = collection(db, 'pashuAaharTransactions');
    // Order by date descending
    const q = query(transactionsCollection, orderBy('date', 'desc'));
    const transactionSnapshot = await getDocs(q);
    const transactionList = transactionSnapshot.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        ...data,
        date: (data.date as Timestamp).toDate(), // Convert Firestore Timestamp to JS Date
      } as PashuAaharTransaction;
    });
    console.log("Successfully fetched Pashu Aahar transactions, count:", transactionList.length);
    return transactionList;
  } catch (error) {
    console.error("Error fetching Pashu Aahar transactions from Firestore:", error);
    return [];
  }
}
