
"use client";

import { useState, type FormEvent, useEffect } from "react";
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
import { IndianRupee, ListChecks, FileText, PlusCircle, CalendarDays } from "lucide-react";
import type { ExpenseEntry } from "@/lib/types";
import { useToast } from "@/hooks/use-toast";

const initialExpenses: ExpenseEntry[] = [
  { id: "E1", date: new Date(new Date().setDate(new Date().getDate() - 1)), category: "Salary", description: "Helper wages - April", amount: 5000 },
  { id: "E2", date: new Date(), category: "Miscellaneous", description: "Office stationary", amount: 250 },
];

const expenseCategories: ExpenseEntry['category'][] = ["Salary", "Miscellaneous"];

export default function ExpensesPage() {
  const { toast } = useToast();
  const [expenses, setExpenses] = useState<ExpenseEntry[]>(initialExpenses);

  const [date, setDate] = useState<Date | undefined>(new Date());
  const [category, setCategory] = useState<ExpenseEntry['category']>("Miscellaneous");
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!date || !description.trim() || !amount) {
      toast({ title: "Error", description: "Please fill all required fields.", variant: "destructive" });
      return;
    }
    const parsedAmount = parseFloat(amount);
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
        toast({ title: "Error", description: "Please enter a valid amount.", variant: "destructive" });
        return;
    }

    const newExpense: ExpenseEntry = {
      id: String(Date.now()),
      date,
      category,
      description: description.trim(),
      amount: parsedAmount,
    };
    setExpenses(prevExpenses => [newExpense, ...prevExpenses].sort((a,b) => b.date.getTime() - a.date.getTime()));
    
    toast({ title: "Success", description: "Expense recorded."});

    // Reset form
    setDescription("");
    setAmount("");
    setCategory("Miscellaneous");
    setDate(new Date());
  };

  return (
    <div>
      <PageHeader
        title="Expenses"
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
              <Button type="submit" className="w-full">
                <PlusCircle className="h-4 w-4 mr-2" /> Add Expense
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Expense History</CardTitle>
            <CardDescription>List of all recorded expenses.</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead className="text-right">Amount (₹)</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {expenses.length === 0 ? (
                    <TableRow>
                        <TableCell colSpan={4} className="text-center text-muted-foreground">No expenses recorded yet.</TableCell>
                    </TableRow>
                ) : (
                    expenses.map((exp) => (
                    <TableRow key={exp.id}>
                        <TableCell>{exp.date.toLocaleDateString()}</TableCell>
                        <TableCell>{exp.category}</TableCell>
                        <TableCell>{exp.description}</TableCell>
                        <TableCell className="text-right">{exp.amount.toFixed(2)}</TableCell>
                    </TableRow>
                    ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
