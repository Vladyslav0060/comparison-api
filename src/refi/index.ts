import { Env } from "../types/types";
import {
  Request_1031_Props,
  TargetPortfolioProps,
  PortfolioForecastingProps,
} from "../types/types";

const temp_vars = (
  target_property: TargetPortfolioProps | undefined,
  body: Request_1031_Props
) => {
  if (!target_property) return;
  const available_equity =
    target_property.currentValue -
    target_property.loans[0].loanBalance -
    target_property.currentValue * body.new_downpaymment;
  const monthly_noi =
    (available_equity * body.new_caprate) / 12 / body.new_downpaymment;
  const monthly_rents =
    monthly_noi / (1 - body.default_values.new_expenseRatio);
  return { available_equity, monthly_noi, monthly_rents };
};

const getRefinancedTarget = (
  target_property: PortfolioForecastingProps,
  body: Request_1031_Props
): PortfolioForecastingProps => {
  return {
    ...target_property,
    loans: [
      {
        startingBalance:
          target_property.currentValue -
          target_property.currentValue * body.new_downpayment_target,
        mortgageYears: 30,
        loanBalance:
          target_property.currentValue -
          target_property.currentValue * body.new_downpayment_target,
        interestRate: body.new_loan_interest_rate,
        extraPayement: 0,
      },
    ],
  };
};

const getNewInvestment = (
  target_property: PortfolioForecastingProps,
  body: Request_1031_Props
): PortfolioForecastingProps => {
  const { available_equity, monthly_noi, monthly_rents } = temp_vars(
    target_property,
    body
  );
  return {
    ...target_property,
    allExpenses: {
      ...target_property.allExpenses,
      propTaxes: monthly_rents * body.default_values.new_taxes,
      insurance: monthly_rents * body.default_values.new_insurance,
      capEx: monthly_rents * body.default_values.new_maintenance,
      propManage: monthly_rents * body.default_values.new_management,
    },
    loans: [
      {
        startingBalance:
          available_equity / body.new_downpaymment - available_equity,
        mortgageYears: 30,
        loanBalance:
          available_equity / body.new_downpaymment - available_equity,
        interestRate: body.new_loan_interest_rate,
        extraPayement: 0,
      },
    ],
    vacancyLossPercentage: body.default_values.new_vacancy,
    avgRent: monthly_rents,
    annualRevenueIncrease: body.default_values.new_rentalGrowth,
    annualOperatingExpenseIncrease: body.default_values.new_expensInflation,
    purchasePrice: available_equity / body.new_downpaymment,
    closingCosts:
      (body.default_values.new_closingCosts / body.new_downpaymment) *
      available_equity,
    currentValue: available_equity / body.new_downpaymment,
    annualAppreciationRate: body.default_values.new_appreciation,
    downPaymentPerc: body.new_downpaymment,
    taxRate: body.default_values.new_taxes,
  };
};

export const startRefi = async (body: Request_1031_Props, env: Env) => {
  // console.log(body.target_portflio);
  const target_property = body.target_portflio.find(
    (p) => p.uuid === body.target_property
  );
  if (!target_property) return;
  const refinanced_target = getRefinancedTarget(target_property, body);
  const new_investment = getNewInvestment(target_property, body);
  console.log(new_investment.loans);
  console.log(refinanced_target.loans);
};
