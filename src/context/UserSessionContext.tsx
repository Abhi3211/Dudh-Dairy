
"use client";
import type { UserProfile, Company } from '@/lib/types';
import { createContext, useContext, useState, ReactNode, useEffect } from 'react';
import { auth, db } from '@/lib/firebase'; // Added db
import type { User as FirebaseUser } from 'firebase/auth';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore'; // Firestore imports

interface UserSessionContextType {
  firebaseUser: FirebaseUser | null;
  userProfile: UserProfile | null;
  companyProfile: Company | null;
  authLoading: boolean;
  profilesLoading: boolean; // New state for loading user/company profiles from Firestore
}

export const UserSessionContext = createContext<UserSessionContextType | undefined>(undefined);

export const UserSessionProvider = ({ children }: { children: ReactNode }) => {
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [userProfile, setUserProfileState] = useState<UserProfile | null>(null);
  const [companyProfile, setCompanyProfileState] = useState<Company | null>(null);
  const [profilesLoading, setProfilesLoading] = useState<boolean>(false); // Initialize to false

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      console.log("CLIENT: Auth state changed, user:", user?.uid);
      setFirebaseUser(user);
      setAuthLoading(false);

      if (!user) {
        setUserProfileState(null);
        setCompanyProfileState(null);
        setProfilesLoading(false); // No profiles to load if no user
      } else {
        // User is logged in, fetch their profiles from Firestore
        setProfilesLoading(true);
        const fetchProfiles = async () => {
          try {
            // 1. Fetch UserProfile
            const userDocRef = doc(db, "users", user.uid);
            const userDocSnap = await getDoc(userDocRef);

            if (userDocSnap.exists()) {
              // Assuming user document ID is the UID, and data matches UserProfile type
              const fetchedUserProfile = { uid: userDocSnap.id, ...userDocSnap.data() } as UserProfile;
              setUserProfileState(fetchedUserProfile);
              console.log("CLIENT: UserProfile fetched:", fetchedUserProfile);

              // 2. Fetch Company Profile using companyId from UserProfile
              if (fetchedUserProfile.companyId) {
                const companyDocRef = doc(db, "companies", fetchedUserProfile.companyId);
                const companyDocSnap = await getDoc(companyDocRef);
                if (companyDocSnap.exists()) {
                  const fetchedCompanyProfile = { id: companyDocSnap.id, ...companyDocSnap.data() } as Company;
                  setCompanyProfileState(fetchedCompanyProfile);
                  console.log("CLIENT: CompanyProfile fetched:", fetchedCompanyProfile);
                } else {
                  console.warn(`CLIENT: Company document not found for companyId: ${fetchedUserProfile.companyId}. User: ${user.uid}`);
                  setCompanyProfileState(null); // Or handle as an error state
                }
              } else {
                console.warn(`CLIENT: No companyId found in UserProfile for user: ${user.uid}`);
                setCompanyProfileState(null); // Should ideally not happen if signup is correct
              }
            } else {
              console.warn(`CLIENT: UserProfile document not found for uid: ${user.uid}. This user might need to complete signup or be an old auth user without a profile.`);
              setUserProfileState(null);
              setCompanyProfileState(null);
              // Consider redirecting to a profile completion step or login if profile is mandatory
            }
          } catch (error) {
            console.error("CLIENT: Error fetching user/company profiles:", error);
            setUserProfileState(null);
            setCompanyProfileState(null);
            // Potentially show a toast error to the user here via a toast context or prop
          } finally {
            setProfilesLoading(false);
          }
        };
        fetchProfiles();
      }
    });
    return () => unsubscribe(); // Cleanup subscription on unmount
  }, []); // Empty dependency array: onAuthStateChanged handles its own re-runs.

  return (
    <UserSessionContext.Provider value={{ firebaseUser, userProfile, companyProfile, authLoading, profilesLoading }}>
      {children}
    </UserSessionContext.Provider>
  );
};

export const useUserSession = () => {
  const context = useContext(UserSessionContext);
  if (context === undefined) {
    throw new Error('useUserSession must be used within a UserSessionProvider');
  }
  return context;
};
