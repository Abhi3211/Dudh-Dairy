
"use client";

import { useState, type FormEvent, useEffect, useMemo, useCallback, useRef } from "react";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
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
import { CalendarDays, User, Percent, Scale, IndianRupee, PlusCircle, CreditCard, MoreHorizontal, Edit, Trash2, StickyNote, Sun, Moon, Filter, Download } from "lucide-react";
import type { BulkSaleEntry, Party } from "@/lib/types";
import { DatePicker } from "@/components/ui/date-picker";
import { useToast } from "@/hooks/use-toast";
import { format, startOfMonth, endOfMonth } from "date-fns";
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
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
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
  const [shift, setShift] = useState<"Morning" | "Evening">("Morning");
  
  const [tableFilterStartDate, setTableFilterStartDate] = useState<Date | undefined>(undefined);
  const [tableFilterEndDate, setTableFilterEndDate] = useState<Date | undefined>(undefined);
  const [shiftFilter, setShiftFilter] = useState<"All" | "Morning" | "Evening">("All");
  
  const [customerNameInput, setCustomerNameInput] = useState<string>("");
  const [isCustomerPopoverOpen, setIsCustomerPopoverOpen] = useState(false);
  const customerNameInputRef = useRef<HTMLInputElement>(null);

  const [quantityLtr, setQuantityLtr] = useState<string>("");
  const [fatPercentage, setFatPercentage] = useState<string>("");
  const [rate, setRate] = useState<string>("6.7"); 
  const [paymentType, setPaymentType] = useState<"Cash" | "Credit">("Credit");
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
    if (!editingEntryId && date === undefined) { 
        setDate(new Date());
    }
    if (tableFilterStartDate === undefined) {
        setTableFilterStartDate(startOfMonth(new Date()));
    }
    if (tableFilterEndDate === undefined) {
        setTableFilterEndDate(new Date()); 
    }
    fetchEntries();
    fetchParties();
  }, [fetchEntries, fetchParties, editingEntryId, date, tableFilterStartDate, tableFilterEndDate]);

  const partiesForBulkSale = useMemo(() => {
    return availableParties.filter(p => p.type === "Customer"); 
  }, [availableParties]);

  const allKnownCustomerNamesForBulkSale = useMemo(() => {
    return partiesForBulkSale.map(p => p.name).sort((a, b) => a.localeCompare(b));
  }, [partiesForBulkSale]);


  const totalAmountDisplay = useMemo(() => {
    const quantityStr = quantityLtr.replace(',', '.');
    const fatStr = fatPercentage.replace(',', '.');
    const rateStr = rate.replace(',', '.');
    
    const quantity = parseFloat(quantityStr);
    const fat = parseFloat(fatStr);
    const rateValue = parseFloat(rateStr);

    if (!isNaN(quantity) && quantity > 0 && !isNaN(fat) && fat >= 0 && !isNaN(rateValue) && rateValue > 0) {
      return (quantity * fat * rateValue);
    }
    return 0;
  }, [quantityLtr, fatPercentage, rate]);

  const filteredEntries = useMemo(() => {
    let dateFiltered = allEntries;
    if (tableFilterStartDate || tableFilterEndDate) {
        dateFiltered = allEntries.filter(entry => {
            if (!entry.date || !(entry.date instanceof Date) || isNaN(entry.date.getTime())) {
                return false;
            }
            const entryDate = new Date(entry.date.getFullYear(), entry.date.getMonth(), entry.date.getDate()); 
            
            const start = tableFilterStartDate ? new Date(tableFilterStartDate.getFullYear(), tableFilterStartDate.getMonth(), tableFilterStartDate.getDate()) : null;
            const end = tableFilterEndDate ? new Date(tableFilterEndDate.getFullYear(), tableFilterEndDate.getMonth(), tableFilterEndDate.getDate()) : null;

            if (start && entryDate < start) return false;
            if (end && entryDate > end) return false;
            return true;
        });
    }
    let shiftAndDateFiltered = dateFiltered;
    if (shiftFilter !== "All") {
        shiftAndDateFiltered = dateFiltered.filter(entry => entry.shift === shiftFilter);
    }
    return shiftAndDateFiltered;
  }, [allEntries, tableFilterStartDate, tableFilterEndDate, shiftFilter]);
  
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
        // Shift persists
        // Rate factor persists
    }
    setPaymentType("Credit"); 
    setCustomerNameInput(""); 
    setQuantityLtr("");
    setFatPercentage("");
    setRemarks("");
    setEditingEntryId(null);
    setIsCustomerPopoverOpen(false);
  }, [editingEntryId]);


  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!date || !shift || !customerNameInput.trim() || !quantityLtr || !fatPercentage || !rate) {
      toast({ title: "Error", description: "Please fill all required fields (Date, Shift, Customer, Quantity, FAT, Rate).", variant: "destructive" });
      return;
    }

    const qLtrStr = quantityLtr.replace(',', '.');
    const fatPStr = fatPercentage.replace(',', '.');
    const finalRateStr = rate.replace(',', '.');

    const qLtr = parseFloat(qLtrStr);
    const fatP = parseFloat(fatPStr);
    const finalRateValue = parseFloat(finalRateStr); 

    if (isNaN(qLtr) || qLtr <= 0) {
      toast({ title: "Error", description: "Please enter a valid quantity.", variant: "destructive" }); return;
    }
    if (isNaN(fatP) || fatP < 0) { 
      toast({ title: "Error", description: "Please enter a valid FAT percentage (must be >= 0).", variant: "destructive" }); return;
    }
    if (isNaN(finalRateValue) || finalRateValue <= 0) {
      toast({ title: "Error", description: "Please enter a valid rate (must be > 0).", variant: "destructive" }); return;
    }

    const finalTotalAmount = qLtr * fatP * finalRateValue; 

    const entryData: Omit<BulkSaleEntry, 'id'> = {
      date, 
      shift,
      customerName: customerNameInput.trim(), 
      quantityLtr: qLtr,
      fatPercentage: fatP,
      rateFactor: finalRateValue,
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
    setShift(entry.shift);
    setCustomerNameInput(entry.customerName);
    setQuantityLtr(String(entry.quantityLtr));
    setFatPercentage(String(entry.fatPercentage));
    setRate(String(entry.rateFactor));
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

  const escapeCSVField = (field: any): string => {
    const str = String(field === undefined || field === null ? "" : field);
    if (str.includes(",")) {
      return `"${str.replace(/"/g, '""')}"`; 
    }
    return str;
  };

  const handleExportCSV = useCallback(() => {
    if (filteredEntries.length === 0) {
      toast({ title: "No Data", description: "No ledger entries to export for the current filter.", variant: "destructive" });
      return;
    }

    const headers = [
      "Date", "Shift", "Customer", "Qty (Ltr)", "FAT (%)", "Rate (₹)", 
      "Total (₹)", "Payment Type", "Remarks"
    ];
    
    const rows = filteredEntries.map(entry => [
      format(entry.date, 'yyyy-MM-dd'),
      escapeCSVField(entry.shift),
      escapeCSVField(entry.customerName),
      escapeCSVField(entry.quantityLtr.toFixed(1)),
      escapeCSVField(entry.fatPercentage.toFixed(1)),
      escapeCSVField(entry.rateFactor ? entry.rateFactor.toFixed(2) : "0.00"),
      escapeCSVField(entry.totalAmount.toFixed(2)),
      escapeCSVField(entry.paymentType),
      escapeCSVField(entry.remarks)
    ]);

    const csvContent = [
      headers.join(","),
      ...rows.map(row => row.join(","))
    ].join("\n");

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    if (link.download !== undefined) {
      const url = URL.createObjectURL(blob);
      const baseFilename = "bulk_sales_ledger";
      const startDateStr = tableFilterStartDate ? format(tableFilterStartDate, 'yyyyMMdd') : 'any_start';
      const endDateStr = tableFilterEndDate ? format(tableFilterEndDate, 'yyyyMMdd') : 'any_end';
      const filename = `${baseFilename}_${startDateStr}_to_${endDateStr}.csv`;

      link.setAttribute("href", url);
      link.setAttribute("download", filename);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      toast({ title: "Success", description: "Ledger exported to CSV." });
    } else {
        toast({ title: "Error", description: "CSV export is not supported by your browser.", variant: "destructive" });
    }
  }, [filteredEntries, tableFilterStartDate, tableFilterEndDate, toast]);

  const ledgerDescription = useMemo(() => {
    let desc = "Ledger for ";
    if (tableFilterStartDate && tableFilterEndDate) {
      if (format(tableFilterStartDate, 'yyyy-MM-dd') === format(tableFilterEndDate, 'yyyy-MM-dd')) {
        desc += format(tableFilterStartDate, 'PPP');
      } else {
        desc += `${format(tableFilterStartDate, 'PPP')} to ${format(tableFilterEndDate, 'PPP')}`;
      }
    } else if (tableFilterStartDate) {
      desc += `from ${format(tableFilterStartDate, 'PPP')}`;
    } else if (tableFilterEndDate) {
      desc += `up to ${format(tableFilterEndDate, 'PPP')}`;
    } else {
      desc = "Complete ledger (no date filter)";
    }
    if (shiftFilter !== 'All') {
      desc += ` (${shiftFilter} shift)`;
    }
    return desc;
  }, [tableFilterStartDate, tableFilterEndDate, shiftFilter]);

  return (
    <TooltipProvider>
      <div>
        <PageHeader title={pageSpecificTitle} description="Record Bulk milk sale" />
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
                  <Label className="flex items-center mb-1">Shift</Label>
                  <RadioGroup
                    value={shift}
                    onValueChange={(value: "Morning" | "Evening") => setShift(value)}
                    className="flex space-x-4"
                  >
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="Morning" id="bs_morning" />
                      <Label htmlFor="bs_morning" className="font-normal flex items-center"><Sun className="h-4 w-4 mr-1 text-muted-foreground" />Morning</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="Evening" id="bs_evening" />
                      <Label htmlFor="bs_evening" className="font-normal flex items-center"><Moon className="h-4 w-4 mr-1 text-muted-foreground" />Evening</Label>
                    </div>
                  </RadioGroup>
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
                    <Label htmlFor="rate" className="flex items-center mb-1">
                      <IndianRupee className="h-4 w-4 mr-1 text-muted-foreground" /> Rate (₹)
                    </Label>
                    <Input 
                      id="rate" 
                      type="text" 
                      inputMode="decimal"
                      value={rate} 
                      onChange={(e) => setRate(e.target.value)} 
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
                  <CardTitle>Sales Ledger</CardTitle>
                  <CardDescription className="mt-1">
                    {ledgerDescription}
                    {isLoadingEntries && allEntries.length === 0 && " Loading entries..."}
                    {!isLoadingEntries && (tableFilterStartDate || tableFilterEndDate) && filteredEntries.length === 0 && ` (No entries for this filter. Checked ${allEntries.length} total entries)`}
                  </CardDescription>
                </div>
                <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto sm:items-center">
                  <div className="w-full sm:w-auto">
                    <Label htmlFor="bsShiftFilterSelect" className="sr-only">Filter by shift</Label>
                    <Select value={shiftFilter} onValueChange={(value: "All" | "Morning" | "Evening") => setShiftFilter(value)}>
                      <SelectTrigger id="bsShiftFilterSelect" className="w-full sm:w-[170px]">
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
                  <div className="w-full sm:w-auto">
                    <Label htmlFor="tableStartDateFilter" className="sr-only">Start Date</Label>
                    <DatePicker date={tableFilterStartDate} setDate={setTableFilterStartDate} className="w-full sm:w-[170px]" />
                  </div>
                  <div className="w-full sm:w-auto">
                    <Label htmlFor="tableEndDateFilter" className="sr-only">End Date</Label>
                    <DatePicker date={tableFilterEndDate} setDate={setTableFilterEndDate} className="w-full sm:w-[170px]" />
                  </div>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button onClick={handleExportCSV} variant="outline" size="icon" className="w-full sm:w-10 mt-2 sm:mt-0 h-10" disabled={filteredEntries.length === 0 || isLoadingEntries}>
                          <Download className="h-4 w-4" />
                          <span className="sr-only">Export CSV</span>
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Export CSV</p>
                    </TooltipContent>
                  </Tooltip>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {isLoadingEntries && allEntries.length === 0 && (!tableFilterStartDate && !tableFilterEndDate) ? ( 
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
                      <TableHead className="text-right">Total (₹)</TableHead>
                      <TableHead>Payment</TableHead>
                      <TableHead>Remarks</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredEntries.length === 0 && !isLoadingEntries ? (
                      <TableRow>
                        <TableCell colSpan={10} className="text-center text-muted-foreground">
                          {(tableFilterStartDate || tableFilterEndDate) ? `No entries for the selected period${shiftFilter !== 'All' ? ` (${shiftFilter} shift)` : ''}.` : "Select a date range to view entries."}
                          {(tableFilterStartDate || tableFilterEndDate) && allEntries.length > 0 && !filteredEntries.length && ` (Checked ${allEntries.length} total entries)`}
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
                          <TableCell colSpan={6} className="text-right font-semibold">Total Bulk Sale Amount:</TableCell>
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
                  "{entryToDelete.customerName}" on {entryToDelete.date instanceof Date && !isNaN(entryToDelete.date.getTime()) ? format(entryToDelete.date, 'P') : 'Invalid Date'} ({entryToDelete.shift}).
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
    </TooltipProvider>
  );
}

    

    