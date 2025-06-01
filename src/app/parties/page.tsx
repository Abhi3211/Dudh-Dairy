
"use client";

import { useState, type FormEvent, useEffect, useMemo, useCallback } from "react";
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
  TableFooter
} from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { User, PlusCircle, Trash2, Filter, CalendarDays, Sun, Moon, Download, Briefcase, FileText, IndianRupee, History } from "lucide-react"; 
import type { Party, PartyLedgerEntry } from "@/lib/types";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { Skeleton } from "@/components/ui/skeleton";
import { format, startOfDay, endOfDay } from "date-fns";
import { getPartiesFromFirestore, addPartyToFirestore, deletePartyFromFirestore, getPartyTransactions } from "./actions";
import { DatePicker } from "@/components/ui/date-picker";
import { usePageTitle } from '@/context/PageTitleContext';
import { parseEntryDate } from '@/lib/utils'; // Import from utils


const partyTypes: Party['type'][] = ["Customer", "Supplier", "Employee"];

export default function PartiesPage() {
  const { setPageTitle } = usePageTitle();
  const pageSpecificTitle = "Parties & Ledgers";

  useEffect(() => {
    setPageTitle(pageSpecificTitle);
  }, [setPageTitle, pageSpecificTitle]);

  const { toast } = useToast();
  const [parties, setParties] = useState<Party[]>([]);
  const [isLoadingParties, setIsLoadingParties] = useState(true); 
  const [isSubmittingParty, setIsSubmittingParty] = useState(false);
  const [selectedPartyId, setSelectedPartyId] = useState<string | undefined>(undefined);
  
  const [allLedgerEntriesForParty, setAllLedgerEntriesForParty] = useState<PartyLedgerEntry[]>([]);
  const [isLoadingLedger, setIsLoadingLedger] = useState(false);
  
  const [ledgerFilterStartDate, setLedgerFilterStartDate] = useState<Date | undefined>(undefined);
  const [ledgerFilterEndDate, setLedgerFilterEndDate] = useState<Date | undefined>(undefined);
  const [ledgerShiftFilter, setLedgerShiftFilter] = useState<"All" | "Morning" | "Evening">("All");

  const [newPartyName, setNewPartyName] = useState("");
  const [newPartyType, setNewPartyType] = useState<Party['type']>("Customer");
  const [newPartyOpeningBalance, setNewPartyOpeningBalance] = useState<string>("");
  const [newPartyOpeningBalanceDate, setNewPartyOpeningBalanceDate] = useState<Date | undefined>(undefined);


  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [partyToDelete, setPartyToDelete] = useState<Party | null>(null);

  const fetchParties = useCallback(async () => {
    setIsLoadingParties(true);
    try {
      const fetchedParties = await getPartiesFromFirestore();
      setParties(fetchedParties);
    } catch (error) {
      console.error("CLIENT: Failed to fetch parties:", error);
      toast({ title: "Error", description: "Could not fetch parties from the database.", variant: "destructive" });
    } finally {
      setIsLoadingParties(false);
    }
  },[toast]);

  useEffect(() => {
    fetchParties();
    if (ledgerFilterStartDate === undefined) {
        setLedgerFilterStartDate(startOfDay(new Date()));
    }
    if (ledgerFilterEndDate === undefined) {
        setLedgerFilterEndDate(endOfDay(new Date()));
    }
    if (newPartyOpeningBalanceDate === undefined) {
        setNewPartyOpeningBalanceDate(new Date());
    }
  }, [fetchParties, ledgerFilterStartDate, ledgerFilterEndDate, newPartyOpeningBalanceDate]);

  const selectedParty = useMemo(() => parties.find(p => p.id === selectedPartyId), [parties, selectedPartyId]);

  useEffect(() => {
    const fetchLedger = async () => {
      if (selectedPartyId && selectedParty) { // Check selectedPartyId as well
        setIsLoadingLedger(true);
        console.log(`CLIENT: Fetching ledger for party: ${selectedParty.name}, type: ${selectedParty.type}`);
        try {
          const transactions = await getPartyTransactions(selectedParty.id); // Pass partyId
          setAllLedgerEntriesForParty(transactions);
          console.log(`CLIENT: Fetched ${transactions.length} ledger entries for ${selectedParty.name}`);
        } catch (error) {
          console.error(`CLIENT: Error fetching ledger for ${selectedParty.name}:`, error);
          toast({ title: "Error", description: "Could not fetch ledger entries.", variant: "destructive" });
          setAllLedgerEntriesForParty([]);
        } finally {
          setIsLoadingLedger(false);
        }
      } else {
        setAllLedgerEntriesForParty([]);
      }
    };
    fetchLedger();
  }, [selectedPartyId, selectedParty, toast]); // Depend on selectedPartyId

  const filteredLedgerEntries = useMemo(() => {
    let filtered = allLedgerEntriesForParty;

    if (ledgerFilterStartDate || ledgerFilterEndDate) {
        filtered = filtered.filter(entry => {
            if (!entry.date || !(entry.date instanceof Date) || isNaN(entry.date.getTime())) {
                return false;
            }
            const entryDate = startOfDay(entry.date); 
            
            const start = ledgerFilterStartDate ? startOfDay(ledgerFilterStartDate) : null;
            const end = ledgerFilterEndDate ? endOfDay(ledgerFilterEndDate) : null; 

            if (start && entryDate < start) return false;
            if (end && entryDate > end) return false;
            return true;
        });
    }
    
    if (ledgerShiftFilter !== "All") {
        filtered = filtered.filter(entry => !entry.shift || entry.shift === ledgerShiftFilter);
    }
    return filtered;
  }, [allLedgerEntriesForParty, ledgerFilterStartDate, ledgerFilterEndDate, ledgerShiftFilter]);

  const currentOverallBalance = useMemo(() => {
    // The balance from the last entry in the ledger IS the current overall balance from dairy's perspective
    // Positive means party owes dairy, negative means dairy owes party
    if (filteredLedgerEntries.length > 0) {
      return filteredLedgerEntries[filteredLedgerEntries.length - 1].balance;
    }
    // If no ledger entries for the period, but there's an OB, this interpretation depends on new OB convention.
    // User entered positive OB: Dairy owes party. For dairy's perspective, this is negative.
    // User entered negative OB: Party owes dairy. For dairy's perspective, this is positive.
    if (selectedParty?.openingBalance) {
        return -selectedParty.openingBalance; 
    }
    return 0;
  }, [filteredLedgerEntries, selectedParty]);


  const handleAddPartySubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!newPartyName.trim()) {
      toast({ title: "Error", description: "Party name cannot be empty.", variant: "destructive" });
      return;
    }
    const openingBalanceNum = newPartyOpeningBalance ? parseFloat(newPartyOpeningBalance) : 0;
    if (newPartyOpeningBalance && isNaN(openingBalanceNum)) {
        toast({ title: "Error", description: "Opening balance must be a valid number.", variant: "destructive" });
        return;
    }
    if (openingBalanceNum !== 0 && !newPartyOpeningBalanceDate) {
        toast({ title: "Error", description: "Opening balance date is required if opening balance is not zero.", variant: "destructive" });
        return;
    }

    const partyData: Omit<Party, 'id'> = {
      name: newPartyName.trim(),
      type: newPartyType,
      openingBalance: openingBalanceNum, // This is now stored as per the new universal convention
      openingBalanceAsOfDate: openingBalanceNum !== 0 ? newPartyOpeningBalanceDate : undefined,
    };
    
    setIsSubmittingParty(true);
    const result = await addPartyToFirestore(partyData);
    
    if (result.success) {
      await fetchParties(); 
      setNewPartyName("");
      setNewPartyType("Customer");
      setNewPartyOpeningBalance("");
      setNewPartyOpeningBalanceDate(new Date());
      toast({ title: "Success", description: `Party "${partyData.name}" added.` });
    } else {
      toast({ title: "Error", description: result.error || "Failed to add party.", variant: "destructive" });
    }
    setIsSubmittingParty(false);
  };

  const openDeleteDialog = (party: Party) => {
    setPartyToDelete(party);
    setDeleteDialogOpen(true);
  };

  const confirmDeleteParty = async () => {
    if (partyToDelete) {
      setIsSubmittingParty(true);
      const result = await deletePartyFromFirestore(partyToDelete.id);
      
      if (result.success) {
        await fetchParties(); 
        toast({ title: "Success", description: `Party "${partyToDelete.name}" deleted.` });
        if (selectedPartyId === partyToDelete.id) {
          setSelectedPartyId(undefined); 
        }
      } else {
        toast({ title: "Error", description: result.error || "Failed to delete party.", variant: "destructive" });
      }
      setPartyToDelete(null);
      setIsSubmittingParty(false);
    }
    setDeleteDialogOpen(false);
  };

  const escapeCSVField = (field: any): string => {
    const str = String(field === undefined || field === null ? "" : field);
    if (str.includes(",")) {
      return `"${str.replace(/"/g, '""')}"`; 
    }
    return str;
  };

  const handleExportCSV = useCallback(() => {
    if (!selectedParty || filteredLedgerEntries.length === 0) {
      toast({ title: "No Data", description: "No ledger entries to export for the current selection.", variant: "destructive" });
      return;
    }

    const headers = [
      "Date", "Description", "Shift", "Milk Qty (Ltr)", "Debit (₹)", "Credit (₹)", "Balance (₹)"
    ];
    
    const rows = filteredLedgerEntries.map(entry => [
      format(entry.date, 'yyyy-MM-dd'),
      escapeCSVField(entry.description),
      escapeCSVField(entry.shift || "-"),
      escapeCSVField(entry.milkQuantityLtr?.toFixed(1) || "-"),
      escapeCSVField(entry.debit?.toFixed(2) || "-"),
      escapeCSVField(entry.credit?.toFixed(2) || "-"),
      escapeCSVField(entry.balance.toFixed(2))
    ]);

    const csvContent = [
      headers.join(","),
      ...rows.map(row => row.join(","))
    ].join("\n");

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    if (link.download !== undefined) {
      const url = URL.createObjectURL(blob);
      const baseFilename = `${selectedParty.name.replace(/\s+/g, '_')}_ledger`;
      const startDateStr = ledgerFilterStartDate ? format(ledgerFilterStartDate, 'yyyyMMdd') : 'any_start';
      const endDateStr = ledgerFilterEndDate ? format(ledgerFilterEndDate, 'yyyyMMdd') : 'any_end';
      const filename = `${baseFilename}_${startDateStr}_to_${endDateStr}.csv`;

      link.setAttribute("href", url);
      link.setAttribute("download", filename);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      toast({ title: "Success", description: "Ledger exported to CSV." });
    } else {
        toast({ title: "Error", description: "CSV export is not supported by your browser.", variant: "destructive" });
    }
  }, [filteredLedgerEntries, selectedParty, ledgerFilterStartDate, ledgerFilterEndDate, toast]);
  
  const ledgerDateRangeDescription = useMemo(() => {
    if (ledgerFilterStartDate && ledgerFilterEndDate) {
      if (format(ledgerFilterStartDate, 'yyyy-MM-dd') === format(ledgerFilterEndDate, 'yyyy-MM-dd')) {
        return format(ledgerFilterStartDate, 'PPP');
      }
      return `${format(ledgerFilterStartDate, 'PPP')} to ${format(ledgerFilterEndDate, 'PPP')}`;
    } else if (ledgerFilterStartDate) {
      return `from ${format(ledgerFilterStartDate, 'PPP')}`;
    } else if (ledgerFilterEndDate) {
      return `up to ${format(ledgerFilterEndDate, 'PPP')}`;
    }
    return "for all dates";
  }, [ledgerFilterStartDate, ledgerFilterEndDate]);

  const openingBalanceConventionText = useMemo(() => {
    // Universal convention based on user feedback
    return "Positive (+): Dairy owes this party (e.g., an advance from customer, or amount due to supplier). Negative (-): This party owes Dairy (e.g., customer dues).";
  }, []);


  return (
    <div>
      <PageHeader title={pageSpecificTitle} description="Manage parties and view their transaction ledgers." />

      <div className="mb-6">
        <Label htmlFor="partySelect">Select Party to View Ledger</Label>
        {isLoadingParties && parties.length === 0 ? ( 
          <Skeleton className="h-10 w-full md:w-1/3" />
        ) : (
          <Select value={selectedPartyId} onValueChange={setSelectedPartyId} disabled={parties.length === 0 && !isLoadingParties}>
            <SelectTrigger id="partySelect" className="w-full md:w-1/3">
              <SelectValue placeholder="Select a party" />
            </SelectTrigger>
            <SelectContent>
              {parties.length === 0 && !isLoadingParties && <SelectItem value="no-parties" disabled>No parties found. Add one below.</SelectItem>}
              {isLoadingParties && <SelectItem value="loading" disabled>Loading parties...</SelectItem>}
              {parties.map(p => (
                <SelectItem key={p.id} value={p.id}>{p.name} ({p.type})</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>

      {selectedPartyId && selectedParty && (
        <div className="mb-8">
          <Card>
            <CardHeader>
             <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
                <div className="flex-1">
                    <CardTitle>Transaction History for {selectedParty.name} <span className="text-sm font-normal text-muted-foreground">({selectedParty.type})</span></CardTitle>
                    <CardDescription className="mt-1">
                        Current Overall Balance (Dairy's Perspective): <span className={`font-semibold ${currentOverallBalance === 0 ? '' : currentOverallBalance > 0 ? 'text-chart-3' : 'text-chart-4'}`}>₹{Math.abs(currentOverallBalance).toFixed(2)}</span>
                        {currentOverallBalance > 0 && " (Party Owes Dairy)"}
                        {currentOverallBalance < 0 && " (Dairy Owes Party)"}
                        {currentOverallBalance === 0 && " (Settled)"}
                        <br />
                        Showing transactions {ledgerDateRangeDescription}
                        {ledgerShiftFilter !== 'All' ? ` (${ledgerShiftFilter} shift)` : ''}.
                        {isLoadingLedger && " Loading ledger..."}
                        {!isLoadingLedger && (ledgerFilterStartDate || ledgerFilterEndDate) && filteredLedgerEntries.length === 0 && ` (No transactions for this filter. Checked ${allLedgerEntriesForParty.length} total entries for party)`}
                         {!isLoadingLedger && allLedgerEntriesForParty.length === 0 && filteredLedgerEntries.length === 0 && " No transactions found for this party."}
                    </CardDescription>
                </div>
                <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto items-end">
                    <div className="w-full sm:min-w-[180px]">
                      <Label htmlFor="ledgerShiftFilterSelect" className="sr-only">Filter by shift</Label>
                      <Select value={ledgerShiftFilter} onValueChange={(value: "All" | "Morning" | "Evening") => setLedgerShiftFilter(value)}>
                          <SelectTrigger id="ledgerShiftFilterSelect" className="min-w-[150px]">
                          <Filter className="h-3 w-3 mr-2 text-muted-foreground" />
                          <SelectValue placeholder="Filter by shift" />
                          </SelectTrigger>
                          <SelectContent>
                          <SelectItem value="All">All Shifts</SelectItem>
                          <SelectItem value="Morning"><Sun className="h-4 w-4 mr-1 inline-block text-muted-foreground" />Morning</SelectItem>
                          <SelectItem value="Evening"><Moon className="h-4 w-4 mr-1 inline-block text-muted-foreground" />Evening</SelectItem>
                          </SelectContent>
                      </Select>
                    </div>
                    <div className="w-full sm:min-w-[180px]">
                      <Label htmlFor="ledgerStartDateFilter" className="sr-only">Start Date</Label>
                      <DatePicker date={ledgerFilterStartDate} setDate={setLedgerFilterStartDate} />
                    </div>
                     <div className="w-full sm:min-w-[180px]">
                      <Label htmlFor="ledgerEndDateFilter" className="sr-only">End Date</Label>
                      <DatePicker date={ledgerFilterEndDate} setDate={setLedgerFilterEndDate} />
                    </div>
                    <Button onClick={handleExportCSV} variant="outline" size="sm" className="ml-auto sm:ml-2 mt-2 sm:mt-0" disabled={filteredLedgerEntries.length === 0 || isLoadingLedger}>
                        <Download className="h-4 w-4 mr-2" /> Export CSV
                    </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {isLoadingLedger ? (
                <div className="space-y-2">
                  <Skeleton className="h-10 w-full" />
                  <Skeleton className="h-10 w-full" />
                  <Skeleton className="h-10 w-full" />
                </div>
              ) : (
                <Table>
                  <TableHeader><TableRow><TableHead>Date</TableHead><TableHead>Description</TableHead><TableHead>Shift</TableHead><TableHead>Milk Qty</TableHead><TableHead className="text-right">Debit (₹)</TableHead><TableHead className="text-right">Credit (₹)</TableHead><TableHead className="text-right">Balance (₹)</TableHead></TableRow></TableHeader>
                  <TableBody>
                    {allLedgerEntriesForParty.length === 0 && !isLoadingLedger && (<TableRow><TableCell colSpan={7} className="text-center text-muted-foreground">No transactions found for this party.</TableCell></TableRow>)}
                    {filteredLedgerEntries.length === 0 && !isLoadingLedger && allLedgerEntriesForParty.length > 0 && (<TableRow><TableCell colSpan={7} className="text-center text-muted-foreground">No transactions match the current filter.</TableCell></TableRow>)}
                    {filteredLedgerEntries.map(entry => (
                      <TableRow key={entry.id}>
                        <TableCell>{entry.date instanceof Date && !isNaN(entry.date.getTime()) ? format(entry.date, 'P') : 'Invalid Date'}</TableCell>
                        <TableCell className="max-w-[250px] truncate" title={entry.description}>{entry.description}</TableCell>
                        <TableCell>{entry.shift || "-"}</TableCell>
                        <TableCell>{entry.milkQuantityLtr ? `${entry.milkQuantityLtr.toFixed(1)}L` : '-'}</TableCell>
                        <TableCell className="text-right text-chart-4">{entry.debit && entry.debit !== 0 ? entry.debit.toFixed(2) : "-"}</TableCell>
                        <TableCell className="text-right text-chart-3">{entry.credit && entry.credit !== 0 ? entry.credit.toFixed(2) : "-"}</TableCell>
                        <TableCell className={`text-right font-semibold ${entry.balance === 0 ? '' : entry.balance > 0 ? 'text-chart-3' : 'text-chart-4'}`}>{entry.balance.toFixed(2)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                   {filteredLedgerEntries.length > 0 && (
                    <TableFooter>
                        <TableRow>
                            <TableCell colSpan={6} className="text-right font-semibold">Final Balance for Period:</TableCell>
                            <TableCell className={`text-right font-bold ${filteredLedgerEntries[filteredLedgerEntries.length -1].balance === 0 ? '' : filteredLedgerEntries[filteredLedgerEntries.length -1].balance > 0 ? 'text-chart-3' : 'text-chart-4'}`}>
                                {filteredLedgerEntries[filteredLedgerEntries.length -1].balance.toFixed(2)}
                            </TableCell>
                        </TableRow>
                    </TableFooter>
                   )}
                </Table>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {!selectedPartyId && !isLoadingParties && parties.length === 0 && (
        <p className="text-center text-muted-foreground my-8">No parties found. Add one to get started.</p>
      )}
       {!selectedPartyId && isLoadingParties && !selectedParty && ( 
        <p className="text-center text-muted-foreground my-8">Loading parties...</p>
      )}


      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-8">
        <Card>
          <CardHeader><CardTitle>Add New Party</CardTitle><CardDescription>Create a new customer, supplier, or employee.</CardDescription></CardHeader>
          <CardContent>
            <form onSubmit={handleAddPartySubmit} className="space-y-4">
              <div><Label htmlFor="newPartyName" className="flex items-center mb-1"><User className="h-4 w-4 mr-2 text-muted-foreground" />Party Name</Label><Input id="newPartyName" value={newPartyName} onChange={(e) => setNewPartyName(e.target.value)} placeholder="Enter party name" required /></div>
              <div><Label htmlFor="newPartyType" className="flex items-center mb-1"><Briefcase className="h-4 w-4 mr-2 text-muted-foreground" />Party Type</Label><Select value={newPartyType} onValueChange={(value: Party['type']) => setNewPartyType(value)}><SelectTrigger id="newPartyType"><SelectValue placeholder="Select party type" /></SelectTrigger><SelectContent>{partyTypes.map(type => (<SelectItem key={type} value={type}>{type}</SelectItem>))}</SelectContent></Select></div>
              
              <div>
                <Label htmlFor="newPartyOpeningBalance" className="flex items-center mb-1">
                  <IndianRupee className="h-4 w-4 mr-1 text-muted-foreground" /> Opening Balance (₹)
                </Label>
                <Input id="newPartyOpeningBalance" type="number" step="0.01" value={newPartyOpeningBalance} onChange={(e) => setNewPartyOpeningBalance(e.target.value)} placeholder="e.g., 100 or -50" />
                <p className="text-xs text-muted-foreground mt-1">{openingBalanceConventionText}</p>
              </div>
              
              <div>
                <Label htmlFor="newPartyOpeningBalanceDate" className="flex items-center mb-1">
                  <History className="h-4 w-4 mr-2 text-muted-foreground" /> As of Date (for Opening Balance)
                </Label>
                <DatePicker date={newPartyOpeningBalanceDate} setDate={setNewPartyOpeningBalanceDate} />
                 <p className="text-xs text-muted-foreground mt-1">Required if opening balance is not zero. Defaults to today.</p>
              </div>

              <Button type="submit" className="w-full" disabled={isSubmittingParty}><PlusCircle className="h-4 w-4 mr-2" /> {isSubmittingParty ? 'Adding...' : 'Add Party'}</Button>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Manage Parties</CardTitle><CardDescription>View and remove existing parties.</CardDescription></CardHeader>
          <CardContent>
            {isLoadingParties && parties.length === 0 ? (
              <div>
                <Skeleton className="h-8 w-full mb-2" />
                <Skeleton className="h-8 w-full mb-2" />
                <Skeleton className="h-8 w-full" />
              </div>
            ) : parties.length === 0 && !isLoadingParties ? (
              <p className="text-muted-foreground text-center">No parties found. Add one to get started.</p>
            ) : (
              <div className="max-h-96 overflow-y-auto">
                <Table>
                  <TableHeader><TableRow><TableHead>Name</TableHead><TableHead>Type</TableHead><TableHead>Opening Balance (₹)</TableHead><TableHead>As of</TableHead><TableHead className="text-right">Actions</TableHead></TableRow></TableHeader>
                  <TableBody>
                    {parties.map(party => (
                      <TableRow key={party.id}>
                        <TableCell>{party.name}</TableCell>
                        <TableCell>{party.type}</TableCell>
                        <TableCell className={party.openingBalance && party.openingBalance < 0 ? 'text-chart-3' : party.openingBalance && party.openingBalance > 0 ? 'text-chart-4' : ''}>
                          {/* Displaying the raw entered OB. Positive means Dairy Owes, Negative means Party Owes. */}
                          {party.openingBalance !== undefined && party.openingBalance !== 0 ? party.openingBalance.toFixed(2) : "-"}
                        </TableCell>
                        <TableCell>
                          {party.openingBalanceAsOfDate && party.openingBalance !== 0 ? format(parseEntryDate(party.openingBalanceAsOfDate), 'P') : "-"}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button variant="ghost" size="icon" onClick={() => openDeleteDialog(party)} disabled={isSubmittingParty}>
                            <Trash2 className="h-4 w-4 text-destructive" /><span className="sr-only">Delete {party.name}</span>
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {deleteDialogOpen && partyToDelete && (
        <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader><AlertDialogTitle>Are you sure?</AlertDialogTitle>
              <AlertDialogDescription>This action cannot be undone. This will permanently delete the party "{partyToDelete?.name}". Related transaction entries will NOT be deleted but will refer to a non-existent party.</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter><AlertDialogCancel onClick={() => {setDeleteDialogOpen(false); setPartyToDelete(null);}}>Cancel</AlertDialogCancel><AlertDialogAction onClick={confirmDeleteParty} className="bg-destructive hover:bg-destructive/90" disabled={isSubmittingParty}>{isSubmittingParty ? 'Deleting...' : 'Delete'}</AlertDialogAction></AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
    </div>
  );
}


    