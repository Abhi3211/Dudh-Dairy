
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
import { User, Package, IndianRupee, CreditCard, PlusCircle, Tag, CalendarDays, MoreHorizontal, Edit, Trash2, Filter, Download } from "lucide-react";
import type { SaleEntry, Party, PurchaseEntry } from "@/lib/types"; // Changed PashuAaharTransaction to PurchaseEntry
import { format, startOfMonth } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import { addSaleEntryToFirestore, getSaleEntriesFromFirestore, updateSaleEntryInFirestore, deleteSaleEntryFromFirestore } from "./actions";
import { getPartiesFromFirestore, addPartyToFirestore } from "../parties/actions";
import { getPurchaseEntriesFromFirestore, getUniquePurchasedProductNames } from "../purchases/actions"; // Updated import path and function names
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

const productCategories: { categoryName: string; unit: SaleEntry['unit'] }[] = [ // string for categoryName
  { categoryName: "Milk", unit: "Ltr" },
  { categoryName: "Ghee", unit: "Kg" },
  { categoryName: "Pashu Aahar", unit: "Bags" },
  { categoryName: "Other", unit: "Pcs" }, // Added Other category
];

export default function SalesPage() {
  const { setPageTitle } = usePageTitle();
  const pageSpecificTitle = "Sales Entry";

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
  const [specificProductName, setSpecificProductName] = useState<string>(""); // Renamed for clarity
  const [quantity, setQuantity] = useState<string>("");
  const [rate, setRate] = useState<string>("");
  const [paymentType, setPaymentType] = useState<"Cash" | "Credit">("Credit");

  const [isCustomerPopoverOpen, setIsCustomerPopoverOpen] = useState(false);
  const customerNameInputRef = useRef<HTMLInputElement>(null);

  const [availableParties, setAvailableParties] = useState<Party[]>([]);
  const [isLoadingPrerequisites, setIsLoadingPrerequisites] = useState(true);

  const [isProductPopoverOpen, setIsProductPopoverOpen] = useState(false); // Renamed
  const productNameInputRef = useRef<HTMLInputElement>(null); // Renamed
  const [availableProductSuggestions, setAvailableProductSuggestions] = useState<string[]>([]); // Renamed

  const [allPurchaseEntriesForStock, setAllPurchaseEntriesForStock] = useState<PurchaseEntry[]>([]); // Renamed
  const [productStock, setProductStock] = useState<Record<string, { quantity: number, unit: string }>>({}); // More generic stock


  const [editingEntryId, setEditingEntryId] = useState<string | null>(null);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [entryToDelete, setEntryToDelete] = useState<SaleEntry | null>(null);

  const [tableFilterStartDate, setTableFilterStartDate] = useState<Date | undefined>(undefined);
  const [tableFilterEndDate, setTableFilterEndDate] = useState<Date | undefined>(undefined);

  const fetchSalesHistory = useCallback(async () => {
    setIsLoadingSales(true);
    try {
      const fetchedSales = await getSaleEntriesFromFirestore();
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
  }, [toast]);

  const fetchPagePrerequisites = useCallback(async () => {
    setIsLoadingPrerequisites(true);
    try {
      const [parties, productNames, purchaseEntriesData] = await Promise.all([ // Using PurchaseEntry now
        getPartiesFromFirestore(),
        getUniquePurchasedProductNames(), // Generic fetch
        getPurchaseEntriesFromFirestore()
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
  }, [toast]);


  useEffect(() => {
    if (date === undefined && !editingEntryId) {
      setDate(new Date());
    }
    if (tableFilterStartDate === undefined) {
      setTableFilterStartDate(startOfMonth(new Date()));
    }
    if (tableFilterEndDate === undefined) {
      setTableFilterEndDate(new Date());
    }
    fetchSalesHistory();
    fetchPagePrerequisites();
  }, [fetchSalesHistory, fetchPagePrerequisites, date, editingEntryId, tableFilterStartDate, tableFilterEndDate]);

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
  
    sales.forEach(sale => { // Use current sales from state for accurate real-time stock during session
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
      .filter(p => p.type === "Customer") // Only customers for sales
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
    // If category is not one that requires specific product name (e.g. Pashu Aahar), 
    // set specificProductName to the category name itself, unless it's "Other".
    if (currentCategoryName && currentCategoryName !== "Pashu Aahar" && currentCategoryName !== "Other") {
      setSpecificProductName(currentCategoryName);
      setIsProductPopoverOpen(false);
    } else if (currentCategoryName !== "Pashu Aahar") { // Clear for "Other" or if "Pashu Aahar" is not selected
        setSpecificProductName("");
        setIsProductPopoverOpen(false);
    }
    // Auto-set rate for Milk and Ghee if available (example, can be more sophisticated)
    if (currentCategoryName === "Milk") setRate("60"); // Example default rate
    else if (currentCategoryName === "Ghee") setRate("700"); // Example default rate
    else if (currentCategoryName !== "Pashu Aahar") setRate(""); // Clear rate for others

  }, [currentCategoryName]);


  const handleSpecificProductNameChange = useCallback((value: string) => {
    setSpecificProductName(value);
    if (currentCategoryName === "Pashu Aahar" && value.trim() && availableProductSuggestions.length > 0) {
        setIsProductPopoverOpen(true);
    } else {
        setIsProductPopoverOpen(false);
    }
  }, [availableProductSuggestions, currentCategoryName]);

  const handleProductSelect = useCallback((currentValue: string) => {
    setSpecificProductName(currentValue);
    setIsProductPopoverOpen(false);
    productNameInputRef.current?.focus();

    if (currentCategoryName === "Pashu Aahar") {
        const latestPurchase = allPurchaseEntriesForStock
        .filter(tx => tx.productName === currentValue && tx.category === "Pashu Aahar" && tx.defaultSalePricePerUnit && tx.defaultSalePricePerUnit > 0)
        .sort((a,b) => (b.date instanceof Date ? b.date.getTime() : new Date(b.date).getTime()) - (a.date instanceof Date ? a.date.getTime() : new Date(a.date).getTime()))[0];

        if (latestPurchase) {
            setRate(String(latestPurchase.defaultSalePricePerUnit));
        } else {
            setRate(""); // Clear rate if no default sale price found
        }
    }
  }, [allPurchaseEntriesForStock, currentCategoryName]);


  const handleCustomerNameInputChange = useCallback((value: string) => {
    setCustomerName(value);
    if (value.trim() && partiesForSuggestions.length > 0) {
      setIsCustomerPopoverOpen(true);
    } else {
      setIsCustomerPopoverOpen(false);
    }
  }, [partiesForSuggestions]);

  const handleCustomerSelect = useCallback(async (currentValue: string, isCreateNew = false) => {
    const trimmedValue = currentValue.trim();
    if (isCreateNew) {
      if (!trimmedValue) {
        toast({ title: "Error", description: "Customer name cannot be empty.", variant: "destructive" });
        setIsCustomerPopoverOpen(false);
        return;
      }

      const existingParty = availableParties.find(
        p => p.name.toLowerCase() === trimmedValue.toLowerCase() && p.type === "Customer"
      );
      if (existingParty) {
        toast({ title: "Info", description: `Customer "${trimmedValue}" already exists. Selecting existing customer.`, variant: "default" });
        setCustomerName(trimmedValue);
        setIsCustomerPopoverOpen(false);
        customerNameInputRef.current?.focus();
        return;
      }
      
      setIsSubmitting(true);
      const result = await addPartyToFirestore({ name: trimmedValue, type: "Customer" });
      if (result.success) {
        setCustomerName(trimmedValue);
        toast({ title: "Success", description: `Customer "${trimmedValue}" added.` });
        await fetchPagePrerequisites();
      } else {
        toast({ title: "Error", description: result.error || "Failed to add customer.", variant: "destructive" });
      }
      setIsSubmitting(false);
    } else {
      setCustomerName(trimmedValue);
    }
    setIsCustomerPopoverOpen(false);
    customerNameInputRef.current?.focus();
  }, [toast, fetchPagePrerequisites, availableParties]);


  const resetFormFields = useCallback(() => {
    if (!editingEntryId) setDate(new Date());
    setCustomerName("");
    setSelectedCategoryIndex("0"); // Reset to first category (Milk)
    setSpecificProductName("");    // This will be auto-set by useEffect for Milk
    setQuantity("");
    setRate(""); // Will be auto-set for Milk/Ghee by useEffect
    setPaymentType("Credit");
    setEditingEntryId(null);
    setIsCustomerPopoverOpen(false);
    setIsProductPopoverOpen(false);
  }, [editingEntryId]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!date || !customerName.trim() || !quantity || !rate) {
      toast({ title: "Error", description: "Please fill all required fields (Date, Customer, Quantity, Rate).", variant: "destructive" });
      return;
    }

    if (!currentCategoryDetails) {
      toast({ title: "Error", description: "Please select a product category.", variant: "destructive" });
      return;
    }
    
    let finalProductName = specificProductName.trim();
    if (!finalProductName) { // If specificProductName is empty (e.g. for Milk, Ghee, Other)
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
      await fetchPagePrerequisites(); // To refresh stock
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
            setSpecificProductName(catDetails.categoryName); // For Milk, Ghee
        }
    } else {
        // Fallback if product name doesn't match a predefined category directly (e.g. old data or truly "Other")
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
      await fetchPagePrerequisites(); // To refresh stock
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


  return (
    <TooltipProvider>
      <div>
        <PageHeader title={pageSpecificTitle} description="Record product sales." />
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
                          if (customerName.trim() || partiesForSuggestions.length > 0) {
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
                      onOpenAutoFocus={(e) => e.preventDefault()}
                      side="bottom"
                      align="start"
                      sideOffset={0}
                    >
                      <Command>
                        <CommandInput
                          placeholder="Search or add new customer..."
                          value={customerName}
                          onValueChange={handleCustomerNameInputChange}
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
                  <Select value={selectedCategoryIndex} onValueChange={setSelectedCategoryIndex}>
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
                            if (currentCategoryName === "Pashu Aahar" && (specificProductName.trim() || availableProductSuggestions.length > 0)) {
                              setIsProductPopoverOpen(true);
                            }
                          }}
                          placeholder={currentCategoryName === "Pashu Aahar" ? "Type or select Pashu Aahar" : "Enter product name"}
                          required = {currentCategoryName === "Pashu Aahar" || currentCategoryName === "Other"}
                          autoComplete="off"
                          className="w-full text-left"
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
                                placeholder="Search Pashu Aahar..."
                                value={specificProductName}
                                onValueChange={handleSpecificProductNameChange}
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
                    <Input id="quantity" type="text" inputMode="decimal" step={currentCategoryDetails?.unit === "Ltr" ? "0.1" : "1"} value={quantity} onChange={(e) => setQuantity(e.target.value)} placeholder="e.g., 2.5 or 2" required />
                  </div>
                  <div>
                    <Label htmlFor="rate" className="flex items-center mb-1"><IndianRupee className="h-4 w-4 mr-1 text-muted-foreground" />Rate</Label>
                    <Input id="rate" type="text" inputMode="decimal" step="0.01" value={rate} onChange={(e) => setRate(e.target.value)} placeholder="e.g., 60" required />
                  </div>
                </div>
                <div>
                  <Label>Total Amount</Label>
                  <Input value={`₹ ${totalAmount.toFixed(2)}`} readOnly className="font-semibold bg-muted/50" />
                </div>
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
                <Button type="submit" className="w-full" disabled={isSubmitting || isLoadingSales || isLoadingPrerequisites}>
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
                  <CardTitle>Recent Sales</CardTitle>
                  <CardDescription className="mt-1">
                    {ledgerDescription}
                    {isLoadingSales && sales.length === 0 && " Loading sales..."}
                    {!isLoadingSales && (tableFilterStartDate || tableFilterEndDate) && filteredSalesEntries.length === 0 && ` (No sales for this filter. Checked ${sales.length} total sales)`}
                  </CardDescription>
                </div>
                <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto sm:items-center">
                  <div className="w-full sm:w-auto">
                    <Label htmlFor="tableStartDateFilterSales" className="sr-only">Start Date</Label>
                    <DatePicker date={tableFilterStartDate} setDate={setTableFilterStartDate} className="w-full sm:w-[170px]" />
                  </div>
                  <div className="w-full sm:w-auto">
                    <Label htmlFor="tableEndDateFilterSales" className="sr-only">End Date</Label>
                    <DatePicker date={tableFilterEndDate} setDate={setTableFilterEndDate} className="w-full sm:w-[170px]" />
                  </div>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button onClick={handleExportCSV} variant="outline" size="icon" className="w-full sm:w-10 mt-2 sm:mt-0 h-10" disabled={filteredSalesEntries.length === 0 || isLoadingSales}>
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
              {isLoadingSales && sales.length === 0 && (!tableFilterStartDate && !tableFilterEndDate) ? (
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
                                <Button variant="ghost" size="icon" className="h-8 w-8">
                                  <MoreHorizontal className="h-4 w-4" />
                                  <span className="sr-only">Actions</span>
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem onSelect={() => handleEdit(sale)}>
                                  <Edit className="mr-2 h-4 w-4" /> Edit
                                </DropdownMenuItem>
                                <DropdownMenuItem onSelect={() => handleDeleteClick(sale)} className="text-destructive focus:text-destructive focus:bg-destructive/10">
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


    