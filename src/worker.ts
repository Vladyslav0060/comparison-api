import {
  getAmortization,
  getAmortizationNonTarget,
  getForecasting,
} from "./api";
import {
  AmortizationNonTargetType,
  AmortizationResponseProps,
  Env,
  PortfolioProps,
  PortfolioResponseProps,
  PropertiesProps,
} from "./types/types";
import {
  Request_1031_Props,
  ComparisonResponseObjectProps,
} from "./types/types";
import { getForecastingRequestObjects } from "./utils";

const getTempVariables = (req: Request_1031_Props) => {
  const targetPortfolio = req.portfolios.find(
    (item) => item.id === req.target_portfolio
  );
  const targetProperty = targetPortfolio?.properties.find(
    (p) => p.uuid === req.target_property
  );
  if (!targetPortfolio || !targetProperty)
    return {
      available_equity: 0,
      mothlyNOI: 0,
      monthly_rents: 0,
      valuation: 0,
    };
  const available_equity =
    targetProperty.currentValue - targetProperty.loans[0].startingBalance;
  const mothlyNOI =
    (available_equity * req.new_caprate) / 12 / req.new_downpaymment;
  const monthly_rents = mothlyNOI / (1 - req.default_values.new_expenseRatio);
  const valuation = available_equity / req.new_downpaymment;

  return { available_equity, mothlyNOI, monthly_rents, valuation };
};

