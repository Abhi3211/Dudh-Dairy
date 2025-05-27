
"use client";

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
import { useToast } from "@/hooks/use-toast";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { format } from "date-fns";

const rawInitialEntries: (Omit<MilkCollectionEntry, 'id' | 'date'> & { tempId: string, dateOffset: number })[] = [
  { tempId: "1", dateOffset: -1, time: "08:30", dealerName: "Rajesh Kumar", quantityLtr: 10.5, fatPercentage: 4.2, ratePerLtr: 40, totalAmount: 420 },
  { tempId: "2", dateOffset: 0, time: "09:15", dealerName: "Sunita Devi", quantityLtr: 15.2, fatPercentage: 3.8, ratePerLtr: 38, totalAmount: 577.6 },
  { tempId: "3", dateOffset: 0, time: "07:45", dealerName: "Rajesh Kumar", quantityLtr: 8.0, fatPercentage: 4.5, ratePerLtr: 42, totalAmount: 336 },
];

export default function MilkCollectionPage() {
  const { toast } = useToast();
  const [entries, setEntries] = useState<MilkCollectionEntry[]>([]);
  const [date, setDate] = useState<Date | undefined>(undefined);
  const [time, setTime] = useState<string>("");
  const [dealerNameInput, setDealerNameInput] = useState<string>("");
  const [quantityLtr, setQuantityLtr] = useState<string>("");
  const [fatPercentage, setFatPercentage] = useState<string>("");
  const [rateInputValue, setRateInputValue] = useState<string>("6.7");
  // const [totalAmountDisplay, setTotalAmountDisplay] = useState<string>(""); // Replaced by useMemo

  // const [dealerNameSuggestions, setDealerNameSuggestions] = useState<string[]>([]); // Popover removed
  // const [dealerPopoverOpen, setDealerPopoverOpen] = useState(false); // Popover removed
  
  const knownDealerNames = useMemo(() => Array.from(new Set(entries.map(e => e.dealerName))), [entries]);

  useEffect(() => {
    // Defer date initialization to client-side
    setDate(new Date());
    setTime(new Date().toTimeString().substring(0,5));

    const processedEntries = rawInitialEntries.map(e => {
      const entryDate = new Date();
      entryDate.setDate(entryDate.getDate() + e.dateOffset);
      return { ...e, id: e.tempId, date: entryDate };
    }).sort((a,b) => {
        const dateComparison = b.date.getTime() - a.date.getTime();
        if (dateComparison !== 0) return dateComparison;
        return b.time.localeCompare(a.time);
    });
    setEntries(processedEntries);
  }, []);

  const totalAmountDisplay = useMemo(() => {
    const quantityStr = quantityLtr.replace(',', '.');
    const rateStr = rateInputValue.replace(',', '.');
    
    const quantity = parseFloat(quantityStr);
    const rate = parseFloat(rateStr);

    if (!isNaN(quantity) && quantity > 0 && !isNaN(rate) && rate > 0) {
      return (quantity * rate).toFixed(2);
    }
    return "";
  }, [quantityLtr, rateInputValue]);


  const filteredEntries = useMemo(() => {
    const sortedEntries = [...entries].sort((a, b) => { 
        const dateComparison = b.date.getTime() - a.date.getTime();
        if (dateComparison !== 0) return dateComparison;
        return b.time.localeCompare(a.time); 
    });

    if (!date) return sortedEntries; 

    return sortedEntries.filter(entry =>
      entry.date.getFullYear() === date.getFullYear() &&
      entry.date.getMonth() === date.getMonth() &&
      entry.date.getDate() === date.getDate()
    );
  }, [entries, date]);

  // Popover related handlers removed
  // const handleDealerNameChange = (value: string) => { ... };
  // const handleDealerSuggestionClick = (name: string) => { ... };


  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!date || !time || !dealerNameInput.trim() || !quantityLtr || !fatPercentage || !rateInputValue) {
      toast({ title: "Error", description: "Please fill all fields.", variant: "destructive" });
      return;
    }

    const qLtrStr = quantityLtr.replace(',', '.');
    const fatPStr = fatPercentage.replace(',', '.');
    const finalRateStr = rateInputValue.replace(',', '.');

    const qLtr = parseFloat(qLtrStr);
    const fatP = parseFloat(fatPStr);
    const finalRate = parseFloat(finalRateStr);

    if (isNaN(qLtr) || qLtr <= 0) {
      toast({ title: "Error", description: "Please enter a valid quantity.", variant: "destructive" });
      return;
    }
    if (isNaN(fatP) || fatP < 0) { 
        toast({ title: "Error", description: "Please enter a valid FAT percentage.", variant: "destructive" });
        return;
    }
    if (isNaN(finalRate) || finalRate <= 0) {
      toast({ title: "Error", description: "Please enter a valid rate.", variant: "destructive" });
      return;
    }

    const finalTotalAmount = qLtr * finalRate;

    const newEntry: MilkCollectionEntry = {
      id: String(Date.now()),
      date,
      time,
      dealerName: dealerNameInput.trim(),
      quantityLtr: qLtr,
      fatPercentage: fatP,
      ratePerLtr: finalRate,
      totalAmount: finalTotalAmount,
    };
    
    setEntries(prevEntries => {
      const updatedEntries = [newEntry, ...prevEntries];
      return updatedEntries.sort((a,b) => b.date.getTime() - a.date.getTime() || b.time.localeCompare(a.time));
    });

    toast({ title: "Success", description: "Milk collection entry added." });

    setDealerNameInput("");
    setQuantityLtr("");
    setFatPercentage("");
    setRateInputValue("6.7"); 
    setTime(new Date().toTimeString().substring(0,5));
    // setDate(new Date()); // Date picker will hold its value, or can be reset if desired.
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
                {/* Popover removed, simple input now */}
                <Input
                    id="dealerName"
                    value={dealerNameInput}
                    onChange={(e) => setDealerNameInput(e.target.value)}
                    placeholder="Enter dealer name"
                    required
                    autoComplete="off"
                    className="w-full"
                />
              </div>
              <div>
                <Label htmlFor="quantityLtr" className="flex items-center mb-1">
                  <Scale className="h-4 w-4 mr-2 text-muted-foreground" /> Quantity (Ltr)
                </Label>
                <Input id="quantityLtr" type="text" inputMode="decimal" value={quantityLtr} onChange={(e) => setQuantityLtr(e.target.value)} placeholder="e.g., 10.5" required />
              </div>
              <div>
                <Label htmlFor="fatPercentage" className="flex items-center mb-1">
                  <Percent className="h-4 w-4 mr-2 text-muted-foreground" /> FAT (%)
                </Label>
                <Input id="fatPercentage" type="text" inputMode="decimal" value={fatPercentage} onChange={(e) => setFatPercentage(e.target.value)} placeholder="e.g., 3.8" required />
              </div>
              <div>
                <Label htmlFor="ratePerLtr" className="flex items-center mb-1">
                  <IndianRupee className="h-4 w-4 mr-1 text-muted-foreground" /> Rate (₹/Ltr)
                </Label>
                <Input 
                  id="ratePerLtr" 
                  type="text" 
                  inputMode="decimal"
                  value={rateInputValue} 
                  onChange={(e) => setRateInputValue(e.target.value)} 
                  placeholder="e.g., 6.7" 
                  required 
                  className="font-semibold"
                />
              </div>
              <div>
                <Label htmlFor="totalAmount" className="flex items-center mb-1">
                  <IndianRupee className="h-4 w-4 mr-1 text-muted-foreground" /> Total Amount (₹)
                </Label>
                <Input id="totalAmount" value={totalAmountDisplay ? `₹ ${totalAmountDisplay}` : ""} readOnly className="font-semibold bg-muted/50" />
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
            <CardDescription>
              {date ? `Showing collections for ${format(date, 'PPP')}` : "Showing all recent collections."}
            </CardDescription>
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
                {filteredEntries.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center text-muted-foreground">
                      {date ? `No entries for ${format(date, 'P')}.` : "No entries yet."}
                    </TableCell>
                  </TableRow>
                )}
                {filteredEntries.map((entry) => (
                  <TableRow key={entry.id}>
                    <TableCell>{format(entry.date, 'P')}</TableCell>
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
