import {
  Env,
  ForecastingResponseObjectProps,
  Request_1031_Props,
  PortfolioProps,
  RequestForecastingProps,
} from "./types/types";
import { getAmortization, getAmortizationNonTarget } from "./api";

const getTempVariables = (
  req: Request_1031_Props,
  portfolio: PortfolioProps
) => {
  const { target_property } = req;
  const object = portfolio.properties.find(
    (item) => item.uuid === target_property
  );
  // if (!object) throw new Error("Object with this uuid is not found");
  if (!object)
    return {
      available_equity: 0,
      mothlyNOI: 0,
      monthly_rents: 0,
      valuation: 0,
    };
  const available_equity =
    req.scenario_type === "1031"
      ? object.currentValue - object.loans[0].startingBalance
      : object.currentValue -
        object.loans[0].startingBalance -
        object.currentValue * req.new_downpaymment;
  const mothlyNOI =
    (available_equity * req.new_caprate) / 12 / req.new_downpaymment;
  const monthly_rents = mothlyNOI / (1 - req.default_values.new_expenseRatio);
  const valuation = available_equity / req.new_downpaymment;

  return { available_equity, mothlyNOI, monthly_rents, valuation };
};

const getForecastingRequestObjects = (
  req: Request_1031_Props,
  portfolio: PortfolioProps
): any => {
  try {
    const { target_property } = req;
    const object = portfolio.properties.find(
      (item) => item.uuid === target_property
    );
    // if (!object) throw new Error("Object with this uuid is not found");
    // if (!object) return null;

    const { available_equity, monthly_rents, mothlyNOI } = getTempVariables(
      req,
      portfolio
    );
    const result = portfolio.properties.map((property) => {
      return {
        array:
          portfolio.id === req.target_portfolio &&
          property.uuid === req.target_property
            ? [
                {
                  available_equity: available_equity,
                  mothlyNOI: mothlyNOI,
                  monthly_rents: monthly_rents,
                  uuid: req.target_property,
                  allExpenses: {
                    propTaxes: monthly_rents * req.default_values.new_taxes,
                    insurance: monthly_rents * req.default_values.new_insurance,
                    capEx: monthly_rents * req.default_values.new_maintenance,
                    propManage:
                      monthly_rents * req.default_values.new_management,
                    othersExpenses: 0,
                    utils: monthly_rents * req.default_values.new_utils,
                    hoa: monthly_rents * req.default_values.new_hoa,
                  },
                  loans: [
                    {
                      startingBalance:
                        available_equity / req.new_downpaymment -
                        available_equity,
                      mortgageYears: 30,
                      loanBalance:
                        available_equity / req.new_downpaymment -
                        available_equity,
                      interestRate: req.new_loan_interest_rate,
                      extraPayement: 0,
                    },
                  ],
                  yearsNum: 31,
                  vacancyLossPercentage: req.default_values.new_vacancy,
                  avgRent: monthly_rents,
                  unitsNum: 1,
                  otherIncome: 0,
                  annualRevenueIncrease: req.default_values.new_rentalGrowth,
                  annualOperatingExpenseIncrease:
                    req.default_values.new_expensInflation,
                  landPerc: 0.2,
                  propertyPerc: 0.8,
                  purchasePrice: available_equity / req.new_downpaymment,
                  closingCosts:
                    (req.default_values.new_closingCosts /
                      req.new_downpaymment) *
                    available_equity,
                  repairCosts: 0,
                  currentValue: available_equity / req.new_downpaymment,
                  annualAppreciationRate: req.default_values.new_appreciation,
                  downPaymentPerc: req.new_downpaymment,
                  taxRate: req.default_values.new_taxes,
                  costToSell: 0.07,
                },
              ]
            : [property],
      };
    });
    return result;
  } catch (error) {
    console.log(error);
  }
};

export { getTempVariables, getForecastingRequestObjects };
