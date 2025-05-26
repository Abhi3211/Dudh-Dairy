
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
import { Package, Warehouse, ShoppingCart, IndianRupee, User, PlusCircle, Tag } from "lucide-react";
import type { PashuAaharTransaction } from "@/lib/types";

const initialTransactions: PashuAaharTransaction[] = [
  { id: "1", date: new Date(Date.now() - 86400000 * 2), type: "Purchase", productName: "Gold Coin Feed", supplierOrCustomerName: "Shakti Feeds", quantityBags: 20, pricePerBag: 300, totalAmount: 6000 },
  { id: "2", date: new Date(Date.now() - 86400000 * 1), type: "Sale", productName: "Gold Coin Feed", supplierOrCustomerName: "Ramesh Bhai", quantityBags: 5, pricePerBag: 350, totalAmount: 1750 },
  { id: "3", date: new Date(Date.now() - 86400000 * 3), type: "Purchase", productName: "Super Pallet", supplierOrCustomerName: "Kamdhenu Agro", quantityBags: 15, pricePerBag: 320, totalAmount: 4800 },
  { id: "4", date: new Date(Date.now() - 86400000 * 1), type: "Purchase", productName: "Nutri Plus Feed", supplierOrCustomerName: "Shakti Feeds", quantityBags: 10, pricePerBag: 310, totalAmount: 3100 },
];

export default function PashuAaharPage() {
  const [transactions, setTransactions] = useState<PashuAaharTransaction[]>(initialTransactions);
  const [currentStockByProduct, setCurrentStockByProduct] = useState<Record<string, number>>({});

  const [date, setDate] = useState<Date | undefined>(new Date());
  const [productName, setProductName] = useState("");
  const [supplierName, setSupplierName] = useState("");
  const [quantityBags, setQuantityBags] = useState("");
  const [pricePerBag, setPricePerBag] = useState("");

  useEffect(() => {
    const stockCalc: Record<string, number> = {};
    // Sort transactions by date to ensure correct stock calculation sequence
    const sortedTransactions = [...transactions].sort((a, b) => a.date.getTime() - b.date.getTime());

    sortedTransactions.forEach(tx => {
      if (!stockCalc[tx.productName]) {
        stockCalc[tx.productName] = 0;
      }
      if (tx.type === "Purchase") {
        stockCalc[tx.productName] += tx.quantityBags;
      } else if (tx.type === "Sale") {
        // Ensure stock doesn't go negative, though ideally sales shouldn't exceed stock
        stockCalc[tx.productName] = Math.max(0, stockCalc[tx.productName] - tx.quantityBags);
      }
    });
    setCurrentStockByProduct(stockCalc);
  }, [transactions]);


  const handlePurchaseSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!date || !productName || !supplierName || !quantityBags || !pricePerBag) {
      alert("Please fill all purchase fields."); // TODO: Replace with toast
      return;
    }
    const newTransaction: PashuAaharTransaction = {
      id: String(Date.now()),
      date,
      type: "Purchase",
      productName: productName.trim(),
      supplierOrCustomerName: supplierName,
      quantityBags: parseInt(quantityBags),
      pricePerBag: parseFloat(pricePerBag),
      totalAmount: parseInt(quantityBags) * parseFloat(pricePerBag),
    };
    setTransactions(prevTransactions => [...prevTransactions, newTransaction].sort((a,b) => b.date.getTime() - a.date.getTime()));
    // Reset form
    setProductName("");
    setSupplierName("");
    setQuantityBags("");
    setPricePerBag("");
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
          {Object.keys(currentStockByProduct).length === 0 ? (
            <p className="text-sm text-muted-foreground">No stock data available. Record a purchase to begin.</p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
              {Object.entries(currentStockByProduct).map(([prodName, stock]) => (
                <Card key={prodName} className="shadow-sm">
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 pt-4 px-4">
                    <CardTitle className="text-sm font-medium text-muted-foreground truncate" title={prodName}>
                      {prodName}
                    </CardTitle>
                    <Package className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent className="pb-4 px-4">
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
                <Label htmlFor="purchaseDate">Date</Label>
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
              <Button type="submit" className="w-full">
                <PlusCircle className="h-4 w-4 mr-2" /> Add Purchase
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
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
                  <TableHead>Product Name</TableHead>
                  <TableHead>Supplier/Customer</TableHead>
                  <TableHead className="text-right">Qty (Bags)</TableHead>
                  <TableHead className="text-right">Price/Bag (₹)</TableHead>
                  <TableHead className="text-right">Total (₹)</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {transactions.length === 0 && (
                    <TableRow>
                        <TableCell colSpan={7} className="text-center text-muted-foreground">No transactions yet.</TableCell>
                    </TableRow>
                )}
                {transactions.map((tx) => (
                  <TableRow key={tx.id}>
                    <TableCell>{tx.date.toLocaleDateString()}</TableCell>
                    <TableCell>
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${tx.type === "Purchase" ? "bg-chart-3/20 text-chart-3" : "bg-chart-4/20 text-chart-4"}`}>
                        {tx.type}
                      </span>
                    </TableCell>
                    <TableCell>{tx.productName}</TableCell>
                    <TableCell>{tx.supplierOrCustomerName}</TableCell>
                    <TableCell className="text-right">{tx.quantityBags.toFixed(0)}</TableCell>
                    <TableCell className="text-right">{tx.pricePerBag ? tx.pricePerBag.toFixed(2) : "-"}</TableCell>
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

