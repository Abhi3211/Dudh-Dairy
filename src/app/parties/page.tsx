
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
import { User, PlusCircle, Trash2 } from "lucide-react"; // Removed Milk, IndianRupee, TrendingUp, TrendingDown
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
import { getPartiesFromFirestore, addPartyToFirestore, deletePartyFromFirestore } from "./actions";


const getPartyLedger = (party: Party | undefined): PartyLedgerEntry[] => {
  if (!party) return [];
  
  const rawLedgerEntries: (Omit<PartyLedgerEntry, 'id'|'date'|'balance'> & {tempId: string, dateOffset: number})[] = [];

  if (party.type === "Customer" && (party.name.includes("Rajesh") || party.name.includes("Sunita"))) { // Changed from Dealer to Customer
    rawLedgerEntries.push(
      { tempId: "L1", dateOffset: -2, description: "Milk Supplied to Dairy", milkQuantityLtr: 10.5, credit: 420 },
      { tempId: "L2", dateOffset: -1, description: "Payment Received from Dairy", debit: 300 },
      { tempId: "L3", dateOffset: 0, description: "Milk Supplied to Dairy", milkQuantityLtr: 12.0, credit: 480 }
    );
  }
  if (party.type === "Customer" && party.name.includes("Cafe")) {
     rawLedgerEntries.push(
        { tempId: "CL1", dateOffset: -1, description: "Milk Sold on Credit", debit: 600 },
        { tempId: "CL2", dateOffset: 0, description: "Payment Received", credit: 500 }
    );
  }
   if (party.type === "Customer" && party.name.includes("Nash")) { // Example for Nash as a Customer
     rawLedgerEntries.push(
        { tempId: "NL1", dateOffset: -3, description: "Milk Supplied to Dairy", milkQuantityLtr: 15.0, credit: 650 },
        { tempId: "NL2", dateOffset: -2, description: "Pashu Aahar Purchased on Credit", debit: 1200 },
        { tempId: "NL3", dateOffset: -1, description: "Payment Received from Dairy (settlement)", debit: 300 },
         { tempId: "NL4", dateOffset: 0, description: "Payment Made for Pashu Aahar", credit: 1000 }
    );
  }
  if (party.type === "Supplier" && party.name.includes("Feeds")) {
    rawLedgerEntries.push(
        { tempId: "SL1", dateOffset: -2, description: "Pashu Aahar Purchase (Goods Received)", credit: 5000 },
        { tempId: "SL2", dateOffset: -1, description: "Payment Made (Payment to Supplier)", debit: 4000 }
    );
  }
   if (party.type === "Employee" && party.name.includes("Anita")) {
    rawLedgerEntries.push(
        { tempId: "EL1", dateOffset: -5, description: "Salary Advance", debit: 2000 },
        { tempId: "EL2", dateOffset: 0, description: "Salary Paid", credit: 10000 } // Assuming salary is a credit to employee from dairy's books (expense)
    );
  }


  return rawLedgerEntries.map(entry => {
    const date = new Date();
    date.setDate(date.getDate() + entry.dateOffset);
    return { ...entry, id: entry.tempId, date, balance: 0 }; 
  }).sort((a, b) => a.date.getTime() - b.date.getTime());
};

const partyTypes: Party['type'][] = ["Customer", "Supplier", "Employee"]; // "Dealer" removed

