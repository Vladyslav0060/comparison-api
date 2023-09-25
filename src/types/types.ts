export interface Env {
  FORECASTING_URL: string;
  AMORTIZATION_URL: string;
}

interface AllExpensesProps {
  propTaxes: number;
  insurance: number;
  capEx: number;
  propManage: number;
  othersExpenses: number;
  utils: number;
  hoa: number;
}

interface LoanObjectProps {
  startingBalance: number;
  mortgageYears: number;
  loanBalance: number;
  interestRate: number;
  extraPayement: number;
  balanceCurrent: number;
}

export interface PortfolioForecastingProps {
  name: string;
  uuid: string | number;
  allExpenses: AllExpensesProps;
  loans: LoanObjectProps[];
  yearsNum: number;
  vacancyLossPercentage: number;
  avgRent: number;
  unitsNum: number;
  otherIncome: number;
  annualRevenueIncrease: number;
  annualOperatingExpenseIncrease: number;
  landPerc: number;
  propertyPerc: number;
  purchasePrice: number;
  closingCosts: number;
  repairCosts: number;
  currentValue: number;
  annualAppreciationRate: number;
  downPaymentPerc: number;
  taxRate: number;
  costToSell: number;
  picture?: string;
}

export interface RequestForecastingProps {
  array: PortfolioForecastingProps[];
}

export interface PropertyPortfolioProps extends PortfolioForecastingProps {
  uuid: string;
}

export interface PortfolioProps {
  name: string;
  id: string;
  properties: PropertyPortfolioProps[];
}

export interface Request_1031_Props {
  scenario_type: string | number;
  target_property: string;
  target_portfolio: string;
  scenario_level: string;
  default_values: {
    new_appreciation: number;
    new_closingCosts: number;
    new_expensInflation: number;
    new_expenseRatio: number;
    new_hoa: number;
    new_insurance: number;
    new_maintenance: number;
    new_management: number;
    new_prp_type: string;
    new_rentalGrowth: number;
    new_taxes: number;
    new_taxRate: number;
    new_utils: number;
    new_vacancy: number;
  };
  new_downpaymment: number;
  new_downpayment_target: number;
  new_caprate: number;
  new_loan_interest_rate: number;
  user_id: string;
  portfolios: PortfolioProps[];
}

export type AmortizationNonTargetType = {
  [uuid: string]: AmortizationResponseProps;
};

export interface ForecastingResponseObjectProps {
  year: number;
  expenses: {
    totalExpenses: number;
    expenseObject: AllExpensesProps;
    expAsGrossPercentage: number;
  };
  revenue: {
    vacancy: number;
    vacancyLossPerc: number;
    grossIncome: number;
    effectiveGrossIncome: number;
  };
  cashFlow: {
    cashFlow: number;
    cashFlowVacancy: number;
    taxIncome: number;
    cashOutlayNOI: number;
    cashOutlayGI: number;
  };
  noi: number;
  cumulativeAppreciations: {
    propertyValue: number;
    currentEquity: number;
    appreciationEquity: number;
    mortgagePaydown: number;
    totalAnnualEquity: number;
    totalCumulativeEquity: number;
    loanBalance: number;
    costToSell: number;
    cashOutlay: number;
  };
}

export type PropertiesProps = {
  // reduce(arg0: (acc: any, i: any) => any, arg1: number): unknown;
  // type?: "target_property" | "non-target_property";
  name: string;
  uid: string;
  valuation: number;
  loanBalance: number;
  equity: number;
  cashFlow: number;
  NOI: number;
  ROE: number;
  picture?: string;
  arb: {
    cashOnCash: number;
    avarageCap: number;
    rentMultiplier: number;
    arbAppreciation: number;
    arbDepreciation: number;
    arbDownPayment: number;
  };
  monthlyIncome: {
    rent: number;
    otherIncome: number;
  };
  monthlyExpenses: {
    vacancy: number;
    taxes: number;
    insurance: number;
    management: number;
    hoa: number;
    maintenance: number;
    utils: number;
    total: number;
  };
  loans: {
    totalYears: number;
    initialBalance: number;
    currentBalance: number;
    interestRate: number;
    pmi: number;
    extraPayments: number;
    monthlyPayment: number;
  };
  assumptions: {
    expenseInflation: number;
    rentalGrowth: number;
    appreciation: number;
    maintenance: number;
    vacancy: number;
    management: number;
  };
  acquisition: {
    totalCashOutlay: number;
    purchasePrice: number;
    closingCosts: number;
    downPayment: number;
    repairCosts: number;
  };
  taxRate: number;
};

export type PortfolioResponseProps = {
  name: string;
  valuation: number;
  equity: number;
  NOI: number;
  cashFlow: number;
  LTV: number;
  uuid: string;
  ROE: number;
  arb: {
    cashOnCash: number;
    avarageCap: number;
    rentMultiplier: number;
    arbAppreciation: number;
    arbDepreciation: number;
    arbDownPayment: number;
  };
  properties: PropertiesProps[];
  forecasting: ForecastingResponseObjectProps;
};

export type ComparisonResponseObjectProps = {
  comparison: {
    target_property: string;
    target_portfolio: string;
    refinanced_property: string;
    "new-investemnt-id": string;
    portfolios: PortfolioResponseProps[];
  };
};

export interface AmortizationResponseProps {
  amortization: {
    month: number;
    principal: number;
    totalPayment: number;
    interest: number;
    totalInterest: number;
    balance: number;
  }[];
  summary: {
    numberOfPayments: number;
    monthlyPayment: number;
    interestPerMonth: number;
    totalInterest: number;
    totalPrincipal: number;
    totalPaymentsSB: number;
    totalPaymentsAMT: number;
  };
}
