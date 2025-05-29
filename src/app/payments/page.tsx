
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
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import { usePageTitle } from '@/context/PageTitleContext';

const rawInitialPayments: (Omit<PaymentEntry, 'id' | 'date'> & { tempId: string, dateOffset: number })[] = [
  { tempId: "P1", dateOffset: 0, type: "Received", partyName: "Cash Sale", partyType: "Customer", amount: 500, mode: "Cash", notes: "Retail milk sale" },
  { tempId: "P2", dateOffset: -1, type: "Paid", partyName: "Rajesh Kumar", partyType: "Customer", amount: 1200, mode: "Bank", notes: "Weekly settlement" },
];

const partyTypes: PaymentEntry['partyType'][] = ["Customer", "Supplier", "Employee"]; // "Dealer" removed
const paymentModes: PaymentEntry['mode'][] = ["Cash", "Bank", "UPI"];

export default function PaymentsPage() {
  const { setPageTitle } = usePageTitle();
  const pageSpecificTitle = "Record Payments";

  useEffect(() => {
    setPageTitle(pageSpecificTitle);
  }, [setPageTitle, pageSpecificTitle]);

  const { toast } = useToast();
  const [payments, setPayments] = useState<PaymentEntry[]>([]);

  const [date, setDate] = useState<Date | undefined>(undefined);
  const [type, setType] = useState<"Received" | "Paid">("Received");
  const [partyName, setPartyName] = useState("");
  const [partyType, setPartyType] = useState<PaymentEntry['partyType']>("Customer");
  const [amount, setAmount] = useState("");
  const [mode, setMode] = useState<PaymentEntry['mode']>("Cash");
  const [notes, setNotes] = useState("");

  useEffect(() => {
    setDate(new Date());
    const processedPayments = rawInitialPayments.map(p => {
      const entryDate = new Date();
      entryDate.setDate(entryDate.getDate() + p.dateOffset);
      return { ...p, id: p.tempId, date: entryDate };
    }).sort((a,b) => b.date.getTime() - a.date.getTime());
    setPayments(processedPayments);
  }, []);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!date || !partyName.trim() || !amount) {
      toast({ title: "Error", description: "Please fill all required fields (Date, Party Name, Amount).", variant: "destructive" });
      return;
    }
    const parsedAmount = parseFloat(amount);
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
        toast({ title: "Error", description: "Please enter a valid amount.", variant: "destructive" });
        return;
    }

    const newPayment: PaymentEntry = {
      id: String(Date.now()),
      date,
      type,
      partyName: partyName.trim(),
      partyType,
      amount: parsedAmount,
      mode,
      notes,
    };
    setPayments(prevPayments => [newPayment, ...prevPayments].sort((a,b) => b.date.getTime() - a.date.getTime()));
    
    toast({ title: "Success", description: "Payment recorded." });

    setPartyName("");
    setAmount("");
    setNotes("");
    setDate(new Date());
    setPartyType("Customer");
    setMode("Cash");
    setType("Received");
  };

  return (
    <div>
      <PageHeader title={pageSpecificTitle} description="Log all incoming and outgoing payments." />
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
          <CardHeader><CardTitle>Recent Payments</CardTitle><CardDescription>List of payments sorted by most recent.</CardDescription></CardHeader>
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
                {payments.length === 0 ? (
                     <TableRow>
                        <TableCell colSpan={5} className="text-center text-muted-foreground">No payments recorded yet.</TableCell>
                    </TableRow>
                ) : (
                    payments.map((p) => (
                    <TableRow key={p.id}>
                        <TableCell>{format(p.date, 'P')}</TableCell>
                        <TableCell>
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${p.type === "Received" ? "bg-chart-3/20 text-chart-3" : "bg-chart-4/20 text-chart-4"}`}>
                            {p.type}
                        </span>
                        </TableCell>
                        <TableCell>{p.partyName} <span className="text-xs text-muted-foreground">({p.partyType})</span></TableCell>
                        <TableCell className="text-right">{p.amount.toFixed(2)}</TableCell>
                        <TableCell>{p.mode}</TableCell>
                    </TableRow>
                    ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
