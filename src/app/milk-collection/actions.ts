'use server';

import { db } from '@/lib/firebase';
import type { MilkCollectionEntry } from '@/lib/types';
import { collection, addDoc, getDocs, query, orderBy, where, Timestamp, doc, updateDoc, deleteDoc, DocumentSnapshot, DocumentData, getDoc } from 'firebase/firestore';

export async function addMilkCollectionEntryToFirestore(
  entryData: Omit<MilkCollectionEntry, 'id'>
): Promise<{ success: boolean; id?: string; error?: string }> {
  console.log("SERVER ACTION: addMilkCollectionEntryToFirestore called with data:", JSON.parse(JSON.stringify(entryData)));
  if (!entryData.companyId) {
    console.error("SERVER ACTION: companyId is missing in addMilkCollectionEntryToFirestore.");
    return { success: false, error: "Company ID is required to add a milk collection entry." };
  }
  try {
    // Using nested collection path
    const { companyId, ...dataWithoutCompanyId } = entryData;
    const docRef = await addDoc(collection(db, 'companies', companyId, 'milkCollections'), dataWithoutCompanyId);
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

export async function getMilkCollectionEntriesFromFirestore(companyId: string): Promise<MilkCollectionEntry[]> {
  console.log("SERVER ACTION: getMilkCollectionEntriesFromFirestore called for companyId:", companyId);
  if (!companyId) {
    console.warn("SERVER ACTION: getMilkCollectionEntriesFromFirestore called without a companyId. Returning empty array.");
    return [];
  }
  try {
    // Using nested collection path
    const entriesCollection = collection(db, 'companies', companyId, 'milkCollections');
    console.log("SERVER ACTION: Querying 'milkCollections' ordered by date desc.");
    const q = query(
      entriesCollection, 
      orderBy('date', 'desc')
    );
    const entrySnapshot = await getDocs(q);
    console.log(`SERVER ACTION: Fetched ${entrySnapshot.docs.length} documents from Firestore.`);

    if (entrySnapshot.empty) {
      console.log("SERVER ACTION: No documents found in 'milkCollections'. Returning empty array.");
      return [];
    }

    const entryList = entrySnapshot.docs.map((docSnapshot: DocumentSnapshot<DocumentData>) => {
      const data = docSnapshot.data();
      console.log(`SERVER ACTION: Processing document ID: ${docSnapshot.id}, Raw Data:`, JSON.parse(JSON.stringify(data)));
      
      let entryDate: Date;
      if (data.date instanceof Timestamp) {
        entryDate = data.date.toDate();
      } else if (typeof data.date === 'string' || typeof data.date === 'number') {
        console.warn(`SERVER ACTION: Document ID ${docSnapshot.id} 'date' field is not a Firestore Timestamp. Attempting to parse. Value:`, data.date);
        entryDate = new Date(data.date);
      } else {
        console.error(`SERVER ACTION: Document ID ${docSnapshot.id} has an invalid 'date' field. Using current date as fallback. Value:`, data.date);
        entryDate = new Date(); 
      }

      return {
        id: docSnapshot.id,
        companyId, // Add back the companyId for consistency
        date: entryDate,
        shift: data.shift || "Morning",
        customerName: data.customerName || "Unknown Customer",
        quantityLtr: typeof data.quantityLtr === 'number' ? data.quantityLtr : 0,
        fatPercentage: typeof data.fatPercentage === 'number' ? data.fatPercentage : 0,
        ratePerLtr: typeof data.ratePerLtr === 'number' ? data.ratePerLtr : 0, 
        totalAmount: typeof data.totalAmount === 'number' ? data.totalAmount : 0,
        advancePaid: typeof data.advancePaid === 'number' ? data.advancePaid : 0,
        remarks: typeof data.remarks === 'string' ? data.remarks : "",
        netAmountPayable: typeof data.netAmountPayable === 'number' ? data.netAmountPayable : (data.totalAmount || 0) - (data.advancePaid || 0),
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

export async function updateMilkCollectionEntryInFirestore(
  entryId: string,
  entryData: Omit<MilkCollectionEntry, 'id'>
): Promise<{ success: boolean; error?: string }> {
  console.log(`SERVER ACTION: updateMilkCollectionEntryInFirestore called for ID: ${entryId} with data:`, JSON.parse(JSON.stringify(entryData)));
  if (!entryData.companyId) {
    console.error("SERVER ACTION: companyId is missing in updateMilkCollectionEntryInFirestore.");
    return { success: false, error: "Company ID is required to update a milk collection entry." };
  }
  try {
    // Using nested collection path
    const { companyId, ...dataWithoutCompanyId } = entryData;
    const entryRef = doc(db, 'companies', companyId, 'milkCollections', entryId);
    await updateDoc(entryRef, dataWithoutCompanyId);
    console.log(`SERVER ACTION: Milk collection entry with ID: ${entryId} successfully updated.`);
    return { success: true };
  } catch (error) {
    console.error(`SERVER ACTION: Error updating milk collection entry with ID: ${entryId}:`, error);
    if (error instanceof Error) {
      return { success: false, error: error.message };
    }
    return { success: false, error: "An unknown error occurred" };
  }
}

export async function deleteMilkCollectionEntryFromFirestore(
  entryId: string,
  companyId: string
): Promise<{ success: boolean; error?: string }> {
  console.log(`SERVER ACTION: deleteMilkCollectionEntryFromFirestore called for ID: ${entryId}`);
  if (!companyId) {
    console.error("SERVER ACTION: companyId is missing in deleteMilkCollectionEntryFromFirestore.");
    return { success: false, error: "Company ID is required to delete a milk collection entry." };
  }
  try {
    // Using nested collection path
    const entryRef = doc(db, 'companies', companyId, 'milkCollections', entryId);
    await deleteDoc(entryRef);
    console.log(`SERVER ACTION: Milk collection entry with ID: ${entryId} successfully deleted.`);
    return { success: true };
  } catch (error) {
    console.error(`SERVER ACTION: Error deleting milk collection entry with ID: ${entryId}:`, error);
    if (error instanceof Error) {
      return { success: false, error: error.message };
    }
    return { success: false, error: "An unknown error occurred" };
  }
}
