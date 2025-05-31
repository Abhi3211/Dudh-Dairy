
'use server';

import { db } from '@/lib/firebase';
import type { ExpenseEntry } from '@/lib/types';
import { collection, addDoc, getDocs, query, orderBy, Timestamp } from 'firebase/firestore';

export async function addExpenseEntryToFirestore(
  entryData: Omit<ExpenseEntry, 'id'>
): Promise<{ success: boolean; id?: string; error?: string }> {
  console.log("SERVER ACTION: addExpenseEntryToFirestore called with data:", JSON.parse(JSON.stringify(entryData)));
  try {
    const docRef = await addDoc(collection(db, 'expenseEntries'), {
      ...entryData,
      date: Timestamp.fromDate(entryData.date), // Ensure date is a Timestamp
    });
    console.log("SERVER ACTION: Expense entry successfully added to Firestore with ID:", docRef.id);
    return { success: true, id: docRef.id };
  } catch (error) {
    console.error("SERVER ACTION: Error adding expense entry to Firestore:", error);
    if (error instanceof Error) {
      return { success: false, error: error.message };
    }
    return { success: false, error: "An unknown error occurred" };
  }
}

export async function getExpenseEntriesFromFirestore(): Promise<ExpenseEntry[]> {
  console.log("SERVER ACTION: getExpenseEntriesFromFirestore called.");
  try {
    const entriesCollection = collection(db, 'expenseEntries');
    const q = query(entriesCollection, orderBy('date', 'desc'));
    const entrySnapshot = await getDocs(q);
    console.log(`SERVER ACTION: Fetched ${entrySnapshot.docs.length} expense documents from Firestore.`);

    if (entrySnapshot.empty) {
      console.log("SERVER ACTION: No documents found in 'expenseEntries'. Returning empty array.");
      return [];
    }

    const entryList = entrySnapshot.docs.map(docSnapshot => {
      const data = docSnapshot.data();
      let entryDate: Date;
      if (data.date instanceof Timestamp) {
        entryDate = data.date.toDate();
      } else if (typeof data.date === 'string' || typeof data.date === 'number') {
        console.warn(`SERVER ACTION (Expenses): Document ID ${docSnapshot.id} 'date' field is not a Firestore Timestamp. Attempting to parse. Value:`, data.date);
        entryDate = new Date(data.date);
      } else {
        console.error(`SERVER ACTION (Expenses): Document ID ${docSnapshot.id} has an invalid 'date' field. Using current date as fallback. Value:`, data.date);
        entryDate = new Date();
      }

      return {
        id: docSnapshot.id,
        date: entryDate,
        category: data.category || "Miscellaneous",
        description: data.description || "No description",
        amount: typeof data.amount === 'number' ? data.amount : 0,
        partyId: data.partyId,
        partyName: data.partyName,
      } as ExpenseEntry;
    });
    console.log("SERVER ACTION: Successfully processed expense entries. Count:", entryList.length);
    return entryList;
  } catch (error) {
    console.error("SERVER ACTION: Error fetching expense entries from Firestore:", error);
    return [];
  }
}
