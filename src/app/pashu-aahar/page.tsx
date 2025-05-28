
"use client";

import { useState, type FormEvent, useEffect, useCallback } from "react";
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
} from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { DatePicker } from "@/components/ui/date-picker";
import { Package, Warehouse, IndianRupee, User, PlusCircle, Tag, CalendarIcon } from "lucide-react";
import type { PashuAaharTransaction } from "@/lib/types";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import { Skeleton } from "@/components/ui/skeleton";
import { addPashuAaharTransactionToFirestore, getPashuAaharTransactionsFromFirestore } from "./actions";

export default function PashuAaharPage() {
  const { toast } = useToast();
  const [transactions, setTransactions] = useState<PashuAaharTransaction[]>([]);
  const [isLoadingTransactions, setIsLoadingTransactions] = useState(true);
  const [currentStockByProduct, setCurrentStockByProduct] = useState<Record<string, number>>({});

  const [date, setDate] = useState<Date | undefined>(undefined);
  const [productName, setProductName] = useState("");
  const [supplierName, setSupplierName] = useState("");
  const [quantityBags, setQuantityBags] = useState("");
  const [pricePerBag, setPricePerBag] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fetchTransactions = useCallback(async () => {
    setIsLoadingTransactions(true);
    try {
      const fetchedTransactions = await getPashuAaharTransactionsFromFirestore();
      setTransactions(fetchedTransactions);
    } catch (error) {
      console.error("Failed to fetch Pashu Aahar transactions:", error);
      toast({ title: "Error", description: "Could not fetch transactions.", variant: "destructive" });
    } finally {
      setIsLoadingTransactions(false);
    }
  }, [toast]);

  useEffect(() => {
    setDate(new Date()); // Initialize date client-side
    fetchTransactions();
  }, [fetchTransactions]);

  useEffect(() => {
    const stockCalc: Record<string, number> = {};
    // Sort transactions chronologically for accurate stock calculation
    const sortedTransactionsForStock = [...transactions].sort((a, b) => a.date.getTime() - b.date.getTime());

    sortedTransactionsForStock.forEach(tx => {
      const pName = tx.productName.trim();
      if (!stockCalc[pName]) {
        stockCalc[pName] = 0;
      }
      if (tx.type === "Purchase") {
        stockCalc[pName] += tx.quantityBags;
      } else if (tx.type === "Sale") {
        // Assuming sales also update stock (though sales form is separate)
        // For now, this means sales recorded elsewhere should also be PashuAaharTransaction type
        stockCalc[pName] = Math.max(0, stockCalc[pName] - tx.quantityBags);
      }
    });
    setCurrentStockByProduct(stockCalc);
  }, [transactions]);


  const handlePurchaseSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!date || !productName.trim() || !supplierName.trim() || !quantityBags || !pricePerBag) {
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
    const newTransactionData: Omit<PashuAaharTransaction, 'id'> = {
      date,
      type: "Purchase",
      productName: productName.trim(),
      supplierOrCustomerName: supplierName.trim(),
      quantityBags: parsedQuantityBags,
      pricePerBag: parsedPricePerBag,
      totalAmount: parsedQuantityBags * parsedPricePerBag,
    };

    const result = await addPashuAaharTransactionToFirestore(newTransactionData);
    
    if (result.success) {
      toast({ title: "Success", description: "Pashu Aahar purchase recorded." });
      await fetchTransactions(); // Re-fetch to update list and stock
      
      setProductName("");
      setSupplierName("");
      setQuantityBags("");
      setPricePerBag("");
      setDate(new Date()); 
    } else {
      toast({ title: "Error", description: result.error || "Failed to record purchase.", variant: "destructive" });
    }
    setIsSubmitting(false);
  };
  
  return (
    <div>
      <PageHeader title="Pashu Aahar Stock" description="Track stock levels and record purchases in bags." />
      
      <Card className="mb-6">
        <CardHeader>
          <div className="flex flex-row items-center justify-between space-y-0 pb-1">
            <CardTitle className="text-lg font-semibold">Current Stock by Product</CardTitle>
            <Warehouse className="h-6 w-6 text-primary" />
          </div>
          <CardDescription className="text-sm text-muted-foreground">
            Breakdown of available Pashu Aahar stock.
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
            <CardTitle>Record Purchase</CardTitle>
            <CardDescription>Add new Pashu Aahar purchase to stock.</CardDescription>
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
                <Label htmlFor="supplierName" className="flex items-center mb-1"><User className="h-4 w-4 mr-2 text-muted-foreground" />Supplier Name</Label>
                <Input id="supplierName" value={supplierName} onChange={(e) => setSupplierName(e.target.value)} placeholder="Supplier" required />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="purchaseQuantity" className="flex items-center mb-1"><Package className="h-4 w-4 mr-2 text-muted-foreground" />Quantity (Bags)</Label>
                  <Input id="purchaseQuantity" type="number" step="1" value={quantityBags} onChange={(e) => setQuantityBags(e.target.value)} placeholder="e.g., 10" required />
                </div>
                <div>
                  <Label htmlFor="purchasePrice" className="flex items-center mb-1"><IndianRupee className="h-4 w-4 mr-1 text-muted-foreground" />Price/Bag</Label>
                  <Input id="purchasePrice" type="number" step="0.01" value={pricePerBag} onChange={(e) => setPricePerBag(e.target.value)} placeholder="e.g., 300" required />
                </div>
              </div>
              <Button type="submit" className="w-full" disabled={isSubmitting || isLoadingTransactions}>
                <PlusCircle className="h-4 w-4 mr-2" /> {isSubmitting ? 'Adding...' : 'Add Purchase'}
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card className="md:col-span-1"> {/* Changed from lg:col-span-2 to md:col-span-1 to balance the layout */}
          <CardHeader>
            <CardTitle>Transaction History</CardTitle>
            <CardDescription>Pashu Aahar purchases and sales affecting stock.</CardDescription>
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
                  <TableHead>Product</TableHead> {/* Simplified from Product Name */}
                  <TableHead>Party</TableHead> {/* Simplified from Supplier/Customer */}
                  <TableHead className="text-right">Qty</TableHead> {/* Simplified */}
                  <TableHead className="text-right">Price/Bag</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {transactions.length === 0 && !isLoadingTransactions ? (
                    <TableRow>
                        <TableCell colSpan={7} className="text-center text-muted-foreground">No transactions recorded yet.</TableCell>
                    </TableRow>
                ) : (
                    transactions.map((tx) => (
                    <TableRow key={tx.id}>
                        <TableCell>{format(tx.date, 'P')}</TableCell>
                        <TableCell>
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${tx.type === "Purchase" ? "bg-chart-3/20 text-chart-3" : "bg-chart-4/20 text-chart-4"}`}>
                            {tx.type}
                        </span>
                        </TableCell>
                        <TableCell>{tx.productName}</TableCell>
                        <TableCell>{tx.supplierOrCustomerName || "-"}</TableCell>
                        <TableCell className="text-right">{tx.quantityBags.toFixed(0)}</TableCell>
                        <TableCell className="text-right">{tx.pricePerBag ? tx.pricePerBag.toFixed(2) : "-"}</TableCell>
                        <TableCell className="text-right">{tx.totalAmount.toFixed(2)}</TableCell>
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
