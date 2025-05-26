
"use client";

import { useState, type FormEvent, useEffect } from "react";
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
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { DatePicker } from "@/components/ui/date-picker";
import { User, Package, IndianRupee, CreditCard, ShoppingCart, PlusCircle } from "lucide-react";
import type { SaleEntry, ProductName } from "@/lib/types";

const initialSales: SaleEntry[] = [
  { id: "1", date: new Date(), customerName: "Amit Singh", productName: "Milk", quantity: 5, unit: "Ltr", rate: 60, totalAmount: 300, paymentType: "Cash" },
  { id: "2", date: new Date(), customerName: "Priya Sharma", productName: "Ghee", quantity: 1, unit: "Kg", rate: 700, totalAmount: 700, paymentType: "Credit" },
];

const productOptions: { name: ProductName; unit: "Ltr" | "Kg" | "Packet" }[] = [
  { name: "Milk", unit: "Ltr" },
  { name: "Ghee", unit: "Kg" },
  { name: "Pashu Aahar", unit: "Packet" },
];

export default function SalesPage() {
  const [sales, setSales] = useState<SaleEntry[]>(initialSales);
  const [date, setDate] = useState<Date | undefined>(new Date());
  const [customerName, setCustomerName] = useState("");
  const [selectedProductIndex, setSelectedProductIndex] = useState<string>("0");
  const [quantity, setQuantity] = useState<string>("");
  const [rate, setRate] = useState<string>("");
  const [paymentType, setPaymentType] = useState<"Cash" | "Credit">("Cash");

  const totalAmount = parseFloat(quantity) * parseFloat(rate) || 0;

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!date || !customerName || !quantity || !rate) {
      alert("Please fill all fields.");
      return;
    }
    const product = productOptions[parseInt(selectedProductIndex)];
    const newSale: SaleEntry = {
      id: String(Date.now()),
      date,
      customerName,
      productName: product.name,
      quantity: parseFloat(quantity),
      unit: product.unit,
      rate: parseFloat(rate),
      totalAmount: parseFloat(quantity) * parseFloat(rate),
      paymentType,
    };
    setSales([newSale, ...sales]);
    // Reset form
    setCustomerName("");
    setQuantity("");
    setRate("");
  };

  return (
    <div>
      <PageHeader title="Sales Entry" description="Record product sales." />
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle>New Sale</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label htmlFor="date">Date</Label>
                <DatePicker date={date} setDate={setDate} />
              </div>
              <div>
                <Label htmlFor="customerName" className="flex items-center mb-1"><User className="h-4 w-4 mr-2 text-muted-foreground" />Customer Name</Label>
                <Input id="customerName" value={customerName} onChange={(e) => setCustomerName(e.target.value)} placeholder="Customer name" required />
              </div>
              <div>
                <Label htmlFor="productName" className="flex items-center mb-1"><Package className="h-4 w-4 mr-2 text-muted-foreground" />Product</Label>
                <Select value={selectedProductIndex} onValueChange={setSelectedProductIndex}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select product" />
                  </SelectTrigger>
                  <SelectContent>
                    {productOptions.map((p, index) => (
                      <SelectItem key={p.name} value={String(index)}>{p.name} ({p.unit})</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="quantity">Quantity</Label>
                  <Input id="quantity" type="number" step="0.1" value={quantity} onChange={(e) => setQuantity(e.target.value)} placeholder="e.g., 2.5" required />
                </div>
                <div>
                  <Label htmlFor="rate" className="flex items-center mb-1"><IndianRupee className="h-4 w-4 mr-1 text-muted-foreground" />Rate</Label>
                  <Input id="rate" type="number" step="0.01" value={rate} onChange={(e) => setRate(e.target.value)} placeholder="e.g., 60" required />
                </div>
              </div>
              <div>
                <Label>Total Amount</Label>
                <Input value={`₹ ${totalAmount.toFixed(2)}`} readOnly className="font-semibold" />
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
              <Button type="submit" className="w-full">
                <PlusCircle className="h-4 w-4 mr-2" /> Add Sale
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Recent Sales</CardTitle>
          </CardHeader>
          <CardContent>
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
                {sales.map((sale) => (
                  <TableRow key={sale.id}>
                    <TableCell>{sale.date.toLocaleDateString()}</TableCell>
                    <TableCell>{sale.customerName}</TableCell>
                    <TableCell>{sale.productName}</TableCell>
                    <TableCell className="text-right">{sale.quantity} {sale.unit}</TableCell>
                    <TableCell className="text-right">{sale.rate.toFixed(2)}</TableCell>
                    <TableCell className="text-right">{sale.totalAmount.toFixed(2)}</TableCell>
                    <TableCell>{sale.paymentType}</TableCell>
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
