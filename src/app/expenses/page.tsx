
"use client";

import { useState, type FormEvent, useEffect, useCallback, useMemo, useRef } from "react";
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
import { getPartiesFromFirestore, addPartyToFirestore } from "../parties/actions";
import { Skeleton } from "@/components/ui/skeleton";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";

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
  
  const [partyNameInputForSalary, setPartyNameInputForSalary] = useState<string>("");
  const [selectedPartyForSalary, setSelectedPartyForSalary] = useState<Party | null>(null);
  const [isPartyPopoverOpenForSalary, setIsPartyPopoverOpenForSalary] = useState(false);
  const partyNameInputRefForSalary = useRef<HTMLInputElement>(null);
  const justPartySelectedRef = useRef(false);
  
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
      setPartyNameInputForSalary("");
      setSelectedPartyForSalary(null);
    }
  }, [category]);

  const resetFormFields = () => {
    setDate(new Date());
    setCategory("Miscellaneous");
    setPartyNameInputForSalary("");
    setSelectedPartyForSalary(null);
    setDescription("");
    setAmount("");
  };

  const partiesForSalarySuggestions = useMemo(() => {
    return availableParties
      .filter(p => p.type === "Employee" || p.type === "Supplier")
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [availableParties]);

  const handlePartyNameInputChangeForSalary = useCallback((value: string) => {
    setPartyNameInputForSalary(value);
    setSelectedPartyForSalary(null); 
  }, []);

  const handlePartySelectForSalary = useCallback(async (partyValue: string, isCreateNew = false) => {
    let partyNameToSet = partyValue;
    let partyIdToSet: string | undefined = undefined;
    let partyTypeToSet: Party['type'] = "Employee"; 
    let partyToSelect: Party | null = null;

    if (isCreateNew) {
      const newPartyName = partyNameInputForSalary.trim();
      if (!newPartyName) {
        toast({ title: "Error", description: "Party name cannot be empty.", variant: "destructive" });
        setIsPartyPopoverOpenForSalary(false);
        return;
      }
      partyNameToSet = newPartyName;
      
      const existingParty = availableParties.find(
        p => p.name.toLowerCase() === newPartyName.toLowerCase() && (p.type === "Employee" || p.type === "Supplier")
      );
      if (existingParty) {
        toast({ title: "Info", description: `Party "${newPartyName}" (${existingParty.type}) already exists. Selecting existing.`, variant: "default" });
        partyToSelect = existingParty;
      } else {
        setIsSubmittingExpense(true); 
        const result = await addPartyToFirestore({ name: newPartyName, type: partyTypeToSet });
        if (result.success && result.id) {
          toast({ title: "Success", description: `Party "${newPartyName}" (${partyTypeToSet}) added.` });
          partyIdToSet = result.id;
          partyToSelect = { id: result.id, name: newPartyName, type: partyTypeToSet };
          await fetchParties(); 
        } else {
          toast({ title: "Error", description: result.error || "Failed to add party.", variant: "destructive" });
          setIsSubmittingExpense(false);
          setIsPartyPopoverOpenForSalary(false);
          return;
        }
        setIsSubmittingExpense(false);
      }
    } else {
      const selected = partiesForSalarySuggestions.find(p => p.name === partyValue);
      if (selected) {
        partyToSelect = selected;
        partyNameToSet = selected.name;
      }
    }

    if (partyToSelect) {
        setSelectedPartyForSalary(partyToSelect);
    }
    setPartyNameInputForSalary(partyNameToSet);
    setIsPartyPopoverOpenForSalary(false);
    justPartySelectedRef.current = true;
  }, [partyNameInputForSalary, toast, fetchParties, availableParties, partiesForSalarySuggestions]);


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
    if (category === "Salary") {
      if (selectedPartyForSalary) {
        partyDetails = { partyId: selectedPartyForSalary.id, partyName: selectedPartyForSalary.name };
      } else if (partyNameInputForSalary.trim()) {
        // Check if typed name matches an existing party exactly if not formally selected via popover
        const matchedParty = partiesForSalarySuggestions.find(p => p.name.toLowerCase() === partyNameInputForSalary.trim().toLowerCase());
        if(matchedParty) {
            partyDetails = { partyId: matchedParty.id, partyName: matchedParty.name };
        } else {
            // If no exact match, and not selected, it implies user typed a new name without confirming "add new"
            toast({ title: "Error", description: `Party "${partyNameInputForSalary.trim()}" not found. Please select from suggestions or add as a new party.`, variant: "destructive" });
            return;
        }
      } else {
         toast({ title: "Error", description: "Please select or add a party for the salary expense.", variant: "destructive" });
         return;
      }
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
      await fetchExpenses(); 
    } else {
      toast({ title: "Error", description: result.error || "Failed to record expense.", variant: "destructive" });
    }
    setIsSubmittingExpense(false);
  };
  
  const filteredPartySuggestionsForSalary = useMemo(() => {
    if (!partyNameInputForSalary.trim()) return partiesForSalarySuggestions;
    return partiesForSalarySuggestions.filter((party) =>
      party.name.toLowerCase().includes(partyNameInputForSalary.toLowerCase())
    );
  }, [partyNameInputForSalary, partiesForSalarySuggestions]);


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
                  <Label htmlFor="partyNameInputForSalary" className="flex items-center mb-1">
                    <Users className="h-4 w-4 mr-2 text-muted-foreground" /> Party (for Salary)
                  </Label>
                  <Popover open={isPartyPopoverOpenForSalary} onOpenChange={setIsPartyPopoverOpenForSalary}>
                    <PopoverTrigger asChild>
                      <Input
                        id="partyNameInputForSalary"
                        ref={partyNameInputRefForSalary}
                        value={partyNameInputForSalary}
                        onChange={(e) => handlePartyNameInputChangeForSalary(e.target.value)}
                        onFocus={() => {
                          if (justPartySelectedRef.current) {
                            justPartySelectedRef.current = false;
                          } else {
                            setIsPartyPopoverOpenForSalary(true);
                          }
                        }}
                        placeholder="Type or select party"
                        autoComplete="off"
                        className="w-full text-left"
                      />
                    </PopoverTrigger>
                    <PopoverContent
                      className="w-[--radix-popover-trigger-width] p-0"
                      side="bottom"
                      align="start"
                      sideOffset={0}
                      onOpenAutoFocus={(e) => e.preventDefault()}
                    >
                      <Command>
                        <CommandInput
                          value={partyNameInputForSalary}
                          onValueChange={handlePartyNameInputChangeForSalary}
                          className="sr-only"
                          tabIndex={-1}
                          aria-hidden="true"
                        />
                        <CommandList>
                          {isLoadingParties ? (
                            <CommandItem disabled>Loading parties...</CommandItem>
                          ) : (
                            <>
                              <CommandGroup>
                                {partyNameInputForSalary.trim() && 
                                 !partiesForSalarySuggestions.some(p => p.name.toLowerCase() === partyNameInputForSalary.trim().toLowerCase()) && (
                                  <CommandItem
                                    key={`__CREATE_SALARY_PARTY__${partyNameInputForSalary.trim()}`}
                                    value={`__CREATE_SALARY_PARTY__${partyNameInputForSalary.trim()}`}
                                    onSelect={() => handlePartySelectForSalary(partyNameInputForSalary.trim(), true)}
                                  >
                                    <PlusCircle className="mr-2 h-4 w-4" />
                                    Add new party: "{partyNameInputForSalary.trim()}" (as Employee)
                                  </CommandItem>
                                )}
                                {filteredPartySuggestionsForSalary.map((party) => (
                                  <CommandItem
                                    key={party.id}
                                    value={party.name}
                                    onSelect={() => handlePartySelectForSalary(party.name)}
                                  >
                                    {party.name} ({party.type})
                                  </CommandItem>
                                ))}
                                <CommandEmpty>
                                  {partiesForSalarySuggestions.length === 0 && !partyNameInputForSalary.trim() 
                                    ? "No Employee/Supplier parties found. Type to add new." 
                                    : "No matching Employee/Supplier parties."}
                                </CommandEmpty>
                              </CommandGroup>
                            </>
                          )}
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
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
