
"use client";

import { useState, type FormEvent, useEffect, useCallback, useMemo, useRef } from "react";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { Package, Warehouse, IndianRupee, User, PlusCircle, Tag, CalendarIcon, MoreHorizontal, Edit, Trash2 } from "lucide-react";
import type { PashuAaharTransaction, Party } from "@/lib/types";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import { Skeleton } from "@/components/ui/skeleton";
import { addPashuAaharTransactionToFirestore, getPashuAaharTransactionsFromFirestore, updatePashuAaharTransactionInFirestore, deletePashuAaharTransactionFromFirestore } from "./actions";
import { getPartiesFromFirestore, addPartyToFirestore } from "../parties/actions";
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

export default function PashuAaharPage() {
  const { setPageTitle } = usePageTitle();
  const pageSpecificTitle = "Pashu Aahar Stock";

  useEffect(() => {
    setPageTitle(pageSpecificTitle);
  }, [setPageTitle, pageSpecificTitle]);

  const { toast } = useToast();
  const [transactions, setTransactions] = useState<PashuAaharTransaction[]>([]);
  const [isLoadingTransactions, setIsLoadingTransactions] = useState(true);
  const [currentStockByProduct, setCurrentStockByProduct] = useState<Record<string, number>>({});

  const [date, setDate] = useState<Date | undefined>(undefined);
  const [productName, setProductName] = useState("");
  
  const [supplierNameInput, setSupplierNameInput] = useState<string>(""); 
  const [isSupplierPopoverOpen, setIsSupplierPopoverOpen] = useState(false);
  const supplierNameInputRef = useRef<HTMLInputElement>(null);
  const [availableParties, setAvailableParties] = useState<Party[]>([]);
  const [isLoadingParties, setIsLoadingParties] = useState(true);

  const [quantityBags, setQuantityBags] = useState("");
  const [pricePerBag, setPricePerBag] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [editingTransactionId, setEditingTransactionId] = useState<string | null>(null);
  const [transactionToEdit, setTransactionToEdit] = useState<PashuAaharTransaction | null>(null);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [transactionToDelete, setTransactionToDelete] = useState<PashuAaharTransaction | null>(null);

  const fetchParties = useCallback(async () => {
    setIsLoadingParties(true);
    try {
      const parties = await getPartiesFromFirestore();
      setAvailableParties(parties);
    } catch (error) {
      console.error("CLIENT: Failed to fetch parties for Pashu Aahar:", error);
      toast({ title: "Error", description: "Could not fetch parties for supplier suggestions.", variant: "destructive" });
    } finally {
      setIsLoadingParties(false);
    }
  }, [toast]);

  const fetchTransactions = useCallback(async () => {
    setIsLoadingTransactions(true);
    try {
      const fetchedTransactions = await getPashuAaharTransactionsFromFirestore();
      const processedTransactions = fetchedTransactions.map(tx => ({
        ...tx,
        date: tx.date instanceof Date ? tx.date : new Date(tx.date)
      })).sort((a, b) => b.date.getTime() - a.date.getTime());
      setTransactions(processedTransactions);
    } catch (error) {
      console.error("CLIENT: Failed to fetch Pashu Aahar transactions:", error);
      toast({ title: "Error", description: "Could not fetch transactions.", variant: "destructive" });
    } finally {
      setIsLoadingTransactions(false);
    }
  }, [toast]);

  useEffect(() => {
    if (!editingTransactionId && !date) { 
        setDate(new Date());
    }
    fetchTransactions();
    fetchParties();
  }, [fetchTransactions, fetchParties, editingTransactionId, date]);

  useEffect(() => {
    const stockCalc: Record<string, number> = {};
    const sortedTransactionsForStock = [...transactions].sort((a, b) => a.date.getTime() - b.date.getTime());

    sortedTransactionsForStock.forEach(tx => {
      const pName = tx.productName.trim();
      if (!stockCalc[pName]) {
        stockCalc[pName] = 0;
      }
      if (tx.type === "Purchase") {
        stockCalc[pName] += tx.quantityBags;
      } else if (tx.type === "Sale") {
         // If sales are tracked in this module, decrement stock here.
         // For now, assuming sales transactions are not directly managed for stock decrement in this particular module's transaction list
         // stockCalc[pName] -= tx.quantityBags; 
      }
    });
    setCurrentStockByProduct(stockCalc);
  }, [transactions]);

  const totalTransactionAmount = useMemo(() => {
    return transactions.reduce((sum, tx) => sum + tx.totalAmount, 0);
  }, [transactions]);

  const resetFormFields = useCallback(() => {
    if (!editingTransactionId) setDate(new Date()); // Only reset date if not editing
    setProductName("");
    setSupplierNameInput("");
    setQuantityBags("");
    setPricePerBag("");
    setEditingTransactionId(null);
    setTransactionToEdit(null);
    setIsSupplierPopoverOpen(false);
  }, [editingTransactionId]);

  const availableSuppliers = useMemo(() => {
    return availableParties.filter(p => p.type === "Supplier");
  }, [availableParties]);

  const filteredSupplierSuggestions = useMemo(() => {
    if (!supplierNameInput.trim()) return availableSuppliers.map(s => s.name);
    return availableSuppliers
      .filter((supplier) =>
        supplier.name.toLowerCase().includes(supplierNameInput.toLowerCase())
      )
      .map(s => s.name);
  }, [supplierNameInput, availableSuppliers]);

  const handleSupplierNameInputChange = useCallback((value: string) => {
    setSupplierNameInput(value);
    if (value.trim() && availableSuppliers.length > 0) {
      setIsSupplierPopoverOpen(true);
    } else {
      setIsSupplierPopoverOpen(false);
    }
  }, [availableSuppliers]);

  const handleSupplierSelect = useCallback(async (currentValue: string, isCreateNew = false) => {
    const trimmedValue = currentValue.trim();
    if (isCreateNew) {
      if (!trimmedValue) {
        toast({ title: "Error", description: "Supplier name cannot be empty.", variant: "destructive" });
        setIsSupplierPopoverOpen(false);
        return;
      }
      setIsSubmitting(true); 
      const result = await addPartyToFirestore({ name: trimmedValue, type: "Supplier" });
      if (result.success && result.id) {
        setSupplierNameInput(trimmedValue);
        toast({ title: "Success", description: `Supplier "${trimmedValue}" added.` });
        await fetchParties(); 
      } else {
        toast({ title: "Error", description: result.error || "Failed to add supplier.", variant: "destructive" });
      }
      setIsSubmitting(false);
    } else {
      setSupplierNameInput(trimmedValue);
    }
    setIsSupplierPopoverOpen(false);
    supplierNameInputRef.current?.focus();
  }, [toast, fetchParties]);


  const handlePurchaseSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!date || !productName.trim() || !supplierNameInput.trim() || !quantityBags || !pricePerBag) {
      toast({ title: "Error", description: "Please fill all purchase fields.", variant: "destructive" });
      return;
    }
    const parsedQuantityBags = parseInt(quantityBags);
    const parsedPricePerBag = parseFloat(pricePerBag);

    if (isNaN(parsedQuantityBags) || parsedQuantityBags <= 0) {
      toast({ title: "Error", description: "Quantity must be a positive number.", variant: "destructive" });
      return;
    }
    if (isNaN(parsedPricePerBag) || parsedPricePerBag <= 0) {
      toast({ title: "Error", description: "Price per bag must be a positive number.", variant: "destructive" });
      return;
    }

    setIsSubmitting(true);
    const transactionType = editingTransactionId && transactionToEdit ? transactionToEdit.type : "Purchase";

    const transactionData: Omit<PashuAaharTransaction, 'id'> = {
      date,
      type: transactionType,
      productName: productName.trim(),
      supplierOrCustomerName: supplierNameInput.trim(),
      quantityBags: parsedQuantityBags,
      pricePerBag: parsedPricePerBag,
      totalAmount: parsedQuantityBags * parsedPricePerBag,
    };

    let result;
    if (editingTransactionId) {
      result = await updatePashuAaharTransactionInFirestore(editingTransactionId, transactionData);
      toast({ title: result.success ? "Success" : "Error", description: result.success ? "Transaction updated." : (result.error || "Failed to update transaction."), variant: result.success ? "default" : "destructive"});
    } else {
      result = await addPashuAaharTransactionToFirestore(transactionData);
      toast({ title: result.success ? "Success" : "Error", description: result.success ? "Pashu Aahar purchase recorded." : (result.error || "Failed to record purchase."), variant: result.success ? "default" : "destructive"});
    }
    
    if (result.success) {
      resetFormFields();
      await fetchTransactions(); 
    }
    setIsSubmitting(false);
  };
  
  const handleEdit = (transaction: PashuAaharTransaction) => {
    setEditingTransactionId(transaction.id);
    setTransactionToEdit(transaction);
    setDate(transaction.date);
    setProductName(transaction.productName);
    setSupplierNameInput(transaction.supplierOrCustomerName || ""); 
    setQuantityBags(String(transaction.quantityBags));
    setPricePerBag(String(transaction.pricePerBag || ""));
  };

  const handleDeleteClick = (transaction: PashuAaharTransaction) => {
    setTransactionToDelete(transaction);
    setShowDeleteDialog(true);
  };

  const confirmDelete = async () => {
    if (!transactionToDelete) return;
    setIsSubmitting(true);
    const result = await deletePashuAaharTransactionFromFirestore(transactionToDelete.id);
    toast({ title: result.success ? "Success" : "Error", description: result.success ? "Transaction deleted." : (result.error || "Failed to delete transaction."), variant: result.success ? "default" : "destructive"});
    if (result.success) {
      await fetchTransactions();
    }
    setShowDeleteDialog(false);
    setTransactionToDelete(null);
    setIsSubmitting(false);
  };

  return (
    <div>
      <PageHeader title={pageSpecificTitle} description="Track stock levels and record purchases in bags." />
      
      <Card className="mb-6">
        <CardHeader>
          <div className="flex flex-row items-center justify-between space-y-0 pb-1">
            <CardTitle>Current Stock by Product</CardTitle>
            <Warehouse className="h-6 w-6 text-primary" />
          </div>
          <CardDescription className="text-sm text-muted-foreground">
            Breakdown of available Pashu Aahar stock (based on purchases).
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-4">
          {isLoadingTransactions && Object.keys(currentStockByProduct).length === 0 ? (
             <Skeleton className="h-20 w-full" />
          ) : Object.keys(currentStockByProduct).length === 0 && !isLoadingTransactions ? (
            <p className="text-sm text-muted-foreground">No stock data available. Record a purchase to begin.</p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
              {Object.entries(currentStockByProduct).map(([prodName, stock]) => (
                <Card key={prodName} className="shadow-sm">
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 px-3 pt-3 pb-1">
                    <CardTitle className="text-sm font-medium text-muted-foreground truncate" title={prodName}>
                      {prodName}
                    </CardTitle>
                    <Package className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent className="px-3 pt-1 pb-3">
                    <div className="text-2xl font-bold text-foreground">
                      {stock.toFixed(0)}
                      <span className="text-base font-normal text-muted-foreground ml-1">Bags</span>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>{editingTransactionId ? "Edit Purchase" : "Record Purchase"}</CardTitle>
            <CardDescription>{editingTransactionId ? "Modify the details of the existing purchase." : "Add new Pashu Aahar purchase to stock."}</CardDescription>
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
                <Label htmlFor="productName" className="flex items-center mb-1"><Tag className="h-4 w-4 mr-2 text-muted-foreground" />Product Name</Label>
                <Input id="productName" value={productName} onChange={(e) => setProductName(e.target.value)} placeholder="e.g., Gold Coin, Super Pallet" required />
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
                        if (supplierNameInput.trim() && filteredSupplierSuggestions.length > 0) {
                           setIsSupplierPopoverOpen(true);
                        } else if (!supplierNameInput.trim() && availableSuppliers.length > 0){
                           setIsSupplierPopoverOpen(true); // Open if input is empty but suggestions exist
                        }
                      }}
                      placeholder="Start typing supplier name"
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
                        placeholder="Search or add new supplier..." 
                        value={supplierNameInput} 
                        onValueChange={handleSupplierNameInputChange} // Ensures main input state syncs
                       />
                      <CommandList>
                        {isLoadingParties ? (
                           <CommandItem disabled>Loading suppliers...</CommandItem>
                        ) : (
                          <>
                            {supplierNameInput.trim() && !availableSuppliers.some(s => s.name.toLowerCase() === supplierNameInput.trim().toLowerCase()) && (
                               <CommandItem
                                key={`__CREATE__${supplierNameInput.trim()}`}
                                value={`__CREATE__${supplierNameInput.trim()}`}
                                onSelect={() => handleSupplierSelect(supplierNameInput.trim(), true)}
                              >
                                <PlusCircle className="mr-2 h-4 w-4" />
                                Add new supplier: "{supplierNameInput.trim()}"
                              </CommandItem>
                            )}
                            {filteredSupplierSuggestions.map((name) => (
                              <CommandItem
                                key={name}
                                value={name}
                                onSelect={() => handleSupplierSelect(name, false)}
                              >
                                {name}
                              </CommandItem>
                            ))}
                             {filteredSupplierSuggestions.length === 0 && supplierNameInput.trim() && !availableSuppliers.some(name => name.toLowerCase() === supplierNameInput.trim().toLowerCase()) && ( // Condition to only show "No existing..." if create new is not shown
                                <CommandEmpty>No existing suppliers match. Select "Add new..." above if needed.</CommandEmpty>
                             )}
                             {availableSuppliers.length === 0 && !supplierNameInput.trim() && (
                                <CommandEmpty>No suppliers found. Type to add a new one.</CommandEmpty>
                             )}
                          </>
                        )}
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="purchaseQuantity" className="flex items-center mb-1"><Package className="h-4 w-4 mr-2 text-muted-foreground" />Quantity (Bags)</Label>
                  <Input id="purchaseQuantity" type="number" step="1" value={quantityBags} onChange={(e) => setQuantityBags(e.target.value)} placeholder="e.g., 10" required />
                </div>
                <div>
                  <Label htmlFor="purchasePrice" className="flex items-center mb-1"><IndianRupee className="h-4 w-4 mr-1 text-muted-foreground" />Price/Bag (₹)</Label>
                  <Input id="purchasePrice" type="number" step="0.01" value={pricePerBag} onChange={(e) => setPricePerBag(e.target.value)} placeholder="e.g., 300" required />
                </div>
              </div>
              <Button type="submit" className="w-full" disabled={isSubmitting || isLoadingTransactions || isLoadingParties}>
                {editingTransactionId ? <Edit className="h-4 w-4 mr-2" /> : <PlusCircle className="h-4 w-4 mr-2" />}
                {isSubmitting && !editingTransactionId ? 'Recording Purchase...' : (isSubmitting && editingTransactionId ? 'Updating Purchase...' : (editingTransactionId ? 'Update Purchase' : 'Record Purchase'))}
              </Button>
              {editingTransactionId && (
                <Button type="button" variant="outline" className="w-full mt-2" onClick={resetFormFields} disabled={isSubmitting}>
                  Cancel Edit
                </Button>
              )}
            </form>
          </CardContent>
        </Card>

        <Card className="md:col-span-1"> 
          <CardHeader>
            <CardTitle>Transaction History</CardTitle>
            <CardDescription>Pashu Aahar purchases.</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoadingTransactions && transactions.length === 0 ? (
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
                  <TableHead>Type</TableHead>
                  <TableHead>Product</TableHead>
                  <TableHead>Party</TableHead>
                  <TableHead className="text-right">Qty</TableHead>
                  <TableHead className="text-right">Price/Bag (₹)</TableHead>
                  <TableHead className="text-right">Total (₹)</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {transactions.length === 0 && !isLoadingTransactions ? (
                    <TableRow>
                        <TableCell colSpan={8} className="text-center text-muted-foreground">No transactions recorded yet.</TableCell>
                    </TableRow>
                ) : (
                    transactions.map((tx) => (
                    <TableRow key={tx.id}>
                        <TableCell>{tx.date instanceof Date && !isNaN(tx.date.getTime()) ? format(tx.date, 'P') : 'Invalid Date'}</TableCell>
                        <TableCell>
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${tx.type === "Purchase" ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200" : "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200"}`}>
                            {tx.type}
                        </span>
                        </TableCell>
                        <TableCell>{tx.productName}</TableCell>
                        <TableCell>{tx.supplierOrCustomerName || "-"}</TableCell>
                        <TableCell className="text-right">{tx.quantityBags.toFixed(0)}</TableCell>
                        <TableCell className="text-right">{tx.pricePerBag ? tx.pricePerBag.toFixed(2) : "-"}</TableCell>
                        <TableCell className="text-right">{tx.totalAmount.toFixed(2)}</TableCell>
                        <TableCell className="text-right">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-8 w-8">
                                <MoreHorizontal className="h-4 w-4" />
                                <span className="sr-only">Actions</span>
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onSelect={() => handleEdit(tx)}>
                                <Edit className="mr-2 h-4 w-4" /> Edit
                              </DropdownMenuItem>
                              <DropdownMenuItem onSelect={() => handleDeleteClick(tx)} className="text-destructive focus:text-destructive focus:bg-destructive/10">
                                <Trash2 className="mr-2 h-4 w-4" /> Delete
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                    </TableRow>
                    ))
                )}
              </TableBody>
              {transactions.length > 0 && (
                <TableFooter>
                  <TableRow>
                    <TableCell colSpan={6} className="text-right font-semibold">Total Transaction Value:</TableCell>
                    <TableCell className="text-right font-bold">{totalTransactionAmount.toFixed(2)}</TableCell>
                    <TableCell /> 
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
                This action cannot be undone. This will permanently delete the transaction for
                "{transactionToDelete.productName}" ({transactionToDelete.type}) on {transactionToDelete.date instanceof Date && !isNaN(transactionToDelete.date.getTime()) ? format(transactionToDelete.date, 'P') : 'Invalid Date'}.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel onClick={() => {setShowDeleteDialog(false); setTransactionToDelete(null);}}>Cancel</AlertDialogCancel>
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
