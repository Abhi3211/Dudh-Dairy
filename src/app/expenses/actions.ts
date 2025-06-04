'use server';

import { db } from '@/lib/firebase';
import type { ExpenseEntry } from '@/lib/types';
import { collection, addDoc, getDocs, query, orderBy, Timestamp } from 'firebase/firestore';

export async function addExpenseEntryToFirestore(
  entryData: Omit<ExpenseEntry, 'id'> & { companyId: string }
): Promise<{ success: boolean; id?: string; error?: string }> {
  console.log("SERVER ACTION: addExpenseEntryToFirestore called with data:", JSON.parse(JSON.stringify(entryData)));
  if (!entryData.companyId) {
    console.error("SERVER ACTION: companyId is missing in addExpenseEntryToFirestore.");
    return { success: false, error: "Company ID is required to add an expense entry." };
  }
  try {
    const { companyId, ...dataWithoutCompanyId } = entryData;
    const docRef = await addDoc(collection(db, 'companies', companyId, 'expenses'), {
      ...dataWithoutCompanyId,
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

export async function getExpenseEntriesFromFirestore(companyId: string): Promise<ExpenseEntry[]> {
  console.log(`SERVER ACTION: getExpenseEntriesFromFirestore called for companyId: ${companyId}.`);
  if (!companyId) {
    console.warn("SERVER ACTION: getExpenseEntriesFromFirestore called without a companyId. Returning empty array.");
    return [];
  }
  try {
    const entriesCollection = collection(db, 'companies', companyId, 'expenses');
    const q = query(
      entriesCollection,
      orderBy('date', 'desc')
    );
    const entrySnapshot = await getDocs(q);
    console.log(`SERVER ACTION: Fetched ${entrySnapshot.docs.length} expense documents from Firestore for companyId ${companyId}.`);

    if (entrySnapshot.empty) {
      console.log("SERVER ACTION: No documents found in 'expenses'. Returning empty array.");
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
        companyId, // Add back the companyId for consistency
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
