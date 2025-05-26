
'use server';

import { db } from '@/lib/firebase';
import type { Party } from '@/lib/types';
import { collection, addDoc, getDocs, deleteDoc, doc, query, orderBy } from 'firebase/firestore';
import { revalidatePath } from 'next/cache';

export async function getPartiesFromFirestore(): Promise<Party[]> {
  try {
    const partiesCollection = collection(db, 'parties');
    const q = query(partiesCollection, orderBy('name', 'asc'));
    const partySnapshot = await getDocs(q);
    const partyList = partySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Party));
    return partyList;
  } catch (error) {
    console.error("Error fetching parties: ", error);
    // In a real app, you might throw the error or return an object indicating failure
    return []; 
  }
}

export async function addPartyToFirestore(partyData: Omit<Party, 'id'>): Promise<{ success: boolean; id?: string; error?: string }> {
  try {
    const partiesCollection = collection(db, 'parties');
    const docRef = await addDoc(partiesCollection, partyData);
    revalidatePath('/parties'); // Revalidate the parties page to show the new party
    return { success: true, id: docRef.id };
  } catch (error) {
    console.error("Error adding party: ", error);
    return { success: false, error: (error as Error).message || "Failed to add party" };
  }
}

export async function deletePartyFromFirestore(partyId: string): Promise<{ success: boolean; error?: string }> {
  try {
    const partyDocRef = doc(db, 'parties', partyId);
    await deleteDoc(partyDocRef);
    revalidatePath('/parties'); // Revalidate the parties page
    return { success: true };
  } catch (error) {
    console.error("Error deleting party: ", error);
    return { success: false, error: (error as Error).message || "Failed to delete party" };
  }
}
