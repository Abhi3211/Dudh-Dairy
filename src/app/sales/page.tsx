
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
import { User, Package, IndianRupee, CreditCard, PlusCircle, Tag, CalendarDays } from "lucide-react";
import type { SaleEntry, Party } from "@/lib/types";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import { addSaleEntryToFirestore, getSaleEntriesFromFirestore } from "./actions";
import { getPartiesFromFirestore, addPartyToFirestore } from "../parties/actions";
import { Skeleton } from "@/components/ui/skeleton";
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
  const [customerNameInput, setCustomerNameInput] = useState(""); // Renamed from customerName for clarity
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
      console.log('CLIENT: Fetched sales entries:', processedSales);
    } catch (error) {
      console.error("CLIENT: Failed to fetch sales entries:", error);
      toast({ title: "Error", description: "Could not fetch sales entries.", variant: "destructive" });
    } finally {
      setIsLoadingSales(false);
    }
  }, [toast]);

  useEffect(() => {
    setDate(new Date());
    fetchSales();
    fetchParties();
  }, [fetchSales, fetchParties]);

  const allKnownCustomerNames = useMemo(() => {
    // Customers for sales can be of type "Customer" or "Dealer" (who might also buy)
    return availableParties
      .filter(p => p.type === "Customer" || p.type === "Dealer")
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
      // When creating from sales form, default to type "Customer"
      const result = await addPartyToFirestore({ name: trimmedValue, type: "Customer" });
      if (result.success) {
        setCustomerNameInput(trimmedValue);
        toast({ title: "Success", description: `Customer "${trimmedValue}" added.` });
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

  const filteredCustomerSuggestions = useMemo(() => {
    if (!customerNameInput.trim()) return allKnownCustomerNames;
    return allKnownCustomerNames.filter((name) =>
      name.toLowerCase().includes(customerNameInput.toLowerCase())
    );
  }, [customerNameInput, allKnownCustomerNames]);


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
    const newSaleData: Omit<SaleEntry, 'id'> = {
      date,
      customerName: customerNameInput.trim(),
      productName: finalProductName,
      quantity: parsedQuantity,
      unit: currentCategoryDetails.unit,
      rate: parsedRate,
      totalAmount: parsedQuantity * parsedRate,
      paymentType,
    };
    
    const result = await addSaleEntryToFirestore(newSaleData);
    
    if (result.success) {
      toast({ title: "Success", description: "Sale entry added." });
      await fetchSales(); 
      
      setCustomerNameInput("");
      setSpecificPashuAaharName("");
      setQuantity("");
      setRate("");
      setPopoverOpenForPashuAahar(false);
      setIsCustomerPopoverOpen(false);
      setDate(new Date()); 
      setSelectedCategoryIndex("0");
      setPaymentType("Cash");
    } else {
      toast({ title: "Error", description: result.error || "Failed to add sale entry.", variant: "destructive" });
    }
    setIsSubmitting(false);
  };

  return (
    <div>
      <PageHeader title={pageSpecificTitle} description="Record product sales." />
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle>New Sale</CardTitle>
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
                             {filteredCustomerSuggestions.length === 0 && customerNameInput.trim() && allKnownCustomerNames.some(name => name.toLowerCase() === customerNameInput.trim().toLowerCase()) && (
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
                                    setSpecificPashuAaharName(currentValue);
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
                <PlusCircle className="h-4 w-4 mr-2" /> {isSubmitting ? 'Adding...' : (isLoadingSales || isLoadingParties ? 'Loading...' : 'Add Sale')}
              </Button>
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
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sales.length === 0 && !isLoadingSales ? (
                      <TableRow>
                          <TableCell colSpan={7} className="text-center text-muted-foreground">No sales recorded yet.</TableCell>
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
