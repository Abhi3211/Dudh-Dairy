
'use server';

import { db } from '@/lib/firebase';
import type { PaymentEntry } from '@/lib/types';
import { collection, addDoc, getDocs, query, orderBy, Timestamp, where } from 'firebase/firestore';

export async function addPaymentEntryToFirestore(
  entryData: Omit<PaymentEntry, 'id'> & { companyId: string }
): Promise<{ success: boolean; id?: string; error?: string }> {
  console.log("SERVER ACTION: addPaymentEntryToFirestore called with data:", JSON.parse(JSON.stringify(entryData)));
  if (!entryData.companyId) {
    console.error("SERVER ACTION: companyId is missing in addPaymentEntryToFirestore.");
    return { success: false, error: "Company ID is required to add a payment entry." };
  }
  try {
    const docRef = await addDoc(collection(db, 'paymentEntries'), {
      ...entryData,
      date: Timestamp.fromDate(entryData.date), // Ensure date is a Timestamp
    });
    console.log("SERVER ACTION: Payment entry successfully added to Firestore with ID:", docRef.id);
    return { success: true, id: docRef.id };
  } catch (error) {
    console.error("SERVER ACTION: Error adding payment entry to Firestore:", error);
    if (error instanceof Error) {
      return { success: false, error: error.message };
    }
    return { success: false, error: "An unknown error occurred" };
  }
}

export async function getPaymentEntriesFromFirestore(companyId: string): Promise<PaymentEntry[]> {
  console.log(`SERVER ACTION: getPaymentEntriesFromFirestore called for companyId: ${companyId}.`);
  if (!companyId) {
    console.warn("SERVER ACTION: getPaymentEntriesFromFirestore called without a companyId. Returning empty array.");
    return [];
  }
  try {
    const entriesCollection = collection(db, 'paymentEntries');
    const q = query(
      entriesCollection,
      where('companyId', '==', companyId),
      orderBy('date', 'desc')
    );
    const entrySnapshot = await getDocs(q);
    console.log(`SERVER ACTION: Fetched ${entrySnapshot.docs.length} payment documents from Firestore for companyId ${companyId}.`);

    if (entrySnapshot.empty) {
      console.log("SERVER ACTION: No documents found in 'paymentEntries'. Returning empty array.");
      return [];
    }

    const entryList = entrySnapshot.docs.map(docSnapshot => {
      const data = docSnapshot.data();
      let entryDate: Date;
      if (data.date instanceof Timestamp) {
        entryDate = data.date.toDate();
      } else if (typeof data.date === 'string' || typeof data.date === 'number') {
        console.warn(`SERVER ACTION (Payments): Document ID ${docSnapshot.id} 'date' field is not a Firestore Timestamp. Attempting to parse. Value:`, data.date);
        entryDate = new Date(data.date);
      } else {
        console.error(`SERVER ACTION (Payments): Document ID ${docSnapshot.id} has an invalid 'date' field. Using current date as fallback. Value:`, data.date);
        entryDate = new Date();
      }

      return {
        id: docSnapshot.id,
        companyId: data.companyId,
        date: entryDate,
        type: data.type || "Received",
        partyName: data.partyName || "Unknown Party",
        partyType: data.partyType || "Customer",
        amount: typeof data.amount === 'number' ? data.amount : 0,
        mode: data.mode || "Cash",
        notes: typeof data.notes === 'string' ? data.notes : "",
      } as PaymentEntry;
    });
    console.log("SERVER ACTION: Successfully processed payment entries. Count:", entryList.length);
    return entryList;
  } catch (error) {
    console.error("SERVER ACTION: Error fetching payment entries from Firestore:", error);
    return [];
  }
}
