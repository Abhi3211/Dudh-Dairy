
"use client";

import { useState, type FormEvent, useEffect, useMemo, useCallback } from "react";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  TableFooter
} from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { CalendarDays, User, Percent, Scale, IndianRupee, PlusCircle, Sun, Moon, Filter } from "lucide-react";
import type { MilkCollectionEntry } from "@/lib/types";
import { DatePicker } from "@/components/ui/date-picker";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { Skeleton } from "@/components/ui/skeleton";
import { addMilkCollectionEntryToFirestore, getMilkCollectionEntriesFromFirestore } from "./actions";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";


const MOCK_DEALER_NAMES = ["Rajesh Dairy", "Suresh Milk Co.", "Anand Farms", "Krishna Dairy"];

export default function MilkCollectionPage() {
  const { toast } = useToast();
  const [allEntries, setAllEntries] = useState<MilkCollectionEntry[]>([]);
  const [isLoadingEntries, setIsLoadingEntries] = useState(true);
  
  const [date, setDate] = useState<Date | undefined>(undefined);
  const [shift, setShift] = useState<"Morning" | "Evening">("Morning");
  const [tableFilterDate, setTableFilterDate] = useState<Date | undefined>(undefined);
  const [shiftFilter, setShiftFilter] = useState<"All" | "Morning" | "Evening">("All");
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
      console.log('CLIENT: Raw fetched entries from Firestore:', JSON.parse(JSON.stringify(fetchedEntries)));
      const processedEntries = fetchedEntries.map(entry => ({
        ...entry,
        date: entry.date instanceof Date ? entry.date : new Date(entry.date) 
      }));
      console.log('CLIENT: Processed milk collection entries. Count:', processedEntries.length, 'Data (sample):', processedEntries.length > 0 ? JSON.parse(JSON.stringify(processedEntries[0])) : 'N/A');
      setAllEntries(processedEntries);
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
    console.log("CLIENT: Recalculating filteredEntries. Selected tableFilterDate:", tableFilterDate ? format(tableFilterDate, 'yyyy-MM-dd') : 'undefined', "Selected shiftFilter:", shiftFilter, "Total entries being filtered:", allEntries.length);
    
    let dateFiltered = allEntries;
    if (tableFilterDate !== undefined) {
        const targetDateStr = format(tableFilterDate, 'yyyy-MM-dd');
        dateFiltered = allEntries.filter(entry => {
            if (!entry.date || !(entry.date instanceof Date) || isNaN(entry.date.getTime())) {
                console.warn("CLIENT: Invalid or missing date in entry during date filtering:", entry);
                return false;
            }
            const entryDateStr = format(entry.date, 'yyyy-MM-dd');
            const match = entryDateStr === targetDateStr;
            console.log(`CLIENT (Date Filter): Comparing entry ID ${entry.id}: entryDateStr=${entryDateStr}, targetDateStr=${targetDateStr}, match=${match}. Entry date object:`, entry.date);
            return match;
        });
    } else {
        console.log("CLIENT (Date Filter): No tableFilterDate selected, using all entries for shift filtering. Count:", allEntries.length);
    }

    let shiftAndDateFiltered = dateFiltered;
    if (shiftFilter !== "All") {
        shiftAndDateFiltered = dateFiltered.filter(entry => {
            const match = entry.shift === shiftFilter;
            console.log(`CLIENT (Shift Filter): Comparing entry ID ${entry.id}: entry.shift=${entry.shift}, shiftFilter=${shiftFilter}, match=${match}`);
            return match;
        });
    } else {
        console.log("CLIENT (Shift Filter): shiftFilter is 'All', using date filtered entries. Count:", dateFiltered.length);
    }
    
    console.log("CLIENT: Resulting filteredEntries count:", shiftAndDateFiltered.length);
    if (shiftAndDateFiltered.length > 0 && shiftAndDateFiltered.length < 5) { 
        console.log("CLIENT: Filtered entries data (sample):", JSON.parse(JSON.stringify(shiftAndDateFiltered)));
    }
    return shiftAndDateFiltered;
  }, [allEntries, tableFilterDate, shiftFilter]);
  
  const totalFilteredAmount = useMemo(() => {
    return filteredEntries.reduce((sum, entry) => sum + (entry.totalAmount || 0), 0);
  }, [filteredEntries]);


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
    if (!date || !shift || !dealerNameInput.trim() || !quantityLtr || !fatPercentage || !rateInputValue) {
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
      shift,
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
      // The 'shift' and 'date' states are intentionally not reset here to persist them for the next entry.
      // setShift("Morning"); // Removed to persist shift
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
                <Label className="flex items-center mb-1">Shift</Label>
                <RadioGroup
                  value={shift}
                  onValueChange={(value: "Morning" | "Evening") => setShift(value)}
                  className="flex space-x-4"
                >
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="Morning" id="morning" />
                    <Label htmlFor="morning" className="font-normal flex items-center"><Sun className="h-4 w-4 mr-1 text-muted-foreground" />Morning</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="Evening" id="evening" />
                    <Label htmlFor="evening" className="font-normal flex items-center"><Moon className="h-4 w-4 mr-1 text-muted-foreground" />Evening</Label>
                  </div>
                </RadioGroup>
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
                  <PopoverContent className="w-[--radix-popover-trigger-width] p-0" side="bottom" align="start" sideOffset={0} onOpenAutoFocus={(e) => e.preventDefault()}>
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
                <PlusCircle className="h-4 w-4 mr-2" /> {isLoadingEntries && allEntries.length === 0 && !tableFilterDate ? 'Loading...' : (isLoadingEntries ? 'Adding...' : 'Add Entry')}
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
              <div className="flex-1">
                <CardTitle>Daily Ledger</CardTitle>
                <CardDescription className="mt-1">
                  {tableFilterDate ? `Ledger for ${format(tableFilterDate, 'PPP')}${shiftFilter !== 'All' ? ` (${shiftFilter} shift)` : ''}` : "Select a date to view ledger."}
                  {isLoadingEntries && allEntries.length === 0 && " Loading entries..."}
                  {!isLoadingEntries && tableFilterDate && filteredEntries.length === 0 && ` (No entries for this date${shiftFilter !== 'All' ? ` and shift` : ''}. Checked ${allEntries.length} total entries)`}
                </CardDescription>
              </div>
              <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
                <div className="w-full sm:min-w-[180px]">
                  <Label htmlFor="shiftFilterSelect" className="sr-only">Filter by shift</Label>
                  <Select value={shiftFilter} onValueChange={(value: "All" | "Morning" | "Evening") => setShiftFilter(value)}>
                    <SelectTrigger id="shiftFilterSelect">
                      <Filter className="h-3 w-3 mr-2 text-muted-foreground" />
                      <SelectValue placeholder="Filter by shift" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="All">All Shifts</SelectItem>
                      <SelectItem value="Morning">Morning</SelectItem>
                      <SelectItem value="Evening">Evening</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="w-full sm:min-w-[200px]">
                  <Label htmlFor="tableDateFilter" className="sr-only">Filter by date</Label>
                  <DatePicker date={tableFilterDate} setDate={setTableFilterDate} />
                </div>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {isLoadingEntries && allEntries.length === 0 && !tableFilterDate ? ( 
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
                    <TableHead>Shift</TableHead>
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
                        {tableFilterDate ? `No entries for ${format(tableFilterDate, 'P')}${shiftFilter !== 'All' ? ` (${shiftFilter} shift)` : ''}.` : "Select a date and shift to view entries."}
                        {tableFilterDate && allEntries.length > 0 && !filteredEntries.length && ` (Checked ${allEntries.length} total entries)`}
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredEntries.map((entry) => (
                      <TableRow key={entry.id}>
                        <TableCell>{entry.date instanceof Date && !isNaN(entry.date.getTime()) ? format(entry.date, 'P') : 'Invalid Date'}</TableCell>
                        <TableCell>{entry.shift}</TableCell>
                        <TableCell>{entry.dealerName}</TableCell>
                        <TableCell className="text-right">{entry.quantityLtr.toFixed(1)}</TableCell>
                        <TableCell className="text-right">{entry.fatPercentage.toFixed(1)}</TableCell>
                        <TableCell className="text-right">{entry.ratePerLtr ? entry.ratePerLtr.toFixed(2) : "-"}</TableCell>
                        <TableCell className="text-right">{entry.totalAmount ? entry.totalAmount.toFixed(2) : "-"}</TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
                {filteredEntries.length > 0 && (
                  <TableFooter>
                    <TableRow>
                      <TableCell colSpan={6} className="text-right font-semibold">Total Amount:</TableCell>
                      <TableCell className="text-right font-bold">{totalFilteredAmount.toFixed(2)}</TableCell>
                    </TableRow>
                  </TableFooter>
                )}
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

    
