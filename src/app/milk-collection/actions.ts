
'use server';

import { db } from '@/lib/firebase';
import type { MilkCollectionEntry } from '@/lib/types';
import { collection, addDoc, getDocs, query, orderBy, Timestamp } from 'firebase/firestore';
// import { revalidatePath } from 'next/cache'; // Removed for client-side re-fetch

export async function addMilkCollectionEntryToFirestore(
  entryData: Omit<MilkCollectionEntry, 'id'>
): Promise<{ success: boolean; id?: string; error?: string }> {
  console.log("addMilkCollectionEntryToFirestore called with data:", entryData);
  try {
    // Firestore SDK converts JS Date to Timestamp automatically
    const docRef = await addDoc(collection(db, 'milkCollections'), entryData);
    console.log("Milk collection entry successfully added to Firestore with ID:", docRef.id);
    // revalidatePath('/milk-collection'); // Removed: client will re-fetch
    return { success: true, id: docRef.id };
  } catch (error) {
    console.error("Error adding milk collection entry to Firestore:", error);
    if (error instanceof Error) {
      return { success: false, error: error.message };
    }
    return { success: false, error: "An unknown error occurred" };
  }
}

export async function getMilkCollectionEntriesFromFirestore(): Promise<MilkCollectionEntry[]> {
  console.log("Attempting to fetch milk collection entries from Firestore.");
  try {
    const entriesCollection = collection(db, 'milkCollections');
    // Order by date descending, then by time descending
    const q = query(entriesCollection, orderBy('date', 'desc'), orderBy('time', 'desc'));
    const entrySnapshot = await getDocs(q);
    const entryList = entrySnapshot.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        ...data,
        date: (data.date as Timestamp).toDate(), // Convert Firestore Timestamp to JS Date
      } as MilkCollectionEntry;
    });
    console.log("Successfully fetched milk collection entries from Firestore, count:", entryList.length);
    return entryList;
  } catch (error) {
    console.error("Error fetching milk collection entries from Firestore:", error);
    return [];
  }
}

