
'use server';

// import { db } from '@/lib/firebase'; // No longer needed
import type { Party } from '@/lib/types';
// import { collection, addDoc, getDocs, deleteDoc, doc, query, orderBy } from 'firebase/firestore'; // No longer needed
// import { revalidatePath } from 'next/cache'; // No longer needed

// Firestore functions are removed.
// If these server actions are called, they will do nothing or might error
// if not properly handled by the calling client component.
// The client component /src/app/parties/page.tsx has been updated
// to manage state locally and not call these actions.

export async function getPartiesFromFirestore(): Promise<Party[]> {
  console.warn("getPartiesFromFirestore server action called, but Firestore integration is currently disabled for parties. Returning empty array.");
  return [];
}

export async function addPartyToFirestore(partyData: Omit<Party, 'id'>): Promise<{ success: boolean; id?: string; error?: string }> {
  console.warn("addPartyToFirestore server action called, but Firestore integration is currently disabled for parties.", partyData);
  // Simulate failure as we are not interacting with a database
  return { success: false, error: "Firestore integration is disabled for parties." };
}

export async function deletePartyFromFirestore(partyId: string): Promise<{ success: boolean; error?: string }> {
  console.warn("deletePartyFromFirestore server action called, but Firestore integration is currently disabled for parties.", partyId);
  // Simulate failure
  return { success: false, error: "Firestore integration is disabled for parties." };
}
