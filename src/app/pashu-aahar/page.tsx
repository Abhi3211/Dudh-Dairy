
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

const initialStockBags = 50; // Bags
const initialTransactions: PashuAaharTransaction[] = [
  { id: "1", date: new Date(Date.now() - 86400000 * 2), type: "Purchase", supplierOrCustomerName: "Shakti Feeds", quantityBags: 20, pricePerBag: 300, totalAmount: 6000 },
  { id: "2", date: new Date(Date.now() - 86400000 * 1), type: "Sale", supplierOrCustomerName: "Ramesh Bhai", quantityBags: 5, pricePerBag: 350, totalAmount: 1750 },
];

export default function PashuAaharPage() {
  const [transactions, setTransactions] = useState<PashuAaharTransaction[]>(initialTransactions);
  const [currentStock, setCurrentStock] = useState(0); // Will be calculated by useEffect

  const [date, setDate] = useState<Date | undefined>(new Date());
  const [supplierName, setSupplierName] = useState("");
  const [quantityBags, setQuantityBags] = useState("");
  const [pricePerBag, setPricePerBag] = useState("");

  useEffect(() => {
    const newStock = transactions.reduce((stock, tx) => {
      if (tx.type === "Purchase") return stock + tx.quantityBags;
      if (tx.type === "Sale") return stock - tx.quantityBags;
      return stock;
    }, initialStockBags); 
    setCurrentStock(newStock);
  }, [transactions]);


  const handlePurchaseSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!date || !supplierName || !quantityBags || !pricePerBag) {
      alert("Please fill all purchase fields.");
      return;
    }
    const newTransaction: PashuAaharTransaction = {
      id: String(Date.now()),
      date,
      type: "Purchase",
      supplierOrCustomerName: supplierName,
      quantityBags: parseInt(quantityBags),
      pricePerBag: parseFloat(pricePerBag),
      totalAmount: parseInt(quantityBags) * parseFloat(pricePerBag),
    };
    setTransactions(prevTransactions => [newTransaction, ...prevTransactions].sort((a,b) => b.date.getTime() - a.date.getTime()));
    // Reset form
    setSupplierName("");
    setQuantityBags("");
    setPricePerBag("");
  };
  
  return (
    <div>
      <PageHeader title="Pashu Aahar Stock" description="Track stock levels and record purchases in bags." />
      
      <Card className="mb-6">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-lg font-semibold">Current Stock</CardTitle>
          <Warehouse className="h-6 w-6 text-primary" />
        </CardHeader>
        <CardContent>
          <div className="text-3xl font-bold text-foreground">{currentStock.toFixed(0)} Bags</div>
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
                  <Label htmlFor="purchaseQuantity" className="flex items-center mb-1"><Package className="h-4 w-4 mr-2 text-muted-foreground" />Quantity (Bags)</Label>
                  <Input id="purchaseQuantity" type="number" step="1" value={quantityBags} onChange={(e) => setQuantityBags(e.target.value)} placeholder="e.g., 10" required />
                </div>
                <div>
                  <Label htmlFor="purchasePrice" className="flex items-center mb-1"><IndianRupee className="h-4 w-4 mr-1 text-muted-foreground" />Price/Bag</Label>
                  <Input id="purchasePrice" type="number" step="0.01" value={pricePerBag} onChange={(e) => setPricePerBag(e.target.value)} placeholder="e.g., 300" required />
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
                  <TableHead className="text-right">Qty (Bags)</TableHead>
                  <TableHead className="text-right">Amount (₹)</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {transactions.map((tx) => (
                  <TableRow key={tx.id}>
                    <TableCell>{tx.date.toLocaleDateString()}</TableCell>
                    <TableCell>
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${tx.type === "Purchase" ? "bg-chart-3/20 text-chart-3" : "bg-chart-4/20 text-chart-4"}`}>
                        {tx.type}
                      </span>
                    </TableCell>
                    <TableCell>{tx.supplierOrCustomerName}</TableCell>
                    <TableCell className="text-right">{tx.quantityBags.toFixed(0)}</TableCell>
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
