
export interface MilkCollectionEntry {
  id: string;
  date: Date;
  shift: "Morning" | "Evening";
  customerName: string; // Renamed from dealerName
  quantityLtr: number;
  fatPercentage: number;
  ratePerLtr: number; // This is the rate factor that gets multiplied by FAT and Quantity
  totalAmount: number;
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

export interface Party {
  id: string;
  name: string;
  type: "Customer" | "Supplier" | "Employee"; // "Dealer" type removed
}

export interface PartyLedgerEntry {
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
  partyType: "Customer" | "Supplier" | "Employee"; // "Dealer" type removed, ensure consistency with Party['type']
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
  milkSoldLitres: number;
  milkSoldAmount: number;
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
