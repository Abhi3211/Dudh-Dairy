
"use client";
import { usePageTitle } from '@/context/PageTitleContext';

export function HeaderTitle() {
  const { pageTitle } = usePageTitle();
  return (
    <div className="flex-1 text-xl font-semibold text-foreground">
      {pageTitle}
    </div>
  );
}
