
export interface MilkCollectionEntry {
  id: string;
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
  date: Date;
  customerName: string;
  productName: string;
  quantity: number;
  unit: "Ltr" | "Kg" | "Bags";
  rate: number;
  totalAmount: number;
  paymentType: "Cash" | "Credit";
}

export interface BulkSaleEntry {
  id: string;
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

export interface PashuAaharTransaction {
  id: string;
  date: Date;
  type: "Purchase" | "Sale"; // "Sale" might be implicit if sold via SalesEntry
  productName: string;
  supplierOrCustomerName?: string; // Supplier if type is "Purchase"
  quantityBags: number;
  pricePerBag?: number; // Cost price
  salePricePerBag?: number; // Optional sale price set at time of purchase
  totalAmount: number; // For purchases: quantityBags * pricePerBag
  paymentType: "Cash" | "Credit";
}

export interface Party {
  id: string;
  name: string;
  type: "Customer" | "Supplier" | "Employee";
}

export interface PartyLedgerEntry {
  id: string;
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
  milkSoldLitres: number; // Retail milk sold
  milkSoldAmount: number; // Retail milk sold value
  bulkMilkSoldLitres: number; // New
  bulkMilkSoldAmount: number; // New
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
  milkSales: number;
  gheeSales: number;
  pashuAaharSales: number;
  costOfGoodsSold: number;
  grossProfit: number;
  operatingExpenses: number;
  netProfitLoss: number;
  periodDays: number;
}

export interface PlChartDataPoint {
  date: string;
  netProfit: number;
}

export interface FullProfitLossData {
  summary: ProfitLossSummaryData;
  chartSeries: PlChartDataPoint[];
}
