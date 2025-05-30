
"use client";

import { useState, type FormEvent, useEffect, useMemo, useCallback, useRef } from "react";
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
import { IndianRupee, ArrowRightLeft, User, Banknote, StickyNote, PlusCircle, CalendarDays } from "lucide-react";
import type { PaymentEntry, Party } from "@/lib/types";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { getPartiesFromFirestore, addPartyToFirestore } from "../parties/actions";
import { usePageTitle } from '@/context/PageTitleContext';

const rawInitialPayments: (Omit<PaymentEntry, 'id' | 'date'> & { tempId: string, dateOffset: number })[] = [
  { tempId: "P1", dateOffset: 0, type: "Received", partyName: "Cash Sale", partyType: "Customer", amount: 500, mode: "Cash", notes: "Retail milk sale" },
  { tempId: "P2", dateOffset: -1, type: "Paid", partyName: "Rajesh Kumar", partyType: "Customer", amount: 1200, mode: "Bank", notes: "Weekly settlement" },
];

const partyTypesForForm: Party['type'][] = ["Customer", "Supplier", "Employee"];
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
  
  const [partyNameInput, setPartyNameInput] = useState("");
  const [partyType, setPartyType] = useState<Party['type']>("Customer");
  
  const [amount, setAmount] = useState("");
  const [mode, setMode] = useState<PaymentEntry['mode']>("Cash");
  const [notes, setNotes] = useState("");

  const [availableParties, setAvailableParties] = useState<Party[]>([]);
  const [isLoadingParties, setIsLoadingParties] = useState(true);
  const [isPartyPopoverOpen, setIsPartyPopoverOpen] = useState(false);
  const partyNameInputRef = useRef<HTMLInputElement>(null);
  const [isSubmittingParty, setIsSubmittingParty] = useState(false);


  const fetchParties = useCallback(async () => {
    setIsLoadingParties(true);
    try {
      const parties = await getPartiesFromFirestore();
      setAvailableParties(parties);
    } catch (error) {
      console.error("CLIENT: Failed to fetch parties for payments:", error);
      toast({ title: "Error", description: "Could not fetch parties.", variant: "destructive" });
    } finally {
      setIsLoadingParties(false);
    }
  }, [toast]);

  useEffect(() => {
    if (date === undefined) {
      setDate(new Date());
    }
    const processedPayments = rawInitialPayments.map(p => {
      const entryDate = new Date();
      entryDate.setDate(entryDate.getDate() + p.dateOffset);
      return { ...p, id: p.tempId, date: entryDate };
    }).sort((a,b) => b.date.getTime() - a.date.getTime());
    setPayments(processedPayments);
    fetchParties();
  }, [date, fetchParties]);

  const filteredPartySuggestions = useMemo(() => {
    if (!partyNameInput.trim()) return availableParties;
    return availableParties.filter((party) =>
      party.name.toLowerCase().includes(partyNameInput.toLowerCase())
    );
  }, [partyNameInput, availableParties]);

  const handlePartyNameInputChange = useCallback((value: string) => {
    setPartyNameInput(value);
    if (value.trim() && filteredPartySuggestions.length > 0) {
      setIsPartyPopoverOpen(true);
    } else if (!value.trim()) {
      setIsPartyPopoverOpen(false);
    }
  }, [filteredPartySuggestions]);

  const handlePartySelect = useCallback(async (currentValue: string) => {
    const isCreatingNew = currentValue.startsWith("__CREATE__");
    let partyNameToSet = currentValue;

    if (isCreatingNew) {
      const newPartyName = partyNameInput.trim();
      if (!newPartyName) {
        toast({ title: "Error", description: "Party name cannot be empty for new party.", variant: "destructive" });
        setIsPartyPopoverOpen(false);
        return;
      }

      const existingParty = availableParties.find(
        p => p.name.toLowerCase() === newPartyName.toLowerCase() && p.type === partyType
      );
      if (existingParty) {
        toast({ title: "Info", description: `Party "${newPartyName}" (${partyType}) already exists. Selecting existing.`, variant: "default" });
        partyNameToSet = newPartyName;
      } else {
        setIsSubmittingParty(true);
        const result = await addPartyToFirestore({ name: newPartyName, type: partyType });
        if (result.success && result.id) {
          partyNameToSet = newPartyName;
          toast({ title: "Success", description: `Party "${newPartyName}" (${partyType}) added.` });
          await fetchParties(); // Re-fetch parties to include the new one
        } else {
          toast({ title: "Error", description: result.error || `Failed to add party "${newPartyName}".`, variant: "destructive" });
          setIsSubmittingParty(false);
          setIsPartyPopoverOpen(false);
          return;
        }
        setIsSubmittingParty(false);
      }
    }
    
    setPartyNameInput(partyNameToSet);
    const selectedPartyDetails = availableParties.find(p => p.name.toLowerCase() === partyNameToSet.toLowerCase());
    if (selectedPartyDetails) {
      setPartyType(selectedPartyDetails.type); // Auto-select party type if existing party chosen
    }
    setIsPartyPopoverOpen(false);
    partyNameInputRef.current?.focus();
  }, [partyNameInput, partyType, availableParties, toast, fetchParties]);


  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!date || !partyNameInput.trim() || !amount) {
      toast({ title: "Error", description: "Please fill all required fields (Date, Party Name, Amount).", variant: "destructive" });
      return;
    }
    const parsedAmount = parseFloat(amount);
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
        toast({ title: "Error", description: "Please enter a valid amount.", variant: "destructive" });
        return;
    }

    const newPayment: PaymentEntry = {
      id: String(Date.now()), // For mock data, this is fine. For DB, ID is auto-generated
      date,
      type,
      partyName: partyNameInput.trim(),
      partyType,
      amount: parsedAmount,
      mode,
      notes: notes.trim(),
    };
    setPayments(prevPayments => [newPayment, ...prevPayments].sort((a,b) => b.date.getTime() - a.date.getTime()));
    
    toast({ title: "Success", description: "Payment recorded." });

    // Reset form fields
    setPartyNameInput("");
    setPartyType("Customer"); // Reset party type to default
    setAmount("");
    setNotes("");
    setDate(new Date()); // Reset date or keep as is, depends on preference
    setMode("Cash");
    setType("Received");
    setIsPartyPopoverOpen(false);
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
                <Label htmlFor="paymentDate" className="flex items-center mb-1"><CalendarDays className="h-4 w-4 mr-2 text-muted-foreground"/>Date</Label>
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
                <Label htmlFor="partyNameInput" className="flex items-center mb-1">
                  <User className="h-4 w-4 mr-2 text-muted-foreground" /> Party Name
                </Label>
                <Popover open={isPartyPopoverOpen} onOpenChange={setIsPartyPopoverOpen}>
                  <PopoverTrigger asChild>
                    <Input
                      id="partyNameInput"
                      ref={partyNameInputRef}
                      value={partyNameInput}
                      onChange={(e) => handlePartyNameInputChange(e.target.value)}
                      onFocus={() => {
                        if (partyNameInput.trim() || availableParties.length > 0) {
                           setIsPartyPopoverOpen(true);
                        }
                      }}
                      placeholder="Start typing party name"
                      autoComplete="off"
                      required
                      className="w-full"
                    />
                  </PopoverTrigger>
                  <PopoverContent 
                    className="w-[--radix-popover-trigger-width] p-0" 
                    side="bottom" 
                    align="start" 
                    sideOffset={0}
                    onOpenAutoFocus={(e) => e.preventDefault()}
                  >
                    <Command>
                      <CommandInput 
                        placeholder="Search or add new party..." 
                        value={partyNameInput} 
                        onValueChange={handlePartyNameInputChange} // Keep main input in sync
                      />
                      <CommandList>
                        {isLoadingParties ? (
                          <CommandItem disabled>Loading parties...</CommandItem>
                        ) : (
                          <>
                            <CommandEmpty>
                              {availableParties.length === 0 && !partyNameInput.trim() ? "No parties found. Type to add new." : "No parties match your search."}
                            </CommandEmpty>
                            <CommandGroup>
                              {partyNameInput.trim() && !availableParties.some(p => p.name.toLowerCase() === partyNameInput.trim().toLowerCase()) && (
                                <CommandItem
                                  key={`__CREATE__${partyNameInput.trim()}`}
                                  value={`__CREATE__${partyNameInput.trim()}`}
                                  onSelect={() => handlePartySelect(`__CREATE__${partyNameInput.trim()}`)}
                                >
                                  <PlusCircle className="mr-2 h-4 w-4" />
                                  Add new party: "{partyNameInput.trim()}" (as {partyType})
                                </CommandItem>
                              )}
                              {filteredPartySuggestions.map((party) => (
                                <CommandItem
                                  key={party.id}
                                  value={party.name} // Use party.name for selection value
                                  onSelect={() => handlePartySelect(party.name)}
                                >
                                  {party.name} ({party.type})
                                </CommandItem>
                              ))}
                            </CommandGroup>
                          </>
                        )}
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
              </div>

              <div>
                <Label htmlFor="partyType">Party Type</Label>
                 <Select value={partyType} onValueChange={(value: Party['type']) => setPartyType(value)}>
                  <SelectTrigger><SelectValue placeholder="Select party type" /></SelectTrigger>
                  <SelectContent>
                    {partyTypesForForm.map(pt => <SelectItem key={pt} value={pt}>{pt}</SelectItem>)}
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
              <Button type="submit" className="w-full" disabled={isLoadingParties || isSubmittingParty}>
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
                  <TableHead>Notes</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {payments.length === 0 ? (
                     <TableRow>
                        <TableCell colSpan={6} className="text-center text-muted-foreground">No payments recorded yet.</TableCell>
                    </TableRow>
                ) : (
                    payments.map((p) => (
                    <TableRow key={p.id}>
                        <TableCell>{p.date instanceof Date && !isNaN(p.date.getTime()) ? format(p.date, 'P') : 'Invalid Date'}</TableCell>
                        <TableCell>
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${p.type === "Received" ? "bg-chart-3/20 text-chart-3" : "bg-chart-4/20 text-chart-4"}`}>
                            {p.type}
                        </span>
                        </TableCell>
                        <TableCell>{p.partyName} <span className="text-xs text-muted-foreground">({p.partyType})</span></TableCell>
                        <TableCell className="text-right">{p.amount.toFixed(2)}</TableCell>
                        <TableCell>{p.mode}</TableCell>
                        <TableCell className="max-w-[150px] truncate" title={p.notes}>{p.notes || "-"}</TableCell>
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

    