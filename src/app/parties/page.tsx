
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
} from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { User, PlusCircle, Trash2, Filter, CalendarDays, Sun, Moon, Download, Briefcase } from "lucide-react"; 
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
import { format } from "date-fns";
import { getPartiesFromFirestore, addPartyToFirestore, deletePartyFromFirestore, getPartyTransactions } from "./actions";
import { DatePicker } from "@/components/ui/date-picker";
import { usePageTitle } from '@/context/PageTitleContext';


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
  const [ledgerFilterDate, setLedgerFilterDate] = useState<Date | undefined>(undefined);
  const [ledgerShiftFilter, setLedgerShiftFilter] = useState<"All" | "Morning" | "Evening">("All");

  const [newPartyName, setNewPartyName] = useState("");
  const [newPartyType, setNewPartyType] = useState<Party['type']>("Customer");

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
    setLedgerFilterDate(new Date()); // Set default ledger filter date
  }, [fetchParties]);

  const selectedParty = useMemo(() => parties.find(p => p.id === selectedPartyId), [parties, selectedPartyId]);

  useEffect(() => {
    const fetchLedger = async () => {
      if (selectedParty) {
        setIsLoadingLedger(true);
        console.log(`CLIENT: Fetching ledger for party: ${selectedParty.name}`);
        try {
          const transactions = await getPartyTransactions(selectedParty.name); // Using party name for now
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
  }, [selectedParty, toast]);

  const filteredLedgerEntries = useMemo(() => {
    console.log("CLIENT: Recalculating filteredLedgerEntries for Parties page. Selected ledgerFilterDate:", ledgerFilterDate ? format(ledgerFilterDate, 'yyyy-MM-dd') : 'undefined', "Selected ledgerShiftFilter:", ledgerShiftFilter, "Total entries being filtered:", allLedgerEntriesForParty.length);
    
    let dateFiltered = allLedgerEntriesForParty;
    if (ledgerFilterDate !== undefined) {
        const targetDateStr = format(ledgerFilterDate, 'yyyy-MM-dd');
        dateFiltered = allLedgerEntriesForParty.filter(entry => {
            if (!entry.date || !(entry.date instanceof Date) || isNaN(entry.date.getTime())) {
                return false;
            }
            const entryDateStr = format(entry.date, 'yyyy-MM-dd');
            return entryDateStr === targetDateStr;
        });
    }
    let shiftAndDateFiltered = dateFiltered;
    if (ledgerShiftFilter !== "All") {
        shiftAndDateFiltered = dateFiltered.filter(entry => entry.shift === ledgerShiftFilter);
    }
    console.log("CLIENT: Parties page - Resulting filteredLedgerEntries count:", shiftAndDateFiltered.length);
    return shiftAndDateFiltered;
  }, [allLedgerEntriesForParty, ledgerFilterDate, ledgerShiftFilter]);

  const currentOverallBalance = useMemo(() => {
    return allLedgerEntriesForParty.length > 0 ? allLedgerEntriesForParty[allLedgerEntriesForParty.length - 1].balance : 0;
  }, [allLedgerEntriesForParty]);


  const handleAddPartySubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!newPartyName.trim()) {
      toast({ title: "Error", description: "Party name cannot be empty.", variant: "destructive" });
      return;
    }
    const partyData: Omit<Party, 'id'> = {
      name: newPartyName.trim(),
      type: newPartyType,
    };
    
    setIsSubmittingParty(true);
    const result = await addPartyToFirestore(partyData);
    
    if (result.success) {
      await fetchParties(); // Re-fetch parties to update the list including the new one
      setNewPartyName("");
      setNewPartyType("Customer");
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
        await fetchParties(); // Re-fetch parties
        toast({ title: "Success", description: `Party "${partyToDelete.name}" deleted.` });
        if (selectedPartyId === partyToDelete.id) {
          setSelectedPartyId(undefined); // Clear selection if deleted party was selected
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
      "Date",
      "Shift",
      "Description",
      "Milk Qty (Ltr)",
      "Debit (₹)",
      "Credit (₹)",
      "Balance (₹)"
    ];
    
    const rows = filteredLedgerEntries.map(entry => [
      format(entry.date, 'yyyy-MM-dd'),
      escapeCSVField(entry.shift),
      escapeCSVField(entry.description),
      escapeCSVField(entry.milkQuantityLtr?.toFixed(1)),
      escapeCSVField(entry.debit?.toFixed(2)),
      escapeCSVField(entry.credit?.toFixed(2)),
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
      const filename = `${selectedParty.name.replace(/\s+/g, '_')}_ledger_${format(new Date(), 'yyyyMMdd')}.csv`;
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
  }, [filteredLedgerEntries, selectedParty, toast]);

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
                        Current Overall Balance: ₹{currentOverallBalance.toFixed(2)}
                        {currentOverallBalance > 0 && " (Party Owes Us)"}
                        {currentOverallBalance < 0 && " (We Owe Party)"}
                        {currentOverallBalance === 0 && " (Settled)"}
                        <br />
                        {ledgerFilterDate ? `Showing transactions for ${format(ledgerFilterDate, 'PPP')}${ledgerShiftFilter !== 'All' ? ` (${ledgerShiftFilter} shift)` : ''}` : "Select a date to filter ledger."}
                        {isLoadingLedger && " Loading ledger..."}
                        {!isLoadingLedger && ledgerFilterDate && filteredLedgerEntries.length === 0 && ` (No transactions for this filter. Checked ${allLedgerEntriesForParty.length} total entries for party)`}
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
                    <div className="w-full sm:min-w-[200px]">
                    <Label htmlFor="ledgerDateFilter" className="sr-only">Filter by date</Label>
                    <DatePicker date={ledgerFilterDate} setDate={setLedgerFilterDate} />
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
                  <TableHeader><TableRow><TableHead>Date</TableHead><TableHead>Shift</TableHead><TableHead>Description</TableHead><TableHead>Milk Qty (Ltr)</TableHead><TableHead className="text-right">Debit (₹)</TableHead><TableHead className="text-right">Credit (₹)</TableHead><TableHead className="text-right">Balance (₹)</TableHead></TableRow></TableHeader>
                  <TableBody>
                    {filteredLedgerEntries.length === 0 && !isLoadingLedger && (<TableRow><TableCell colSpan={7} className="text-center text-muted-foreground">No transactions match the current filter for this party.</TableCell></TableRow>)}
                    {filteredLedgerEntries.map(entry => (
                      <TableRow key={entry.id}>
                        <TableCell>{entry.date instanceof Date && !isNaN(entry.date.getTime()) ? format(entry.date, 'P') : 'Invalid Date'}</TableCell>
                        <TableCell>{entry.shift || "-"}</TableCell>
                        <TableCell>{entry.description}</TableCell>
                        <TableCell>{entry.milkQuantityLtr ? `${entry.milkQuantityLtr.toFixed(1)}L` : '-'}</TableCell>
                        <TableCell className="text-right text-chart-4">{entry.debit?.toFixed(2) || "-"}</TableCell>
                        <TableCell className="text-right text-chart-3">{entry.credit?.toFixed(2) || "-"}</TableCell>
                        <TableCell className="text-right font-medium">{entry.balance.toFixed(2)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {!selectedPartyId && !isLoadingParties && parties.length === 0 && (
        <p className="text-center text-muted-foreground my-8">No parties found. Add one to get started.</p>
      )}
       {!selectedPartyId && isLoadingParties && !selectedParty && ( // Added !selectedParty to ensure this shows only when no party is selected
        <p className="text-center text-muted-foreground my-8">Loading parties...</p>
      )}


      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-8">
        <Card>
          <CardHeader><CardTitle>Add New Party</CardTitle><CardDescription>Create a new customer, supplier, or employee.</CardDescription></CardHeader>
          <CardContent>
            <form onSubmit={handleAddPartySubmit} className="space-y-4">
              <div><Label htmlFor="newPartyName">Party Name</Label><Input id="newPartyName" value={newPartyName} onChange={(e) => setNewPartyName(e.target.value)} placeholder="Enter party name" required /></div>
              <div><Label htmlFor="newPartyType">Party Type</Label><Select value={newPartyType} onValueChange={(value: Party['type']) => setNewPartyType(value)}><SelectTrigger id="newPartyType"><SelectValue placeholder="Select party type" /></SelectTrigger><SelectContent>{partyTypes.map(type => (<SelectItem key={type} value={type}>{type}</SelectItem>))}</SelectContent></Select></div>
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
              <Table>
                <TableHeader><TableRow><TableHead>Name</TableHead><TableHead>Type</TableHead><TableHead className="text-right">Actions</TableHead></TableRow></TableHeader>
                <TableBody>
                  {parties.map(party => (
                    <TableRow key={party.id}>
                      <TableCell>{party.name}</TableCell>
                      <TableCell>{party.type}</TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="icon" onClick={() => openDeleteDialog(party)} disabled={isSubmittingParty}>
                          <Trash2 className="h-4 w-4 text-destructive" /><span className="sr-only">Delete {party.name}</span>
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

      {deleteDialogOpen && partyToDelete && (
        <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader><AlertDialogTitle>Are you sure?</AlertDialogTitle>
              <AlertDialogDescription>This action cannot be undone. This will permanently delete the party "{partyToDelete?.name}".</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter><AlertDialogCancel onClick={() => {setDeleteDialogOpen(false); setPartyToDelete(null);}}>Cancel</AlertDialogCancel><AlertDialogAction onClick={confirmDeleteParty} className="bg-destructive hover:bg-destructive/90" disabled={isSubmittingParty}>{isSubmittingParty ? 'Deleting...' : 'Delete'}</AlertDialogAction></AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
    </div>
  );
}
