
"use client";

import { useState, type FormEvent, useEffect, useMemo, useCallback } from "react";
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
import { format } from "date-fns";
import { Skeleton } from "@/components/ui/skeleton";
import { addMilkCollectionEntryToFirestore, getMilkCollectionEntriesFromFirestore } from "./actions";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";


const MOCK_DEALER_NAMES = ["Rajesh Dairy", "Suresh Milk Co.", "Anand Farms", "Krishna Dairy"];

export default function MilkCollectionPage() {
  const { toast } = useToast();
  const [allEntries, setAllEntries] = useState<MilkCollectionEntry[]>([]);
  const [isLoadingEntries, setIsLoadingEntries] = useState(true);
  
  const [date, setDate] = useState<Date | undefined>(undefined);
  const [tableFilterDate, setTableFilterDate] = useState<Date | undefined>(undefined);
  const [time, setTime] = useState<string>("");
  const [dealerNameInput, setDealerNameInput] = useState<string>("");
  const [quantityLtr, setQuantityLtr] = useState<string>("");
  const [fatPercentage, setFatPercentage] = useState<string>("");
  const [rateInputValue, setRateInputValue] = useState<string>("6.7"); 
  const [isDealerPopoverOpen, setIsDealerPopoverOpen] = useState(false);


  const fetchEntries = useCallback(async () => {
    console.log('CLIENT: fetchEntries called. Setting isLoadingEntries to true.');
    setIsLoadingEntries(true);
    try {
      const fetchedEntries = await getMilkCollectionEntriesFromFirestore();
      // Log with JSON.stringify to see date objects correctly in console
      console.log('CLIENT: Fetched milk collection entries from Firestore. Count:', fetchedEntries.length, 'Data:', JSON.parse(JSON.stringify(fetchedEntries)));
      setAllEntries(fetchedEntries);
    } catch (error) {
      console.error("CLIENT: Failed to fetch milk collection entries:", error);
      toast({ title: "Error", description: "Could not fetch milk collection entries.", variant: "destructive" });
    } finally {
      console.log('CLIENT: fetchEntries finished. Setting isLoadingEntries to false.');
      setIsLoadingEntries(false);
    }
  }, [toast]);

  useEffect(() => {
    console.log("CLIENT: Initial useEffect running to set dates and fetch entries.");
    setDate(new Date()); 
    setTableFilterDate(new Date()); 
    setTime(new Date().toTimeString().substring(0, 5));
    fetchEntries();
  }, [fetchEntries]); 

  const uniqueDealerNamesFromEntries = useMemo(() => {
    const names = new Set(allEntries.map(entry => entry.dealerName));
    return Array.from(names);
  }, [allEntries]);

  const allKnownDealerNames = useMemo(() => {
    return Array.from(new Set([...MOCK_DEALER_NAMES, ...uniqueDealerNamesFromEntries])).sort();
  }, [uniqueDealerNamesFromEntries]);


  const totalAmountDisplay = useMemo(() => {
    const quantityStr = quantityLtr.replace(',', '.');
    const fatStr = fatPercentage.replace(',', '.');
    const rateStr = rateInputValue.replace(',', '.');
    
    const quantity = parseFloat(quantityStr);
    const fat = parseFloat(fatStr);
    const rate = parseFloat(rateStr);

    if (!isNaN(quantity) && quantity > 0 && !isNaN(fat) && fat > 0 && !isNaN(rate) && rate > 0) {
      return (quantity * fat * rate).toFixed(2);
    }
    return "";
  }, [quantityLtr, fatPercentage, rateInputValue]);

  const filteredEntries = useMemo(() => {
    console.log("CLIENT: Recalculating filteredEntries. Selected tableFilterDate:", tableFilterDate ? format(tableFilterDate, 'yyyy-MM-dd') : 'undefined', "Total entries being filtered:", allEntries.length);
    if (!tableFilterDate) {
        console.log("CLIENT: No tableFilterDate selected, returning all entries. Count:", allEntries.length);
        return allEntries;
    }
    
    const targetDateStr = format(tableFilterDate, 'yyyy-MM-dd');
    const result = allEntries.filter(entry => {
        if (!entry.date || !(entry.date instanceof Date)) {
            console.warn("CLIENT: Invalid or missing date in entry during filtering:", entry);
            return false;
        }
        const entryDateStr = format(entry.date, 'yyyy-MM-dd');
        const match = entryDateStr === targetDateStr;
        // console.log(`CLIENT: Filtering entry ID ${entry.id}: entryDateStr=${entryDateStr}, targetDateStr=${targetDateStr}, match=${match}`);
        return match;
    });
    console.log("CLIENT: Resulting filteredEntries count:", result.length);
    if (result.length > 0 && result.length < 5) { // Log only if few results for brevity
        console.log("CLIENT: Filtered entries data (sample):", JSON.parse(JSON.stringify(result)));
    }
    return result;
  }, [allEntries, tableFilterDate]);

  const handleDealerNameInputChange = useCallback((value: string) => {
    setDealerNameInput(value);
    if (value.trim()) {
      setIsDealerPopoverOpen(true);
    } else {
      setIsDealerPopoverOpen(false);
    }
  }, []);

  const handleDealerSelect = useCallback((currentValue: string) => {
    setDealerNameInput(currentValue);
    setIsDealerPopoverOpen(false);
  }, []);


  const handleSubmit = async (e: FormEvent) => {
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
    const finalRateFactor = parseFloat(finalRateStr); 

    if (isNaN(qLtr) || qLtr <= 0) {
      toast({ title: "Error", description: "Please enter a valid quantity.", variant: "destructive" });
      return;
    }
    if (isNaN(fatP) || fatP <= 0) { 
        toast({ title: "Error", description: "Please enter a valid FAT percentage (must be > 0).", variant: "destructive" });
        return;
    }
    if (isNaN(finalRateFactor) || finalRateFactor <= 0) {
      toast({ title: "Error", description: "Please enter a valid rate factor (must be > 0).", variant: "destructive" });
      return;
    }

    const finalTotalAmount = qLtr * fatP * finalRateFactor;

    const newEntryData: Omit<MilkCollectionEntry, 'id'> = {
      date, 
      time,
      dealerName: dealerNameInput.trim(),
      quantityLtr: qLtr,
      fatPercentage: fatP,
      ratePerLtr: finalRateFactor,
      totalAmount: finalTotalAmount,
    };
    
    console.log("CLIENT: Submitting new entry data:", JSON.parse(JSON.stringify(newEntryData)));
    setIsLoadingEntries(true); 
    const result = await addMilkCollectionEntryToFirestore(newEntryData);
    
    if (result.success) {
      toast({ title: "Success", description: "Milk collection entry added." });
      setDealerNameInput("");
      setQuantityLtr("");
      setFatPercentage("");
      // setRateInputValue("6.7"); // Keep rate for next entry
      setTime(new Date().toTimeString().substring(0,5)); 
      // setDate(new Date()); // Keep date for next entry or let user change
      await fetchEntries(); 
    } else {
      toast({ title: "Error", description: result.error || "Failed to add entry.", variant: "destructive" });
      setIsLoadingEntries(false); 
    }
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
                  <CalendarDays className="h-4 w-4 mr-2 text-muted-foreground" /> Date for New Entry
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
                <Label htmlFor="dealerNameInput" className="flex items-center mb-1">
                  <User className="h-4 w-4 mr-2 text-muted-foreground" /> Dealer Name
                </Label>
                <Popover open={isDealerPopoverOpen} onOpenChange={setIsDealerPopoverOpen}>
                  <PopoverTrigger asChild>
                    <Input
                      id="dealerNameInput"
                      value={dealerNameInput}
                      onChange={(e) => handleDealerNameInputChange(e.target.value)}
                      placeholder="Start typing dealer name"
                      autoComplete="off"
                      required
                      className="w-full"
                    />
                  </PopoverTrigger>
                  <PopoverContent className="w-[--radix-popover-trigger-width] p-0" onOpenAutoFocus={(e) => e.preventDefault()}>
                    <Command>
                      <CommandInput placeholder="Search dealers..." />
                      <CommandList>
                        <CommandEmpty>No dealer found.</CommandEmpty>
                        <CommandGroup>
                          {allKnownDealerNames
                            .filter((name) =>
                              name.toLowerCase().includes(dealerNameInput.toLowerCase())
                            )
                            .map((name) => (
                              <CommandItem
                                key={name}
                                value={name}
                                onSelect={handleDealerSelect}
                              >
                                {name}
                              </CommandItem>
                            ))}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
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
                  <IndianRupee className="h-4 w-4 mr-1 text-muted-foreground" /> Rate (₹)
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
              <Button type="submit" className="w-full" disabled={isLoadingEntries}>
                <PlusCircle className="h-4 w-4 mr-2" /> {isLoadingEntries && !allEntries.length ? 'Loading...' : (isLoadingEntries ? 'Adding...' : 'Add Entry')}
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
              <div className="flex-1">
                <CardTitle>Recent Collections</CardTitle>
                <CardDescription className="mt-1">
                  {tableFilterDate ? `Showing collections for ${format(tableFilterDate, 'PPP')}` : "Select a date to view collections."}
                  {isLoadingEntries && allEntries.length === 0 && " Loading entries..."}
                  {!isLoadingEntries && tableFilterDate && filteredEntries.length === 0 && ` (No entries for this date. Checked ${allEntries.length} total entries)`}
                </CardDescription>
              </div>
              <div className="w-full sm:w-auto sm:min-w-[240px]">
                <Label htmlFor="tableDateFilter" className="sr-only">Filter by date</Label>
                <DatePicker date={tableFilterDate} setDate={setTableFilterDate} />
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {isLoadingEntries && allEntries.length === 0 ? (
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
                    <TableHead>Time</TableHead>
                    <TableHead>Dealer</TableHead>
                    <TableHead className="text-right">Qty (Ltr)</TableHead>
                    <TableHead className="text-right">FAT (%)</TableHead>
                    <TableHead className="text-right">Rate (₹)</TableHead>
                    <TableHead className="text-right">Amount (₹)</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredEntries.length === 0 && !isLoadingEntries ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center text-muted-foreground">
                        {tableFilterDate ? `No entries for ${format(tableFilterDate, 'P')}.` : "Select a date to view entries."}
                        {tableFilterDate && allEntries.length > 0 && !filteredEntries.length && ` (Checked ${allEntries.length} total entries)`}
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredEntries.map((entry) => (
                      <TableRow key={entry.id}>
                        <TableCell>{entry.date instanceof Date ? format(entry.date, 'P') : 'Invalid Date'}</TableCell>
                        <TableCell>{entry.time}</TableCell>
                        <TableCell>{entry.dealerName}</TableCell>
                        <TableCell className="text-right">{entry.quantityLtr.toFixed(1)}</TableCell>
                        <TableCell className="text-right">{entry.fatPercentage.toFixed(1)}</TableCell>
                        <TableCell className="text-right">{entry.ratePerLtr ? entry.ratePerLtr.toFixed(2) : "-"}</TableCell>
                        <TableCell className="text-right">{entry.totalAmount ? entry.totalAmount.toFixed(2) : "-"}</TableCell>
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
