
"use client";

import { useState, type FormEvent, useEffect, useMemo, useCallback, useRef } from "react";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  TableFooter
} from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { CalendarDays, User, Percent, Scale, IndianRupee, PlusCircle, CreditCard, MoreHorizontal, Edit, Trash2, StickyNote } from "lucide-react";
import type { BulkSaleEntry, Party } from "@/lib/types";
import { DatePicker } from "@/components/ui/date-picker";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { Skeleton } from "@/components/ui/skeleton";
import { addBulkSaleEntryToFirestore, getBulkSaleEntriesFromFirestore, updateBulkSaleEntryInFirestore, deleteBulkSaleEntryFromFirestore } from "./actions";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { getPartiesFromFirestore, addPartyToFirestore } from "../parties/actions";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { usePageTitle } from '@/context/PageTitleContext';

export default function BulkSalesPage() {
  const { setPageTitle } = usePageTitle();
  const pageSpecificTitle = "Bulk Milk Sales";

  useEffect(() => {
    setPageTitle(pageSpecificTitle);
  }, [setPageTitle, pageSpecificTitle]);

  const { toast } = useToast();
  const [allEntries, setAllEntries] = useState<BulkSaleEntry[]>([]);
  const [isLoadingEntries, setIsLoadingEntries] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [date, setDate] = useState<Date | undefined>(undefined);
  const [tableFilterDate, setTableFilterDate] = useState<Date | undefined>(undefined);
  
  const [customerNameInput, setCustomerNameInput] = useState<string>("");
  const [isCustomerPopoverOpen, setIsCustomerPopoverOpen] = useState(false);
  const customerNameInputRef = useRef<HTMLInputElement>(null);

  const [quantityLtr, setQuantityLtr] = useState<string>("");
  const [fatPercentage, setFatPercentage] = useState<string>("");
  const [rateFactor, setRateFactor] = useState<string>("6.7"); 
  const [paymentType, setPaymentType] = useState<"Cash" | "Credit">("Cash");
  const [remarks, setRemarks] = useState<string>("");

  const [availableParties, setAvailableParties] = useState<Party[]>([]);
  const [isLoadingParties, setIsLoadingParties] = useState(true);

  const [editingEntryId, setEditingEntryId] = useState<string | null>(null);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [entryToDelete, setEntryToDelete] = useState<BulkSaleEntry | null>(null);

  const fetchParties = useCallback(async () => {
    setIsLoadingParties(true);
    try {
      const parties = await getPartiesFromFirestore();
      setAvailableParties(parties); 
    } catch (error) {
      console.error("CLIENT: Failed to fetch parties for bulk sales:", error);
      toast({ title: "Error", description: "Could not fetch parties.", variant: "destructive" });
    } finally {
      setIsLoadingParties(false);
    }
  }, [toast]);
  
  const fetchEntries = useCallback(async () => {
    setIsLoadingEntries(true);
    try {
      const fetchedEntries = await getBulkSaleEntriesFromFirestore();
      const processedEntries = fetchedEntries.map(entry => ({
        ...entry,
        date: entry.date instanceof Date ? entry.date : new Date(entry.date) 
      })).sort((a, b) => b.date.getTime() - a.date.getTime());
      setAllEntries(processedEntries);
    } catch (error) {
      console.error("CLIENT: Failed to fetch bulk sale entries:", error);
      toast({ title: "Error", description: "Could not fetch bulk sale entries.", variant: "destructive" });
    } finally {
      setIsLoadingEntries(false);
    }
  }, [toast]);

  useEffect(() => {
    if (!editingEntryId) {
        setDate(new Date());
    }
    setTableFilterDate(new Date()); 
    fetchEntries();
    fetchParties();
  }, [fetchEntries, fetchParties, editingEntryId]); 

  const partiesForBulkSale = useMemo(() => {
    return availableParties.filter(p => p.type === "Customer"); // Or any other relevant type for bulk buyers
  }, [availableParties]);

  const allKnownCustomerNamesForBulkSale = useMemo(() => {
    return partiesForBulkSale.map(p => p.name).sort((a, b) => a.localeCompare(b));
  }, [partiesForBulkSale]);


  const totalAmountDisplay = useMemo(() => {
    const quantityStr = quantityLtr.replace(',', '.');
    const fatStr = fatPercentage.replace(',', '.');
    const rateStr = rateFactor.replace(',', '.');
    
    const quantity = parseFloat(quantityStr);
    const fat = parseFloat(fatStr);
    const rate = parseFloat(rateStr);

    if (!isNaN(quantity) && quantity > 0 && !isNaN(fat) && fat >= 0 && !isNaN(rate) && rate > 0) {
      return (quantity * fat * rate);
    }
    return 0;
  }, [quantityLtr, fatPercentage, rateFactor]);

  const filteredEntries = useMemo(() => {
    let dateFiltered = allEntries;
    if (tableFilterDate !== undefined) {
        const targetDateStr = format(tableFilterDate, 'yyyy-MM-dd');
        dateFiltered = allEntries.filter(entry => {
            if (!entry.date || !(entry.date instanceof Date) || isNaN(entry.date.getTime())) {
                return false;
            }
            const entryDateStr = format(entry.date, 'yyyy-MM-dd');
            return entryDateStr === targetDateStr;
        });
    }
    return dateFiltered;
  }, [allEntries, tableFilterDate]);
  
  const totalFilteredAmount = useMemo(() => {
    return filteredEntries.reduce((sum, entry) => sum + (entry.totalAmount || 0), 0);
  }, [filteredEntries]);

  const handleCustomerNameInputChange = useCallback((value: string) => {
    setCustomerNameInput(value);
    if (value.trim()){
        setIsCustomerPopoverOpen(true);
    } else {
        setIsCustomerPopoverOpen(false);
    }
  }, []);

  const handleCustomerSelect = useCallback(async (currentValue: string, isCreateNew = false) => {
    const trimmedValue = currentValue.trim();
    if (isCreateNew) {
      if (!trimmedValue) {
        toast({ title: "Error", description: "Customer name cannot be empty.", variant: "destructive" });
        setIsCustomerPopoverOpen(false);
        return;
      }
      setIsSubmitting(true);
      const result = await addPartyToFirestore({ name: trimmedValue, type: "Customer" }); 
      if (result.success && result.id) {
        setCustomerNameInput(trimmedValue);
        toast({ title: "Success", description: `Customer "${trimmedValue}" added.` });
        await fetchParties(); 
      } else {
        toast({ title: "Error", description: result.error || "Failed to add customer.", variant: "destructive" });
      }
      setIsSubmitting(false);
    } else {
      setCustomerNameInput(trimmedValue);
    }
    setIsCustomerPopoverOpen(false);
    customerNameInputRef.current?.focus();
  }, [toast, fetchParties]);

  const resetFormFields = useCallback(() => {
    if (!editingEntryId) {
      setDate(new Date());
    }
    setCustomerNameInput(""); 
    setQuantityLtr("");
    setFatPercentage("");
    setRateFactor("6.7"); // Reset to default or keep existing for faster entry
    setPaymentType("Cash");
    setRemarks("");
    setEditingEntryId(null);
    setIsCustomerPopoverOpen(false);
  }, [editingEntryId]);


  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!date || !customerNameInput.trim() || !quantityLtr || !fatPercentage || !rateFactor) {
      toast({ title: "Error", description: "Please fill all required fields (Date, Customer, Quantity, FAT, Rate Factor).", variant: "destructive" });
      return;
    }

    const qLtrStr = quantityLtr.replace(',', '.');
    const fatPStr = fatPercentage.replace(',', '.');
    const finalRateStr = rateFactor.replace(',', '.');

    const qLtr = parseFloat(qLtrStr);
    const fatP = parseFloat(fatPStr);
    const finalRate = parseFloat(finalRateStr); 

    if (isNaN(qLtr) || qLtr <= 0) {
      toast({ title: "Error", description: "Please enter a valid quantity.", variant: "destructive" }); return;
    }
    if (isNaN(fatP) || fatP < 0) { 
      toast({ title: "Error", description: "Please enter a valid FAT percentage (must be >= 0).", variant: "destructive" }); return;
    }
    if (isNaN(finalRate) || finalRate <= 0) {
      toast({ title: "Error", description: "Please enter a valid rate factor (must be > 0).", variant: "destructive" }); return;
    }

    const finalTotalAmount = qLtr * fatP * finalRate; 

    const entryData: Omit<BulkSaleEntry, 'id'> = {
      date, 
      customerName: customerNameInput.trim(), 
      quantityLtr: qLtr,
      fatPercentage: fatP,
      rateFactor: finalRate,
      totalAmount: finalTotalAmount,
      paymentType,
      remarks: remarks.trim(),
    };
    
    setIsSubmitting(true);
    
    let result;
    if (editingEntryId) {
      result = await updateBulkSaleEntryInFirestore(editingEntryId, entryData);
      toast({ title: result.success ? "Success" : "Error", description: result.success ? "Bulk sale entry updated." : (result.error || "Failed to update entry."), variant: result.success ? "default" : "destructive"});
    } else {
      result = await addBulkSaleEntryToFirestore(entryData);
      toast({ title: result.success ? "Success" : "Error", description: result.success ? "Bulk sale entry added." : (result.error || "Failed to add entry."), variant: result.success ? "default" : "destructive"});
    }
    
    if (result.success) {
      resetFormFields();
      await fetchEntries(); 
    }
    setIsSubmitting(false);
  };

  const filteredCustomerSuggestions = useMemo(() => {
    if (!customerNameInput.trim()) return allKnownCustomerNamesForBulkSale;
    return allKnownCustomerNamesForBulkSale.filter((name) =>
      name.toLowerCase().includes(customerNameInput.toLowerCase())
    );
  }, [customerNameInput, allKnownCustomerNamesForBulkSale]);

  const handleEdit = (entry: BulkSaleEntry) => {
    setEditingEntryId(entry.id);
    setDate(entry.date); 
    setCustomerNameInput(entry.customerName);
    setQuantityLtr(String(entry.quantityLtr));
    setFatPercentage(String(entry.fatPercentage));
    setRateFactor(String(entry.rateFactor));
    setPaymentType(entry.paymentType);
    setRemarks(entry.remarks || "");
  };

  const handleDeleteClick = (entry: BulkSaleEntry) => {
    setEntryToDelete(entry);
    setShowDeleteDialog(true);
  };

  const confirmDelete = async () => {
    if (!entryToDelete) return;
    setIsSubmitting(true);
    const result = await deleteBulkSaleEntryFromFirestore(entryToDelete.id);
    toast({ title: result.success ? "Success" : "Error", description: result.success ? "Entry deleted." : (result.error || "Failed to delete entry."), variant: result.success ? "default" : "destructive" });
    if (result.success) {
      await fetchEntries();
    }
    setShowDeleteDialog(false);
    setEntryToDelete(null);
    setIsSubmitting(false);
  };

  return (
    <div>
      <PageHeader title={pageSpecificTitle} description="Record bulk milk sales based on Liter x FAT x Rate Factor." />
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle>{editingEntryId ? "Edit Bulk Sale" : "New Bulk Sale"}</CardTitle>
            <CardDescription>{editingEntryId ? "Modify existing bulk sale details." : "Add a new bulk sale record."}</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label htmlFor="date" className="flex items-center mb-1">
                  <CalendarDays className="h-4 w-4 mr-2 text-muted-foreground" /> Date
                </Label>
                 <DatePicker date={date} setDate={setDate} />
              </div>
              
              <div>
                <Label htmlFor="customerNameInput" className="flex items-center mb-1">
                  <User className="h-4 w-4 mr-2 text-muted-foreground" /> Customer Name (Bulk Buyer)
                </Label>
                <Popover open={isCustomerPopoverOpen} onOpenChange={setIsCustomerPopoverOpen}>
                  <PopoverTrigger asChild>
                    <Input
                      id="customerNameInput"
                      ref={customerNameInputRef}
                      value={customerNameInput}
                      onChange={(e) => handleCustomerNameInputChange(e.target.value)}
                      onFocus={() => {
                        if (customerNameInput.trim() && filteredCustomerSuggestions.length > 0) {
                            setIsCustomerPopoverOpen(true);
                        }
                      }}
                      placeholder="Start typing customer name"
                      autoComplete="off"
                      required
                      className="w-full"
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
                        placeholder="Search or add new customer..." 
                        value={customerNameInput} 
                        onValueChange={handleCustomerNameInputChange}
                       />
                      <CommandList>
                        {isLoadingParties ? (
                           <CommandItem disabled>Loading customers...</CommandItem>
                        ) : (
                          <>
                            {customerNameInput.trim() && !allKnownCustomerNamesForBulkSale.some(name => name.toLowerCase() === customerNameInput.trim().toLowerCase()) && (
                               <CommandItem
                                key={`__CREATE__${customerNameInput.trim()}`}
                                value={`__CREATE__${customerNameInput.trim()}`}
                                onSelect={() => handleCustomerSelect(customerNameInput.trim(), true)}
                              >
                                <PlusCircle className="mr-2 h-4 w-4" />
                                Add new customer: "{customerNameInput.trim()}"
                              </CommandItem>
                            )}
                            {filteredCustomerSuggestions.map((name) => (
                              <CommandItem
                                key={name}
                                value={name}
                                onSelect={() => handleCustomerSelect(name)}
                              >
                                {name}
                              </CommandItem>
                            ))}
                             {filteredCustomerSuggestions.length === 0 && customerNameInput.trim() && allKnownCustomerNamesForBulkSale.some(name => name.toLowerCase() === customerNameInput.trim().toLowerCase()) && (
                                <CommandEmpty>No existing customers match. Select "Add new..." above.</CommandEmpty>
                             )}
                             {allKnownCustomerNamesForBulkSale.length === 0 && !customerNameInput.trim() && (
                                <CommandEmpty>No customers found. Type to add a new one.</CommandEmpty>
                             )}
                          </>
                        )}
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <Label htmlFor="quantityLtr" className="flex items-center mb-1">
                    <Scale className="h-4 w-4 mr-2 text-muted-foreground" /> Qty (Ltr)
                  </Label>
                  <Input id="quantityLtr" type="text" inputMode="decimal" value={quantityLtr} onChange={(e) => setQuantityLtr(e.target.value)} placeholder="e.g., 100.5" required />
                </div>
                <div>
                  <Label htmlFor="fatPercentage" className="flex items-center mb-1">
                    <Percent className="h-4 w-4 mr-2 text-muted-foreground" /> FAT (%)
                  </Label>
                  <Input id="fatPercentage" type="text" inputMode="decimal" value={fatPercentage} onChange={(e) => setFatPercentage(e.target.value)} placeholder="e.g., 3.8" required />
                </div>
                 <div>
                  <Label htmlFor="rateFactor" className="flex items-center mb-1">
                    <IndianRupee className="h-4 w-4 mr-1 text-muted-foreground" /> Rate Factor (₹)
                  </Label>
                  <Input 
                    id="rateFactor" 
                    type="text" 
                    inputMode="decimal"
                    value={rateFactor} 
                    onChange={(e) => setRateFactor(e.target.value)} 
                    placeholder="e.g., 6.7" 
                    required 
                  />
                </div>
              </div>
              <div>
                <Label htmlFor="totalAmount" className="flex items-center mb-1">
                  <IndianRupee className="h-4 w-4 mr-1 text-muted-foreground" /> Total Amount (₹)
                </Label>
                <Input id="totalAmount" value={totalAmountDisplay ? `₹ ${totalAmountDisplay.toFixed(2)}` : "₹ 0.00"} readOnly className="font-semibold bg-muted/50" />
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                    <Label htmlFor="paymentType" className="flex items-center mb-1"><CreditCard className="h-4 w-4 mr-2 text-muted-foreground" />Payment Type</Label>
                    <Select value={paymentType} onValueChange={(value: "Cash" | "Credit") => setPaymentType(value)}>
                        <SelectTrigger>
                            <SelectValue placeholder="Select payment type" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="Cash">Cash</SelectItem>
                            <SelectItem value="Credit">Credit</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
                <div>
                  <Label htmlFor="remarks" className="flex items-center mb-1">
                    <StickyNote className="h-4 w-4 mr-2 text-muted-foreground" /> Remarks
                  </Label>
                  <Textarea id="remarks" value={remarks} onChange={(e) => setRemarks(e.target.value)} placeholder="Optional notes" />
                </div>
              </div>

              <Button type="submit" className="w-full" disabled={isSubmitting || isLoadingEntries || isLoadingParties}>
                {editingEntryId ? <Edit className="h-4 w-4 mr-2" /> : <PlusCircle className="h-4 w-4 mr-2" />}
                {isSubmitting && !editingEntryId ? 'Adding...' : (isSubmitting && editingEntryId ? 'Updating...' : (editingEntryId ? 'Update Sale' : 'Add Sale'))}
              </Button>
              {editingEntryId && (
                <Button type="button" variant="outline" className="w-full mt-2" onClick={resetFormFields} disabled={isSubmitting}>
                  Cancel Edit
                </Button>
              )}
            </form>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
           <CardHeader>
            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
              <div className="flex-1">
                <CardTitle>Daily Bulk Sales Ledger</CardTitle>
                 <CardDescription className="mt-1">
                  {tableFilterDate ? `Ledger for ${format(tableFilterDate, 'PPP')}` : "Select a date to view ledger."}
                  {isLoadingEntries && allEntries.length === 0 && " Loading entries..."}
                  {!isLoadingEntries && tableFilterDate && filteredEntries.length === 0 && ` (No entries for this date. Checked ${allEntries.length} total entries)`}
                </CardDescription>
              </div>
              <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
                <div className="w-full sm:min-w-[200px]">
                  <Label htmlFor="tableDateFilter" className="sr-only">Filter by date</Label>
                  <DatePicker date={tableFilterDate} setDate={setTableFilterDate} />
                </div>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {isLoadingEntries && allEntries.length === 0 && !tableFilterDate ? ( 
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
                    <TableHead>Customer</TableHead> 
                    <TableHead className="text-right">Qty (Ltr)</TableHead>
                    <TableHead className="text-right">FAT (%)</TableHead>
                    <TableHead className="text-right">Rate Factor (₹)</TableHead>
                    <TableHead className="text-right">Total (₹)</TableHead>
                    <TableHead>Payment</TableHead>
                    <TableHead>Remarks</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredEntries.length === 0 && !isLoadingEntries ? (
                    <TableRow>
                      <TableCell colSpan={9} className="text-center text-muted-foreground">
                        {tableFilterDate ? `No entries for ${format(tableFilterDate, 'P')}.` : "Select a date to view entries."}
                        {tableFilterDate && allEntries.length > 0 && !filteredEntries.length && ` (Checked ${allEntries.length} total entries)`}
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredEntries.map((entry) => (
                      <TableRow key={entry.id}>
                        <TableCell>{entry.date instanceof Date && !isNaN(entry.date.getTime()) ? format(entry.date, 'P') : 'Invalid Date'}</TableCell>
                        <TableCell>{entry.customerName}</TableCell>
                        <TableCell className="text-right">{entry.quantityLtr.toFixed(1)}</TableCell>
                        <TableCell className="text-right">{entry.fatPercentage.toFixed(1)}</TableCell>
                        <TableCell className="text-right">{entry.rateFactor ? entry.rateFactor.toFixed(2) : "-"}</TableCell>
                        <TableCell className="text-right font-semibold">{entry.totalAmount ? entry.totalAmount.toFixed(2) : "-"}</TableCell>
                        <TableCell>{entry.paymentType}</TableCell>
                        <TableCell className="max-w-[150px] truncate" title={entry.remarks}>{entry.remarks || "-"}</TableCell>
                        <TableCell className="text-right">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-8 w-8">
                                <MoreHorizontal className="h-4 w-4" />
                                <span className="sr-only">Actions</span>
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onSelect={() => handleEdit(entry)}>
                                <Edit className="mr-2 h-4 w-4" /> Edit
                              </DropdownMenuItem>
                              <DropdownMenuItem onSelect={() => handleDeleteClick(entry)} className="text-destructive focus:text-destructive focus:bg-destructive/10">
                                <Trash2 className="mr-2 h-4 w-4" /> Delete
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
                {filteredEntries.length > 0 && (
                  <TableFooter>
                    <TableRow>
                        <TableCell colSpan={5} className="text-right font-semibold">Total Bulk Sale Amount:</TableCell>
                        <TableCell className="text-right font-bold">{totalFilteredAmount.toFixed(2)}</TableCell>
                        <TableCell colSpan={3} />
                    </TableRow>
                  </TableFooter>
                )}
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
      {showDeleteDialog && entryToDelete && (
        <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Are you sure?</AlertDialogTitle>
              <AlertDialogDescription>
                This action cannot be undone. This will permanently delete the bulk sale entry for
                "{entryToDelete.customerName}" on {entryToDelete.date instanceof Date && !isNaN(entryToDelete.date.getTime()) ? format(entryToDelete.date, 'P') : 'Invalid Date'}.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel onClick={() => {setShowDeleteDialog(false); setEntryToDelete(null);}}>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={confirmDelete} className="bg-destructive hover:bg-destructive/90" disabled={isSubmitting}>
                {isSubmitting ? 'Deleting...' : 'Delete'}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
    </div>
  );
}
