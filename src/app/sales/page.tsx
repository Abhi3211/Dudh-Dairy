
"use client";

import { useState, type FormEvent, useEffect, useMemo, useCallback, useRef } from "react";
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
  TableFooter
} from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { DatePicker } from "@/components/ui/date-picker";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { User, Package, IndianRupee, CreditCard, PlusCircle, Tag, CalendarDays, MoreHorizontal, Edit, Trash2, Filter, Download, AlertCircle } from "lucide-react";
import type { SaleEntry, Party, PurchaseEntry } from "@/lib/types";
import { format, startOfMonth } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import { addSaleEntryToFirestore, getSaleEntriesFromFirestore, updateSaleEntryInFirestore, deleteSaleEntryFromFirestore } from "./actions";
import { getPartiesFromFirestore, addPartyToFirestore } from "../parties/actions";
import { getPurchaseEntriesFromFirestore, getUniquePurchasedProductNames } from "../purchases/actions";
import { Skeleton } from "@/components/ui/skeleton";
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
import { useUserSession } from "@/context/UserSessionContext";

const productCategories: { categoryName: string; unit: SaleEntry['unit'] }[] = [
  { categoryName: "Milk", unit: "Ltr" },
  { categoryName: "Ghee", unit: "Kg" },
  { categoryName: "Pashu Aahar", unit: "Bags" },
  { categoryName: "Other", unit: "Pcs" },
];

