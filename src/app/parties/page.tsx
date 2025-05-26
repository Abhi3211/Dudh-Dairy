
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
import { DatePicker } from "@/components/ui/date-picker";
import { User, Milk, IndianRupee, TrendingUp, TrendingDown, PlusCircle } from "lucide-react";
import type { Party, PartyLedgerEntry } from "@/lib/types";

// Mock data for parties
const partiesData: Party[] = [
  { id: "1", name: "Rajesh Kumar", type: "Dealer" },
  { id: "2", name: "Sunita Devi", type: "Dealer" },
  { id: "3", name: "Mohan Lal", type: "Dealer" },
  { id: "C1", name: "Local Cafe", type: "Customer" },
  { id: "S1", name: "Agro Feeds Ltd.", type: "Supplier" },
];

// Mock function to get ledger entries for a party
const getPartyLedger = (partyId: string): PartyLedgerEntry[] => {
  // For this example, we'll only return ledger data for "Dealer" type party "1"
  // to match the previous dealer-specific mock data.
  const party = partiesData.find(p => p.id === partyId);
  if (party && party.type === "Dealer" && partyId === "1") {
    return [
      { id: "L1", date: new Date(Date.now() - 86400000 * 2), description: "Milk Collection", milkQuantityLtr: 10.5, credit: 420, balance: 0 },
      { id: "L2", date: new Date(Date.now() - 86400000 * 1), description: "Payment to Party", debit: 300, balance: 0 },
      { id: "L3", date: new Date(), description: "Milk Collection", milkQuantityLtr: 12.0, credit: 480, balance: 0 },
    ];
  }
  if (party && party.type === "Customer" && partyId === "C1") {
    return [
        { id: "CL1", date: new Date(Date.now() - 86400000 * 1), description: "Milk Sold on Credit", debit: 600, balance: 0 },
        { id: "CL2", date: new Date(), description: "Payment Received", credit: 500, balance: 0 },
    ];
  }
  if (party && party.type === "Supplier" && partyId === "S1") {
    return [
        { id: "SL1", date: new Date(Date.now() - 86400000 * 2), description: "Pashu Aahar Purchase", credit: 5000, balance: 0 },
        { id: "SL2", date: new Date(Date.now() - 86400000 * 1), description: "Payment Made", debit: 4000, balance: 0 },
    ];
  }
  return []; // Return empty for other parties or types for now
};

