
'use server';

import { db } from '@/lib/firebase';
import type { MilkCollectionEntry } from '@/lib/types';
import { collection, addDoc, getDocs, query, orderBy, Timestamp } from 'firebase/firestore';

export async function addMilkCollectionEntryToFirestore(
  entryData: Omit<MilkCollectionEntry, 'id'>
): Promise<{ success: boolean; id?: string; error?: string }> {
  console.log("SERVER ACTION: addMilkCollectionEntryToFirestore called with data:", JSON.parse(JSON.stringify(entryData)));
  try {
    // Firebase SDK handles JS Date to Timestamp conversion automatically
    const docRef = await addDoc(collection(db, 'milkCollections'), entryData);
    console.log("SERVER ACTION: Milk collection entry successfully added to Firestore with ID:", docRef.id);
    return { success: true, id: docRef.id };
  } catch (error) {
    console.error("SERVER ACTION: Error adding milk collection entry to Firestore:", error);
    if (error instanceof Error) {
      return { success: false, error: error.message };
    }
    return { success: false, error: "An unknown error occurred" };
  }
}

export async function getMilkCollectionEntriesFromFirestore(): Promise<MilkCollectionEntry[]> {
  console.log("SERVER ACTION: getMilkCollectionEntriesFromFirestore called.");
  try {
    const entriesCollection = collection(db, 'milkCollections');
    // Order by date descending. Shift order can be handled client-side if needed or by more complex query.
    console.log("SERVER ACTION: Querying 'milkCollections' ordered by date desc.");
    const q = query(entriesCollection, orderBy('date', 'desc'));
    const entrySnapshot = await getDocs(q);
    console.log(`SERVER ACTION: Fetched ${entrySnapshot.docs.length} documents from Firestore.`);

    if (entrySnapshot.empty) {
      console.log("SERVER ACTION: No documents found in 'milkCollections'. Returning empty array.");
      return [];
    }

    const entryList = entrySnapshot.docs.map(doc => {
      const data = doc.data();
      console.log(`SERVER ACTION: Processing document ID: ${doc.id}, Raw Data:`, JSON.parse(JSON.stringify(data)));
      
      let entryDate: Date;
      if (data.date instanceof Timestamp) {
        entryDate = data.date.toDate();
      } else if (typeof data.date === 'string' || typeof data.date === 'number') {
        console.warn(`SERVER ACTION: Document ID ${doc.id} 'date' field is not a Firestore Timestamp. Attempting to parse. Value:`, data.date);
        entryDate = new Date(data.date);
      } else {
        console.error(`SERVER ACTION: Document ID ${doc.id} has an invalid 'date' field. Using current date as fallback. Value:`, data.date);
        entryDate = new Date(); 
      }

      return {
        id: doc.id,
        date: entryDate,
        shift: data.shift || "Morning", // Default to Morning if undefined, though it should be set
        dealerName: data.dealerName || "Unknown Dealer",
        quantityLtr: typeof data.quantityLtr === 'number' ? data.quantityLtr : 0,
        fatPercentage: typeof data.fatPercentage === 'number' ? data.fatPercentage : 0,
        ratePerLtr: typeof data.ratePerLtr === 'number' ? data.ratePerLtr : 0,
        totalAmount: typeof data.totalAmount === 'number' ? data.totalAmount : 0,
      } as MilkCollectionEntry;
    });
    console.log("SERVER ACTION: Successfully processed entries. Mapped entries count:", entryList.length);
     if (entryList.length > 0) {
        console.log("SERVER ACTION: First mapped entry (sample):", JSON.parse(JSON.stringify(entryList[0])));
    }
    return entryList;
  } catch (error) {
    console.error("SERVER ACTION: Error fetching milk collection entries from Firestore:", error);
    if (error instanceof Error) {
        console.error("SERVER ACTION: Error name:", error.name, "Error message:", error.message);
    }
    return [];
  }
}
