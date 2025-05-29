
"use client";
import { createContext, useState, Dispatch, SetStateAction, ReactNode, useContext } from 'react';

interface PageTitleContextType {
  pageTitle: string;
  setPageTitle: Dispatch<SetStateAction<string>>;
}

export const PageTitleContext = createContext<PageTitleContextType | undefined>(undefined);

export const PageTitleProvider = ({ children }: { children: ReactNode }) => {
  const [pageTitle, setPageTitle] = useState<string>("Dudh Dairy"); // Default title
  return (
    <PageTitleContext.Provider value={{ pageTitle, setPageTitle }}>
      {children}
    </PageTitleContext.Provider>
  );
};

export const usePageTitle = () => {
  const context = useContext(PageTitleContext);
  if (context === undefined) {
    throw new Error('usePageTitle must be used within a PageTitleProvider');
  }
  return context;
};