const getPortolioPropertiesObjects = (
  req: Request_1031_Props,
  portfolio: PortfolioProps,
  amortizationResponseNonTarget: AmortizationNonTargetType,
  targetAmortization: AmortizationResponseProps | undefined,
  forecasting: any[]
) => {
  const isTargetPortfolio = portfolio.id === req.target_portfolio;
  const { available_equity, monthly_rents, mothlyNOI, valuation } =
    getTempVariables(req);
  let result: PropertiesProps[];
  result = portfolio.properties.flatMap((property) => {
    const isTargetProperty = property.uuid === req.target_property;
    if (isTargetProperty && isTargetPortfolio) {
      return (() => {
        const propertyForecasting = Object.values(
          forecasting.find((f) => Object.keys(f)[0] === property.uuid)
        )[0];
        const allExpensesSum = Object.values(property.allExpenses).reduce(
          (acc, item) => acc + item,
          0
        );
        const noi =
          property.uuid === req.target_property
            ? mothlyNOI * 12
            : (property.avgRent +
                property.otherIncome -
                allExpensesSum -
                property.vacancyLossPercentage *
                  (property.avgRent + property.otherIncome)) *
              12;
        const temp_non_target = amortizationResponseNonTarget[property.uuid];

        const cashflow =
          property.uuid === req.target_property
            ? (mothlyNOI - targetAmortization.summary.monthlyPayment) * 12
            : noi - temp_non_target.summary.monthlyPayment * 12;

        const closingcosts =
          property.uuid === req.target_property
            ? (req.default_values.new_closingCosts / req.new_downpaymment) *
              available_equity
            : property.closingCosts;

        const downpayment =
          property.uuid === req.target_property
            ? available_equity
            : property.downPaymentPerc * property.purchasePrice;

        const totalcashoutlay =
          property.uuid === req.target_property
            ? downpayment + closingcosts
            : downpayment + closingcosts + property.repairCosts;

        const local_valuation =
          property.uuid === req.target_property
            ? valuation
            : property.currentValue;

        const arbappreciation =
          local_valuation * req.default_values.new_appreciation;
        const arbdepreciation =
          ((local_valuation * 0.85) / 27.5) * property.taxRate;
        const arbdownpayment =
          propertyForecasting[0].cumulativeAppreciations.mortgagePaydown;
        const equity = available_equity;
        return {
          //1
          // type: "target",
          uid: property.uuid,
          valuation: local_valuation,
          loanBalance: local_valuation - available_equity,
          equity: available_equity,
          cashFlow: cashflow,
          NOI: noi,
          arb: {
            cashOnCash: (cashflow / totalcashoutlay) * 100,
            avarageCap: (noi / local_valuation) * 100,
            rentMultiplier: local_valuation / (monthly_rents * 12),
            arbAppreciation:
              local_valuation * req.default_values.new_appreciation,
            arbDepreciation:
              ((local_valuation * 0.85) / 27.5) * property.taxRate,
            arbDownPayment:
              propertyForecasting[0].cumulativeAppreciations.mortgagePaydown,
            // forecatingResponse[0].cumulativeAppreciations.mortgagePaydown,
          },
          monthlyIncome: {
            rent: monthly_rents,
            otherIncome: 0,
          },
          monthlyExpenses: (() => {
            const vacancy = monthly_rents * req.default_values.new_vacancy;
            const taxes = monthly_rents * req.default_values.new_taxes;
            const insurance = monthly_rents * req.default_values.new_insurance;
            const management =
              monthly_rents * req.default_values.new_management;
            const hoa = monthly_rents * req.default_values.new_hoa;
            const maintenance =
              monthly_rents * req.default_values.new_maintenance;
            const utils = monthly_rents * req.default_values.new_utils;
            const total =
              vacancy +
              taxes +
              insurance +
              management +
              hoa +
              maintenance +
              utils;
            return {
              vacancy: vacancy,
              taxes: taxes,
              insurance: insurance,
              management: management,
              hoa: hoa,
              maintenance: maintenance,
              utils: utils,
              total: total,
            };
          })(),
          loans: {
            totalYears: property.loans.reduce((maxYears, loan) => {
              return Math.max(maxYears, loan.mortgageYears);
            }, 0),
            initialBalance:
              available_equity / req.new_downpaymment - available_equity,
            currentBalance:
              available_equity / req.new_downpaymment - available_equity,
            interestRate: req.new_loan_interest_rate,
            pmi: 0,
            extraPayments: 0,
            monthlyPayment: targetAmortization.summary.monthlyPayment,
          },
          assumptions: {
            expenseInflation: req.default_values.new_expensInflation,
            rentalGrowth: req.default_values.new_rentalGrowth,
            appreciation: req.default_values.new_appreciation,
            maintenance: req.default_values.new_maintenance,
            vacancy: req.default_values.new_vacancy,
            management: req.default_values.new_management,
          },
          acquisition: {
            totalCashOutlay: totalcashoutlay,
            purchasePrice: local_valuation,
            closingCosts: closingcosts,
            downPayment: downpayment,
          },
          picture: property.picture,
          ROE:
            (arbappreciation + arbdepreciation + arbdownpayment + cashflow) /
            equity,
        };
      })();
    } else
      return (() => {
        const propertyForecasting = Object.values(
          forecasting.find((f) => Object.keys(f)[0] === property.uuid)
        )[0];
        const allExpensesSum = Object.values(property.allExpenses).reduce(
          (acc, item) => acc + item,
          0
        );

        const noi =
          (property.avgRent +
            property.otherIncome -
            allExpensesSum -
            property.vacancyLossPercentage *
              (property.avgRent + property.otherIncome)) *
          12;
        const temp_non_target = amortizationResponseNonTarget[property.uuid];
        const cashflow = noi - temp_non_target.summary.monthlyPayment * 12;

        const closingcosts = property.closingCosts;
        const downpayment = property.downPaymentPerc * property.purchasePrice;
        const totalcashoutlay =
          downpayment + closingcosts + property.repairCosts;
        const local_valuation = property.currentValue;
        const arbappreciation =
          local_valuation * property.annualAppreciationRate;
        const arbdepreciation =
          ((property.purchasePrice * 0.85) / 27.5) * property.taxRate;
        const arbdownpayment =
          propertyForecasting[0].cumulativeAppreciations.mortgagePaydown;
        const equity =
          property.currentValue -
          property.loans.reduce((acc, item) => acc + item.loanBalance, 0);
        return {
          //1
          // type: "non-target",
          uid: property.uuid,
          valuation: property.currentValue,
          loanBalance: property.loans.reduce(
            (acc, item) => acc + item.loanBalance,
            0
          ),
          equity: equity,
          cashFlow: cashflow,
          NOI: noi,
          arb: {
            cashOnCash: (cashflow / totalcashoutlay) * 100,
            avarageCap: (noi / property.currentValue) * 100,
            rentMultiplier:
              local_valuation /
              (property.avgRent * 12 + property.otherIncome * 12),
            arbAppreciation: arbappreciation,
            arbDepreciation: arbdepreciation,
            arbDownPayment: arbdownpayment,
          },
          monthlyIncome: {
            rent: property.avgRent,
            otherIncome: property.otherIncome,
          },
          monthlyExpenses: (() => {
            const { avgRent, vacancyLossPercentage } = property;
            const { propTaxes, capEx, hoa, insurance, propManage, utils } =
              property.allExpenses;
            const vacancy = avgRent * vacancyLossPercentage;
            const total =
              vacancy +
              propTaxes +
              insurance +
              propManage +
              hoa +
              capEx +
              propManage +
              utils;
            return {
              vacancy: vacancy,
              taxes: propTaxes,
              insurance: insurance,
              management: propManage,
              hoa: hoa,
              maintenance: capEx,
              utils: utils,
              total: total,
            };
          })(),
          loans: {
            totalYears: property.loans[0].mortgageYears,
            initialBalance: property.loans[0].loanBalance,
            currentBalance: property.loans[0].startingBalance,
            interestRate: property.loans[0].interestRate,
            pmi: 0,
            extraPayments: property.loans[0].extraPayement,
            monthlyPayment:
              amortizationResponseNonTarget[property.uuid]?.summary
                .monthlyPayment,
          },
          assumptions: {
            expenseInflation: property.annualOperatingExpenseIncrease,
            rentalGrowth: property.annualRevenueIncrease,
            appreciation: property.annualAppreciationRate,
            maintenance: property.allExpenses.capEx / property.avgRent,
            vacancy: property.vacancyLossPercentage,
            management: property.allExpenses.propManage / property.avgRent,
          },
          acquisition: {
            totalCashOutlay: totalcashoutlay,
            purchasePrice: property.purchasePrice,
            closingCosts: property.closingCosts,
            downPayment: property.downPaymentPerc * property.purchasePrice,
          },
          picture: property.picture,
          ROE:
            (arbappreciation + arbdepreciation + arbdownpayment + cashflow) /
            equity,
        };
      })();
  });
  return result;
};

