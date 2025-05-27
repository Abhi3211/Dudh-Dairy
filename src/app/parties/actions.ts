
'use server';

import { db } from '@/lib/firebase';
import type { Party } from '@/lib/types';
import { collection, addDoc, getDocs, deleteDoc, doc, query, orderBy } from 'firebase/firestore';
import { revalidatePath } from 'next/cache';

export async function getPartiesFromFirestore(): Promise<Party[]> {
  console.log("Attempting to fetch parties from Firestore.");
  try {
    const partiesCollection = collection(db, 'parties');
    const q = query(partiesCollection, orderBy('name', 'asc'));
    const partySnapshot = await getDocs(q);
    const partyList = partySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Party));
    console.log("Successfully fetched parties:", partyList.length);
    return partyList;
  } catch (error) {
    console.error("Error fetching parties from Firestore:", error);
    return [];
  }
}

export async function addPartyToFirestore(partyData: Omit<Party, 'id'>): Promise<{ success: boolean; id?: string; error?: string }> {
  console.log("addPartyToFirestore called with data:", partyData);
  try {
    console.log("Attempting to add document to 'parties' collection in Firestore.");
    const docRef = await addDoc(collection(db, 'parties'), partyData);
    console.log("Document successfully added to Firestore with ID:", docRef.id);
    revalidatePath('/parties');
    return { success: true, id: docRef.id };
  } catch (error) {
    console.error("Error adding party to Firestore:", error);
    if (error instanceof Error) {
        return { success: false, error: error.message };
    }
    return { success: false, error: "An unknown error occurred" };
  }
}

export async function deletePartyFromFirestore(partyId: string): Promise<{ success: boolean; error?: string }> {
  console.log("deletePartyFromFirestore called with partyId:", partyId);
  try {
    console.log(`Attempting to delete document with ID ${partyId} from 'parties' collection.`);
    await deleteDoc(doc(db, 'parties', partyId));
    console.log("Document successfully deleted from Firestore.");
    revalidatePath('/parties');
    return { success: true };
  } catch (error) {
    console.error("Error deleting party from Firestore:", error);
     if (error instanceof Error) {
        return { success: false, error: error.message };
    }
    return { success: false, error: "An unknown error occurred" };
  }
}