export default function PartiesPage() {
  const [selectedPartyId, setSelectedPartyId] = useState<string | undefined>(partiesData[0]?.id);
  const [ledgerEntries, setLedgerEntries] = useState<PartyLedgerEntry[]>([]);
  const [paymentAmount, setPaymentAmount] = useState("");
  const [paymentDate, setPaymentDate] = useState<Date | undefined>(new Date());

  const selectedParty = partiesData.find(p => p.id === selectedPartyId);

  useEffect(() => {
    if (selectedPartyId) {
      const initialLedger = getPartyLedger(selectedPartyId);
      let runningBalance = 0;
      const calculatedEntries = initialLedger
        .sort((a, b) => a.date.getTime() - b.date.getTime())
        .map(entry => {
          // Positive balance = Party Owes Us / Our Asset (e.g. Customer owes for sales, We paid advance to supplier)
          // Negative balance = We Owe Party / Our Liability (e.g. We owe dealer for milk, Supplier has given us credit)

          // For a Dealer: We Owe Dealer for milk (Credit entry increases our liability -> more negative balance)
          //             Payment to Dealer (Debit entry decreases our liability -> less negative / more positive balance)
          // For a Customer: Customer Owes Us for sales (Debit entry increases our asset -> more positive balance)
          //                 Payment from Customer (Credit entry decreases our asset -> less positive / more negative balance)
          // For a Supplier: We Owe Supplier for purchases (Credit entry increases our liability -> more negative balance)
          //                 Payment to Supplier (Debit entry decreases our liability -> less negative / more positive balance)
          
          runningBalance = runningBalance + (entry.debit || 0) - (entry.credit || 0);
          return { ...entry, balance: runningBalance };
        });
      setLedgerEntries(calculatedEntries);
    } else {
      setLedgerEntries([]);
    }
  }, [selectedPartyId]);

  const partySummary = ledgerEntries.reduce((acc, entry) => {
      if (selectedParty?.type === "Dealer") {
        acc.totalMilk += entry.milkQuantityLtr || 0;
        acc.totalPayableToDealer += entry.credit || 0; // Milk value, dairy owes dealer
        acc.totalPaidToDealer += entry.debit || 0;    // Payment dairy made to dealer
      }
      // General totals for any party type (if applicable)
      acc.totalDebits += entry.debit || 0;
      acc.totalCredits += entry.credit || 0;
      return acc;
  }, { totalMilk: 0, totalPayableToDealer: 0, totalPaidToDealer: 0, totalDebits: 0, totalCredits: 0 });

  // For a Dealer: Net Payable to Dealer = totalPayableToDealer - totalPaidToDealer. Positive means dairy owes.
  // For other types, balance is derived from runningBalance in ledger.
  const netPayableToDealer = selectedParty?.type === "Dealer" ? partySummary.totalPayableToDealer - partySummary.totalPaidToDealer : 0;
  const currentOverallBalance = ledgerEntries.length > 0 ? ledgerEntries[ledgerEntries.length - 1].balance : 0;


  const handlePaymentSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!selectedPartyId || !paymentAmount || !paymentDate) {
      alert("Please select party, enter amount and date.");
      return;
    }

    const amount = parseFloat(paymentAmount);
    let newPaymentEntry: PartyLedgerEntry;

    // Payment to a Dealer/Supplier by us (reduces what we owe them OR they owe us less)
    // Payment from a Customer to us (reduces what they owe us)
    // This form is "Record Payment to Party", implying we are PAYING the party.
    // So, it's a DEBIT from their account in our books (if they are a creditor like Dealer/Supplier)
    // or a CREDIT if this form was "Record Payment FROM Party"
    // Let's assume this form is for Payments WE MAKE to a Party.

    newPaymentEntry = {
      id: String(Date.now()),
      date: paymentDate,
      description: `Payment Made to ${selectedParty?.name || 'Party'}`,
      debit: amount, // We paid them, so it's a debit against their account from our liability perspective
      balance: 0 // Will be recalculated
    };
    
    const updatedEntries = [...ledgerEntries, newPaymentEntry].sort((a, b) => a.date.getTime() - b.date.getTime());
    let runningBalance = 0;
    const finalEntries = updatedEntries.map(entry => {
      runningBalance = runningBalance + (entry.debit || 0) - (entry.credit || 0);
      return { ...entry, balance: runningBalance };
    });

    setLedgerEntries(finalEntries);
    setPaymentAmount("");
  };


  return (
    <div>
      <PageHeader title="Party Ledger" description="View and manage party accounts." />
      
      <div className="mb-6">
        <Label htmlFor="partySelect">Select Party</Label>
        <Select value={selectedPartyId} onValueChange={setSelectedPartyId}>
          <SelectTrigger id="partySelect" className="w-full md:w-1/3">
            <SelectValue placeholder="Select a party" />
          </SelectTrigger>
          <SelectContent>
            {partiesData.map(p => (
              <SelectItem key={p.id} value={p.id}>{p.name} ({p.type})</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {selectedPartyId && selectedParty && (
        <>
          {selectedParty.type === "Dealer" && (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 mb-6">
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

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <Card className="lg:col-span-1">
              <CardHeader><CardTitle>Record Payment to Party</CardTitle></CardHeader>
              <CardContent>
                <form onSubmit={handlePaymentSubmit} className="space-y-4">
                  <div>
                    <Label htmlFor="paymentDate">Payment Date</Label>
                    <DatePicker date={paymentDate} setDate={setPaymentDate} />
                  </div>
                  <div>
                    <Label htmlFor="paymentAmount" className="flex items-center mb-1"><IndianRupee className="h-4 w-4 mr-1 text-muted-foreground" />Amount Paid to Party</Label>
                    <Input id="paymentAmount" type="number" step="0.01" value={paymentAmount} onChange={(e) => setPaymentAmount(e.target.value)} placeholder="Enter amount" required />
                  </div>
                  <Button type="submit" className="w-full"><PlusCircle className="h-4 w-4 mr-2" />Record Payment</Button>
                </form>
              </CardContent>
            </Card>

            <Card className="lg:col-span-2">
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
        </>
      )}
      {!selectedPartyId && <p className="text-center text-muted-foreground mt-8">Please select a party to view their ledger.</p>}
    </div>
  );
}