const buildPortfolioResponse = (
  properties: PropertiesProps[],
  portfolio_id: string
): PortfolioResponseProps => {
  console.log("build properties: ", properties);
  const { valuationSum, equitySum, loanBalancesSum, noiSum, cashflowSum } =
    properties.reduce(
      (acc, item) => {
        return {
          valuationSum: item.valuation + acc.valuationSum,
          equitySum: item.equity + acc.equitySum,
          noiSum: item.NOI + acc.noiSum,
          loanBalancesSum: item.loanBalance + acc.loanBalancesSum,
          cashflowSum: item.cashFlow + acc.cashflowSum,
        };
      },
      {
        valuationSum: 0,
        equitySum: 0,
        loanBalancesSum: 0,
        noiSum: 0,
        cashflowSum: 0,
      }
    );
  return {
    name: portfolio_id,
    cashFlow: cashflowSum,
    arb: {
      arbAppreciation: properties.reduce((acc, item) => {
        return item.arb.arbAppreciation + acc;
      }, 0),
      arbDepreciation: properties.reduce((acc, item) => {
        return item.arb.arbDepreciation + acc;
      }, 0),
      arbDownPayment: properties.reduce((acc, item) => {
        return item.arb.arbDownPayment + acc;
      }, 0),
      avarageCap:
        properties.reduce((acc, item) => {
          return item.arb.avarageCap + acc;
        }, 0) / properties.length,
      cashOnCash:
        properties.reduce((acc, item) => {
          return item.arb.cashOnCash + acc;
        }, 0) / properties.length,
      rentMultiplier:
        properties.reduce((acc, item) => {
          return item.arb.rentMultiplier + acc;
        }, 0) / properties.length,
    },
    equity: equitySum,
    LTV: (loanBalancesSum / valuationSum) * 100,
    NOI: noiSum,
    uuid: portfolio_id,
    valuation: valuationSum,
    properties: properties,
  };
};

const getPortfolioResponse = (
  req: Request_1031_Props,
  portfolio: PortfolioProps,
  amortizationResponseNonTarget: AmortizationNonTargetType,
  targetAmortization: AmortizationResponseProps | undefined,
  forecasting: any[]
) => {
  const portfolioPropertiesResponse = getPortolioPropertiesObjects(
    req,
    portfolio,
    amortizationResponseNonTarget,
    targetAmortization,
    forecasting
  );
  const portfolio_res = buildPortfolioResponse(
    portfolioPropertiesResponse,
    portfolio.id
  );
  return portfolio_res;
};

export const start = async (
  req: Request_1031_Props,
  env: Env
): Promise<any> => {
  try {
    const target_portfolio = req.portfolios.find(
      (p) => p.id === req.target_portfolio
    );

    target_portfolio &&
      req.portfolios.push({
        ...target_portfolio,
        id: `clone-${target_portfolio.id}`,
      });
    const targetAmortization = await getAmortization(req, env);
    const portfolios = await Promise.all(
      req.portfolios.map(async (portfolio, idx = 0) => {
        const forecastingRequestObjects = await getForecastingRequestObjects(
          req,
          portfolio
        );
        if (!forecastingRequestObjects) return;
        const forecatingResponse = await getForecasting(
          forecastingRequestObjects,
          env
        );
        const amortizationResponseNonTarget: AmortizationNonTargetType =
          await getAmortizationNonTarget(portfolio, env);
        const portfolio_res = getPortfolioResponse(
          req,
          portfolio,
          amortizationResponseNonTarget,
          targetAmortization,
          forecatingResponse
        );
        return portfolio_res;
      })
    );
    const response: ComparisonResponseObjectProps = {
      comparison: {
        "new-investemnt-id": req.target_property,
        target_portfolio: req.target_portfolio,
        target_property: req.target_property,
        refinanced_property: req.target_property,
        portfolios: portfolios,
      },
    };

    return response;
  } catch (err) {
    console.error(err);
  }
};
