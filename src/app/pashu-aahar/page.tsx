
"use client";

import { useState, type FormEvent, useEffect } from "react";
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
import { Package, Warehouse, ShoppingCart, IndianRupee, User, PlusCircle } from "lucide-react";
import type { PashuAaharTransaction } from "@/lib/types";

const initialStock = 500; // kg
const initialTransactions: PashuAaharTransaction[] = [
  { id: "1", date: new Date(Date.now() - 86400000 * 2), type: "Purchase", supplierOrCustomerName: "Shakti Feeds", quantityKg: 200, purchasePricePerKg: 30, totalAmount: 6000 },
  { id: "2", date: new Date(Date.now() - 86400000 * 1), type: "Sale", supplierOrCustomerName: "Ramesh Bhai", quantityKg: 50, salePricePerKg: 35, totalAmount: 1750 },
];

export default function PashuAaharPage() {
  const [transactions, setTransactions] = useState<PashuAaharTransaction[]>(initialTransactions);
  const [currentStock, setCurrentStock] = useState(initialStock);

  const [date, setDate] = useState<Date | undefined>(new Date());
  const [supplierName, setSupplierName] = useState("");
  const [quantityKg, setQuantityKg] = useState("");
  const [purchasePrice, setPurchasePrice] = useState("");

  useEffect(() => {
    const newStock = initialTransactions.reduce((stock, tx) => {
      if (tx.type === "Purchase") return stock + tx.quantityKg;
      if (tx.type === "Sale") return stock - tx.quantityKg;
      return stock;
    }, initialStock - initialTransactions.reduce((acc, tx) => tx.type === "Purchase" ? acc + tx.quantityKg : (tx.type === "Sale" ? acc - tx.quantityKg : acc) ,0) ); // Recalculate based on initial state
    setCurrentStock(newStock);
  }, [transactions]);


  const handlePurchaseSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!date || !supplierName || !quantityKg || !purchasePrice) {
      alert("Please fill all purchase fields.");
      return;
    }
    const newTransaction: PashuAaharTransaction = {
      id: String(Date.now()),
      date,
      type: "Purchase",
      supplierOrCustomerName: supplierName,
      quantityKg: parseFloat(quantityKg),
      purchasePricePerKg: parseFloat(purchasePrice),
      totalAmount: parseFloat(quantityKg) * parseFloat(purchasePrice),
    };
    setTransactions([newTransaction, ...transactions]);
    // setCurrentStock(currentStock + parseFloat(quantityKg)); // Handled by useEffect
    // Reset form
    setSupplierName("");
    setQuantityKg("");
    setPurchasePrice("");
  };
  
  // Note: Sales of Pashu Aahar would ideally be handled via the main Sales page for consistency.
  // This page focuses on stock and purchases. A simplified sales entry could be added here if needed.

  return (
    <div>
      <PageHeader title="Pashu Aahar Stock" description="Track stock levels and record purchases." />
      
      <Card className="mb-6">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-lg font-semibold">Current Stock</CardTitle>
          <Warehouse className="h-6 w-6 text-primary" />
        </CardHeader>
        <CardContent>
          <div className="text-3xl font-bold text-foreground">{currentStock.toFixed(2)} Kg</div>
          <p className="text-xs text-muted-foreground">Available Pashu Aahar stock</p>
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
                <Label htmlFor="purchaseDate">Date</Label>
                <DatePicker date={date} setDate={setDate} />
              </div>
              <div>
                <Label htmlFor="supplierName" className="flex items-center mb-1"><User className="h-4 w-4 mr-2 text-muted-foreground" />Supplier Name</Label>
                <Input id="supplierName" value={supplierName} onChange={(e) => setSupplierName(e.target.value)} placeholder="Supplier" required />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="purchaseQuantity" className="flex items-center mb-1"><Package className="h-4 w-4 mr-2 text-muted-foreground" />Quantity (Kg)</Label>
                  <Input id="purchaseQuantity" type="number" step="0.1" value={quantityKg} onChange={(e) => setQuantityKg(e.target.value)} placeholder="e.g., 100" required />
                </div>
                <div>
                  <Label htmlFor="purchasePrice" className="flex items-center mb-1"><IndianRupee className="h-4 w-4 mr-1 text-muted-foreground" />Price/Kg</Label>
                  <Input id="purchasePrice" type="number" step="0.01" value={purchasePrice} onChange={(e) => setPurchasePrice(e.target.value)} placeholder="e.g., 30" required />
                </div>
              </div>
              <Button type="submit" className="w-full">
                <PlusCircle className="h-4 w-4 mr-2" /> Add Purchase
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Transaction History</CardTitle>
            <CardDescription>Pashu Aahar purchases and sales affecting stock.</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Party</TableHead>
                  <TableHead className="text-right">Qty (Kg)</TableHead>
                  <TableHead className="text-right">Amount (₹)</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {transactions.map((tx) => (
                  <TableRow key={tx.id}>
                    <TableCell>{tx.date.toLocaleDateString()}</TableCell>
                    <TableCell>
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${tx.type === "Purchase" ? "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300" : "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300"}`}>
                        {tx.type}
                      </span>
                    </TableCell>
                    <TableCell>{tx.supplierOrCustomerName}</TableCell>
                    <TableCell className="text-right">{tx.quantityKg.toFixed(1)}</TableCell>
                    <TableCell className="text-right">{tx.totalAmount.toFixed(2)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

