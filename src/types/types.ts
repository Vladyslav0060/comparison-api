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

interface TargetPortfolioProps extends PortfolioForecastingProps {
  uuid: string | number;
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
    new_taxRate: number;
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
