
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
import { User, BookUser, Milk, IndianRupee, TrendingUp, TrendingDown, PlusCircle } from "lucide-react";
import type { DealerLedgerEntry } from "@/lib/types";

interface Dealer {
  id: string;
  name: string;
}

const dealers: Dealer[] = [
  { id: "1", name: "Rajesh Kumar" },
  { id: "2", name: "Sunita Devi" },
  { id: "3", name: "Mohan Lal" },
];

const getDealerLedger = (dealerId: string): DealerLedgerEntry[] => {
  if (dealerId === "1") {
    return [
      { id: "L1", date: new Date(Date.now() - 86400000 * 2), description: "Milk Collection", milkQuantityLtr: 10.5, credit: 420, balance: -420 },
      { id: "L2", date: new Date(Date.now() - 86400000 * 1), description: "Payment Received", debit: 300, balance: -120 },
      { id: "L3", date: new Date(), description: "Milk Collection", milkQuantityLtr: 12.0, credit: 480, balance: -600 },
    ];
  }
  return [];
};

export default function DealerLedgerPage() {
  const [selectedDealerId, setSelectedDealerId] = useState<string | undefined>(dealers[0]?.id);
  const [ledgerEntries, setLedgerEntries] = useState<DealerLedgerEntry[]>([]);
  const [paymentAmount, setPaymentAmount] = useState("");
  const [paymentDate, setPaymentDate] = useState<Date | undefined>(new Date());

  useEffect(() => {
    if (selectedDealerId) {
      setLedgerEntries(getDealerLedger(selectedDealerId));
    } else {
      setLedgerEntries([]);
    }
  }, [selectedDealerId]);
  
  const dealerSummary = ledgerEntries.reduce((acc, entry) => {
      acc.totalMilk += entry.milkQuantityLtr || 0;
      acc.totalPayable += entry.credit || 0; // Value of milk is payable to dealer
      acc.totalPaid += entry.debit || 0; // Payments made to dealer
      return acc;
  }, { totalMilk: 0, totalPayable: 0, totalPaid: 0 });
  dealerSummary.pendingBalance = dealerSummary.totalPayable - dealerSummary.totalPaid;


  const handlePaymentSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!selectedDealerId || !paymentAmount || !paymentDate) {
      alert("Please select dealer, enter amount and date.");
      return;
    }
    const newPaymentEntry: DealerLedgerEntry = {
      id: String(Date.now()),
      date: paymentDate,
      description: "Payment Made",
      debit: parseFloat(paymentAmount), // Payment made to dealer reduces their balance (debit for dairy's PoV if balance is liability)
      // This depends on accounting convention. If balance is "Amount Dairy Owes Dealer", then payment *reduces* this.
      // Let's assume positive balance means dairy owes dealer. Payment reduces this.
      balance: (ledgerEntries.length > 0 ? ledgerEntries[ledgerEntries.length-1].balance : 0) - parseFloat(paymentAmount) // Simplified balance update
    };
    // Logic for updating balance correctly needs to be robust, this is a placeholder
    setLedgerEntries([...ledgerEntries, newPaymentEntry].sort((a, b) => a.date.getTime() - b.date.getTime()));
    setPaymentAmount("");
  };

  return (
    <div>
      <PageHeader title="Dealer Ledger" description="View and manage dealer accounts." />
      
      <div className="mb-6">
        <Label htmlFor="dealerSelect">Select Dealer</Label>
        <Select value={selectedDealerId} onValueChange={setSelectedDealerId}>
          <SelectTrigger id="dealerSelect" className="w-full md:w-1/3">
            <SelectValue placeholder="Select a dealer" />
          </SelectTrigger>
          <SelectContent>
            {dealers.map(dealer => (
              <SelectItem key={dealer.id} value={dealer.id}>{dealer.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {selectedDealerId && (
        <>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 mb-6">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Total Milk Supplied</CardTitle><Milk className="h-4 w-4 text-muted-foreground" /></CardHeader>
              <CardContent><div className="text-2xl font-bold">{dealerSummary.totalMilk.toFixed(1)} Ltr</div></CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Total Amount Payable</CardTitle><TrendingUp className="h-4 w-4 text-muted-foreground" /></CardHeader>
              <CardContent><div className="text-2xl font-bold">₹{dealerSummary.totalPayable.toFixed(2)}</div></CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Total Amount Paid</CardTitle><TrendingDown className="h-4 w-4 text-muted-foreground" /></CardHeader>
              <CardContent><div className="text-2xl font-bold">₹{dealerSummary.totalPaid.toFixed(2)}</div></CardContent>
            </Card>
            <Card className="border-primary">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2"><CardTitle className="text-sm font-medium">Pending Balance</CardTitle><IndianRupee className="h-4 w-4 text-primary" /></CardHeader>
              <CardContent><div className="text-2xl font-bold text-primary">₹{dealerSummary.pendingBalance.toFixed(2)}</div></CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <Card className="lg:col-span-1">
              <CardHeader><CardTitle>Record Payment to Dealer</CardTitle></CardHeader>
              <CardContent>
                <form onSubmit={handlePaymentSubmit} className="space-y-4">
                  <div>
                    <Label htmlFor="paymentDate">Payment Date</Label>
                    <DatePicker date={paymentDate} setDate={setPaymentDate} />
                  </div>
                  <div>
                    <Label htmlFor="paymentAmount" className="flex items-center mb-1"><IndianRupee className="h-4 w-4 mr-1 text-muted-foreground" />Amount Paid</Label>
                    <Input id="paymentAmount" type="number" step="0.01" value={paymentAmount} onChange={(e) => setPaymentAmount(e.target.value)} placeholder="Enter amount" required />
                  </div>
                  <Button type="submit" className="w-full"><PlusCircle className="h-4 w-4 mr-2" />Record Payment</Button>
                </form>
              </CardContent>
            </Card>

            <Card className="lg:col-span-2">
              <CardHeader><CardTitle>Transaction History</CardTitle></CardHeader>
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
                    {ledgerEntries.map(entry => (
                      <TableRow key={entry.id}>
                        <TableCell>{entry.date.toLocaleDateString()}</TableCell>
                        <TableCell>{entry.description} {entry.milkQuantityLtr ? `(${entry.milkQuantityLtr}L)` : ''}</TableCell>
                        <TableCell className="text-right text-red-600">{entry.debit?.toFixed(2) || "-"}</TableCell>
                        <TableCell className="text-right text-green-600">{entry.credit?.toFixed(2) || "-"}</TableCell>
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
      {!selectedDealerId && <p className="text-center text-muted-foreground mt-8">Please select a dealer to view their ledger.</p>}
    </div>
  );
}

