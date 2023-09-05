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
}

export interface PortfolioForecastingProps {
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
}

export interface TargetPortfolioProps extends PortfolioForecastingProps {
  uuid: string;
}

export interface Request_1031_Props {
  scenario_type: string | number;
  target_property: string;
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
    new_utils: number;
    new_vacancy: number;
  };
  new_downpaymment: number;
  new_downpayment_target: number;
  new_caprate: number;
  new_loan_interest_rate: number;
  user_id: string;
  target_portflio: TargetPortfolioProps[];
}

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
  uid: string;
  valuation: number;
  loanBalance: number;
  equity: number;
  cashFlow: number;
  NOI: number;
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
  };
};

export type ComparisonResponseObjectProps = {
  comparison: {
    target_property: any;
    refinanced_property: string;
    "new-investemnt-id": string;
    portfolios: {
      name: string;
      valuation: number;
      equity: number;
      NOI: number;
      cashFlow: number;
      LTV: number;
      uuid: string;
      arb: {
        cashOnCash: number;
        avarageCap: number;
        rentMultiplier: number;
        arbAppreciation: number;
        arbDepreciation: number;
        arbDownPayment: number;
      };
      properties: PropertiesProps[];
    }[];
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
