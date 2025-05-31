
"use client";

import { useState, type FormEvent, useEffect, useCallback, useMemo } from "react";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { DatePicker } from "@/components/ui/date-picker";
import { Textarea } from "@/components/ui/textarea";
import { IndianRupee, ListChecks, FileText, PlusCircle, CalendarDays, Users } from "lucide-react";
import type { ExpenseEntry, Party } from "@/lib/types";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { usePageTitle } from '@/context/PageTitleContext';
import { addExpenseEntryToFirestore, getExpenseEntriesFromFirestore } from "./actions";
import { getPartiesFromFirestore } from "../parties/actions";
import { Skeleton } from "@/components/ui/skeleton";

const expenseCategories: ExpenseEntry['category'][] = ["Salary", "Miscellaneous"];

export default function ExpensesPage() {
  const { setPageTitle } = usePageTitle();
  const pageSpecificTitle = "Expenses";

  useEffect(() => {
    setPageTitle(pageSpecificTitle);
  }, [setPageTitle, pageSpecificTitle]);

  const { toast } = useToast();
  const [expenses, setExpenses] = useState<ExpenseEntry[]>([]);
  const [isLoadingExpenses, setIsLoadingExpenses] = useState(true);
  const [isSubmittingExpense, setIsSubmittingExpense] = useState(false);

  const [availableParties, setAvailableParties] = useState<Party[]>([]);
  const [isLoadingParties, setIsLoadingParties] = useState(true);

  const [date, setDate] = useState<Date | undefined>(undefined);
  const [category, setCategory] = useState<ExpenseEntry['category']>("Miscellaneous");
  const [selectedPartyId, setSelectedPartyId] = useState<string | undefined>(undefined);
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");

  const fetchExpenses = useCallback(async () => {
    setIsLoadingExpenses(true);
    try {
      const fetchedExpenses = await getExpenseEntriesFromFirestore();
      setExpenses(fetchedExpenses);
    } catch (error) {
      console.error("CLIENT: Failed to fetch expenses:", error);
      toast({ title: "Error", description: "Could not fetch expense entries.", variant: "destructive" });
    } finally {
      setIsLoadingExpenses(false);
    }
  }, [toast]);

  const fetchParties = useCallback(async () => {
    setIsLoadingParties(true);
    try {
      const parties = await getPartiesFromFirestore();
      setAvailableParties(parties);
    } catch (error) {
      console.error("CLIENT: Failed to fetch parties for expenses:", error);
      toast({ title: "Error", description: "Could not fetch parties.", variant: "destructive" });
    } finally {
      setIsLoadingParties(false);
    }
  }, [toast]);


  useEffect(() => {
    if (date === undefined) {
        setDate(new Date());
    }
    fetchExpenses();
    fetchParties();
  }, [date, fetchExpenses, fetchParties]);

  useEffect(() => {
    if (category !== "Salary") {
      setSelectedPartyId(undefined);
    }
  }, [category]);

  const resetFormFields = () => {
    setDate(new Date());
    setCategory("Miscellaneous");
    setSelectedPartyId(undefined);
    setDescription("");
    setAmount("");
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!date || !description.trim() || !amount) {
      toast({ title: "Error", description: "Please fill all required fields (Date, Description, Amount).", variant: "destructive" });
      return;
    }
    const parsedAmount = parseFloat(amount);
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
        toast({ title: "Error", description: "Please enter a valid amount.", variant: "destructive" });
        return;
    }

    let partyDetails: { partyId?: string; partyName?: string } = {};
    if (category === "Salary" && selectedPartyId) {
      const party = availableParties.find(p => p.id === selectedPartyId);
      if (party) {
        partyDetails = { partyId: party.id, partyName: party.name };
      } else {
         toast({ title: "Error", description: "Selected party for salary not found.", variant: "destructive" });
         return;
      }
    }
     if (category === "Salary" && !selectedPartyId) {
      toast({ title: "Error", description: "Please select a party for salary expense.", variant: "destructive" });
      return;
    }

    setIsSubmittingExpense(true);
    const newExpenseData: Omit<ExpenseEntry, 'id'> = {
      date,
      category,
      description: description.trim(),
      amount: parsedAmount,
      ...partyDetails,
    };
    
    const result = await addExpenseEntryToFirestore(newExpenseData);

    if (result.success) {
      toast({ title: "Success", description: "Expense recorded."});
      resetFormFields();
      await fetchExpenses(); // Refresh the list
    } else {
      toast({ title: "Error", description: result.error || "Failed to record expense.", variant: "destructive" });
    }
    setIsSubmittingExpense(false);
  };

  const partiesForSalary = useMemo(() => {
    return availableParties.filter(p => p.type === "Employee" || p.type === "Supplier");
  }, [availableParties]);

  return (
    <div>
      <PageHeader
        title={pageSpecificTitle}
        description="Track and manage your business expenses."
      />
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle>Record New Expense</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label htmlFor="expenseDate" className="flex items-center mb-1">
                    <CalendarDays className="h-4 w-4 mr-2 text-muted-foreground" /> Date
                </Label>
                <DatePicker date={date} setDate={setDate} />
              </div>
              <div>
                <Label htmlFor="expenseCategory" className="flex items-center mb-1">
                    <ListChecks className="h-4 w-4 mr-2 text-muted-foreground" /> Category
                </Label>
                <Select value={category} onValueChange={(value: ExpenseEntry['category']) => setCategory(value)}>
                  <SelectTrigger id="expenseCategory">
                    <SelectValue placeholder="Select category" />
                  </SelectTrigger>
                  <SelectContent>
                    {expenseCategories.map(cat => (
                      <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {category === "Salary" && (
                <div>
                  <Label htmlFor="expenseParty" className="flex items-center mb-1">
                    <Users className="h-4 w-4 mr-2 text-muted-foreground" /> Party (for Salary)
                  </Label>
                  <Select 
                    value={selectedPartyId} 
                    onValueChange={setSelectedPartyId} 
                    disabled={isLoadingParties || partiesForSalary.length === 0}
                  >
                    <SelectTrigger id="expenseParty">
                      <SelectValue placeholder="Select party" />
                    </SelectTrigger>
                    <SelectContent>
                      {isLoadingParties ? (
                        <SelectItem value="loading" disabled>Loading parties...</SelectItem>
                      ) : partiesForSalary.length === 0 ? (
                        <SelectItem value="no-parties" disabled>No eligible parties (Employee/Supplier) found.</SelectItem>
                      ) : (
                        partiesForSalary.map(party => (
                          <SelectItem key={party.id} value={party.id}>{party.name} ({party.type})</SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>
                </div>
              )}

              <div>
                <Label htmlFor="expenseDescription" className="flex items-center mb-1">
                    <FileText className="h-4 w-4 mr-2 text-muted-foreground" /> Description
                </Label>
                <Textarea 
                  id="expenseDescription" 
                  value={description} 
                  onChange={(e) => setDescription(e.target.value)} 
                  placeholder="Enter expense details" 
                  required 
                />
              </div>
              <div>
                <Label htmlFor="expenseAmount" className="flex items-center mb-1">
                    <IndianRupee className="h-4 w-4 mr-1 text-muted-foreground" /> Amount
                </Label>
                <Input 
                  id="expenseAmount" 
                  type="number" 
                  step="0.01" 
                  value={amount} 
                  onChange={(e) => setAmount(e.target.value)} 
                  placeholder="Enter amount" 
                  required 
                />
              </div>
              <Button type="submit" className="w-full" disabled={isSubmittingExpense || isLoadingParties}>
                <PlusCircle className="h-4 w-4 mr-2" /> 
                {isSubmittingExpense ? 'Adding...' : 'Add Expense'}
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Expense History</CardTitle>
            <CardDescription>List of all recorded expenses from Firestore.</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoadingExpenses ? (
              <div className="space-y-2">
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead>Party</TableHead>
                    <TableHead className="text-right">Amount (₹)</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {expenses.length === 0 ? (
                      <TableRow>
                          <TableCell colSpan={5} className="text-center text-muted-foreground">No expenses recorded yet.</TableCell>
                      </TableRow>
                  ) : (
                      expenses.map((exp) => (
                      <TableRow key={exp.id}>
                          <TableCell>{format(exp.date, 'P')}</TableCell>
                          <TableCell>{exp.category}</TableCell>
                          <TableCell>{exp.description}</TableCell>
                          <TableCell>{exp.partyName || "-"}</TableCell>
                          <TableCell className="text-right">{exp.amount.toFixed(2)}</TableCell>
                      </TableRow>
                      ))
                  )}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
