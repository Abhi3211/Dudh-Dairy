
export interface MilkCollectionEntry {
  id: string;
  date: Date;
  time: string;
  dealerName: string;
  quantityLtr: number;
  fatPercentage: number;
  ratePerLtr?: number; 
  totalAmount?: number; 
}

export interface SaleEntry {
  id: string;
  date: Date;
  customerName: string;
  productName: string; 
  quantity: number;
  unit: "Ltr" | "Kg" | "Bags";
  rate: number;
  totalAmount: number;
  paymentType: "Cash" | "Credit";
}

export interface PashuAaharTransaction {
  id: string;
  date: Date;
  type: "Purchase" | "Sale";
  productName: string; 
  supplierOrCustomerName?: string; 
  quantityBags: number;
  pricePerBag?: number;
  totalAmount: number;
}

export interface DealerLedgerEntry {
  id: string;
  date: Date;
  description: string; 
  milkQuantityLtr?: number;
  fatPercentage?: number;
  rate?: number;
  debit?: number; 
  credit?: number; 
  balance: number;
}

export interface PaymentEntry {
  id:string;
  date: Date;
  type: "Received" | "Paid";
  partyName: string; 
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

export interface ChartDataPoint {
  date: string; // e.g., "Jan 01", "Mon", "Week 1"
  purchasedValue?: number;
  soldValue?: number;
}

export interface DashboardData {
  summary: DailySummary;
  chartSeries: ChartDataPoint[];
}
