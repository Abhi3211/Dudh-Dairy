
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
import { Textarea } from "@/components/ui/textarea";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle, CardDescription }from "@/components/ui/card";
import { DatePicker } from "@/components/ui/date-picker";
import { IndianRupee, ArrowRightLeft, User, Banknote, StickyNote, PlusCircle } from "lucide-react";
import type { PaymentEntry } from "@/lib/types";

const initialPayments: PaymentEntry[] = [
  { id: "P1", date: new Date(), type: "Received", partyName: "Cash Sale", partyType: "Customer", amount: 500, mode: "Cash", notes: "Retail milk sale" },
  { id: "P2", date: new Date(Date.now() - 86400000), type: "Paid", partyName: "Rajesh Kumar", partyType: "Dealer", amount: 1200, mode: "Bank", notes: "Weekly settlement" },
];

const partyTypes: PaymentEntry['partyType'][] = ["Customer", "Dealer", "Supplier"];
const paymentModes: PaymentEntry['mode'][] = ["Cash", "Bank", "UPI"];

export default function PaymentsPage() {
  const [payments, setPayments] = useState<PaymentEntry[]>(initialPayments);

  const [date, setDate] = useState<Date | undefined>(new Date());
  const [type, setType] = useState<"Received" | "Paid">("Received");
  const [partyName, setPartyName] = useState("");
  const [partyType, setPartyType] = useState<PaymentEntry['partyType']>("Customer");
  const [amount, setAmount] = useState("");
  const [mode, setMode] = useState<PaymentEntry['mode']>("Cash");
  const [notes, setNotes] = useState("");

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!date || !partyName || !amount) {
      alert("Please fill all required fields.");
      return;
    }
    const newPayment: PaymentEntry = {
      id: String(Date.now()),
      date,
      type,
      partyName,
      partyType,
      amount: parseFloat(amount),
      mode,
      notes,
    };
    setPayments([newPayment, ...payments]);
    // Reset form
    setPartyName("");
    setAmount("");
    setNotes("");
  };

  return (
    <div>
      <PageHeader title="Record Payments" description="Log all incoming and outgoing payments." />
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-1">
          <CardHeader><CardTitle>New Payment</CardTitle></CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label htmlFor="paymentDate">Date</Label>
                <DatePicker date={date} setDate={setDate} />
              </div>
              <div>
                <Label htmlFor="paymentType" className="flex items-center mb-1"><ArrowRightLeft className="h-4 w-4 mr-2 text-muted-foreground" />Type</Label>
                <Select value={type} onValueChange={(value: "Received" | "Paid") => setType(value)}>
                  <SelectTrigger><SelectValue placeholder="Select type" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Received">Received</SelectItem>
                    <SelectItem value="Paid">Paid</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="partyName" className="flex items-center mb-1"><User className="h-4 w-4 mr-2 text-muted-foreground" />Party Name</Label>
                <Input id="partyName" value={partyName} onChange={(e) => setPartyName(e.target.value)} placeholder="From/To whom" required />
              </div>
              <div>
                <Label htmlFor="partyType">Party Type</Label>
                 <Select value={partyType} onValueChange={(value: PaymentEntry['partyType']) => setPartyType(value)}>
                  <SelectTrigger><SelectValue placeholder="Select party type" /></SelectTrigger>
                  <SelectContent>
                    {partyTypes.map(pt => <SelectItem key={pt} value={pt}>{pt}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="amount" className="flex items-center mb-1"><IndianRupee className="h-4 w-4 mr-1 text-muted-foreground" />Amount</Label>
                <Input id="amount" type="number" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="Enter amount" required />
              </div>
              <div>
                <Label htmlFor="paymentMode" className="flex items-center mb-1"><Banknote className="h-4 w-4 mr-2 text-muted-foreground" />Mode</Label>
                 <Select value={mode} onValueChange={(value: PaymentEntry['mode']) => setMode(value)}>
                  <SelectTrigger><SelectValue placeholder="Select mode" /></SelectTrigger>
                  <SelectContent>
                    {paymentModes.map(pm => <SelectItem key={pm} value={pm}>{pm}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="notes" className="flex items-center mb-1"><StickyNote className="h-4 w-4 mr-2 text-muted-foreground" />Notes</Label>
                <Textarea id="notes" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Optional notes" />
              </div>
              <Button type="submit" className="w-full">
                <PlusCircle className="h-4 w-4 mr-2" />Record Payment
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader><CardTitle>Recent Payments</CardTitle></CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Party</TableHead>
                  <TableHead className="text-right">Amount (₹)</TableHead>
                  <TableHead>Mode</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {payments.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell>{p.date.toLocaleDateString()}</TableCell>
                    <TableCell>
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${p.type === "Received" ? "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300" : "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300"}`}>
                        {p.type}
                      </span>
                    </TableCell>
                    <TableCell>{p.partyName} <span className="text-xs text-muted-foreground">({p.partyType})</span></TableCell>
                    <TableCell className="text-right">{p.amount.toFixed(2)}</TableCell>
                    <TableCell>{p.mode}</TableCell>
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

