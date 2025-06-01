
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
import { IndianRupee, ArrowRightLeft, User, Banknote, StickyNote, PlusCircle, CalendarDays, AlertCircle } from "lucide-react";
import type { PaymentEntry, Party } from "@/lib/types";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { getPartiesFromFirestore, addPartyToFirestore } from "../parties/actions";
import { addPaymentEntryToFirestore, getPaymentEntriesFromFirestore } from "./actions";
import { Skeleton } from "@/components/ui/skeleton";
import { usePageTitle } from '@/context/PageTitleContext';
import { useUserSession } from "@/context/UserSessionContext";

const partyTypesForForm: Party['type'][] = ["Customer", "Supplier", "Employee"];
const paymentModes: PaymentEntry['mode'][] = ["Cash", "Bank", "UPI"];

export default function PaymentsPage() {
  const { setPageTitle } = usePageTitle();
  const pageSpecificTitle = "Record Payments";
  const { firebaseUser, companyProfile, authLoading, profilesLoading } = useUserSession();
  const companyId = companyProfile?.id;

  useEffect(() => {
    setPageTitle(pageSpecificTitle);
  }, [setPageTitle, pageSpecificTitle]);

  const { toast } = useToast();
  const [payments, setPayments] = useState<PaymentEntry[]>([]);
  const [isLoadingPayments, setIsLoadingPayments] = useState(true);
  const [isSubmittingPayment, setIsSubmittingPayment] = useState(false);

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
  const justPartySelectedRef = useRef(false);
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

  const fetchPayments = useCallback(async () => {
    if (!companyId) {
      setIsLoadingPayments(false);
      setPayments([]);
      return;
    }
    setIsLoadingPayments(true);
    try {
      const fetchedPayments = await getPaymentEntriesFromFirestore(companyId);
      const processedPayments = fetchedPayments.map(p => ({
        ...p,
        date: p.date instanceof Date ? p.date : new Date(p.date)
      })).sort((a,b) => b.date.getTime() - a.date.getTime());
      setPayments(processedPayments);
    } catch (error) {
      console.error("CLIENT: Failed to fetch payment entries:", error);
      toast({ title: "Error", description: "Could not fetch payment entries.", variant: "destructive" });
    } finally {
      setIsLoadingPayments(false);
    }
  }, [toast, companyId]);

  useEffect(() => {
    if (authLoading || profilesLoading) return;

    if (date === undefined) {
      setDate(new Date());
    }
    if (companyId) {
      fetchPayments();
    }
    fetchParties(); // Parties can be fetched regardless of companyId for now
  }, [date, companyId, authLoading, profilesLoading, fetchPayments, fetchParties]);

  const filteredPartySuggestions = useMemo(() => {
    if (!partyNameInput.trim()) return availableParties;
    return availableParties.filter((party) =>
      party.name.toLowerCase().includes(partyNameInput.toLowerCase())
    );
  }, [partyNameInput, availableParties]);

  const handlePartyNameInputChange = useCallback((value: string) => {
    setPartyNameInput(value);
  }, []);

  const handlePartySelect = useCallback(async (currentValue: string) => {
    const isCreatingNew = currentValue.startsWith("__CREATE__");
    let partyNameToSet = currentValue;
    let newPartyCreated = false;

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
        // TODO: Consider if companyId should be passed to addPartyToFirestore if parties become company-specific
        const result = await addPartyToFirestore({ name: newPartyName, type: partyType });
        if (result.success && result.id) {
          partyNameToSet = newPartyName;
          newPartyCreated = true;
          toast({ title: "Success", description: `Party "${newPartyName}" (${partyType}) added.` });
          await fetchParties(); 
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
    if (!newPartyCreated) { 
        const selectedPartyDetails = availableParties.find(p => p.name.toLowerCase() === partyNameToSet.toLowerCase());
        if (selectedPartyDetails) {
        setPartyType(selectedPartyDetails.type); 
        }
    }
    setIsPartyPopoverOpen(false);
    justPartySelectedRef.current = true;
  }, [partyNameInput, partyType, availableParties, toast, fetchParties]);

  const resetFormFields = useCallback(() => {
    setDate(new Date());
    setType("Received");
    setPartyNameInput("");
    setPartyType("Customer");
    setAmount("");
    setMode("Cash");
    setNotes("");
    setIsPartyPopoverOpen(false);
  }, []);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!companyId) {
      toast({ title: "Error", description: "Company information is missing. Cannot record payment.", variant: "destructive" });
      return;
    }
    if (!date || !partyNameInput.trim() || !amount) {
      toast({ title: "Error", description: "Please fill all required fields (Date, Party Name, Amount).", variant: "destructive" });
      return;
    }
    const parsedAmount = parseFloat(amount);
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
        toast({ title: "Error", description: "Please enter a valid amount.", variant: "destructive" });
        return;
    }

    setIsSubmittingPayment(true);
    const paymentData: Omit<PaymentEntry, 'id'> & { companyId: string } = {
      companyId,
      date,
      type,
      partyName: partyNameInput.trim(),
      partyType,
      amount: parsedAmount,
      mode,
      notes: notes.trim(),
    };
    
    const result = await addPaymentEntryToFirestore(paymentData);
    
    if (result.success) {
      toast({ title: "Success", description: "Payment recorded." });
      resetFormFields();
      await fetchPayments();
    } else {
      toast({ title: "Error", description: result.error || "Failed to record payment.", variant: "destructive" });
    }
    setIsSubmittingPayment(false);
  };

  const isFormDisabled = authLoading || profilesLoading || !companyId;

  return (
    <div>
      <PageHeader title={pageSpecificTitle} description="Log all incoming and outgoing payments." />
       {authLoading || profilesLoading ? (
          <Card className="mb-6"><CardContent className="p-6"><Skeleton className="h-8 w-1/2" /></CardContent></Card>
      ) : !companyId && firebaseUser ? (
        <Card className="mb-6 border-destructive">
          <CardHeader>
            <CardTitle className="text-destructive flex items-center"><AlertCircle className="mr-2 h-5 w-5" /> Company Information Missing</CardTitle>
          </CardHeader>
          <CardContent>
            <p>Your user profile does not have company information associated with it. Payments cannot be recorded or displayed.</p>
          </CardContent>
        </Card>
      ) : !firebaseUser ? (
         <Card className="mb-6 border-destructive">
          <CardHeader>
            <CardTitle className="text-destructive flex items-center"><AlertCircle className="mr-2 h-5 w-5" /> Not Logged In</CardTitle>
          </CardHeader>
          <CardContent>
            <p>You need to be logged in to record or view payments.</p>
          </CardContent>
        </Card>
      ) : null}

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
                <Select value={type} onValueChange={(value: "Received" | "Paid") => setType(value)} disabled={isFormDisabled}>
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
                        if (justPartySelectedRef.current) {
                            justPartySelectedRef.current = false;
                        } else {
                           setIsPartyPopoverOpen(true);
                        }
                      }}
                      placeholder="Start typing party name"
                      autoComplete="off"
                      required
                      className="w-full text-left"
                      disabled={isFormDisabled}
                    />
                  </PopoverTrigger>
                  <PopoverContent 
                    className="w-[--radix-popover-trigger-width] p-0" 
                    side="bottom" 
                    align="start" 
                    sideOffset={4}
                    onOpenAutoFocus={(e) => e.preventDefault()}
                  >
                    <Command>
                      <Input
                        value={partyNameInput}
                        onChange={(e) => handlePartyNameInputChange(e.target.value)}
                        className="sr-only" 
                        tabIndex={-1} 
                        aria-hidden="true"
                      />
                      <CommandList>
                        {isLoadingParties ? (
                          <CommandItem disabled>Loading parties...</CommandItem>
                        ) : (
                          <>
                            <CommandEmpty>
                              {availableParties.length === 0 && !partyNameInput.trim() ? "No parties recorded. Type to add new." : "No parties match your search."}
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
                                  value={party.name} 
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
                 <Select value={partyType} onValueChange={(value: Party['type']) => setPartyType(value)} disabled={isFormDisabled}>
                  <SelectTrigger><SelectValue placeholder="Select party type" /></SelectTrigger>
                  <SelectContent>
                    {partyTypesForForm.map(pt => <SelectItem key={pt} value={pt}>{pt}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="amount" className="flex items-center mb-1"><IndianRupee className="h-4 w-4 mr-1 text-muted-foreground" />Amount</Label>
                <Input id="amount" type="number" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="Enter amount" required disabled={isFormDisabled} />
              </div>
              <div>
                <Label htmlFor="paymentMode" className="flex items-center mb-1"><Banknote className="h-4 w-4 mr-2 text-muted-foreground" />Mode</Label>
                 <Select value={mode} onValueChange={(value: PaymentEntry['mode']) => setMode(value)} disabled={isFormDisabled}>
                  <SelectTrigger><SelectValue placeholder="Select mode" /></SelectTrigger>
                  <SelectContent>
                    {paymentModes.map(pm => <SelectItem key={pm} value={pm}>{pm}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="notes" className="flex items-center mb-1"><StickyNote className="h-4 w-4 mr-2 text-muted-foreground" />Notes</Label>
                <Textarea id="notes" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Optional notes" disabled={isFormDisabled} />
              </div>
              <Button type="submit" className="w-full" disabled={isLoadingParties || isSubmittingParty || isSubmittingPayment || isFormDisabled}>
                <PlusCircle className="h-4 w-4 mr-2" />
                {isSubmittingPayment ? 'Recording...' : 'Record Payment'}
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader><CardTitle>Recent Payments</CardTitle><CardDescription>List of payments sorted by most recent for your company.</CardDescription></CardHeader>
          <CardContent>
            {(isLoadingPayments || isLoadingParties) && companyId ? (
              <div className="space-y-2">
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
              </div>
            ) : !companyId && firebaseUser && !authLoading && !profilesLoading ? (
                <p className="text-center text-muted-foreground py-4">Company ID is not available. Payments data cannot be loaded.</p>
            ) : (
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
                          <TableCell colSpan={6} className="text-center text-muted-foreground">
                            {companyId ? "No payments recorded yet for this company." : "Login or complete company setup to view payments."}
                          </TableCell>
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
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
