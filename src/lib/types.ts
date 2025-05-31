
export type UserRole = 'admin' | 'member';

export interface UserProfile {
  uid: string;
  email: string | null;
  displayName: string | null;
  companyId: string;
  role: UserRole;
}

export interface Company {
  id: string;
  name: string;
  // other company details like subscription status, ownerUid, etc. could go here
}

export interface MilkCollectionEntry {
  id: string;
  companyId?: string; // Added for multi-tenancy
  date: Date;
  shift: "Morning" | "Evening";
  customerName: string; // This is the person supplying milk
  quantityLtr: number;
  fatPercentage: number;
  ratePerLtr: number; // This is the rate factor (Quantity * FAT * Rate = Total)
  totalAmount: number; // Gross amount: quantity * fat * rate
  advancePaid?: number;
  remarks?: string;
  netAmountPayable: number; // totalAmount - (advancePaid || 0)
}

export interface SaleEntry {
  id: string;
  companyId?: string; // Added for multi-tenancy
  date: Date;
  customerName: string;
  productName: string;
  quantity: number;
  unit: "Ltr" | "Kg" | "Bags" | "Pcs";
  rate: number;
  totalAmount: number;
  paymentType: "Cash" | "Credit";
}

export interface BulkSaleEntry {
  id: string;
  companyId?: string; // Added for multi-tenancy
  date: Date;
  shift: "Morning" | "Evening";
  customerName: string; // The bulk buyer
  quantityLtr: number;
  fatPercentage: number;
  rateFactor: number; // Rate per FAT point
  totalAmount: number; // quantityLtr * fatPercentage * rateFactor
  paymentType: "Cash" | "Credit";
  remarks?: string;
}

export interface PurchaseEntry {
  id: string;
  companyId?: string; // Added for multi-tenancy
  date: Date;
  category: string;
  productName: string;
  supplierName?: string;
  quantity: number;
  unit: string;
  pricePerUnit?: number;
  defaultSalePricePerUnit?: number;
  totalAmount: number;
  paymentType: "Cash" | "Credit";
}

export interface Party {
  id: string;
  companyId?: string; // Added for multi-tenancy
  name: string;
  type: "Customer" | "Supplier" | "Employee";
}

export interface PartyLedgerEntry {
  id: string;
  companyId?: string; // Added for multi-tenancy (though ledger is derived, source transactions will have it)
  date: Date;
  description: string;
  shift?: "Morning" | "Evening";
  milkQuantityLtr?: number;
  fatPercentage?: number;
  rate?: number;
  debit?: number;
  credit?: number;
  balance: number;
}

export interface PaymentEntry {
  id:string;
  companyId?: string; // Added for multi-tenancy
  date: Date;
  type: "Received" | "Paid";
  partyName: string;
  partyType: "Customer" | "Supplier" | "Employee";
  amount: number;
  mode: "Cash" | "Bank" | "UPI";
  notes?: string;
}

export interface ExpenseEntry {
  id: string;
  companyId?: string; // Added for multi-tenancy
  date: Date;
  category: "Salary" | "Miscellaneous";
  description: string;
  amount: number;
  partyId?: string;
  partyName?: string;
}

export interface DailySummary {
  milkPurchasedLitres: number;
  milkPurchasedAmount: number;
  milkSoldLitres: number;
  milkSoldAmount: number;
  bulkMilkSoldLitres: number;
  bulkMilkSoldAmount: number;
  gheeSalesAmount: number;
  pashuAaharSalesAmount: number;
  totalCashIn: number;
  totalCreditOut: number;
  totalOutstandingAmount: number;
}

export interface ChartDataPoint {
  date: string;
  purchasedValue?: number;
  soldValue?: number;
}

export interface DashboardData {
  summary: DailySummary;
  chartSeries: ChartDataPoint[];
}

export interface ProfitLossSummaryData {
  totalRevenue: number;
  milkSalesRetail: number;
  milkSalesBulk: number;
  gheeSales: number;
  pashuAaharSales: number;
  
  purchasesMilkCollectionValue: number;
  purchasesGheeValue: number;
  purchasesPashuAaharValue: number;
  totalPurchasesValue: number;

  closingStockValueMilk: number;
  closingStockValueGhee: number;
  closingStockValuePashuAahar: number;
  totalClosingStockValue: number;
  
  costOfGoodsSold: number; // totalPurchasesValue - totalClosingStockValue
  grossProfit: number;     // totalRevenue - costOfGoodsSold
  operatingExpenses: number; // Still 0 for now
  netProfitLoss: number;     // grossProfit - operatingExpenses
  periodDays: number;
}

export interface PlChartDataPoint {
  date: string; // e.g., "MMM dd"
  netProfit: number; // Daily net profit
  revenue?: number; // Optional: for more detailed chart tooltips
  cogs?: number;    // Optional: for more detailed chart tooltips
}

export interface FullProfitLossData {
  summary: ProfitLossSummaryData;
  chartSeries: PlChartDataPoint[];
}