export default function PartiesPage() {
  const { toast } = useToast();
  const [parties, setParties] = useState<Party[]>([]);
  const [isLoadingParties, setIsLoadingParties] = useState(true); 
  const [selectedPartyId, setSelectedPartyId] = useState<string | undefined>(undefined);
  const [ledgerEntries, setLedgerEntries] = useState<PartyLedgerEntry[]>([]);

  const [newPartyName, setNewPartyName] = useState("");
  const [newPartyType, setNewPartyType] = useState<Party['type']>("Customer"); // Default to Customer

  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [partyToDelete, setPartyToDelete] = useState<Party | null>(null);

  const fetchParties = useCallback(async () => {
    setIsLoadingParties(true);
    try {
      const fetchedParties = await getPartiesFromFirestore();
      setParties(fetchedParties);
    } catch (error) {
      console.error("Failed to fetch parties:", error);
      toast({ title: "Error", description: "Could not fetch parties from the database.", variant: "destructive" });
    } finally {
      setIsLoadingParties(false);
    }
  },[toast]);

  useEffect(() => {
    fetchParties();
  }, [fetchParties]);

  const selectedParty = useMemo(() => parties.find(p => p.id === selectedPartyId), [parties, selectedPartyId]);

  useEffect(() => {
    if (selectedParty) {
      const initialLedger = getPartyLedger(selectedParty); 
      let runningBalance = 0;
      const calculatedEntries = initialLedger
        .map(entry => {
          runningBalance = runningBalance + (entry.debit || 0) - (entry.credit || 0);
          return { ...entry, balance: runningBalance };
        });
      setLedgerEntries(calculatedEntries);
    } else {
      setLedgerEntries([]);
    }
  }, [selectedParty]);

  const currentOverallBalance = useMemo(() => {
    return ledgerEntries.length > 0 ? ledgerEntries[ledgerEntries.length - 1].balance : 0;
  }, [ledgerEntries]);


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
    
    setIsLoadingParties(true);
    const result = await addPartyToFirestore(partyData);
    
    if (result.success) {
      await fetchParties();
      setNewPartyName("");
      setNewPartyType("Customer");
      toast({ title: "Success", description: `Party "${partyData.name}" added.` });
    } else {
      toast({ title: "Error", description: result.error || "Failed to add party.", variant: "destructive" });
    }
    setIsLoadingParties(false);
  };

  const openDeleteDialog = (party: Party) => {
    setPartyToDelete(party);
    setDeleteDialogOpen(true);
  };

  const confirmDeleteParty = async () => {
    if (partyToDelete) {
      setIsLoadingParties(true);
      const result = await deletePartyFromFirestore(partyToDelete.id);
      
      if (result.success) {
        await fetchParties();
        toast({ title: "Success", description: `Party "${partyToDelete.name}" deleted.` });
        if (selectedPartyId === partyToDelete.id) {
          setSelectedPartyId(undefined);
        }
        setPartyToDelete(null);
      } else {
        toast({ title: "Error", description: result.error || "Failed to delete party.", variant: "destructive" });
      }
       setIsLoadingParties(false);
    }
    setDeleteDialogOpen(false);
  };

  return (
    <div>
      <PageHeader title="Parties & Ledgers" description="Manage parties and view their transaction ledgers." />

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
          <CardHeader className="px-0 pt-0 pb-4">
             <CardTitle className="text-xl">Ledger for: {selectedParty.name} ({selectedParty.type})</CardTitle>
          </CardHeader>

          {/* Dealer-specific summary cards removed as "Dealer" type is removed */}

          <Card>
            <CardHeader>
              <CardTitle>Transaction History for {selectedParty.name}</CardTitle>
              <CardDescription>
                Current Balance: ₹{currentOverallBalance.toFixed(2)}
                {currentOverallBalance > 0 && " (Party Owes Us)"}
                {currentOverallBalance < 0 && " (We Owe Party)"}
                {currentOverallBalance === 0 && " (Settled)"}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader><TableRow><TableHead>Date</TableHead><TableHead>Description</TableHead>{selectedParty.type === 'Customer' && <TableHead>Milk Qty (Ltr)</TableHead>}<TableHead className="text-right">Debit (₹)</TableHead><TableHead className="text-right">Credit (₹)</TableHead><TableHead className="text-right">Balance (₹)</TableHead></TableRow></TableHeader>
                <TableBody>
                  {ledgerEntries.length === 0 && (<TableRow><TableCell colSpan={selectedParty.type === 'Customer' ? 6: 5} className="text-center">No transactions for this party.</TableCell></TableRow>)}
                  {ledgerEntries.map(entry => (
                    <TableRow key={entry.id}>
                      <TableCell>{format(entry.date, 'P')}</TableCell>
                      <TableCell>{entry.description}</TableCell>
                      {selectedParty.type === 'Customer' && <TableCell>{entry.milkQuantityLtr ? `${entry.milkQuantityLtr.toFixed(1)}L` : '-'}</TableCell>}
                      <TableCell className="text-right text-chart-4">{entry.debit?.toFixed(2) || "-"}</TableCell>
                      <TableCell className="text-right text-chart-3">{entry.credit?.toFixed(2) || "-"}</TableCell>
                      <TableCell className="text-right font-medium">{entry.balance.toFixed(2)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>
      )}

      {!selectedPartyId && !isLoadingParties && parties.length === 0 && (
        <p className="text-center text-muted-foreground my-8">No parties found. Add one to get started.</p>
      )}
       {!selectedPartyId && isLoadingParties && (
        <p className="text-center text-muted-foreground my-8">Loading parties...</p>
      )}


      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-8">
        <Card>
          <CardHeader><CardTitle>Add New Party</CardTitle><CardDescription>Create a new customer, supplier, or employee.</CardDescription></CardHeader>
          <CardContent>
            <form onSubmit={handleAddPartySubmit} className="space-y-4">
              <div><Label htmlFor="newPartyName">Party Name</Label><Input id="newPartyName" value={newPartyName} onChange={(e) => setNewPartyName(e.target.value)} placeholder="Enter party name" required /></div>
              <div><Label htmlFor="newPartyType">Party Type</Label><Select value={newPartyType} onValueChange={(value: Party['type']) => setNewPartyType(value)}><SelectTrigger id="newPartyType"><SelectValue placeholder="Select party type" /></SelectTrigger><SelectContent>{partyTypes.map(type => (<SelectItem key={type} value={type}>{type}</SelectItem>))}</SelectContent></Select></div>
              <Button type="submit" className="w-full" disabled={isLoadingParties}><PlusCircle className="h-4 w-4 mr-2" /> {isLoadingParties ? 'Adding...' : 'Add Party'}</Button>
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
                        <Button variant="ghost" size="icon" onClick={() => openDeleteDialog(party)} disabled={isLoadingParties}>
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

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>This action cannot be undone. This will permanently delete the party "{partyToDelete?.name}".</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction onClick={confirmDeleteParty} className="bg-destructive hover:bg-destructive/90" disabled={isLoadingParties}>{isLoadingParties ? 'Deleting...' : 'Delete'}</AlertDialogAction></AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
