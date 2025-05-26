
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
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
// DatePicker is not used in the payment form anymore, but kept for ledger entries
// import { DatePicker } from "@/components/ui/date-picker"; 
import { User, Milk, IndianRupee, TrendingUp, TrendingDown, PlusCircle, Trash2 } from "lucide-react";
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
} from "@/components/ui/alert-dialog"; // AlertDialogTrigger removed as it's used directly on Button
import { useToast } from "@/hooks/use-toast";

// Initial mock data for parties
const initialPartiesData: Party[] = [
  { id: "1", name: "Rajesh Kumar", type: "Dealer" },
  { id: "2", name: "Sunita Devi", type: "Dealer" },
  { id: "3", name: "Mohan Lal", type: "Dealer" },
  { id: "C1", name: "Local Cafe", type: "Customer" },
  { id: "S1", name: "Agro Feeds Ltd.", type: "Supplier" },
];

// Mock function to get ledger entries for a party
const getPartyLedger = (party: Party | undefined): PartyLedgerEntry[] => {
  if (!party) return [];

  if (party.type === "Dealer" && party.id === "1") {
    return [
      { id: "L1", date: new Date(Date.now() - 86400000 * 2), description: "Milk Collection", milkQuantityLtr: 10.5, credit: 420, balance: 0 },
      { id: "L2", date: new Date(Date.now() - 86400000 * 1), description: "Payment to Party", debit: 300, balance: 0 },
      { id: "L3", date: new Date(), description: "Milk Collection", milkQuantityLtr: 12.0, credit: 480, balance: 0 },
    ];
  }
  if (party.type === "Customer" && party.id === "C1") {
    return [
        { id: "CL1", date: new Date(Date.now() - 86400000 * 1), description: "Milk Sold on Credit", debit: 600, balance: 0 },
        { id: "CL2", date: new Date(), description: "Payment Received", credit: 500, balance: 0 },
    ];
  }
  if (party.type === "Supplier" && party.id === "S1") {
    return [
        { id: "SL1", date: new Date(Date.now() - 86400000 * 2), description: "Pashu Aahar Purchase", credit: 5000, balance: 0 },
        { id: "SL2", date: new Date(Date.now() - 86400000 * 1), description: "Payment Made", debit: 4000, balance: 0 },
    ];
  }
  return []; 
};

const partyTypes: Party['type'][] = ["Dealer", "Customer", "Supplier"];

