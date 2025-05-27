
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
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DatePicker } from "@/components/ui/date-picker";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { User, Package, IndianRupee, CreditCard, PlusCircle, Tag } from "lucide-react";
import type { SaleEntry } from "@/lib/types";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";

// Raw data for initial sales, dates processed in useEffect
const rawInitialSales: (Omit<SaleEntry, 'id' | 'date'> & { tempId: string, dateOffset?: number })[] = [
  { tempId: "1", customerName: "Amit Singh", productName: "Milk", quantity: 5, unit: "Ltr", rate: 60, totalAmount: 300, paymentType: "Cash", dateOffset: 0 },
  { tempId: "2", customerName: "Priya Sharma", productName: "Ghee", quantity: 1, unit: "Kg", rate: 700, totalAmount: 700, paymentType: "Credit", dateOffset: 0 },
  { tempId: "3", customerName: "Vijay Store", productName: "Gold Coin Feed", quantity: 2, unit: "Bags", rate: 320, totalAmount: 640, paymentType: "Cash", dateOffset: 0 },
];

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
  const { toast } = useToast();
  const [sales, setSales] = useState<SaleEntry[]>([]);
  const [date, setDate] = useState<Date | undefined>(undefined);
  const [customerName, setCustomerName] = useState("");
  const [selectedCategoryIndex, setSelectedCategoryIndex] = useState<string>("0");
  const [specificPashuAaharName, setSpecificPashuAaharName] = useState<string>("");
  const [quantity, setQuantity] = useState<string>("");
  const [rate, setRate] = useState<string>("");
  const [paymentType, setPaymentType] = useState<"Cash" | "Credit">("Cash");

  const [filteredPashuAaharSuggestions, setFilteredPashuAaharSuggestions] = useState<string[]>([]);
  const [popoverOpenForPashuAahar, setPopoverOpenForPashuAahar] = useState(false);

  useEffect(() => {
    setDate(new Date());
    const processedSales = rawInitialSales.map(s => {
      const entryDate = new Date();
      if (s.dateOffset !== undefined) {
        entryDate.setDate(entryDate.getDate() + s.dateOffset);
      }
      return { ...s, id: s.tempId, date: entryDate };
    }).sort((a,b) => b.date.getTime() - a.date.getTime());
    setSales(processedSales);
  }, []);

  const totalAmount = parseFloat(quantity) * parseFloat(rate) || 0;
  const currentCategoryDetails = productCategories[parseInt(selectedCategoryIndex)];
  const currentCategoryName = currentCategoryDetails?.categoryName;

  useEffect(() => {
    if (currentCategoryName !== "Pashu Aahar") {
      setSpecificPashuAaharName("");
      setFilteredPashuAaharSuggestions([]);
      setPopoverOpenForPashuAahar(false);
    }
  }, [currentCategoryName]);

  const handlePashuAaharNameChange = (value: string) => {
    setSpecificPashuAaharName(value);
    if (value.trim()) {
      const filtered = knownPashuAaharProducts.filter(p =>
        p.toLowerCase().includes(value.toLowerCase())
      );
      setFilteredPashuAaharSuggestions(filtered);
      setPopoverOpenForPashuAahar(filtered.length > 0 && value.trim().length > 0);
    } else {
      setFilteredPashuAaharSuggestions([]);
      setPopoverOpenForPashuAahar(false);
    }
  };

  const handlePashuAaharSuggestionClick = (suggestion: string) => {
    setSpecificPashuAaharName(suggestion);
    setFilteredPashuAaharSuggestions([]);
    setPopoverOpenForPashuAahar(false);
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!date || !customerName || !quantity || !rate) {
      toast({ title: "Error", description: "Please fill all fields.", variant: "destructive" });
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

    const newSale: SaleEntry = {
      id: String(Date.now()),
      date,
      customerName,
      productName: finalProductName,
      quantity: parseFloat(quantity),
      unit: currentCategoryDetails.unit,
      rate: parseFloat(rate),
      totalAmount: parseFloat(quantity) * parseFloat(rate),
      paymentType,
    };
    setSales(prevSales => [newSale, ...prevSales].sort((a,b) => b.date.getTime() - a.date.getTime()));
    
    toast({ title: "Success", description: "Sale entry added." });

    setCustomerName("");
    setSpecificPashuAaharName("");
    setQuantity("");
    setRate("");
    setFilteredPashuAaharSuggestions([]);
    setPopoverOpenForPashuAahar(false);
    setDate(new Date()); // Reset date for next entry
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
                        placeholder="Type to search Pashu Aahar"
                        required
                        autoComplete="off"
                        className="w-full"
                      />
                    </PopoverTrigger>
                    <PopoverContent
                      className="w-[var(--radix-popover-trigger-width)] p-0"
                      onOpenAutoFocus={(e) => e.preventDefault()}
                      sideOffset={5}
                    >
                      {filteredPashuAaharSuggestions.length === 0 && specificPashuAaharName.trim() ? (
                         <div className="p-2 text-sm text-muted-foreground">No products found.</div>
                      ) : (
                        <div className="max-h-48 overflow-auto">
                          {filteredPashuAaharSuggestions.map(suggestion => (
                            <div
                              key={suggestion}
                              className="p-2 hover:bg-accent cursor-pointer text-sm"
                              onMouseDown={() => handlePashuAaharSuggestionClick(suggestion)}
                            >
                              {suggestion}
                            </div>
                          ))}
                        </div>
                      )}
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
                {sales.length === 0 ? (
                    <TableRow>
                        <TableCell colSpan={7} className="text-center text-muted-foreground">No sales recorded yet.</TableCell>
                    </TableRow>
                ) : (
                    sales.map((sale) => (
                    <TableRow key={sale.id}>
                        <TableCell>{format(sale.date, 'P')}</TableCell>
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
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

    