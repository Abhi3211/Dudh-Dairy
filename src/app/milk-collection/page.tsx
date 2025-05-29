
"use client";

import { useState, type FormEvent, useEffect, useMemo, useCallback, useRef } from "react";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
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
import { CalendarDays, User, Percent, Scale, IndianRupee, PlusCircle, Sun, Moon, Filter, MoreHorizontal, Edit, Trash2 } from "lucide-react";
import type { MilkCollectionEntry, Party } from "@/lib/types";
import { DatePicker } from "@/components/ui/date-picker";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { Skeleton } from "@/components/ui/skeleton";
import { addMilkCollectionEntryToFirestore, getMilkCollectionEntriesFromFirestore, updateMilkCollectionEntryInFirestore, deleteMilkCollectionEntryFromFirestore } from "./actions";
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


export default function MilkCollectionPage() {
  const { toast } = useToast();
  const [allEntries, setAllEntries] = useState<MilkCollectionEntry[]>([]);
  const [isLoadingEntries, setIsLoadingEntries] = useState(true);
  
  const [date, setDate] = useState<Date | undefined>(undefined);
  const [shift, setShift] = useState<"Morning" | "Evening">("Morning");
  const [tableFilterDate, setTableFilterDate] = useState<Date | undefined>(undefined);
  const [shiftFilter, setShiftFilter] = useState<"All" | "Morning" | "Evening">("All");
  
  const [customerNameInput, setCustomerNameInput] = useState<string>("");
  const [isCustomerPopoverOpen, setIsCustomerPopoverOpen] = useState(false);
  const customerNameInputRef = useRef<HTMLInputElement>(null);

  const [quantityLtr, setQuantityLtr] = useState<string>("");
  const [fatPercentage, setFatPercentage] = useState<string>("");
  const [rateInputValue, setRateInputValue] = useState<string>("6.7"); 

  const [availableParties, setAvailableParties] = useState<Party[]>([]);
  const [isLoadingParties, setIsLoadingParties] = useState(true);

  const [editingEntryId, setEditingEntryId] = useState<string | null>(null);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [entryToDelete, setEntryToDelete] = useState<MilkCollectionEntry | null>(null);

  const fetchParties = useCallback(async () => {
    setIsLoadingParties(true);
    try {
      const parties = await getPartiesFromFirestore();
      setAvailableParties(parties.filter(p => p.type === "Customer")); // Assuming milk suppliers are "Customer" type
    } catch (error) {
      console.error("CLIENT: Failed to fetch parties:", error);
      toast({ title: "Error", description: "Could not fetch parties for suggestions.", variant: "destructive" });
    } finally {
      setIsLoadingParties(false);
    }
  }, [toast]);
  
  const fetchEntries = useCallback(async () => {
    console.log('CLIENT: fetchEntries called. Setting isLoadingEntries to true.');
    setIsLoadingEntries(true);
    try {
      const fetchedEntries = await getMilkCollectionEntriesFromFirestore();
      console.log('CLIENT: Raw fetched entries from Firestore:', JSON.parse(JSON.stringify(fetchedEntries)));
      const processedEntries = fetchedEntries.map(entry => ({
        ...entry,
        date: entry.date instanceof Date ? entry.date : new Date(entry.date) 
      }));
      console.log('CLIENT: Processed milk collection entries. Count:', processedEntries.length);
      if (processedEntries.length > 0) {
        console.log('Data (sample):', JSON.parse(JSON.stringify(processedEntries[0])));
      }
      setAllEntries(processedEntries);
    } catch (error) {
      console.error("CLIENT: Failed to fetch milk collection entries:", error);
      toast({ title: "Error", description: "Could not fetch milk collection entries.", variant: "destructive" });
    } finally {
      console.log('CLIENT: fetchEntries finished. Setting isLoadingEntries to false.');
      setIsLoadingEntries(false);
    }
  }, [toast]);

  useEffect(() => {
    console.log("CLIENT: Initial useEffect running to set dates and fetch entries/parties.");
    setDate(new Date()); 
    setTableFilterDate(new Date()); 
    fetchEntries();
    fetchParties();
  }, [fetchEntries, fetchParties]); 

  const milkSuppliers = useMemo(() => {
    return availableParties.filter(p => p.type === "Customer");
  }, [availableParties]);

  const allKnownCustomerNames = useMemo(() => {
    return milkSuppliers.map(p => p.name).sort();
  }, [milkSuppliers]);


  const totalAmountDisplay = useMemo(() => {
    const quantityStr = quantityLtr.replace(',', '.');
    const fatStr = fatPercentage.replace(',', '.');
    const rateStr = rateInputValue.replace(',', '.');
    
    const quantity = parseFloat(quantityStr);
    const fat = parseFloat(fatStr);
    const rate = parseFloat(rateStr);

    if (!isNaN(quantity) && quantity > 0 && !isNaN(fat) && fat >= 0 && !isNaN(rate) && rate > 0) { // fat can be 0
      return (quantity * fat * rate).toFixed(2);
    }
    return "";
  }, [quantityLtr, fatPercentage, rateInputValue]);

  const filteredEntries = useMemo(() => {
    console.log("CLIENT: Recalculating filteredEntries. Selected tableFilterDate:", tableFilterDate ? format(tableFilterDate, 'yyyy-MM-dd') : 'undefined', "Selected shiftFilter:", shiftFilter, "Total entries being filtered:", allEntries.length);
    
    let dateFiltered = allEntries;
    if (tableFilterDate !== undefined) {
        const targetDateStr = format(tableFilterDate, 'yyyy-MM-dd');
        dateFiltered = allEntries.filter(entry => {
            if (!entry.date || !(entry.date instanceof Date) || isNaN(entry.date.getTime())) {
                console.warn("CLIENT: Invalid or missing date in entry during date filtering:", entry);
                return false;
            }
            const entryDateStr = format(entry.date, 'yyyy-MM-dd');
            const match = entryDateStr === targetDateStr;
            console.log(`CLIENT: Comparing entry ID ${entry.id}, entry date: ${entryDateStr}, target date: ${targetDateStr}, match: ${match}`);
            return match;
        });
    }

    let shiftAndDateFiltered = dateFiltered;
    if (shiftFilter !== "All") {
        shiftAndDateFiltered = dateFiltered.filter(entry => entry.shift === shiftFilter);
    } 
    
    console.log("CLIENT: Resulting filteredEntries count:", shiftAndDateFiltered.length);
    if (shiftAndDateFiltered.length > 0 && shiftAndDateFiltered.length < 5) { 
        console.log("CLIENT: Filtered entries data (sample):", JSON.parse(JSON.stringify(shiftAndDateFiltered)));
    }
    return shiftAndDateFiltered;
  }, [allEntries, tableFilterDate, shiftFilter]);
  
  const totalFilteredAmount = useMemo(() => {
    return filteredEntries.reduce((sum, entry) => sum + (entry.totalAmount || 0), 0);
  }, [filteredEntries]);


  const handleCustomerNameInputChange = useCallback((value: string) => {
    setCustomerNameInput(value);
    if (value.trim()) {
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
      setIsLoadingParties(true);
      const result = await addPartyToFirestore({ name: trimmedValue, type: "Customer" }); // Milk suppliers are Customers
      if (result.success) {
        setCustomerNameInput(trimmedValue);
        toast({ title: "Success", description: `Customer (Milk Supplier) "${trimmedValue}" added.` });
        await fetchParties(); 
      } else {
        toast({ title: "Error", description: result.error || "Failed to add customer.", variant: "destructive" });
      }
      setIsLoadingParties(false);
    } else {
      setCustomerNameInput(trimmedValue);
    }
    setIsCustomerPopoverOpen(false);
    customerNameInputRef.current?.focus();
  }, [toast, fetchParties]);

  const resetFormFields = useCallback(() => {
    setCustomerNameInput(""); 
    setQuantityLtr("");
    setFatPercentage("");
    // Keep date and shift as they are, for rapid entry
    // setRateInputValue("6.7"); // Optionally reset rate, or keep it
    setEditingEntryId(null);
    setIsCustomerPopoverOpen(false);
  }, []);


  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!date || !shift || !customerNameInput.trim() || !quantityLtr || !fatPercentage || !rateInputValue) {
      toast({ title: "Error", description: "Please fill all fields.", variant: "destructive" });
      return;
    }

    const qLtrStr = quantityLtr.replace(',', '.');
    const fatPStr = fatPercentage.replace(',', '.');
    const finalRateStr = rateInputValue.replace(',', '.');

    const qLtr = parseFloat(qLtrStr);
    const fatP = parseFloat(fatPStr);
    const finalRateFactor = parseFloat(finalRateStr); 

    if (isNaN(qLtr) || qLtr <= 0) {
      toast({ title: "Error", description: "Please enter a valid quantity.", variant: "destructive" });
      return;
    }
    if (isNaN(fatP) || fatP < 0) { // FAT can be 0
        toast({ title: "Error", description: "Please enter a valid FAT percentage (must be >= 0).", variant: "destructive" });
        return;
    }
    if (isNaN(finalRateFactor) || finalRateFactor <= 0) {
      toast({ title: "Error", description: "Please enter a valid rate factor (must be > 0).", variant: "destructive" });
      return;
    }

    const finalTotalAmount = qLtr * fatP * finalRateFactor; 

    const entryData: Omit<MilkCollectionEntry, 'id'> = {
      date, 
      shift,
      customerName: customerNameInput.trim(), 
      quantityLtr: qLtr,
      fatPercentage: fatP,
      ratePerLtr: finalRateFactor,
      totalAmount: finalTotalAmount,
    };
    
    console.log("CLIENT: Submitting entry data:", JSON.parse(JSON.stringify(entryData)));
    setIsLoadingEntries(true); 
    
    let result;
    if (editingEntryId) {
      result = await updateMilkCollectionEntryInFirestore(editingEntryId, entryData);
      if (result.success) {
        toast({ title: "Success", description: "Milk collection entry updated." });
      } else {
        toast({ title: "Error", description: result.error || "Failed to update entry.", variant: "destructive" });
      }
    } else {
      result = await addMilkCollectionEntryToFirestore(entryData);
      if (result.success) {
        toast({ title: "Success", description: "Milk collection entry added." });
      } else {
        toast({ title: "Error", description: result.error || "Failed to add entry.", variant: "destructive" });
      }
    }
    
    if (result.success) {
      resetFormFields();
      await fetchEntries(); 
    }
    setIsLoadingEntries(false); 
  };

  const filteredCustomerSuggestions = useMemo(() => {
    if (!customerNameInput.trim()) return allKnownCustomerNames;
    return allKnownCustomerNames.filter((name) =>
      name.toLowerCase().includes(customerNameInput.toLowerCase())
    );
  }, [customerNameInput, allKnownCustomerNames]);

  const handleEdit = (entry: MilkCollectionEntry) => {
    setEditingEntryId(entry.id);
    setDate(entry.date); // Date is already a JS Date object
    setShift(entry.shift);
    setCustomerNameInput(entry.customerName);
    setQuantityLtr(String(entry.quantityLtr));
    setFatPercentage(String(entry.fatPercentage));
    setRateInputValue(String(entry.ratePerLtr));
  };

  const handleDeleteClick = (entry: MilkCollectionEntry) => {
    setEntryToDelete(entry);
    setShowDeleteDialog(true);
  };

  const confirmDelete = async () => {
    if (!entryToDelete) return;
    setIsLoadingEntries(true);
    const result = await deleteMilkCollectionEntryFromFirestore(entryToDelete.id);
    if (result.success) {
      toast({ title: "Success", description: "Entry deleted." });
      await fetchEntries();
    } else {
      toast({ title: "Error", description: result.error || "Failed to delete entry.", variant: "destructive" });
    }
    setShowDeleteDialog(false);
    setEntryToDelete(null);
    setIsLoadingEntries(false);
  };

  return (
    <div>
      <PageHeader title="Milk Collection" description="Record new milk collection entries." />
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle>{editingEntryId ? "Edit Entry" : "New Entry"}</CardTitle>
            <CardDescription>{editingEntryId ? "Modify the details of the existing record." : "Add a new milk collection record."}</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label htmlFor="date" className="flex items-center mb-1">
                  <CalendarDays className="h-4 w-4 mr-2 text-muted-foreground" /> Date for New Entry
                </Label>
                 <DatePicker date={date} setDate={setDate} />
              </div>
              <div>
                <Label className="flex items-center mb-1">Shift</Label>
                <RadioGroup
                  value={shift}
                  onValueChange={(value: "Morning" | "Evening") => setShift(value)}
                  className="flex space-x-4"
                >
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="Morning" id="morning" />
                    <Label htmlFor="morning" className="font-normal flex items-center"><Sun className="h-4 w-4 mr-1 text-muted-foreground" />Morning</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="Evening" id="evening" />
                    <Label htmlFor="evening" className="font-normal flex items-center"><Moon className="h-4 w-4 mr-1 text-muted-foreground" />Evening</Label>
                  </div>
                </RadioGroup>
              </div>
              
              <div>
                <Label htmlFor="customerNameInput" className="flex items-center mb-1">
                  <User className="h-4 w-4 mr-2 text-muted-foreground" /> Customer Name (Milk Supplier)
                </Label>
                <Popover open={isCustomerPopoverOpen} onOpenChange={setIsCustomerPopoverOpen}>
                  <PopoverTrigger asChild>
                    <Input
                      id="customerNameInput"
                      ref={customerNameInputRef}
                      value={customerNameInput}
                      onChange={(e) => handleCustomerNameInputChange(e.target.value)}
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
                        onValueChange={handleCustomerNameInputChange} // Use the same handler for CommandInput
                       />
                      <CommandList>
                        {isLoadingParties ? (
                           <CommandItem disabled>Loading customers...</CommandItem>
                        ) : (
                          <>
                            {customerNameInput.trim() && !allKnownCustomerNames.some(name => name.toLowerCase() === customerNameInput.trim().toLowerCase()) && (
                               <CommandItem
                                key={`__CREATE__${customerNameInput.trim()}`}
                                value={`__CREATE__${customerNameInput.trim()}`} // Value is important for onSelect
                                onSelect={() => handleCustomerSelect(customerNameInput.trim(), true)}
                              >
                                <PlusCircle className="mr-2 h-4 w-4" />
                                Add new milk supplier: "{customerNameInput.trim()}"
                              </CommandItem>
                            )}
                            {filteredCustomerSuggestions.map((name) => (
                              <CommandItem
                                key={name}
                                value={name} // Value is important for onSelect
                                onSelect={() => handleCustomerSelect(name)}
                              >
                                {name}
                              </CommandItem>
                            ))}
                             {filteredCustomerSuggestions.length === 0 && customerNameInput.trim() && allKnownCustomerNames.some(name => name.toLowerCase() === customerNameInput.trim().toLowerCase()) && (
                                <CommandEmpty>No existing milk suppliers match. Select "Add new..." above.</CommandEmpty>
                             )}
                             {allKnownCustomerNames.length === 0 && !customerNameInput.trim() && (
                                <CommandEmpty>No milk suppliers found. Type to add a new one.</CommandEmpty>
                             )}
                          </>
                        )}
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
              </div>

              <div>
                <Label htmlFor="quantityLtr" className="flex items-center mb-1">
                  <Scale className="h-4 w-4 mr-2 text-muted-foreground" /> Quantity (Ltr)
                </Label>
                <Input id="quantityLtr" type="text" inputMode="decimal" value={quantityLtr} onChange={(e) => setQuantityLtr(e.target.value)} placeholder="e.g., 10.5" required />
              </div>
              <div>
                <Label htmlFor="fatPercentage" className="flex items-center mb-1">
                  <Percent className="h-4 w-4 mr-2 text-muted-foreground" /> FAT (%)
                </Label>
                <Input id="fatPercentage" type="text" inputMode="decimal" value={fatPercentage} onChange={(e) => setFatPercentage(e.target.value)} placeholder="e.g., 3.8" required />
              </div>
              <div>
                <Label htmlFor="ratePerLtr" className="flex items-center mb-1">
                  <IndianRupee className="h-4 w-4 mr-1 text-muted-foreground" /> Rate Factor (₹)
                </Label>
                <Input 
                  id="ratePerLtr" 
                  type="text" 
                  inputMode="decimal"
                  value={rateInputValue} 
                  onChange={(e) => setRateInputValue(e.target.value)} 
                  placeholder="e.g., 6.7" 
                  required 
                  className="font-semibold"
                />
              </div>
              <div>
                <Label htmlFor="totalAmount" className="flex items-center mb-1">
                  <IndianRupee className="h-4 w-4 mr-1 text-muted-foreground" /> Total Amount (₹)
                </Label>
                <Input id="totalAmount" value={totalAmountDisplay ? `₹ ${totalAmountDisplay}` : ""} readOnly className="font-semibold bg-muted/50" />
              </div>
              <Button type="submit" className="w-full" disabled={isLoadingEntries || isLoadingParties}>
                {editingEntryId ? <Edit className="h-4 w-4 mr-2" /> : <PlusCircle className="h-4 w-4 mr-2" />}
                {isLoadingEntries && !editingEntryId ? 'Adding...' : (isLoadingEntries && editingEntryId ? 'Updating...' : (editingEntryId ? 'Update Entry' : 'Add Entry'))}
              </Button>
              {editingEntryId && (
                <Button type="button" variant="outline" className="w-full mt-2" onClick={resetFormFields}>
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
                <CardTitle>Daily Ledger</CardTitle>
                 <CardDescription className="mt-1">
                  {tableFilterDate ? `Ledger for ${format(tableFilterDate, 'PPP')}${shiftFilter !== 'All' ? ` (${shiftFilter} shift)` : ''}` : "Select a date to view ledger."}
                  {isLoadingEntries && allEntries.length === 0 && " Loading entries..."}
                  {!isLoadingEntries && tableFilterDate && filteredEntries.length === 0 && ` (No entries for this date${shiftFilter !== 'All' ? ` and shift` : ''}. Checked ${allEntries.length} total entries)`}
                </CardDescription>
              </div>
              <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
                <div className="w-full sm:min-w-[180px]">
                  <Label htmlFor="shiftFilterSelect" className="sr-only">Filter by shift</Label>
                  <Select value={shiftFilter} onValueChange={(value: "All" | "Morning" | "Evening") => setShiftFilter(value)}>
                    <SelectTrigger id="shiftFilterSelect">
                      <Filter className="h-3 w-3 mr-2 text-muted-foreground" />
                      <SelectValue placeholder="Filter by shift" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="All">All Shifts</SelectItem>
                      <SelectItem value="Morning">Morning</SelectItem>
                      <SelectItem value="Evening">Evening</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
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
                    <TableHead>Shift</TableHead>
                    <TableHead>Customer</TableHead> 
                    <TableHead className="text-right">Qty (Ltr)</TableHead>
                    <TableHead className="text-right">FAT (%)</TableHead>
                    <TableHead className="text-right">Rate (₹)</TableHead>
                    <TableHead className="text-right">Amount (₹)</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredEntries.length === 0 && !isLoadingEntries ? (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center text-muted-foreground">
                        {tableFilterDate ? `No entries for ${format(tableFilterDate, 'P')}${shiftFilter !== 'All' ? ` (${shiftFilter} shift)` : ''}.` : "Select a date and shift to view entries."}
                        {tableFilterDate && allEntries.length > 0 && !filteredEntries.length && ` (Checked ${allEntries.length} total entries)`}
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredEntries.map((entry) => (
                      <TableRow key={entry.id}>
                        <TableCell>{entry.date instanceof Date && !isNaN(entry.date.getTime()) ? format(entry.date, 'P') : 'Invalid Date'}</TableCell>
                        <TableCell>{entry.shift}</TableCell>
                        <TableCell>{entry.customerName}</TableCell>
                        <TableCell className="text-right">{entry.quantityLtr.toFixed(1)}</TableCell>
                        <TableCell className="text-right">{entry.fatPercentage.toFixed(1)}</TableCell>
                        <TableCell className="text-right">{entry.ratePerLtr ? entry.ratePerLtr.toFixed(2) : "-"}</TableCell>
                        <TableCell className="text-right">{entry.totalAmount ? entry.totalAmount.toFixed(2) : "-"}</TableCell>
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
                      <TableCell colSpan={6} className="text-right font-semibold">Total Amount:</TableCell>
                      <TableCell className="text-right font-bold">{totalFilteredAmount.toFixed(2)}</TableCell>
                      <TableCell /> {/* Empty cell for actions column */}
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
                This action cannot be undone. This will permanently delete the milk collection entry for
                "{entryToDelete.customerName}" on {format(entryToDelete.date, 'P')} ({entryToDelete.shift} shift).
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel onClick={() => {setShowDeleteDialog(false); setEntryToDelete(null);}}>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={confirmDelete} className="bg-destructive hover:bg-destructive/90">Delete</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
    </div>
  );
}
