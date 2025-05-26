
"use client"; // This page contains a form, so it needs to be a client component or contain one.

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
import { CalendarDays, Clock, User, Percent, Scale, PlusCircle } from "lucide-react";
import type { MilkCollectionEntry } from "@/lib/types";
import { DatePicker } from "@/components/ui/date-picker"; // Assuming a DatePicker component exists or will be created

// Placeholder for DatePicker if not already available
// If you have a shadcn date picker, use that. Otherwise, a simple input type="date"
// const DatePicker = ({ date, setDate }: { date?: Date, setDate: (date?: Date) => void }) => (
//   <Input type="date" value={date ? date.toISOString().split('T')[0] : ''} onChange={(e) => setDate(e.target.value ? new Date(e.target.value) : undefined)} />
// );


const initialEntries: MilkCollectionEntry[] = [
  { id: "1", date: new Date(), time: "08:30", dealerName: "Rajesh Kumar", quantityLtr: 10.5, fatPercentage: 4.2, ratePerLtr: 40, totalAmount: 420 },
  { id: "2", date: new Date(), time: "09:15", dealerName: "Sunita Devi", quantityLtr: 15.2, fatPercentage: 3.8, ratePerLtr: 38, totalAmount: 577.6 },
];

export default function MilkCollectionPage() {
  const [entries, setEntries] = useState<MilkCollectionEntry[]>(initialEntries);
  const [date, setDate] = useState<Date | undefined>(new Date());
  const [time, setTime] = useState<string>(new Date().toTimeString().substring(0,5));
  const [dealerName, setDealerName] = useState("");
  const [quantityLtr, setQuantityLtr] = useState<string>("");
  const [fatPercentage, setFatPercentage] = useState<string>("");

  // Effect to update time when component mounts, to avoid hydration mismatch for default time
  useEffect(() => {
    setTime(new Date().toTimeString().substring(0,5));
  }, []);


  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!date || !dealerName || !quantityLtr || !fatPercentage) {
      alert("Please fill all fields."); // Replace with proper toast notification
      return;
    }
    const newEntry: MilkCollectionEntry = {
      id: String(Date.now()),
      date,
      time,
      dealerName,
      quantityLtr: parseFloat(quantityLtr),
      fatPercentage: parseFloat(fatPercentage),
      // Rate and TotalAmount can be calculated later or on server
    };
    setEntries([newEntry, ...entries]);
    // Reset form
    // setDate(new Date()); // Keep date or reset as per preference
    // setTime(new Date().toTimeString().substring(0,5)); // Keep time or reset
    setDealerName("");
    setQuantityLtr("");
    setFatPercentage("");
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
                {/* If using ShadCN Date Picker component: */}
                 <DatePicker date={date} setDate={setDate} />
                {/* Or simplified: <Input id="date" type="date" value={date ? date.toISOString().split('T')[0] : ''} onChange={(e) => setDate(e.target.value ? new Date(e.target.value) : undefined)} required /> */}
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
                  <TableHead className="text-right">Amount (₹)</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {entries.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-muted-foreground">No entries yet.</TableCell>
                  </TableRow>
                )}
                {entries.map((entry) => (
                  <TableRow key={entry.id}>
                    <TableCell>{entry.date.toLocaleDateString()}</TableCell>
                    <TableCell>{entry.time}</TableCell>
                    <TableCell>{entry.dealerName}</TableCell>
                    <TableCell className="text-right">{entry.quantityLtr.toFixed(1)}</TableCell>
                    <TableCell className="text-right">{entry.fatPercentage.toFixed(1)}</TableCell>
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

