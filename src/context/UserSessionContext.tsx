
"use client";
import type { UserProfile, Company } from '@/lib/types';
import { createContext, useContext, useState, ReactNode } from 'react';

interface UserSessionContextType {
  currentUser: UserProfile | null;
  currentCompany: Company | null;
  // In a real app, you'd have functions to login/logout, set user, etc.
  // For now, we'll use mock data.
}

// Mock data - in a real app, this would come from auth and Firestore after login
const MOCK_DEFAULT_COMPANY_ID = "default_company_DudhDairy_XYZ123"; // Make it a bit more unique
const MOCK_DEFAULT_USER_ID = "default_user_admin_ABC789";

const mockUser: UserProfile = {
  uid: MOCK_DEFAULT_USER_ID,
  email: "admin@example.com",
  displayName: "Default Admin User",
  companyId: MOCK_DEFAULT_COMPANY_ID,
  role: 'admin', // Default role for the mock user
};

const mockCompany: Company = {
  id: MOCK_DEFAULT_COMPANY_ID,
  name: "Default Dudh Dairy Inc.",
};

export const UserSessionContext = createContext<UserSessionContextType | undefined>(undefined);

export const UserSessionProvider = ({ children }: { children: ReactNode }) => {
  // In a real app, currentUser and currentCompany would be managed by auth state
  // and fetched/set after successful login.
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(mockUser);
  const [currentCompany, setCurrentCompany] = useState<Company | null>(mockCompany);

  // Later, we might add functions here to simulate login/logout for testing:
  // const login = (user: UserProfile, company: Company) => {
  //   setCurrentUser(user);
  //   setCurrentCompany(company);
  // };
  // const logout = () => {
  //   setCurrentUser(null);
  //   setCurrentCompany(null);
  // };

  return (
    <UserSessionContext.Provider value={{ currentUser, currentCompany }}>
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
