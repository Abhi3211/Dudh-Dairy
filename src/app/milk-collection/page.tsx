
"use client"; // This page contains a form, so it needs to be a client component or contain one.

import { useState, type FormEvent, useEffect, useMemo } from "react";
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
import { CalendarDays, Clock, User, Percent, Scale, IndianRupee, PlusCircle } from "lucide-react";
import type { MilkCollectionEntry } from "@/lib/types";
import { DatePicker } from "@/components/ui/date-picker";

const initialEntries: MilkCollectionEntry[] = [
  { id: "1", date: new Date(), time: "08:30", dealerName: "Rajesh Kumar", quantityLtr: 10.5, fatPercentage: 4.2, ratePerLtr: 40, totalAmount: 420 },
  { id: "2", date: new Date(), time: "09:15", dealerName: "Sunita Devi", quantityLtr: 15.2, fatPercentage: 3.8, ratePerLtr: 38, totalAmount: 577.6 },
];

export default function MilkCollectionPage() {
  const [entries, setEntries] = useState<MilkCollectionEntry[]>(initialEntries);
  const [date, setDate] = useState<Date | undefined>(new Date());
  const [time, setTime] = useState<string>("");
  const [dealerName, setDealerName] = useState("");
  const [quantityLtr, setQuantityLtr] = useState<string>("");
  const [fatPercentage, setFatPercentage] = useState<string>("");

  const [rateDisplay, setRateDisplay] = useState<string>("");
  const [totalAmountDisplay, setTotalAmountDisplay] = useState<string>("");

  // Effect to update time when component mounts, to avoid hydration mismatch for default time
  useEffect(() => {
    setTime(new Date().toTimeString().substring(0,5));
  }, []);

  useEffect(() => {
    const fat = parseFloat(fatPercentage);
    const quantity = parseFloat(quantityLtr);
    let calculatedRate = 0;

    if (!isNaN(fat) && fat > 0) {
      // Placeholder rate calculation logic based on FAT
      if (fat >= 4.5) {
        calculatedRate = 42;
      } else if (fat >= 4.0) {
        calculatedRate = 40;
      } else if (fat >= 3.5) {
        calculatedRate = 38;
      } else {
        calculatedRate = 35; // Base rate for lower FAT
      }
    }
    setRateDisplay(calculatedRate > 0 ? calculatedRate.toFixed(2) : "");

    if (!isNaN(quantity) && quantity > 0 && calculatedRate > 0) {
      setTotalAmountDisplay((quantity * calculatedRate).toFixed(2));
    } else {
      setTotalAmountDisplay("");
    }
  }, [quantityLtr, fatPercentage]);


  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!date || !time || !dealerName || !quantityLtr || !fatPercentage) {
      alert("Please fill all fields."); // Replace with proper toast notification
      return;
    }

    const qLtr = parseFloat(quantityLtr);
    const fatP = parseFloat(fatPercentage);
    // Re-calculate rate and total amount to ensure consistency on submission
    let currentRate = 0;
    if (!isNaN(fatP) && fatP > 0) {
        if (fatP >= 4.5) currentRate = 42;
        else if (fatP >= 4.0) currentRate = 40;
        else if (fatP >= 3.5) currentRate = 38;
        else currentRate = 35;
    }
    const currentTotalAmount = (!isNaN(qLtr) && qLtr > 0 && currentRate > 0) ? qLtr * currentRate : undefined;


    const newEntry: MilkCollectionEntry = {
      id: String(Date.now()),
      date,
      time,
      dealerName,
      quantityLtr: qLtr,
      fatPercentage: fatP,
      ratePerLtr: currentRate > 0 ? currentRate : undefined,
      totalAmount: currentTotalAmount,
    };
    setEntries(prevEntries => [newEntry, ...prevEntries].sort((a,b) => b.date.getTime() - a.date.getTime()));
    // Reset form
    // setDate(new Date()); // Keep date or reset as per preference
    // setTime(new Date().toTimeString().substring(0,5)); // Keep time or reset
    setDealerName("");
    setQuantityLtr("");
    setFatPercentage("");
    // Rate and Total Amount will reset via useEffect
  };

  return (
    <div>
      <PageHeader title="Milk Collection" description="Record new milk collection entries." />
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle>New Entry</CardTitle>
            <CardDescription>Add a new milk collection record.</CardDescription>
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
                <Label htmlFor="time" className="flex items-center mb-1">
                  <Clock className="h-4 w-4 mr-2 text-muted-foreground" /> Time
                </Label>
                <Input id="time" type="time" value={time} onChange={(e) => setTime(e.target.value)} required />
              </div>
              <div>
                <Label htmlFor="dealerName" className="flex items-center mb-1">
                  <User className="h-4 w-4 mr-2 text-muted-foreground" /> Dealer Name
                </Label>
                <Input id="dealerName" value={dealerName} onChange={(e) => setDealerName(e.target.value)} placeholder="Enter dealer name" required />
              </div>
              <div>
                <Label htmlFor="quantityLtr" className="flex items-center mb-1">
                  <Scale className="h-4 w-4 mr-2 text-muted-foreground" /> Quantity (Ltr)
                </Label>
                <Input id="quantityLtr" type="number" step="0.1" value={quantityLtr} onChange={(e) => setQuantityLtr(e.target.value)} placeholder="e.g., 10.5" required />
              </div>
              <div>
                <Label htmlFor="fatPercentage" className="flex items-center mb-1">
                  <Percent className="h-4 w-4 mr-2 text-muted-foreground" /> FAT (%)
                </Label>
                <Input id="fatPercentage" type="number" step="0.1" value={fatPercentage} onChange={(e) => setFatPercentage(e.target.value)} placeholder="e.g., 3.8" required />
              </div>
              <div>
                <Label htmlFor="ratePerLtr" className="flex items-center mb-1">
                  <IndianRupee className="h-4 w-4 mr-2 text-muted-foreground" /> Rate (₹/Ltr)
                </Label>
                <Input id="ratePerLtr" value={rateDisplay} readOnly className="font-semibold bg-muted/50" />
              </div>
              <div>
                <Label htmlFor="totalAmount" className="flex items-center mb-1">
                  <IndianRupee className="h-4 w-4 mr-2 text-muted-foreground" /> Total Amount (₹)
                </Label>
                <Input id="totalAmount" value={totalAmountDisplay} readOnly className="font-semibold bg-muted/50" />
              </div>
              <Button type="submit" className="w-full">
                <PlusCircle className="h-4 w-4 mr-2" /> Add Entry
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Recent Collections</CardTitle>
            <CardDescription>List of recently added milk collections.</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Time</TableHead>
                  <TableHead>Dealer</TableHead>
                  <TableHead className="text-right">Qty (Ltr)</TableHead>
                  <TableHead className="text-right">FAT (%)</TableHead>
                  <TableHead className="text-right">Rate (₹/Ltr)</TableHead>
                  <TableHead className="text-right">Amount (₹)</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {entries.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center text-muted-foreground">No entries yet.</TableCell>
                  </TableRow>
                )}
                {entries.map((entry) => (
                  <TableRow key={entry.id}>
                    <TableCell>{entry.date.toLocaleDateString()}</TableCell>
                    <TableCell>{entry.time}</TableCell>
                    <TableCell>{entry.dealerName}</TableCell>
                    <TableCell className="text-right">{entry.quantityLtr.toFixed(1)}</TableCell>
                    <TableCell className="text-right">{entry.fatPercentage.toFixed(1)}</TableCell>
                    <TableCell className="text-right">{entry.ratePerLtr ? entry.ratePerLtr.toFixed(2) : "-"}</TableCell>
                    <TableCell className="text-right">{entry.totalAmount ? entry.totalAmount.toFixed(2) : "-"}</TableCell>
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

