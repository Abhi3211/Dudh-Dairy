
"use client";

import { useState, type FormEvent, useEffect, useMemo, useCallback, useRef } from "react";
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
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CalendarDays, Clock, User, Percent, Scale, IndianRupee, PlusCircle } from "lucide-react";
import type { MilkCollectionEntry } from "@/lib/types";
import { DatePicker } from "@/components/ui/date-picker";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { Skeleton } from "@/components/ui/skeleton";
import { addMilkCollectionEntryToFirestore, getMilkCollectionEntriesFromFirestore } from "./actions";

// Static list of some dealer names for initial suggestions
const MOCK_DEALER_NAMES = ["Rajesh Dairy", "Suresh Milk Co.", "Anand Farms", "Krishna Dairy"];

export default function MilkCollectionPage() {
  const { toast } = useToast();
  const [allEntries, setAllEntries] = useState<MilkCollectionEntry[]>([]);
  const [isLoadingEntries, setIsLoadingEntries] = useState(true);
  
  // Form state
  const [date, setDate] = useState<Date | undefined>(undefined);
  const [time, setTime] = useState<string>("");
  const [dealerNameInput, setDealerNameInput] = useState<string>("");
  const [quantityLtr, setQuantityLtr] = useState<string>("");
  const [fatPercentage, setFatPercentage] = useState<string>("");
  const [rateInputValue, setRateInputValue] = useState<string>("6.7"); 

  // Dealer name suggestions state
  const [dealerSuggestions, setDealerSuggestions] = useState<string[]>([]);
  const [isDealerPopoverOpen, setIsDealerPopoverOpen] = useState(false);
  const dealerNameInputRef = useRef<HTMLInputElement>(null);

  const fetchEntries = useCallback(async () => {
    setIsLoadingEntries(true);
    try {
      const fetchedEntries = await getMilkCollectionEntriesFromFirestore();
      console.log('Client: Fetched entries from Firestore:', JSON.stringify(fetchedEntries.map(e => ({...e, date: e.date.toISOString()})), null, 2));
      setAllEntries(fetchedEntries);
    } catch (error) {
      console.error("Failed to fetch milk collection entries:", error);
      toast({ title: "Error", description: "Could not fetch milk collection entries.", variant: "destructive" });
    } finally {
      setIsLoadingEntries(false);
    }
  }, [toast]);

  useEffect(() => {
    // Initialize date and time client-side to avoid hydration issues
    setDate(new Date());
    setTime(new Date().toTimeString().substring(0, 5));
    fetchEntries();
  }, [fetchEntries]);

  const uniqueDealerNamesFromEntries = useMemo(() => {
    const names = new Set(allEntries.map(entry => entry.dealerName));
    return Array.from(names);
  }, [allEntries]);

  const allKnownDealerNames = useMemo(() => {
    return Array.from(new Set([...MOCK_DEALER_NAMES, ...uniqueDealerNamesFromEntries]));
  }, [uniqueDealerNamesFromEntries]);

  const handleDealerNameChange = (value: string) => {
    setDealerNameInput(value); 
    const trimmedValue = value.trim(); 

    if (trimmedValue) {
      const filtered = allKnownDealerNames.filter(name =>
        name.toLowerCase().includes(trimmedValue.toLowerCase()) 
      );
      setDealerSuggestions(filtered);
      setIsDealerPopoverOpen(filtered.length > 0); 
    } else {
      setDealerSuggestions([]);
      setIsDealerPopoverOpen(false); 
    }
  };

  const handleDealerSuggestionClick = (suggestion: string) => {
    setDealerNameInput(suggestion);
    setDealerSuggestions([]);
    setIsDealerPopoverOpen(false);
    dealerNameInputRef.current?.focus(); // Explicitly focus the input
  };


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
    if (!date) return [];
    
    const targetDateStr = format(date, 'yyyy-MM-dd');
    return allEntries.filter(entry => {
        const entryDateStr = format(entry.date, 'yyyy-MM-dd');
        return entryDateStr === targetDateStr;
    });
  }, [allEntries, date]);

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

    const newEntryData: Omit<MilkCollectionEntry, 'id'> = {
      date, 
      time,
      dealerName: dealerNameInput.trim(),
      quantityLtr: qLtr,
      fatPercentage: fatP,
      ratePerLtr: finalRate,
      totalAmount: finalTotalAmount,
    };
    
    setIsLoadingEntries(true); 
    const result = await addMilkCollectionEntryToFirestore(newEntryData);
    
    if (result.success) {
      toast({ title: "Success", description: "Milk collection entry added." });
      setDealerNameInput("");
      setQuantityLtr("");
      setFatPercentage("");
      // setRateInputValue("6.7"); // Keep rate as user might want to reuse for next entry.
      setTime(new Date().toTimeString().substring(0,5));
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
                <Popover open={isDealerPopoverOpen} onOpenChange={setIsDealerPopoverOpen}>
                  <PopoverTrigger asChild>
                    <Input
                        id="dealerName"
                        ref={dealerNameInputRef}
                        value={dealerNameInput}
                        onChange={(e) => handleDealerNameChange(e.target.value)}
                        placeholder="Type to search dealer"
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
                    {dealerSuggestions.length === 0 && dealerNameInput.trim() ? (
                        <div className="p-2 text-sm text-muted-foreground">No dealers found.</div>
                    ) : (
                      <div className="max-h-48 overflow-auto">
                        {dealerSuggestions.map(suggestion => (
                          <div
                            key={suggestion}
                            className="p-2 hover:bg-accent cursor-pointer text-sm"
                            onClick={() => handleDealerSuggestionClick(suggestion)} 
                          >
                            {suggestion}
                          </div>
                        ))}
                      </div>
                    )}
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
              <Button type="submit" className="w-full" disabled={isLoadingEntries}>
                <PlusCircle className="h-4 w-4 mr-2" /> {isLoadingEntries && !allEntries.length ? 'Loading...' : (isLoadingEntries ? 'Adding...' : 'Add Entry')}
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Recent Collections</CardTitle>
            <CardDescription>
              {date ? `Showing collections for ${format(date, 'PPP')}` : "Select a date to view collections."}
              {isLoadingEntries && allEntries.length === 0 && " Loading entries..."}
              {!isLoadingEntries && date && filteredEntries.length === 0 && allEntries.length > 0 && ` (Checked ${allEntries.length} total entries)`}
            </CardDescription>
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
                    <TableHead className="text-right">Rate (₹/Ltr)</TableHead>
                    <TableHead className="text-right">Amount (₹)</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredEntries.length === 0 && !isLoadingEntries ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center text-muted-foreground">
                        {date ? `No entries for ${format(date, 'P')}.` : "Select a date to view entries."}
                        {date && allEntries.length > 0 && !filteredEntries.length && ` (Checked ${allEntries.length} total entries)`}
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredEntries.map((entry) => (
                      <TableRow key={entry.id}>
                        <TableCell>{format(entry.date, 'P')}</TableCell>
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
    