export default function PartiesPage() {
  const { toast } = useToast();
  const [parties, setParties] = useState<Party[]>(initialPartiesData);
  const [selectedPartyId, setSelectedPartyId] = useState<string | undefined>(undefined); // Default to undefined
  const [ledgerEntries, setLedgerEntries] = useState<PartyLedgerEntry[]>([]);
  
  const [newPartyName, setNewPartyName] = useState("");
  const [newPartyType, setNewPartyType] = useState<Party['type']>("Dealer");

  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [partyToDelete, setPartyToDelete] = useState<Party | null>(null);

  const selectedParty = parties.find(p => p.id === selectedPartyId);

  useEffect(() => {
    if (selectedPartyId) {
      const party = parties.find(p => p.id === selectedPartyId);
      const initialLedger = getPartyLedger(party);
      let runningBalance = 0;
      const calculatedEntries = initialLedger
        .sort((a, b) => a.date.getTime() - b.date.getTime())
        .map(entry => {
          runningBalance = runningBalance + (entry.debit || 0) - (entry.credit || 0);
          return { ...entry, balance: runningBalance };
        });
      setLedgerEntries(calculatedEntries);
    } else {
      setLedgerEntries([]);
    }
  }, [selectedPartyId, parties]);

  const partySummary = ledgerEntries.reduce((acc, entry) => {
      if (selectedParty?.type === "Dealer") {
        acc.totalMilk += entry.milkQuantityLtr || 0;
        acc.totalPayableToDealer += entry.credit || 0; 
        acc.totalPaidToDealer += entry.debit || 0;    
      }
      acc.totalDebits += entry.debit || 0;
      acc.totalCredits += entry.credit || 0;
      return acc;
  }, { totalMilk: 0, totalPayableToDealer: 0, totalPaidToDealer: 0, totalDebits: 0, totalCredits: 0 });

  const netPayableToDealer = selectedParty?.type === "Dealer" ? partySummary.totalPayableToDealer - partySummary.totalPaidToDealer : 0;
  const currentOverallBalance = ledgerEntries.length > 0 ? ledgerEntries[ledgerEntries.length - 1].balance : 0;

  const handleAddPartySubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!newPartyName.trim()) {
      toast({ title: "Error", description: "Party name cannot be empty.", variant: "destructive" });
      return;
    }
    const newParty: Party = {
      id: String(Date.now()),
      name: newPartyName.trim(),
      type: newPartyType,
    };
    setParties(prevParties => [...prevParties, newParty]);
    setNewPartyName("");
    setNewPartyType("Dealer");
    toast({ title: "Success", description: `Party "${newParty.name}" added.` });
  };

  const openDeleteDialog = (party: Party) => {
    setPartyToDelete(party);
    setDeleteDialogOpen(true);
  };

  const confirmDeleteParty = () => {
    if (partyToDelete) {
      setParties(prevParties => prevParties.filter(p => p.id !== partyToDelete.id));
      toast({ title: "Success", description: `Party "${partyToDelete.name}" deleted.` });
      if (selectedPartyId === partyToDelete.id) {
        setSelectedPartyId(undefined); 
      }
      setPartyToDelete(null);
    }
    setDeleteDialogOpen(false);
  };

  return (
    <div>
      <PageHeader title="Parties & Ledgers" description="Manage parties and view their transaction ledgers." />
      
      <div className="mb-6">
        <Label htmlFor="partySelect">Select Party to View Ledger</Label>
        <Select value={selectedPartyId} onValueChange={setSelectedPartyId}>
          <SelectTrigger id="partySelect" className="w-full md:w-1/3">
            <SelectValue placeholder="Select a party" />
          </SelectTrigger>
          <SelectContent>
            {parties.length === 0 && <SelectItem value="no-parties" disabled>No parties available</SelectItem>}
            {parties.map(p => (
              <SelectItem key={p.id} value={p.id}>{p.name} ({p.type})</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Ledger Section - Only shows if a party is selected */}
      {selectedPartyId && selectedParty && (
        <div className="mb-8">
          <CardHeader className="px-0 pt-0 pb-4"> {/* Adjusted padding */}
             <CardTitle className="text-xl">Ledger for: {selectedParty.name} ({selectedParty.type})</CardTitle>
          </CardHeader>
          
          {selectedParty.type === "Dealer" && (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 mb-6"> {/* mb-6 instead of my-4 */}
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Total Milk Supplied</CardTitle><Milk className="h-4 w-4 text-muted-foreground" /></CardHeader>
                <CardContent><div className="text-2xl font-bold">{partySummary.totalMilk.toFixed(1)} Ltr</div></CardContent>
              </Card>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Total Value (Milk Owed)</CardTitle><TrendingUp className="h-4 w-4 text-muted-foreground" /></CardHeader>
                <CardContent><div className="text-2xl font-bold">₹{partySummary.totalPayableToDealer.toFixed(2)}</div></CardContent>
              </Card>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Total Paid to Dealer</CardTitle><TrendingDown className="h-4 w-4 text-muted-foreground" /></CardHeader>
                <CardContent><div className="text-2xl font-bold">₹{partySummary.totalPaidToDealer.toFixed(2)}</div></CardContent>
              </Card>
              <Card className="border-primary">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2"><CardTitle className="text-sm font-medium">Net Payable to Dealer</CardTitle><IndianRupee className="h-4 w-4 text-primary" /></CardHeader>
                <CardContent><div className="text-2xl font-bold text-primary">₹{netPayableToDealer.toFixed(2)}</div></CardContent>
              </Card>
            </div>
          )}

          <Card> {/* Transaction History Card */}
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
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead className="text-right">Debit (₹)</TableHead>
                    <TableHead className="text-right">Credit (₹)</TableHead>
                    <TableHead className="text-right">Balance (₹)</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {ledgerEntries.length === 0 && (
                      <TableRow><TableCell colSpan={5} className="text-center">No transactions for this party.</TableCell></TableRow>
                  )}
                  {ledgerEntries.map(entry => (
                    <TableRow key={entry.id}>
                      <TableCell>{entry.date.toLocaleDateString()}</TableCell>
                      <TableCell>{entry.description} {entry.milkQuantityLtr && selectedParty.type === 'Dealer' ? `(${entry.milkQuantityLtr}L)` : ''}</TableCell>
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
      
      {/* Message if no party selected (but parties exist) and ledger is not being shown */}
      {!selectedParty && parties.length > 0 && (
        <p className="text-center text-muted-foreground my-8">Please select a party to view their ledger.</p>
      )}
      
      {/* Party Management Section - Always visible */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-8">
        <Card>
          <CardHeader>
            <CardTitle>Add New Party</CardTitle>
            <CardDescription>Create a new dealer, customer, or supplier.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleAddPartySubmit} className="space-y-4">
              <div>
                <Label htmlFor="newPartyName">Party Name</Label>
                <Input 
                  id="newPartyName" 
                  value={newPartyName} 
                  onChange={(e) => setNewPartyName(e.target.value)} 
                  placeholder="Enter party name" 
                  required 
                />
              </div>
              <div>
                <Label htmlFor="newPartyType">Party Type</Label>
                <Select value={newPartyType} onValueChange={(value: Party['type']) => setNewPartyType(value)}>
                  <SelectTrigger id="newPartyType">
                    <SelectValue placeholder="Select party type" />
                  </SelectTrigger>
                  <SelectContent>
                    {partyTypes.map(type => (
                      <SelectItem key={type} value={type}>{type}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button type="submit" className="w-full">
                <PlusCircle className="h-4 w-4 mr-2" /> Add Party
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Manage Parties</CardTitle>
            <CardDescription>View and remove existing parties.</CardDescription>
          </CardHeader>
          <CardContent>
            {parties.length === 0 ? (
              <p className="text-muted-foreground text-center">No parties added yet.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {parties.map(party => (
                    <TableRow key={party.id}>
                      <TableCell>{party.name}</TableCell>
                      <TableCell>{party.type}</TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="icon" onClick={() => openDeleteDialog(party)}>
                          <Trash2 className="h-4 w-4 text-destructive" />
                          <span className="sr-only">Delete {party.name}</span>
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
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the party
              "{partyToDelete?.name}" and all associated data (Note: ledger data deletion is not yet implemented).
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDeleteParty} className="bg-destructive hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

    </div>
  );
}

    