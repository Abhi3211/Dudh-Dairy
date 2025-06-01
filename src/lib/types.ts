
export type UserRole = 'admin' | 'member'; // 'accountant' could be added later

export interface UserProfile {
  uid: string; // Document ID in Firestore 'users' collection, matches Firebase Auth UID
  companyId: string; // ID of the company document in 'companies' collection
  email: string; // User's email
  displayName: string | null;
  role: UserRole;
  createdAt?: Date;
}

export interface Company {
  id: string; // Document ID in Firestore 'companies' collection
  name: string;
  ownerUid: string; // UID of the user who created/owns the company
  createdAt?: Date;
}

export interface MilkCollectionEntry {
  id: string;
  // companyId is implied by subcollection path
  date: Date;
  shift: "Morning" | "Evening";
  customerName: string; // This refers to the Party supplying milk
  quantityLtr: number;
  fatPercentage: number;
  ratePerLtr: number;
  totalAmount: number;
  advancePaid?: number;
  remarks?: string;
  netAmountPayable: number;
}

export interface SaleEntry {
  id: string;
  companyId?: string;
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
  companyId?: string;
  date: Date;
  shift: "Morning" | "Evening";
  customerName: string;
  quantityLtr: number;
  fatPercentage: number;
  rateFactor: number;
  totalAmount: number;
  paymentType: "Cash" | "Credit";
  remarks?: string;
}

export interface PurchaseEntry {
  id: string;
  companyId?: string;
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
  companyId?: string; // Will be set when creating party under a company context
  name: string;
  type: "Customer" | "Supplier" | "Employee";
  openingBalance?: number; // Positive: Party owes Dairy (Customer/Employee) or Dairy owes Party (Supplier). Negative: Vice-versa.
  openingBalanceAsOfDate?: Date;
}

export interface PartyLedgerEntry {
  id: string;
  companyId?: string;
  date: Date;
  description: string;
  shift?: "Morning" | "Evening";
  milkQuantityLtr?: number;
  fatPercentage?: number;
  rate?: number;
  debit?: number; // Amount party owes dairy, or dairy paid to party
  credit?: number; // Amount dairy owes party, or party paid to dairy
  balance: number; // Running balance from dairy's perspective (Positive = Party owes dairy; Negative = Dairy owes party)
}

export interface PaymentEntry {
  id:string;
  companyId?: string;
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
  companyId?: string;
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
  
  costOfGoodsSold: number; 
  grossProfit: number;    
  operatingExpenses: number; 
  netProfitLoss: number;    
  periodDays: number;
}

export interface PlChartDataPoint {
  date: string; 
  netProfit: number; 
  revenue?: number; 
  cogs?: number;    
}

export interface FullProfitLossData {
  summary: ProfitLossSummaryData;
  chartSeries: PlChartDataPoint[];
}
