
"use client";
import type { UserProfile, Company } from '@/lib/types';
import { createContext, useContext, useState, ReactNode, useEffect } from 'react';
import { auth } from '@/lib/firebase';
import type { User as FirebaseUser } from 'firebase/auth'; // Renamed to avoid conflict
import { onAuthStateChanged } from 'firebase/auth';

interface UserSessionContextType {
  firebaseUser: FirebaseUser | null; // User from Firebase Auth
  userProfile: UserProfile | null;    // Your Firestore user profile
  companyProfile: Company | null;   // Your Firestore company profile
  authLoading: boolean;
  setUserProfile: (profile: UserProfile | null) => void;
  setCompanyProfile: (company: Company | null) => void;
  // Logout function can be added here later or handled directly via auth.signOut()
}

export const UserSessionContext = createContext<UserSessionContextType | undefined>(undefined);

export const UserSessionProvider = ({ children }: { children: ReactNode }) => {
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [userProfile, setUserProfileState] = useState<UserProfile | null>(null);
  const [companyProfile, setCompanyProfileState] = useState<Company | null>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      console.log("Auth state changed, user:", user);
      setFirebaseUser(user);
      setAuthLoading(false);
      if (!user) {
        // If Firebase user is logged out, clear our app-specific profiles
        setUserProfileState(null);
        setCompanyProfileState(null);
      }
      // If user is logged in, userProfile and companyProfile will be fetched
      // in a subsequent step based on firebaseUser.uid
      // For now, they remain null until explicitly set.
    });
    return () => unsubscribe(); // Cleanup subscription on unmount
  }, []);

  const setUserProfile = (profile: UserProfile | null) => {
    setUserProfileState(profile);
  };

  const setCompanyProfile = (company: Company | null) => {
    setCompanyProfileState(company);
  };

  return (
    <UserSessionContext.Provider value={{ firebaseUser, userProfile, companyProfile, authLoading, setUserProfile, setCompanyProfile }}>
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
