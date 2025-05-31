
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
  TableFooter,
} from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { DatePicker } from "@/components/ui/date-picker";
import { Warehouse, IndianRupee, User, PlusCircle, Tag, CalendarIcon, MoreHorizontal, Edit, Trash2, CreditCard, ListFilter, PackageSearch } from "lucide-react";
import type { PurchaseEntry, Party, SaleEntry } from "@/lib/types";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import { Skeleton } from "@/components/ui/skeleton";
import {
  addPurchaseEntryToFirestore,
  getPurchaseEntriesFromFirestore,
  updatePurchaseEntryInFirestore,
  deletePurchaseEntryFromFirestore,
  getUniquePurchasedProductNames,
  getUniqueCategoriesFromFirestore
} from "./actions";
import { getPartiesFromFirestore, addPartyToFirestore } from "../parties/actions";
import { getSaleEntriesFromFirestore } from "../sales/actions"; 
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
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


export default function PurchasesPage() {
  const { setPageTitle } = usePageTitle();
  const pageSpecificTitle = "Record Purchases";

  useEffect(() => {
    setPageTitle(pageSpecificTitle);
  }, [setPageTitle, pageSpecificTitle]);

  const { toast } = useToast();
  const [purchaseEntries, setPurchaseEntries] = useState<PurchaseEntry[]>([]);
  const [allSales, setAllSales] = useState<SaleEntry[]>([]);
  const [isLoadingData, setIsLoadingData] = useState(true);
  const [currentStockByProduct, setCurrentStockByProduct] = useState<Record<string, { quantity: number; unit: string }>>({});

  const [date, setDate] = useState<Date | undefined>(undefined);
  
  const [categoryNameInput, setCategoryNameInput] = useState("");
  const [isCategoryPopoverOpen, setIsCategoryPopoverOpen] = useState(false);
  const categoryNameInputRef = useRef<HTMLInputElement>(null);
  const [existingCategorySuggestions, setExistingCategorySuggestions] = useState<string[]>([]);
  
  const [productName, setProductName] = useState("");
  const [isProductPopoverOpen, setIsProductPopoverOpen] = useState(false);
  const productNameInputRef = useRef<HTMLInputElement>(null);
  const [productNameSuggestions, setProductNameSuggestions] = useState<string[]>([]);

  const [supplierNameInput, setSupplierNameInput] = useState<string>("");
  const [isSupplierPopoverOpen, setIsSupplierPopoverOpen] = useState(false);
  const supplierNameInputRef = useRef<HTMLInputElement>(null);

  const [availableParties, setAvailableParties] = useState<Party[]>([]);
  const [isLoadingParties, setIsLoadingParties] = useState(true);

  const [quantity, setQuantity] = useState("");
  const [unit, setUnit] = useState("");
  const [pricePerUnit, setPricePerUnit] = useState("");
  const [defaultSalePricePerUnitInput, setDefaultSalePricePerUnitInput] = useState("");
  const [paymentType, setPaymentType] = useState<"Cash" | "Credit">("Credit");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [editingTransactionId, setEditingTransactionId] = useState<string | null>(null);
  const [transactionToEdit, setTransactionToEdit] = useState<PurchaseEntry | null>(null);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [transactionToDelete, setTransactionToDelete] = useState<PurchaseEntry | null>(null);

  const fetchPageData = useCallback(async () => {
    setIsLoadingData(true);
    setIsLoadingParties(true);
    try {
      const [
        fetchedPurchases, 
        fetchedSalesData, 
        fetchedParties, 
        fetchedProductNames,
        fetchedCategoryNames
      ] = await Promise.all([
        getPurchaseEntriesFromFirestore(),
        getSaleEntriesFromFirestore(),
        getPartiesFromFirestore(),
        getUniquePurchasedProductNames(),
        getUniqueCategoriesFromFirestore()
      ]);

      const processedPurchases = fetchedPurchases.map(tx => ({
        ...tx,
        date: tx.date instanceof Date ? tx.date : new Date(tx.date)
      })).sort((a, b) => b.date.getTime() - a.date.getTime());
      setPurchaseEntries(processedPurchases);
      setAllSales(fetchedSalesData.map(s => ({ ...s, date: s.date instanceof Date ? s.date : new Date(s.date) })));
      setAvailableParties(fetchedParties);
      setProductNameSuggestions(fetchedProductNames);
      setExistingCategorySuggestions(fetchedCategoryNames);

    } catch (error) {
      console.error("CLIENT: Failed to fetch Purchase page data:", error);
      toast({ title: "Error", description: "Could not fetch all necessary data.", variant: "destructive" });
    } finally {
      setIsLoadingData(false);
      setIsLoadingParties(false);
    }
  }, [toast]);

  useEffect(() => {
    if (!editingTransactionId && date === undefined) {
      setDate(new Date());
    }
    fetchPageData();
  }, [fetchPageData, editingTransactionId, date]);
  

  useEffect(() => {
    const stockCalc: Record<string, { quantity: number; unit: string }> = {};
    const stockEvents: { productName: string; unit: string; date: Date; quantityChange: number; }[] = [];

    purchaseEntries.forEach(tx => {
      stockEvents.push({
        productName: tx.productName.trim(),
        unit: tx.unit,
        date: tx.date,
        quantityChange: tx.quantity,
      });
    });

    allSales.forEach(sale => {
      stockEvents.push({
        productName: sale.productName.trim(),
        unit: sale.unit,
        date: sale.date,
        quantityChange: -sale.quantity,
      });
    });

    stockEvents.sort((a, b) => a.date.getTime() - b.date.getTime());

    stockEvents.forEach(event => {
      const key = `${event.productName}#${event.unit}`; // Use product#unit as key
      const current = stockCalc[key] || { quantity: 0, unit: event.unit };
      current.quantity += event.quantityChange;
      stockCalc[key] = current;
    });
    setCurrentStockByProduct(stockCalc);
  }, [purchaseEntries, allSales]);


  const totalPurchaseAmount = useMemo(() => {
    return purchaseEntries.reduce((sum, tx) => sum + tx.totalAmount, 0);
  }, [purchaseEntries]);

  const resetFormFields = useCallback(() => {
    if (!editingTransactionId) setDate(new Date());
    setCategoryNameInput("");
    setProductName("");
    setSupplierNameInput("");
    setQuantity("");
    setUnit("");
    setPricePerUnit("");
    setDefaultSalePricePerUnitInput("");
    setPaymentType("Credit");
    setEditingTransactionId(null);
    setTransactionToEdit(null);
    setIsSupplierPopoverOpen(false);
    setIsProductPopoverOpen(false);
    setIsCategoryPopoverOpen(false);
  }, [editingTransactionId]);

  const availableSuppliers = useMemo(() => {
    return availableParties
      .filter(p => p.type === "Supplier")
      .map(s => s.name)
      .sort((a, b) => a.localeCompare(b));
  }, [availableParties]);

  const handleCategoryNameInputChange = useCallback((value: string) => {
    setCategoryNameInput(value);
    if (value.trim() && (existingCategorySuggestions.length > 0 || !isLoadingData)) {
        setIsCategoryPopoverOpen(true);
    } else {
        setIsCategoryPopoverOpen(false);
    }
  }, [existingCategorySuggestions, isLoadingData]);

  const handleCategorySelect = useCallback((currentValue: string) => {
    const isCreatingNew = currentValue.startsWith("__CREATE_CATEGORY__");
    let actualValue = currentValue;

    if (isCreatingNew) {
        actualValue = categoryNameInput.trim(); 
        if (!actualValue) {
            toast({ title: "Error", description: "Category name cannot be empty.", variant: "destructive" });
            setIsCategoryPopoverOpen(false);
            return;
        }
        if (!existingCategorySuggestions.some(cat => cat.toLowerCase() === actualValue.toLowerCase())) {
            setExistingCategorySuggestions(prev => [...prev, actualValue].sort((a, b) => a.localeCompare(b)));
            toast({ title: "Info", description: `Category "${actualValue}" added to suggestions for this session.` });
        }
    }
    setCategoryNameInput(actualValue);
    setIsCategoryPopoverOpen(false);
    categoryNameInputRef.current?.focus();
  }, [categoryNameInput, existingCategorySuggestions, toast]);


  const handleProductNameInputChange = useCallback((value: string) => {
    setProductName(value);
    if (value.trim() && (productNameSuggestions.length > 0 || !isLoadingData)) {
      setIsProductPopoverOpen(true);
    } else {
      setIsProductPopoverOpen(false);
    }
  }, [productNameSuggestions, isLoadingData]);

  const handleProductSelect = useCallback((currentValue: string) => {
    const isCreatingNew = currentValue.startsWith("__CREATE_PRODUCT__");
    let actualValue = currentValue;

    if (isCreatingNew) {
        actualValue = productName.trim(); 
        if (!actualValue) {
            toast({ title: "Error", description: "Product name cannot be empty.", variant: "destructive" });
            setIsProductPopoverOpen(false);
            return;
        }
        if (!productNameSuggestions.some(p => p.toLowerCase() === actualValue.toLowerCase())) {
            setProductNameSuggestions(prev => [...prev, actualValue].sort((a, b) => a.localeCompare(b)));
            toast({ title: "Info", description: `Product "${actualValue}" added to suggestions for this session.` });
        }
    }
    setProductName(actualValue);
    setIsProductPopoverOpen(false);
    productNameInputRef.current?.focus();
  }, [productName, productNameSuggestions, toast]);


  const handleSupplierNameInputChange = useCallback((value: string) => {
    setSupplierNameInput(value);
    if (value.trim() && (availableSuppliers.length > 0 || !isLoadingParties)) {
      setIsSupplierPopoverOpen(true);
    } else {
      setIsSupplierPopoverOpen(false);
    }
  }, [availableSuppliers, isLoadingParties]);

  const handleSupplierSelect = useCallback(async (currentValue: string) => {
    const trimmedValue = currentValue.trim();
    const isCreatingNew = currentValue.startsWith("__CREATE_SUPPLIER__");
    let actualValue = currentValue;

    if (isCreatingNew) {
        actualValue = supplierNameInput.trim();
        if (!actualValue) {
            toast({ title: "Error", description: "Supplier name cannot be empty.", variant: "destructive" });
            setIsSupplierPopoverOpen(false);
            return;
        }
        setIsSubmitting(true); 
        const result = await addPartyToFirestore({ name: actualValue, type: "Supplier" });
        if (result.success && result.id) {
            toast({ title: "Success", description: `Supplier "${actualValue}" added.` });
            await fetchPageData(); 
        } else {
            toast({ title: "Error", description: result.error || "Failed to add supplier.", variant: "destructive" });
        }
        setIsSubmitting(false);
    }
    setSupplierNameInput(actualValue);
    setIsSupplierPopoverOpen(false);
    supplierNameInputRef.current?.focus();
  }, [supplierNameInput, toast, fetchPageData]);


  const handlePurchaseSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!date || !categoryNameInput.trim() || !productName.trim() || !supplierNameInput.trim() || !quantity || !unit.trim() || !pricePerUnit || !paymentType) {
      toast({ title: "Error", description: "Please fill all required fields (Date, Category, Product, Supplier, Quantity, Unit, Price/Unit, Payment Type).", variant: "destructive" });
      return;
    }
    const parsedQuantity = parseFloat(quantity.replace(',', '.'));
    const parsedPrice = parseFloat(pricePerUnit.replace(',', '.'));
    const parsedDefaultSalePrice = defaultSalePricePerUnitInput ? parseFloat(defaultSalePricePerUnitInput.replace(',', '.')) : undefined;


    if (isNaN(parsedQuantity) || parsedQuantity <= 0) {
      toast({ title: "Error", description: "Quantity must be a positive number.", variant: "destructive" }); return;
    }
    if (isNaN(parsedPrice) || parsedPrice <= 0) {
      toast({ title: "Error", description: "Price per unit must be a positive number.", variant: "destructive" }); return;
    }
    if (parsedDefaultSalePrice !== undefined && (isNaN(parsedDefaultSalePrice) || parsedDefaultSalePrice < 0)) {
        toast({ title: "Error", description: "Default sale price must be a valid non-negative number if entered.", variant: "destructive" }); return;
    }
    
    setIsSubmitting(true);
    const purchaseData: Omit<PurchaseEntry, 'id'> = {
      date,
      category: categoryNameInput.trim(),
      productName: productName.trim(),
      supplierName: supplierNameInput.trim(),
      quantity: parsedQuantity,
      unit: unit.trim(),
      pricePerUnit: parsedPrice,
      defaultSalePricePerUnit: parsedDefaultSalePrice,
      totalAmount: parsedQuantity * parsedPrice,
      paymentType,
    };

    let result;
    if (editingTransactionId) {
      result = await updatePurchaseEntryInFirestore(editingTransactionId, purchaseData);
      toast({ title: result.success ? "Success" : "Error", description: result.success ? "Purchase updated." : (result.error || "Failed to update purchase."), variant: result.success ? "default" : "destructive" });
    } else {
      result = await addPurchaseEntryToFirestore(purchaseData);
      toast({ title: result.success ? "Success" : "Error", description: result.success ? "Purchase recorded." : (result.error || "Failed to record purchase."), variant: result.success ? "default" : "destructive" });
    }

    if (result.success) {
      resetFormFields();
      await fetchPageData(); // Refetch all data
    }
    setIsSubmitting(false);
  };

  const handleEdit = (entry: PurchaseEntry) => {
    setEditingTransactionId(entry.id);
    setTransactionToEdit(entry);
    setDate(entry.date);
    setCategoryNameInput(entry.category);
    setProductName(entry.productName);
    setSupplierNameInput(entry.supplierName || "");
    setQuantity(String(entry.quantity));
    setUnit(entry.unit);
    setPricePerUnit(String(entry.pricePerUnit || ""));
    setDefaultSalePricePerUnitInput(String(entry.defaultSalePricePerUnit || ""));
    setPaymentType(entry.paymentType || "Credit");
  };

  const handleDeleteClick = (entry: PurchaseEntry) => {
    setTransactionToDelete(entry);
    setShowDeleteDialog(true);
  };

  const confirmDelete = async () => {
    if (!transactionToDelete) return;
    setIsSubmitting(true);
    const result = await deletePurchaseEntryFromFirestore(transactionToDelete.id);
    toast({ title: result.success ? "Success" : "Error", description: result.success ? "Purchase deleted." : (result.error || "Failed to delete purchase."), variant: result.success ? "default" : "destructive" });
    if (result.success) {
      await fetchPageData(); // Refetch all data
    }
    setShowDeleteDialog(false);
    setTransactionToDelete(null);
    setIsSubmitting(false);
  };

  return (
    <div>
      <PageHeader title={pageSpecificTitle} description="Track stock levels and record purchases of various items." />

      <Card className="mb-6">
        <CardHeader>
          <div className="flex flex-row items-center justify-between space-y-0 pb-1">
            <CardTitle>Current Stock by Product</CardTitle>
            <Warehouse className="h-6 w-6 text-primary" />
          </div>
          <CardDescription className="text-sm text-muted-foreground">
            Breakdown of available stock (purchases minus sales).
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-4">
          {isLoadingData && Object.keys(currentStockByProduct).length === 0 ? (
            <Skeleton className="h-20 w-full" />
          ) : Object.keys(currentStockByProduct).length === 0 && !isLoadingData ? (
            <p className="text-sm text-muted-foreground">No stock data available. Record a purchase to begin.</p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
              {Object.entries(currentStockByProduct)
                .sort(([keyA], [keyB]) => keyA.localeCompare(keyB)) // Sort by product name#unit
                .map(([productUnitKey, stockInfo]) => {
                  const [prodName, unitKey] = productUnitKey.split('#');
                  return (
                    <Card key={productUnitKey} className="shadow-sm">
                      <CardHeader className="flex flex-row items-center justify-between space-y-0 px-3 pt-3 pb-1">
                        <CardTitle className="text-sm font-medium text-muted-foreground truncate" title={prodName}>
                          {prodName}
                        </CardTitle>
                        <PackageSearch className="h-4 w-4 text-muted-foreground" />
                      </CardHeader>
                      <CardContent className="px-3 pt-1 pb-3">
                        <div className="text-xl font-bold text-foreground">
                          {stockInfo.quantity.toFixed(unitKey === "Ltr" || unitKey === "Kg" ? 1:0)}
                          <span className="text-base font-normal text-muted-foreground ml-1">{stockInfo.unit}</span>
                        </div>
                      </CardContent>
                    </Card>
                  );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle>{editingTransactionId ? "Edit Purchase" : "Record Purchase"}</CardTitle>
            <CardDescription>{editingTransactionId ? "Modify existing purchase details." : "Add a new purchase record."}</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handlePurchaseSubmit} className="space-y-4">
              <div>
                <Label htmlFor="purchaseDate" className="flex items-center mb-1">
                  <CalendarIcon className="h-4 w-4 mr-2 text-muted-foreground" /> Date
                </Label>
                <DatePicker date={date} setDate={setDate} />
              </div>
              
              <div>
                <Label htmlFor="categoryNameInput" className="flex items-center mb-1"><ListFilter className="h-4 w-4 mr-2 text-muted-foreground" />Category</Label>
                <Popover open={isCategoryPopoverOpen} onOpenChange={setIsCategoryPopoverOpen}>
                  <PopoverTrigger asChild>
                    <Input
                      id="categoryNameInput"
                      ref={categoryNameInputRef}
                      value={categoryNameInput}
                      onChange={(e) => handleCategoryNameInputChange(e.target.value)}
                      onFocus={() => {
                          if (categoryNameInput.trim() || existingCategorySuggestions.length > 0 || !isLoadingData) {
                              setIsCategoryPopoverOpen(true);
                          }
                      }}
                      placeholder="Type or select category"
                      autoComplete="off"
                      required
                      className="w-full text-left"
                    />
                  </PopoverTrigger>
                  <PopoverContent
                    className="w-[--radix-popover-trigger-width] p-0"
                    side="bottom"
                    align="start"
                    sideOffset={4}
                    onOpenAutoFocus={(e) => e.preventDefault()}
                  >
                    <Command>
                      <CommandInput
                        placeholder="Search or add new category..."
                        value={categoryNameInput}
                        onValueChange={handleCategoryNameInputChange}
                      />
                      <CommandList>
                        {isLoadingData && existingCategorySuggestions.length === 0 ? (
                            <CommandItem disabled>Loading categories...</CommandItem>
                        ) : (
                          <>
                            <CommandEmpty>
                              {existingCategorySuggestions.length === 0 && !categoryNameInput.trim() ? "No categories recorded. Type to add new." : "No categories match your search."}
                            </CommandEmpty>
                            <CommandGroup>
                              {categoryNameInput.trim() && !existingCategorySuggestions.some(cat => cat.toLowerCase() === categoryNameInput.trim().toLowerCase()) && (
                                <CommandItem
                                  key={`__CREATE_CATEGORY__${categoryNameInput.trim()}`}
                                  value={`__CREATE_CATEGORY__${categoryNameInput.trim()}`}
                                  onSelect={() => handleCategorySelect(`__CREATE_CATEGORY__${categoryNameInput.trim()}`)}
                                >
                                  <PlusCircle className="mr-2 h-4 w-4" />
                                  Add new category: "{categoryNameInput.trim()}"
                                </CommandItem>
                              )}
                              {existingCategorySuggestions
                                .filter(name => name.toLowerCase().includes(categoryNameInput.toLowerCase()))
                                .map((name) => (
                                  <CommandItem
                                    key={name}
                                    value={name}
                                    onSelect={() => handleCategorySelect(name)}
                                  >
                                    {name}
                                  </CommandItem>
                                ))}
                            </CommandGroup>
                          </>
                        )}
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
              </div>

              <div>
                <Label htmlFor="productNameInput" className="flex items-center mb-1"><Tag className="h-4 w-4 mr-2 text-muted-foreground" />Product Name</Label>
                <Popover open={isProductPopoverOpen} onOpenChange={setIsProductPopoverOpen}>
                  <PopoverTrigger asChild>
                    <Input
                      id="productNameInput"
                      ref={productNameInputRef}
                      value={productName}
                      onChange={(e) => handleProductNameInputChange(e.target.value)}
                      onFocus={() => {
                        if (productName.trim() || productNameSuggestions.length > 0 || !isLoadingData) {
                          setIsProductPopoverOpen(true);
                        }
                      }}
                      placeholder="Type or select product"
                      autoComplete="off"
                      required
                      className="w-full text-left"
                    />
                  </PopoverTrigger>
                  <PopoverContent
                    className="w-[--radix-popover-trigger-width] p-0"
                    side="bottom"
                    align="start"
                    sideOffset={4}
                    onOpenAutoFocus={(e) => e.preventDefault()}
                  >
                    <Command>
                      <CommandInput
                        placeholder="Search or add new product..."
                        value={productName}
                        onValueChange={handleProductNameInputChange}
                      />
                      <CommandList>
                        {isLoadingData && productNameSuggestions.length === 0 ? (
                          <CommandItem disabled>Loading products...</CommandItem>
                        ) : (
                          <>
                            <CommandEmpty>
                              {productNameSuggestions.length === 0 && !productName.trim() ? "No products recorded. Type to add new." : "No products match your search."}
                            </CommandEmpty>
                            <CommandGroup>
                              {productName.trim() && !productNameSuggestions.some(p => p.toLowerCase() === productName.trim().toLowerCase()) && (
                                <CommandItem
                                  key={`__CREATE_PRODUCT__${productName.trim()}`}
                                  value={`__CREATE_PRODUCT__${productName.trim()}`}
                                  onSelect={() => handleProductSelect(`__CREATE_PRODUCT__${productName.trim()}`)}
                                >
                                  <PlusCircle className="mr-2 h-4 w-4" />
                                  Add new product: "{productName.trim()}"
                                </CommandItem>
                              )}
                              {productNameSuggestions
                                .filter(name => name.toLowerCase().includes(productName.toLowerCase()))
                                .map((name) => (
                                  <CommandItem
                                    key={name}
                                    value={name}
                                    onSelect={() => handleProductSelect(name)}
                                  >
                                    {name}
                                  </CommandItem>
                                ))}
                            </CommandGroup>
                          </>
                        )}
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
              </div>

              <div>
                <Label htmlFor="supplierNameInput" className="flex items-center mb-1">
                  <User className="h-4 w-4 mr-2 text-muted-foreground" /> Supplier Name
                </Label>
                <Popover open={isSupplierPopoverOpen} onOpenChange={setIsSupplierPopoverOpen}>
                  <PopoverTrigger asChild>
                    <Input
                      id="supplierNameInput"
                      ref={supplierNameInputRef}
                      value={supplierNameInput}
                      onChange={(e) => handleSupplierNameInputChange(e.target.value)}
                      onFocus={() => {
                        if (supplierNameInput.trim() || availableSuppliers.length > 0 || isLoadingParties) {
                          setIsSupplierPopoverOpen(true);
                        }
                      }}
                      placeholder="Start typing supplier name"
                      autoComplete="off"
                      required
                      className="w-full text-left"
                    />
                  </PopoverTrigger>
                  <PopoverContent
                    className="w-[--radix-popover-trigger-width] p-0"
                    side="bottom"
                    align="start"
                    sideOffset={4}
                    onOpenAutoFocus={(e) => e.preventDefault()}
                  >
                    <Command>
                      <CommandInput
                        placeholder="Search or add new supplier..."
                        value={supplierNameInput}
                        onValueChange={handleSupplierNameInputChange}
                      />
                      <CommandList>
                        {isLoadingParties ? (
                          <CommandItem disabled>Loading suppliers...</CommandItem>
                        ) : (
                          <>
                            <CommandGroup>
                              {supplierNameInput.trim() && !availableSuppliers.some(s => s.toLowerCase() === supplierNameInput.trim().toLowerCase()) && (
                                <CommandItem
                                  key={`__CREATE_SUPPLIER__${supplierNameInput.trim()}`}
                                  value={`__CREATE_SUPPLIER__${supplierNameInput.trim()}`}
                                  onSelect={() => handleSupplierSelect(`__CREATE_SUPPLIER__${supplierNameInput.trim()}`)}
                                >
                                  <PlusCircle className="mr-2 h-4 w-4" />
                                  Add new supplier: "{supplierNameInput.trim()}"
                                </CommandItem>
                              )}
                              {availableSuppliers
                                .filter(name => name.toLowerCase().includes(supplierNameInput.toLowerCase()))
                                .map((name) => (
                                  <CommandItem
                                    key={name}
                                    value={name}
                                    onSelect={() => handleSupplierSelect(name)}
                                  >
                                    {name}
                                  </CommandItem>
                                ))}
                              <CommandEmpty>
                                {availableSuppliers.length === 0 && !supplierNameInput.trim() ? "No suppliers found. Type to add." : "No suppliers match your search."}
                              </CommandEmpty>
                            </CommandGroup>
                          </>
                        )}
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
              </div>

              <div className="grid grid-cols-2 gap-4">
                 <div>
                  <Label htmlFor="purchaseQuantity" className="flex items-center mb-1"><Warehouse className="h-4 w-4 mr-2 text-muted-foreground" />Quantity</Label>
                  <Input id="purchaseQuantity" type="text" inputMode="decimal" value={quantity} onChange={(e) => setQuantity(e.target.value)} placeholder="e.g., 10" required />
                </div>
                <div>
                  <Label htmlFor="unit" className="flex items-center mb-1"> Unit</Label>
                  <Input id="unit" type="text" value={unit} onChange={(e) => setUnit(e.target.value)} placeholder="e.g., Bags, Kg, Ltr" required />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="purchasePrice" className="flex items-center mb-1"><IndianRupee className="h-4 w-4 mr-1 text-muted-foreground" />Price/Unit (₹)</Label>
                  <Input id="purchasePrice" type="text" inputMode="decimal" value={pricePerUnit} onChange={(e) => setPricePerUnit(e.target.value)} placeholder="e.g., 300" required />
                </div>
                <div>
                    <Label htmlFor="defaultSalePricePerUnit" className="flex items-center mb-1"><IndianRupee className="h-4 w-4 mr-1 text-muted-foreground" />Sale Price/Unit <span className="text-xs text-muted-foreground ml-1">(Optional)</span></Label>
                    <Input id="defaultSalePricePerUnit" type="text" inputMode="decimal" value={defaultSalePricePerUnitInput} onChange={(e) => setDefaultSalePricePerUnitInput(e.target.value)} placeholder="e.g., 350" />
                </div>
              </div>
              <div>
                <Label htmlFor="paymentType" className="flex items-center mb-1"><CreditCard className="h-4 w-4 mr-2 text-muted-foreground" />Payment Type</Label>
                <Select value={paymentType} onValueChange={(value: "Cash" | "Credit") => setPaymentType(value)}>
                <SelectTrigger id="paymentType">
                    <SelectValue placeholder="Select payment type" />
                </SelectTrigger>
                <SelectContent>
                    <SelectItem value="Cash">Cash</SelectItem>
                    <SelectItem value="Credit">Credit</SelectItem>
                </SelectContent>
                </Select>
              </div>


              <Button type="submit" className="w-full" disabled={isSubmitting || isLoadingData || isLoadingParties}>
                {editingTransactionId ? <Edit className="h-4 w-4 mr-2" /> : <PlusCircle className="h-4 w-4 mr-2" />}
                {isSubmitting && !editingTransactionId ? 'Recording...' : (isSubmitting && editingTransactionId ? 'Updating...' : (editingTransactionId ? 'Update Purchase' : 'Record Purchase'))}
              </Button>
              {editingTransactionId && (
                <Button type="button" variant="outline" className="w-full mt-2" onClick={resetFormFields} disabled={isSubmitting}>
                  Cancel Edit
                </Button>
              )}
            </form>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Purchase History</CardTitle>
            <CardDescription>List of all recorded purchases.</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoadingData && purchaseEntries.length === 0 ? (
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
                    <TableHead>Product</TableHead>
                    <TableHead>Supplier</TableHead>
                    <TableHead className="text-right">Qty</TableHead>
                    <TableHead className="text-right">Unit</TableHead>
                    <TableHead className="text-right">Price/Unit (₹)</TableHead>
                    <TableHead className="text-right">Sale Price/Unit</TableHead>
                    <TableHead className="text-right">Total (₹)</TableHead>
                    <TableHead>Payment</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {purchaseEntries.length === 0 && !isLoadingData ? (
                    <TableRow>
                      <TableCell colSpan={11} className="text-center text-muted-foreground">No purchases recorded yet.</TableCell>
                    </TableRow>
                  ) : (
                    purchaseEntries.map((entry) => (
                      <TableRow key={entry.id}>
                        <TableCell>{entry.date instanceof Date && !isNaN(entry.date.getTime()) ? format(entry.date, 'P') : 'Invalid Date'}</TableCell>
                        <TableCell>{entry.category}</TableCell>
                        <TableCell>{entry.productName}</TableCell>
                        <TableCell>{entry.supplierName || "-"}</TableCell>
                        <TableCell className="text-right">{entry.quantity.toFixed(entry.unit === "Ltr" || entry.unit === "Kg" ? 1:0)}</TableCell>
                        <TableCell className="text-right">{entry.unit}</TableCell>
                        <TableCell className="text-right">{entry.pricePerUnit ? entry.pricePerUnit.toFixed(2) : "-"}</TableCell>
                        <TableCell className="text-right">{entry.defaultSalePricePerUnit ? entry.defaultSalePricePerUnit.toFixed(2) : "-"}</TableCell>
                        <TableCell className="text-right">{entry.totalAmount.toFixed(2)}</TableCell>
                        <TableCell>{entry.paymentType}</TableCell>
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
                {purchaseEntries.length > 0 && (
                  <TableFooter>
                    <TableRow>
                      <TableCell colSpan={8} className="text-right font-semibold">Total Purchase Value:</TableCell>
                      <TableCell className="text-right font-bold">{totalPurchaseAmount.toFixed(2)}</TableCell>
                      <TableCell colSpan={2} />
                    </TableRow>
                  </TableFooter>
                )}
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
      {showDeleteDialog && transactionToDelete && (
        <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Are you sure?</AlertDialogTitle>
              <AlertDialogDescription>
                This action cannot be undone. This will permanently delete the purchase for
                "{transactionToDelete.productName}" ({transactionToDelete.category}) on {transactionToDelete.date instanceof Date && !isNaN(transactionToDelete.date.getTime()) ? format(transactionToDelete.date, 'P') : 'Invalid Date'}.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel onClick={() => { setShowDeleteDialog(false); setTransactionToDelete(null); }}>Cancel</AlertDialogCancel>
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

    