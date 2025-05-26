
import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function ExpensesPage() {
  return (
    <div>
      <PageHeader
        title="Expenses"
        description="Track and manage your business expenses."
      />
      <Card>
        <CardHeader>
          <CardTitle>Expenses Management</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">
            This section is under development. Here you will be able to record, categorize, and analyze your expenses.
          </p>
          {/* Placeholder for expenses form and list */}
        </CardContent>
      </Card>
    </div>
  );
}
