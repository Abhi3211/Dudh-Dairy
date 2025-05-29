
"use client";

import { useEffect } from "react";
import { PageHeader } from "@/components/shared/page-header";
import { usePageTitle } from '@/context/PageTitleContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function BulkSalesPage() {
  const { setPageTitle } = usePageTitle();
  const pageSpecificTitle = "Bulk Milk Sales";

  useEffect(() => {
    setPageTitle(pageSpecificTitle);
  }, [setPageTitle, pageSpecificTitle]);

  return (
    <div>
      <PageHeader
        title={pageSpecificTitle}
        description="Record bulk milk sales based on Liter x FAT x Rate."
      />
      <Card>
        <CardHeader>
          <CardTitle>Bulk Sales Management</CardTitle>
          <CardDescription>
            This section is under development. Functionality to add, edit, and view bulk sales will be implemented here.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">
            Future enhancements will include a form for new bulk sales entries and a table to display historical bulk sales.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
