
export interface MilkCollectionEntry {
  id: string;
  date: Date;
  time: string;
  dealerName: string;
  quantityLtr: number;
  fatPercentage: number;
  ratePerLtr?: number; // Optional, might be set later or based on FAT
  totalAmount?: number; // Optional, calculated
}

export type ProductName = "Milk" | "Ghee" | "Pashu Aahar";

export interface SaleEntry {
  id: string;
  date: Date;
  customerName: string;
  productName: ProductName;
  quantity: number;
  unit: "Ltr" | "Kg" | "Packet";
  rate: number;
  totalAmount: number;
  paymentType: "Cash" | "Credit";
}

export interface PashuAaharTransaction {
  id: string;
  date: Date;
  type: "Purchase" | "Sale";
  supplierOrCustomerName?: string; // Supplier for Purchase, Customer for Sale
  quantityKg: number;
  purchasePricePerKg?: number; // For purchases
  salePricePerKg?: number; // For sales
  totalAmount: number;
}

export interface DealerLedgerEntry {
  id: string;
  date: Date;
  description: string; // e.g., "Milk Collection", "Payment Received"
  milkQuantityLtr?: number;
  fatPercentage?: number;
  rate?: number;
  debit?: number; // Amount due from dealer (e.g. for items sold to them)
  credit?: number; // Amount paid by dealer or value of milk supplied
  balance: number;
}

export interface PaymentEntry {
  id:string;
  date: Date;
  type: "Received" | "Paid";
  partyName: string; // Dealer, Customer, Supplier
  partyType: "Dealer" | "Customer" | "Supplier";
  amount: number;
  mode: "Cash" | "Bank" | "UPI";
  notes?: string;
}

export interface DailySummary {
  milkPurchasedLitres: number;
  milkPurchasedAmount: number;
  milkSoldLitres: number;
  milkSoldAmount: number;
  gheeSalesAmount: number;
  pashuAaharSalesAmount: number;
  totalCashIn: number;
  totalCreditOut: number;
  totalOutstandingAmount: number;
}
