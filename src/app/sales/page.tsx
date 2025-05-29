
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
} from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DatePicker } from "@/components/ui/date-picker";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { User, Package, IndianRupee, CreditCard, PlusCircle, Tag, CalendarDays, MoreHorizontal, Edit, Trash2 } from "lucide-react";
import type { SaleEntry, Party } from "@/lib/types";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import { addSaleEntryToFirestore, getSaleEntriesFromFirestore, updateSaleEntryInFirestore, deleteSaleEntryFromFirestore } from "./actions";
import { getPartiesFromFirestore, addPartyToFirestore } from "../parties/actions";
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
import { usePageTitle } from '@/context/PageTitleContext';

const productCategories: { categoryName: "Milk" | "Ghee" | "Pashu Aahar"; unit: SaleEntry['unit'] }[] = [
  { categoryName: "Milk", unit: "Ltr" },
  { categoryName: "Ghee", unit: "Kg" },
  { categoryName: "Pashu Aahar", unit: "Bags" },
];

const knownPashuAaharProducts: string[] = [
  "Gold Coin Feed",
  "Super Pallet",
  "Nutri Plus Feed",
  "Kisan Special Churi",
  "Dairy Delight Mix",
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
  const [customerNameInput, setCustomerNameInput] = useState("");
  const [selectedCategoryIndex, setSelectedCategoryIndex] = useState<string>("0");
  const [specificPashuAaharName, setSpecificPashuAaharName] = useState<string>("");
  const [quantity, setQuantity] = useState<string>("");
  const [rate, setRate] = useState<string>("");
  const [paymentType, setPaymentType] = useState<"Cash" | "Credit">("Cash");

  const [popoverOpenForPashuAahar, setPopoverOpenForPashuAahar] = useState(false);
  const [isCustomerPopoverOpen, setIsCustomerPopoverOpen] = useState(false);
  const customerNameInputRef = useRef<HTMLInputElement>(null);
  
  const [availableParties, setAvailableParties] = useState<Party[]>([]);
  const [isLoadingParties, setIsLoadingParties] = useState(true);

  const [editingEntryId, setEditingEntryId] = useState<string | null>(null);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [entryToDelete, setEntryToDelete] = useState<SaleEntry | null>(null);

  const fetchParties = useCallback(async () => {
    setIsLoadingParties(true);
    try {
      const parties = await getPartiesFromFirestore();
      setAvailableParties(parties);
    } catch (error) {
      console.error("CLIENT: Failed to fetch parties:", error);
      toast({ title: "Error", description: "Could not fetch parties for customer suggestions.", variant: "destructive" });
    } finally {
      setIsLoadingParties(false);
    }
  }, [toast]);

  const fetchSales = useCallback(async () => {
    setIsLoadingSales(true);
    try {
      const fetchedSales = await getSaleEntriesFromFirestore();
      const processedSales = fetchedSales.map(s => ({
        ...s,
        date: s.date instanceof Date ? s.date : new Date(s.date)
      }));
      setSales(processedSales);
    } catch (error) {
      console.error("CLIENT: Failed to fetch sales entries:", error);
      toast({ title: "Error", description: "Could not fetch sales entries.", variant: "destructive" });
    } finally {
      setIsLoadingSales(false);
    }
  }, [toast]);

  useEffect(() => {
    if (!editingEntryId) {
      setDate(new Date());
    }
    fetchSales();
    fetchParties();
  }, [fetchSales, fetchParties, editingEntryId]);

  const allKnownCustomerNames = useMemo(() => {
    return availableParties
      .filter(p => p.type === "Customer" || p.type === "Dealer") // Keep Dealer for now as per previous setup
      .map(p => p.name)
      .sort((a, b) => a.localeCompare(b));
  }, [availableParties]);

  const totalAmount = useMemo(() => {
    const q = parseFloat(quantity);
    const r = parseFloat(rate);
    return (!isNaN(q) && !isNaN(r)) ? q * r : 0;
  }, [quantity, rate]);

  const currentCategoryDetails = productCategories[parseInt(selectedCategoryIndex)];
  const currentCategoryName = currentCategoryDetails?.categoryName;

  useEffect(() => {
    if (currentCategoryName !== "Pashu Aahar") {
      setSpecificPashuAaharName("");
      setPopoverOpenForPashuAahar(false);
    }
  }, [currentCategoryName]);

  const handlePashuAaharNameChange = useCallback((value: string) => {
    setSpecificPashuAaharName(value);
    setPopoverOpenForPashuAahar(!!value.trim());
  }, []);

  const handleCustomerNameInputChange = useCallback((value: string) => {
    setCustomerNameInput(value);
    setIsCustomerPopoverOpen(!!value.trim());
  }, []);
  
  const handleCustomerSelect = useCallback(async (currentValue: string, isCreateNew = false) => {
    const trimmedValue = currentValue.trim();
    if (isCreateNew) {
       if (!trimmedValue) {
        toast({ title: "Error", description: "Customer name cannot be empty.", variant: "destructive" });
        setIsCustomerPopoverOpen(false);
        return;
      }
      setIsSubmitting(true); // or setIsLoadingParties(true)
      const result = await addPartyToFirestore({ name: trimmedValue, type: "Customer" });
      if (result.success) {
        setCustomerNameInput(trimmedValue);
        toast({ title: "Success", description: `Customer "${trimmedValue}" added.` });
        await fetchParties(); 
      } else {
        toast({ title: "Error", description: result.error || "Failed to add customer.", variant: "destructive" });
      }
      setIsSubmitting(false); // or setIsLoadingParties(false)
    } else {
      setCustomerNameInput(trimmedValue);
    }
    setIsCustomerPopoverOpen(false);
    customerNameInputRef.current?.focus();
  }, [toast, fetchParties]);

  const filteredCustomerSuggestions = useMemo(() => {
    if (!customerNameInput.trim()) return allKnownCustomerNames;
    return allKnownCustomerNames.filter((name) =>
      name.toLowerCase().includes(customerNameInput.toLowerCase())
    );
  }, [customerNameInput, allKnownCustomerNames]);

  const resetFormFields = useCallback(() => {
    if (!editingEntryId) setDate(new Date()); // Only reset date if not editing
    // Date persists during edits, shift persists by design (though no shift here)
    setCustomerNameInput("");
    setSelectedCategoryIndex("0");
    setSpecificPashuAaharName("");
    setQuantity("");
    setRate("");
    setPaymentType("Cash");
    setEditingEntryId(null);
    setIsCustomerPopoverOpen(false);
    setPopoverOpenForPashuAahar(false);
  }, [editingEntryId]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!date || !customerNameInput.trim() || !quantity || !rate) {
      toast({ title: "Error", description: "Please fill all required fields (Date, Customer, Quantity, Rate).", variant: "destructive" });
      return;
    }

    let finalProductName = "";
    if (!currentCategoryDetails) {
        toast({ title: "Error", description: "Please select a product category.", variant: "destructive" });
        return;
    }

    if (currentCategoryDetails.categoryName === "Pashu Aahar") {
      if (!specificPashuAaharName.trim()) {
        toast({ title: "Error", description: "Please enter or select the specific Pashu Aahar product name.", variant: "destructive" });
        return;
      }
      finalProductName = specificPashuAaharName.trim();
    } else {
      finalProductName = currentCategoryDetails.categoryName;
    }

    const parsedQuantity = parseFloat(quantity);
    const parsedRate = parseFloat(rate);

    if (isNaN(parsedQuantity) || parsedQuantity <= 0) {
      toast({ title: "Error", description: "Quantity must be a positive number.", variant: "destructive" });
      return;
    }
    if (isNaN(parsedRate) || parsedRate <= 0) {
      toast({ title: "Error", description: "Rate must be a positive number.", variant: "destructive" });
      return;
    }

    setIsSubmitting(true);
    const saleData: Omit<SaleEntry, 'id'> = {
      date,
      customerName: customerNameInput.trim(),
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
      await fetchSales(); 
    }
    setIsSubmitting(false);
  };

  const handleEdit = (entry: SaleEntry) => {
    setEditingEntryId(entry.id);
    setDate(entry.date);
    setCustomerNameInput(entry.customerName);
    
    const categoryIndex = productCategories.findIndex(
      (cat) => cat.categoryName === entry.productName || (cat.categoryName === "Pashu Aahar" && cat.unit === entry.unit)
    );

    if (productCategories[categoryIndex]?.categoryName === "Pashu Aahar") {
        setSelectedCategoryIndex(String(categoryIndex !== -1 ? categoryIndex : 0));
        setSpecificPashuAaharName(entry.productName);
    } else if (categoryIndex !== -1) {
        setSelectedCategoryIndex(String(categoryIndex));
        setSpecificPashuAaharName("");
    } else {
        // Fallback if product name doesn't match main categories (e.g. older data)
        // Try to find if it's one of the known Pashu Aahar products
        const pashuAaharCatIndex = productCategories.findIndex(cat => cat.categoryName === "Pashu Aahar");
        if (knownPashuAaharProducts.includes(entry.productName) && pashuAaharCatIndex !== -1) {
            setSelectedCategoryIndex(String(pashuAaharCatIndex));
            setSpecificPashuAaharName(entry.productName);
        } else {
            setSelectedCategoryIndex("0"); // Default to Milk
            setSpecificPashuAaharName("");
        }
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
      await fetchSales();
    } else {
      toast({ title: "Error", description: result.error || "Failed to delete entry.", variant: "destructive" });
    }
    setShowDeleteDialog(false);
    setEntryToDelete(null);
    setIsSubmitting(false);
  };


  return (
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
                    onOpenAutoFocus={(e) => e.preventDefault()}
                    side="bottom"
                    align="start"
                    sideOffset={0}
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
                        ): (
                          <>
                            {customerNameInput.trim() && !allKnownCustomerNames.some(name => name.toLowerCase() === customerNameInput.trim().toLowerCase()) && (
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
                             {filteredCustomerSuggestions.length === 0 && customerNameInput.trim() && (
                                <CommandEmpty>No existing customers match. Select "Add new..." above.</CommandEmpty>
                             )}
                             {allKnownCustomerNames.length === 0 && !customerNameInput.trim() && (
                                <CommandEmpty>No customers found. Type to add a new one.</CommandEmpty>
                             )}
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

              {currentCategoryName === "Pashu Aahar" && (
                 <div key="pashu-aahar-specific-name-section">
                  <Label htmlFor="specificPashuAaharName" className="flex items-center mb-1"><Tag className="h-4 w-4 mr-2 text-muted-foreground" />Specific Pashu Aahar Name</Label>
                  <Popover open={popoverOpenForPashuAahar} onOpenChange={setPopoverOpenForPashuAahar}>
                    <PopoverTrigger asChild>
                      <Input
                        id="specificPashuAaharName"
                        value={specificPashuAaharName}
                        onChange={(e) => handlePashuAaharNameChange(e.target.value)}
                        placeholder="Type or select Pashu Aahar"
                        required
                        autoComplete="off"
                        className="w-full"
                      />
                    </PopoverTrigger>
                    <PopoverContent
                      className="w-[var(--radix-popover-trigger-width)] p-0"
                      onOpenAutoFocus={(e) => e.preventDefault()}
                      side="bottom"
                      align="start"
                      sideOffset={0}
                    >
                       <Command>
                        <CommandInput 
                            placeholder="Search Pashu Aahar..." 
                            value={specificPashuAaharName}
                            onValueChange={handlePashuAaharNameChange}
                        />
                        <CommandList>
                            <CommandEmpty>No Pashu Aahar product found.</CommandEmpty>
                            <CommandGroup>
                            {knownPashuAaharProducts
                                .filter(name => name.toLowerCase().includes(specificPashuAaharName.toLowerCase()))
                                .map(suggestion => ( 
                                <CommandItem
                                key={suggestion}
                                value={suggestion}
                                onSelect={(currentValue) => { 
                                    setSpecificPashuAaharName(currentValue); // Use the passed currentValue
                                    setPopoverOpenForPashuAahar(false);
                                }}
                                >
                                {suggestion}
                                </CommandItem>
                            ))}
                            </CommandGroup>
                        </CommandList>
                        </Command>
                    </PopoverContent>
                  </Popover>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="quantity">Quantity</Label>
                  <Input id="quantity" type="number" step={currentCategoryDetails?.unit === "Ltr" ? "0.1" : "1"} value={quantity} onChange={(e) => setQuantity(e.target.value)} placeholder="e.g., 2.5 or 2" required />
                </div>
                <div>
                  <Label htmlFor="rate" className="flex items-center mb-1"><IndianRupee className="h-4 w-4 mr-1 text-muted-foreground" />Rate</Label>
                  <Input id="rate" type="number" step="0.01" value={rate} onChange={(e) => setRate(e.target.value)} placeholder="e.g., 60" required />
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
              <Button type="submit" className="w-full" disabled={isSubmitting || isLoadingSales || isLoadingParties}>
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
            <CardTitle>Recent Sales</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoadingSales && sales.length === 0 ? (
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
                  {sales.length === 0 && !isLoadingSales ? (
                      <TableRow>
                          <TableCell colSpan={8} className="text-center text-muted-foreground">No sales recorded yet.</TableCell>
                      </TableRow>
                  ) : (
                      sales.map((sale) => (
                      <TableRow key={sale.id}>
                          <TableCell>{sale.date instanceof Date && !isNaN(sale.date.getTime()) ? format(sale.date, 'P') : 'Invalid Date'}</TableCell>
                          <TableCell>{sale.customerName}</TableCell>
                          <TableCell>{sale.productName}</TableCell>
                          <TableCell className="text-right">{sale.quantity} {sale.unit}</TableCell>
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
