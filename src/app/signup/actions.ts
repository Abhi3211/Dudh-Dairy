
'use server';

import { db } from '@/lib/firebase';
import type { UserRole } from '@/lib/types';
import { collection, addDoc, doc, setDoc, query, where, getDocs } from 'firebase/firestore';

export async function createCompanyInFirestore(
  companyName: string,
  ownerUid: string
): Promise<{ success: boolean; companyId?: string; error?: string }> {
  console.log("SERVER ACTION: createCompanyInFirestore called with name:", companyName, "ownerUid:", ownerUid);
  try {
    // Optional: Check if a company with the same name already exists (globally or by owner)
    // For simplicity, we'll allow duplicate names for now, but this could be a refinement.

    const companyData = {
      name: companyName,
      ownerUid: ownerUid,
      createdAt: new Date(), // Good to have a creation timestamp
    };
    const docRef = await addDoc(collection(db, 'companies'), companyData);
    console.log("SERVER ACTION: Company successfully added to Firestore with ID:", docRef.id);
    return { success: true, companyId: docRef.id };
  } catch (error) {
    console.error("SERVER ACTION: Error adding company to Firestore:", error);
    if (error instanceof Error) {
      return { success: false, error: error.message };
    }
    return { success: false, error: "An unknown error occurred while creating company" };
  }
}

export async function createUserProfileInFirestore(
  userId: string, // This is the Firebase Auth UID
  companyId: string,
  email: string,
  displayName: string | null,
  role: UserRole
): Promise<{ success: boolean; error?: string }> {
  console.log("SERVER ACTION: createUserProfileInFirestore called for userId:", userId);
  try {
    const userProfileData = {
      uid: userId, // Storing uid within the document as well for easier querying if needed
      companyId: companyId,
      email: email,
      displayName: displayName,
      role: role,
      createdAt: new Date(),
    };
    // Use the userId (Firebase Auth UID) as the document ID in the 'users' collection
    await setDoc(doc(db, 'users', userId), userProfileData);
    console.log("SERVER ACTION: User profile successfully created/updated in Firestore for userId:", userId);
    return { success: true };
  } catch (error) {
    console.error("SERVER ACTION: Error creating/updating user profile in Firestore:", error);
    if (error instanceof Error) {
      return { success: false, error: error.message };
    }
    return { success: false, error: "An unknown error occurred while creating user profile" };
  }
}