export default function SalesPage() {
  const { setPageTitle } = usePageTitle();
  const pageSpecificTitle = "Sales Entry";
  const { firebaseUser, companyProfile, authLoading, profilesLoading } = useUserSession();
  const companyId = companyProfile?.id;

  useEffect(() => {
    setPageTitle(pageSpecificTitle);
  }, [setPageTitle, pageSpecificTitle]);

  const { toast } = useToast();
  const [sales, setSales] = useState<SaleEntry[]>([]);
  const [isLoadingSales, setIsLoadingSales] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [date, setDate] = useState<Date | undefined>(undefined);
  const [customerName, setCustomerName] = useState("");
  const [selectedCategoryIndex, setSelectedCategoryIndex] = useState<string>("0");
  const [specificProductName, setSpecificProductName] = useState<string>("");
  const [quantity, setQuantity] = useState<string>("");
  const [rate, setRate] = useState<string>("");
  const [paymentType, setPaymentType] = useState<"Cash" | "Credit">("Credit");

  const [isCustomerPopoverOpen, setIsCustomerPopoverOpen] = useState(false);
  const customerNameInputRef = useRef<HTMLInputElement>(null);
  const justCustomerSelectedRef = useRef(false);


  const [availableParties, setAvailableParties] = useState<Party[]>([]);
  const [isLoadingPrerequisites, setIsLoadingPrerequisites] = useState(true);

  const [isProductPopoverOpen, setIsProductPopoverOpen] = useState(false);
  const productNameInputRef = useRef<HTMLInputElement>(null);
  const [availableProductSuggestions, setAvailableProductSuggestions] = useState<string[]>([]);

  const [allPurchaseEntriesForStock, setAllPurchaseEntriesForStock] = useState<PurchaseEntry[]>([]);
  const [productStock, setProductStock] = useState<Record<string, { quantity: number, unit: string }>>({});


  const [editingEntryId, setEditingEntryId] = useState<string | null>(null);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [entryToDelete, setEntryToDelete] = useState<SaleEntry | null>(null);

  const [tableFilterStartDate, setTableFilterStartDate] = useState<Date | undefined>(undefined);
  const [tableFilterEndDate, setTableFilterEndDate] = useState<Date | undefined>(undefined);

  const fetchSalesHistory = useCallback(async () => {
    if (!companyId) {
      setIsLoadingSales(false);
      setSales([]);
      return;
    }
    setIsLoadingSales(true);
    try {
      const fetchedSales = await getSaleEntriesFromFirestore(companyId);
      const processedSales = fetchedSales.map(s => ({
        ...s,
        date: s.date instanceof Date ? s.date : new Date(s.date)
      })).sort((a, b) => b.date.getTime() - a.date.getTime());
      setSales(processedSales);
    } catch (error) {
      console.error("CLIENT: Failed to fetch sales entries:", error);
      toast({ title: "Error", description: "Could not fetch sales entries.", variant: "destructive" });
    } finally {
      setIsLoadingSales(false);
    }
  }, [toast, companyId]);

  const fetchPagePrerequisites = useCallback(async () => {
    // companyId check not strictly needed here as these are general lists,
    // but good to ensure user context is somewhat ready.
    if (authLoading || profilesLoading) return; 

    setIsLoadingPrerequisites(true);
    try {
      const [parties, productNames, purchaseEntriesData] = await Promise.all([
        getPartiesFromFirestore(), // Assumes parties are global or filtered by rules later
        getUniquePurchasedProductNames(), // Global list for now
        getPurchaseEntriesFromFirestore() // Fetches all, filtering for stock calc done client-side
      ]);
      setAvailableParties(parties);
      setAvailableProductSuggestions(productNames.sort((a, b) => a.localeCompare(b)));
      setAllPurchaseEntriesForStock(purchaseEntriesData);

    } catch (error) {
      console.error("CLIENT: Failed to fetch page prerequisites:", error);
      toast({ title: "Error", description: "Could not fetch supporting data for sales form.", variant: "destructive" });
    } finally {
      setIsLoadingPrerequisites(false);
    }
  }, [toast, authLoading, profilesLoading]);


  useEffect(() => {
    if (authLoading || profilesLoading) return;

    if (date === undefined && !editingEntryId) {
      setDate(new Date());
    }
    if (tableFilterStartDate === undefined) {
      setTableFilterStartDate(startOfMonth(new Date()));
    }
    if (tableFilterEndDate === undefined) {
      setTableFilterEndDate(new Date());
    }
    if (companyId) {
        fetchSalesHistory();
    }
    fetchPagePrerequisites();
  }, [fetchSalesHistory, fetchPagePrerequisites, date, editingEntryId, tableFilterStartDate, tableFilterEndDate, companyId, authLoading, profilesLoading]);

  useEffect(() => {
    const stock: Record<string, { quantity: number, unit: string }> = {};
    const stockEvents: { productName: string; unit: string; date: Date; quantityChange: number; }[] = [];
  
    allPurchaseEntriesForStock.forEach(tx => {
      stockEvents.push({
        productName: tx.productName.trim(),
        unit: tx.unit,
        date: tx.date instanceof Date ? tx.date : new Date(tx.date),
        quantityChange: tx.quantity,
      });
    });
  
    sales.forEach(sale => { // Use current company's sales for stock calc
      stockEvents.push({
        productName: sale.productName.trim(),
        unit: sale.unit,
        date: sale.date instanceof Date ? sale.date : new Date(sale.date),
        quantityChange: -sale.quantity,
      });
    });
    
    stockEvents.sort((a, b) => a.date.getTime() - b.date.getTime());
  
    stockEvents.forEach(event => {
      const key = `${event.productName}#${event.unit}`;
      const current = stock[key] || { quantity: 0, unit: event.unit };
      current.quantity += event.quantityChange;
      stock[key] = current;
    });
    setProductStock(stock);
  }, [allPurchaseEntriesForStock, sales]);


  const partiesForSuggestions = useMemo(() => {
    return availableParties
      .filter(p => p.type === "Customer") // TODO: Consider company-specific parties
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [availableParties]);

  const totalAmount = useMemo(() => {
    const q = parseFloat(quantity);
    const r = parseFloat(rate);
    return (!isNaN(q) && !isNaN(r)) ? q * r : 0;
  }, [quantity, rate]);

  const currentCategoryDetails = productCategories[parseInt(selectedCategoryIndex)];
  const currentCategoryName = currentCategoryDetails?.categoryName;

  useEffect(() => {
    if (currentCategoryName === "Pashu Aahar") {
      setSpecificProductName(""); 
      setRate(""); 
    } else {
      setSpecificProductName(currentCategoryName === "Other" ? "" : (currentCategoryName || ""));
      setIsProductPopoverOpen(false);
    }
  
    if (currentCategoryName === "Milk") setRate("60");
    else if (currentCategoryName === "Ghee") setRate("700");
    else if (currentCategoryName !== "Pashu Aahar") setRate("");
  
  }, [currentCategoryName]);


  const handleSpecificProductNameChange = useCallback((value: string) => {
    setSpecificProductName(value);
    if (currentCategoryName === "Pashu Aahar") {
      if (value.trim()) { 
        setIsProductPopoverOpen(true);
      } else { 
        setIsProductPopoverOpen(false);
      }
    }
  }, [currentCategoryName]);

  const handleProductSelect = useCallback((currentValue: string) => {
    setSpecificProductName(currentValue);
    setIsProductPopoverOpen(false);
    // productNameInputRef.current?.focus(); // Removed to keep focus on main input

    if (currentCategoryName === "Pashu Aahar") {
        const latestPurchase = allPurchaseEntriesForStock
        .filter(tx => tx.productName === currentValue && tx.category === "Pashu Aahar" && tx.defaultSalePricePerUnit && tx.defaultSalePricePerUnit > 0)
        .sort((a,b) => (b.date instanceof Date ? b.date.getTime() : new Date(b.date).getTime()) - (a.date instanceof Date ? a.date.getTime() : new Date(a.date).getTime()))[0];

        if (latestPurchase) {
            setRate(String(latestPurchase.defaultSalePricePerUnit));
        } else {
            setRate(""); 
        }
    }
  }, [allPurchaseEntriesForStock, currentCategoryName]);


  const handleCustomerNameInputChange = useCallback((value: string) => {
    setCustomerName(value);
  }, []);

  const handleCustomerSelect = useCallback(async (currentValue: string, isCreateNew = false) => {
    const trimmedValue = currentValue.trim();
    let finalCustomerName = trimmedValue;

    if (isCreateNew) {
      if (!trimmedValue) {
        toast({ title: "Error", description: "Customer name cannot be empty.", variant: "destructive" });
        return;
      }

      const existingParty = availableParties.find(
        p => p.name.toLowerCase() === trimmedValue.toLowerCase() && p.type === "Customer"
      );
      if (existingParty) {
        toast({ title: "Info", description: `Customer "${trimmedValue}" already exists. Selecting existing customer.`, variant: "default" });
        finalCustomerName = trimmedValue;
      } else {
        setIsSubmitting(true);
        // TODO: Consider adding companyId to party if parties become company-specific
        const result = await addPartyToFirestore({ name: trimmedValue, type: "Customer" });
        if (result.success) {
          finalCustomerName = trimmedValue;
          toast({ title: "Success", description: `Customer "${trimmedValue}" added.` });
          await fetchPagePrerequisites();
        } else {
          toast({ title: "Error", description: result.error || "Failed to add customer.", variant: "destructive" });
          setIsSubmitting(false);
          setIsCustomerPopoverOpen(false);
          return;
        }
        setIsSubmitting(false);
      }
    }
    setCustomerName(finalCustomerName);
    setIsCustomerPopoverOpen(false);
    justCustomerSelectedRef.current = true;
  }, [toast, fetchPagePrerequisites, availableParties]);


  const resetFormFields = useCallback(() => {
    if (!editingEntryId) setDate(new Date());
    setCustomerName("");
    setSelectedCategoryIndex("0"); 
    setSpecificProductName("");    
    setQuantity("");
    setRate(""); 
    setPaymentType("Credit");
    setEditingEntryId(null);
    setIsCustomerPopoverOpen(false);
    setIsProductPopoverOpen(false);
  }, [editingEntryId]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!companyId) {
      toast({ title: "Error", description: "Company information is missing. Cannot add sale.", variant: "destructive" });
      return;
    }
    if (!date || !customerName.trim() || !quantity || !rate) {
      toast({ title: "Error", description: "Please fill all required fields (Date, Customer, Quantity, Rate).", variant: "destructive" });
      return;
    }

    if (!currentCategoryDetails) {
      toast({ title: "Error", description: "Please select a product category.", variant: "destructive" });
      return;
    }
    
    let finalProductName = specificProductName.trim();
    if (!finalProductName && (currentCategoryName === "Milk" || currentCategoryName === "Ghee")) {
        finalProductName = currentCategoryDetails.categoryName;
    }


    if (currentCategoryDetails.categoryName === "Pashu Aahar" && !specificProductName.trim()) {
        toast({ title: "Error", description: "Please enter or select the specific Pashu Aahar product name.", variant: "destructive" });
        return;
    }
    if (currentCategoryDetails.categoryName === "Other" && !specificProductName.trim()) {
        toast({ title: "Error", description: "Please enter product name for 'Other' category.", variant: "destructive" });
        return;
    }


    const parsedQuantity = parseFloat(quantity);
    const parsedRate = parseFloat(rate);

    if (isNaN(parsedQuantity) || parsedQuantity <= 0) {
      toast({ title: "Error", description: "Quantity must be a positive number.", variant: "destructive" }); return;
    }
    if (isNaN(parsedRate) || parsedRate <= 0) {
      toast({ title: "Error", description: "Rate must be a positive number.", variant: "destructive" }); return;
    }

    setIsSubmitting(true);
    const saleData: Omit<SaleEntry, 'id'> = {
      companyId, // Add companyId
      date,
      customerName: customerName.trim(),
      productName: finalProductName,
      quantity: parsedQuantity,
      unit: currentCategoryDetails.unit,
      rate: parsedRate,
      totalAmount: parsedQuantity * parsedRate,
      paymentType,
    };

    let result;
    if (editingEntryId) {
      result = await updateSaleEntryInFirestore(editingEntryId, saleData);
      if (result.success) {
        toast({ title: "Success", description: "Sale entry updated." });
      } else {
        toast({ title: "Error", description: result.error || "Failed to update entry.", variant: "destructive" });
      }
    } else {
      result = await addSaleEntryToFirestore(saleData);
      if (result.success) {
        toast({ title: "Success", description: "Sale entry added." });
      } else {
        toast({ title: "Error", description: result.error || "Failed to add entry.", variant: "destructive" });
      }
    }

    if (result.success) {
      resetFormFields();
      await fetchSalesHistory();
      // fetchPagePrerequisites might not be needed if only sales impact stock display here
      // but could be kept if party list needs refresh
    }
    setIsSubmitting(false);
  };

  const handleEdit = (entry: SaleEntry) => {
    setEditingEntryId(entry.id);
    setDate(entry.date);
    setCustomerName(entry.customerName);

    const categoryIndex = productCategories.findIndex(
      (cat) => cat.categoryName === entry.productName || (cat.categoryName === "Pashu Aahar" && entry.unit === "Bags") || (cat.categoryName === "Other" && entry.unit === "Pcs")
    );
    
    if (categoryIndex !== -1) {
        setSelectedCategoryIndex(String(categoryIndex));
        const catDetails = productCategories[categoryIndex];
        if (catDetails.categoryName === "Pashu Aahar" || catDetails.categoryName === "Other") {
            setSpecificProductName(entry.productName);
        } else {
            setSpecificProductName(catDetails.categoryName); 
        }
    } else {
        const otherCategoryIndex = productCategories.findIndex(cat => cat.categoryName === "Other");
        setSelectedCategoryIndex(String(otherCategoryIndex !== -1 ? otherCategoryIndex : 0));
        setSpecificProductName(entry.productName);
    }


    setQuantity(String(entry.quantity));
    setRate(String(entry.rate));
    setPaymentType(entry.paymentType);
  };

  const handleDeleteClick = (entry: SaleEntry) => {
    setEntryToDelete(entry);
    setShowDeleteDialog(true);
  };

  const confirmDelete = async () => {
    if (!entryToDelete) return;
    setIsSubmitting(true);
    const result = await deleteSaleEntryFromFirestore(entryToDelete.id);
    if (result.success) {
      toast({ title: "Success", description: "Sale entry deleted." });
      await fetchSalesHistory();
    } else {
      toast({ title: "Error", description: result.error || "Failed to delete entry.", variant: "destructive" });
    }
    setShowDeleteDialog(false);
    setEntryToDelete(null);
    setIsSubmitting(false);
  };

  const filteredSalesEntries = useMemo(() => {
    let dateFiltered = sales;
    if (tableFilterStartDate || tableFilterEndDate) {
        dateFiltered = sales.filter(entry => {
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
    return dateFiltered;
  }, [sales, tableFilterStartDate, tableFilterEndDate]);

  const totalFilteredSalesAmount = useMemo(() => {
    return filteredSalesEntries.reduce((sum, entry) => sum + (entry.totalAmount || 0), 0);
  }, [filteredSalesEntries]);

  const escapeCSVField = (field: any): string => {
    const str = String(field === undefined || field === null ? "" : field);
    if (str.includes(",")) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };

  const handleExportCSV = useCallback(() => {
    if (filteredSalesEntries.length === 0) {
      toast({ title: "No Data", description: "No sales entries to export for the current filter.", variant: "destructive" });
      return;
    }

    const headers = ["Date", "Customer", "Product", "Qty", "Unit", "Rate (₹)", "Total (₹)", "Payment"];
    const rows = filteredSalesEntries.map(entry => [
      format(entry.date, 'yyyy-MM-dd'),
      escapeCSVField(entry.customerName),
      escapeCSVField(entry.productName),
      escapeCSVField(entry.quantity),
      escapeCSVField(entry.unit),
      escapeCSVField(entry.rate.toFixed(2)),
      escapeCSVField(entry.totalAmount.toFixed(2)),
      escapeCSVField(entry.paymentType)
    ]);

    const csvContent = [headers.join(","), ...rows.map(row => row.join(","))].join("\n");
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    if (link.download !== undefined) {
      const url = URL.createObjectURL(blob);
      const baseFilename = "sales_ledger";
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
      toast({ title: "Success", description: "Sales ledger exported to CSV." });
    } else {
      toast({ title: "Error", description: "CSV export is not supported by your browser.", variant: "destructive" });
    }
  }, [filteredSalesEntries, tableFilterStartDate, tableFilterEndDate, toast]);

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
    return desc;
  }, [tableFilterStartDate, tableFilterEndDate]);
  
  const currentPashuAaharStock = useMemo(() => {
    const stockKey = `${specificProductName}#Bags`;
    return productStock[stockKey]?.quantity ?? 0;
  }, [specificProductName, productStock]);

  const isFormDisabled = authLoading || profilesLoading || !companyId;


  return (
    <TooltipProvider>
      <div>
        <PageHeader title={pageSpecificTitle} description="Record product sales." />
         {authLoading || profilesLoading ? (
          <Card className="mb-6"><CardContent className="p-6"><Skeleton className="h-8 w-1/2" /></CardContent></Card>
        ) : !companyId && firebaseUser ? (
          <Card className="mb-6 border-destructive">
            <CardHeader>
              <CardTitle className="text-destructive flex items-center"><AlertCircle className="mr-2 h-5 w-5" /> Company Information Missing</CardTitle>
            </CardHeader>
            <CardContent>
              <p>Your user profile does not have company information associated with it. Sales entries cannot be recorded or displayed.</p>
              <p className="mt-2 text-sm">Please contact support or re-check your account setup if this seems incorrect.</p>
            </CardContent>
          </Card>
        ) : !firebaseUser ? (
            <Card className="mb-6 border-destructive">
            <CardHeader>
              <CardTitle className="text-destructive flex items-center"><AlertCircle className="mr-2 h-5 w-5" /> Not Logged In</CardTitle>
            </CardHeader>
            <CardContent>
              <p>You need to be logged in to record or view sales entries.</p>
            </CardContent>
          </Card>
        ) : null}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <Card className="lg:col-span-1">
            <CardHeader>
              <CardTitle>{editingEntryId ? "Edit Sale" : "New Sale"}</CardTitle>
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
                    <User className="h-4 w-4 mr-2 text-muted-foreground" /> Customer Name
                  </Label>
                  <Popover open={isCustomerPopoverOpen} onOpenChange={setIsCustomerPopoverOpen}>
                    <PopoverTrigger asChild>
                      <Input
                        id="customerNameInput"
                        ref={customerNameInputRef}
                        value={customerName}
                        onChange={(e) => handleCustomerNameInputChange(e.target.value)}
                        onFocus={() => {
                          if (justCustomerSelectedRef.current) {
                            justCustomerSelectedRef.current = false;
                          } else {
                            setIsCustomerPopoverOpen(true);
                          }
                        }}
                        placeholder="Start typing customer name"
                        autoComplete="off"
                        required
                        className="w-full text-left"
                        disabled={isFormDisabled}
                      />
                    </PopoverTrigger>
                    <PopoverContent
                      className="w-[--radix-popover-trigger-width] p-0"
                      onOpenAutoFocus={(e) => e.preventDefault()}
                      side="bottom"
                      align="start"
                      sideOffset={0}
                    >
                      <Command>
                        <CommandInput
                          value={customerName}
                          onValueChange={handleCustomerNameInputChange}
                          className="sr-only" 
                          tabIndex={-1}
                          aria-hidden="true"
                        />
                        <CommandList>
                          {isLoadingPrerequisites && availableParties.length === 0 ? (
                            <CommandItem disabled>Loading customers...</CommandItem>
                          ) : (
                            <>
                              <CommandGroup>
                                {customerName.trim() && !partiesForSuggestions.some(p => p.name.toLowerCase() === customerName.trim().toLowerCase()) && (
                                  <CommandItem
                                    key={`__CREATE_CUSTOMER__${customerName.trim()}`}
                                    value={`__CREATE_CUSTOMER__${customerName.trim()}`}
                                    onSelect={() => handleCustomerSelect(customerName.trim(), true)}
                                  >
                                    <PlusCircle className="mr-2 h-4 w-4" />
                                    Add new customer: "{customerName.trim()}"
                                  </CommandItem>
                                )}
                                {partiesForSuggestions
                                  .filter(party => party.name.toLowerCase().includes(customerName.toLowerCase()))
                                  .map((party) => (
                                    <CommandItem
                                      key={party.id}
                                      value={party.name}
                                      onSelect={() => handleCustomerSelect(party.name)}
                                    >
                                      {party.name}
                                    </CommandItem>
                                  ))}
                                <CommandEmpty>
                                  {partiesForSuggestions.length === 0 && !customerName.trim() ? "No customers found. Type to add." : "No customers match your search."}
                                </CommandEmpty>
                              </CommandGroup>
                            </>
                          )}
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
                </div>

                <div>
                  <Label htmlFor="productCategory" className="flex items-center mb-1"><Package className="h-4 w-4 mr-2 text-muted-foreground" />Product Category</Label>
                  <Select value={selectedCategoryIndex} onValueChange={setSelectedCategoryIndex} disabled={isFormDisabled}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select product category" />
                    </SelectTrigger>
                    <SelectContent>
                      {productCategories.map((p, index) => (
                        <SelectItem key={p.categoryName} value={String(index)}>{p.categoryName} ({p.unit})</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                { (currentCategoryName === "Pashu Aahar" || currentCategoryName === "Other") && (
                  <div key="specific-product-name-section">
                    <Label htmlFor="specificProductName" className="flex items-center mb-1"><Tag className="h-4 w-4 mr-2 text-muted-foreground" />
                      {currentCategoryName === "Pashu Aahar" ? "Specific Pashu Aahar Name" : "Product Name"}
                    </Label>
                    <Popover open={isProductPopoverOpen} onOpenChange={setIsProductPopoverOpen}>
                      <PopoverTrigger asChild>
                        <Input
                          id="specificProductName"
                          ref={productNameInputRef}
                          value={specificProductName}
                          onChange={(e) => handleSpecificProductNameChange(e.target.value)}
                          onFocus={() => {
                            if (currentCategoryName === "Pashu Aahar") {
                              setIsProductPopoverOpen(true);
                            }
                          }}
                          placeholder={
                            currentCategoryName === "Pashu Aahar" 
                              ? "Type or select Pashu Aahar" 
                              : "Enter product name"
                          }
                          required = {currentCategoryName === "Pashu Aahar" || currentCategoryName === "Other"}
                          autoComplete="off"
                          className="w-full text-left"
                          disabled={isFormDisabled}
                        />
                      </PopoverTrigger>
                      {currentCategoryName === "Pashu Aahar" && (
                        <PopoverContent
                            className="w-[--radix-popover-trigger-width] p-0"
                            onOpenAutoFocus={(e) => e.preventDefault()}
                            side="bottom"
                            align="start"
                            sideOffset={0}
                        >
                            <Command>
                            <CommandInput
                                value={specificProductName}
                                onValueChange={handleSpecificProductNameChange}
                                className="sr-only" 
                                tabIndex={-1}
                                aria-hidden="true"
                            />
                            <CommandList>
                                {isLoadingPrerequisites && availableProductSuggestions.length === 0 ? (
                                <CommandItem disabled>Loading products...</CommandItem>
                                ) : (
                                <>
                                    <CommandGroup>
                                    {availableProductSuggestions
                                        .filter(name => name.toLowerCase().includes(specificProductName.toLowerCase()))
                                        .map(productNameItem => (
                                        <CommandItem
                                            key={productNameItem}
                                            value={productNameItem}
                                            onSelect={() => handleProductSelect(productNameItem)}
                                        >
                                            {productNameItem}
                                            {productStock[`${productNameItem}#Bags`] !== undefined && (
                                            <span className="ml-auto text-xs text-muted-foreground">
                                                (Stock: {productStock[`${productNameItem}#Bags`]?.quantity ?? 0} Bags)
                                            </span>
                                            )}
                                        </CommandItem>
                                        ))}
                                    <CommandEmpty>
                                        {availableProductSuggestions.length === 0 && !specificProductName.trim() ? "No products recorded." : "No products match search."}
                                    </CommandEmpty>
                                    </CommandGroup>
                                </>
                                )}
                            </CommandList>
                            </Command>
                        </PopoverContent>
                      )}
                    </Popover>
                  </div>
                )}


                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="quantity">Quantity ({currentCategoryDetails?.unit || 'Units'})</Label>
                    <Input id="quantity" type="text" inputMode="decimal" step={currentCategoryDetails?.unit === "Ltr" || currentCategoryDetails?.unit === "Kg" ? "0.1" : "1"} value={quantity} onChange={(e) => setQuantity(e.target.value)} placeholder="e.g., 2.5 or 2" required disabled={isFormDisabled} />
                  </div>
                  <div>
                    <Label htmlFor="rate" className="flex items-center mb-1"><IndianRupee className="h-4 w-4 mr-1 text-muted-foreground" />Rate</Label>
                    <Input id="rate" type="text" inputMode="decimal" step="0.01" value={rate} onChange={(e) => setRate(e.target.value)} placeholder="e.g., 60" required disabled={isFormDisabled} />
                  </div>
                </div>
                <div>
                  <Label>Total Amount</Label>
                  <Input value={`₹ ${totalAmount.toFixed(2)}`} readOnly className="font-semibold bg-muted/50" />
                </div>
                <div>
                  <Label htmlFor="paymentType" className="flex items-center mb-1"><CreditCard className="h-4 w-4 mr-2 text-muted-foreground" />Payment Type</Label>
                  <Select value={paymentType} onValueChange={(value: "Cash" | "Credit") => setPaymentType(value)} disabled={isFormDisabled}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select payment type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Cash">Cash</SelectItem>
                      <SelectItem value="Credit">Credit</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Button type="submit" className="w-full" disabled={isSubmitting || isLoadingSales || isLoadingPrerequisites || isFormDisabled}>
                  {editingEntryId ? <Edit className="h-4 w-4 mr-2" /> : <PlusCircle className="h-4 w-4 mr-2" />}
                  {isSubmitting && !editingEntryId ? 'Adding...' : (isSubmitting && editingEntryId ? 'Updating...' : (editingEntryId ? 'Update Sale' : 'Add Sale'))}
                </Button>
                {editingEntryId && (
                  <Button type="button" variant="outline" className="w-full mt-2" onClick={resetFormFields} disabled={isSubmitting || isFormDisabled}>
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
                  <CardTitle>Recent Sales</CardTitle>
                  <CardDescription className="mt-1">
                    {ledgerDescription}
                    {isLoadingSales && sales.length === 0 && companyId && " Loading sales..."}
                    {!isLoadingSales && companyId && (tableFilterStartDate || tableFilterEndDate) && filteredSalesEntries.length === 0 && ` (No sales for this filter. Checked ${sales.length} total sales)`}
                     {!companyId && !authLoading && !profilesLoading && firebaseUser && " (Company ID missing, cannot load sales)"}
                  </CardDescription>
                </div>
                <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto sm:items-center">
                  <div className="w-full sm:w-auto">
                    <Label htmlFor="tableStartDateFilterSales" className="sr-only">Start Date</Label>
                    <DatePicker date={tableFilterStartDate} setDate={setTableFilterStartDate} className="w-full sm:w-[170px]" disabled={isFormDisabled} />
                  </div>
                  <div className="w-full sm:w-auto">
                    <Label htmlFor="tableEndDateFilterSales" className="sr-only">End Date</Label>
                    <DatePicker date={tableFilterEndDate} setDate={setTableFilterEndDate} className="w-full sm:w-[170px]" disabled={isFormDisabled} />
                  </div>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button onClick={handleExportCSV} variant="outline" size="icon" className="w-full sm:w-10 mt-2 sm:mt-0 h-10" disabled={filteredSalesEntries.length === 0 || isLoadingSales || isFormDisabled}>
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
              {isLoadingSales && companyId ? (
                <div className="space-y-2">
                  <Skeleton className="h-10 w-full" />
                  <Skeleton className="h-10 w-full" />
                  <Skeleton className="h-10 w-full" />
                </div>
              ) : !companyId && firebaseUser && !authLoading && !profilesLoading ? (
                <p className="text-center text-muted-foreground py-4">Company ID is not available. Sales data cannot be loaded.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Customer</TableHead>
                      <TableHead>Product</TableHead>
                      <TableHead className="text-right">Qty</TableHead>
                      <TableHead className="text-right">Rate (₹)</TableHead>
                      <TableHead className="text-right">Total (₹)</TableHead>
                      <TableHead>Payment</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredSalesEntries.length === 0 && !isLoadingSales ? (
                      <TableRow>
                        <TableCell colSpan={8} className="text-center text-muted-foreground">
                          {(tableFilterStartDate || tableFilterEndDate) ? `No sales for the selected period.` : "Select a date range to view sales."}
                          {(tableFilterStartDate || tableFilterEndDate) && sales.length > 0 && !filteredSalesEntries.length && ` (Checked ${sales.length} total sales)`}
                          {sales.length === 0 && "No sales recorded yet for this company."}
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredSalesEntries.map((sale) => (
                        <TableRow key={sale.id}>
                          <TableCell>{sale.date instanceof Date && !isNaN(sale.date.getTime()) ? format(sale.date, 'P') : 'Invalid Date'}</TableCell>
                          <TableCell>{sale.customerName}</TableCell>
                          <TableCell>{sale.productName}</TableCell>
                          <TableCell className="text-right">{sale.quantity.toFixed(sale.unit === "Ltr" || sale.unit === "Kg" ? 1:0)} {sale.unit}</TableCell>
                          <TableCell className="text-right">{sale.rate.toFixed(2)}</TableCell>
                          <TableCell className="text-right">{sale.totalAmount.toFixed(2)}</TableCell>
                          <TableCell>{sale.paymentType}</TableCell>
                          <TableCell className="text-right">
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-8 w-8" disabled={isFormDisabled}>
                                  <MoreHorizontal className="h-4 w-4" />
                                  <span className="sr-only">Actions</span>
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem onSelect={() => handleEdit(sale)} disabled={isFormDisabled}>
                                  <Edit className="mr-2 h-4 w-4" /> Edit
                                </DropdownMenuItem>
                                <DropdownMenuItem onSelect={() => handleDeleteClick(sale)} className="text-destructive focus:text-destructive focus:bg-destructive/10" disabled={isFormDisabled}>
                                  <Trash2 className="mr-2 h-4 w-4" /> Delete
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                  {filteredSalesEntries.length > 0 && (
                    <TableFooter>
                        <TableRow>
                            <TableCell colSpan={5} className="text-right font-semibold">Total Sales Amount:</TableCell>
                            <TableCell className="text-right font-bold">{totalFilteredSalesAmount.toFixed(2)}</TableCell>
                            <TableCell colSpan={2} />
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
                  This action cannot be undone. This will permanently delete the sale entry for
                  "{entryToDelete.productName}" to "{entryToDelete.customerName}" on {entryToDelete.date instanceof Date && !isNaN(entryToDelete.date.getTime()) ? format(entryToDelete.date, 'P') : 'Invalid Date'}.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel onClick={() => { setShowDeleteDialog(false); setEntryToDelete(null); }}>Cancel</AlertDialogCancel>
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
