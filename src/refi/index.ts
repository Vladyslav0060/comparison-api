import {
  getAmortization,
  getAmortizationNonTarget,
  getFinalForecasting,
  getForecasting,
  getRefiAmortization,
  getRefiForecasting,
} from "../api";
import {
  AmortizationNonTargetType,
  AmortizationResponseProps,
  ComparisonResponseObjectProps,
  Env,
  PortfolioProps,
  PropertiesProps,
} from "../types/types";
import {
  Request_1031_Props,
  TargetPortfolioProps,
  PortfolioForecastingProps,
} from "../types/types";
import { getForecastingRequestObjects } from "../utils";

type TempVarsProps = {
  available_equity: number;
  monthly_noi: number;
  monthly_rents: number;
};

const temp_vars = (
  target_property: TargetPortfolioProps | PortfolioForecastingProps | undefined,
  body: Request_1031_Props
): TempVarsProps | null => {
  try {
    if (!target_property) return null;
    const available_equity =
      target_property.currentValue -
      target_property.loans[0].balanceCurrent -
      target_property.currentValue * body.new_downpaymment;
    const monthly_noi =
      (available_equity * body.new_caprate) / 12 / body.new_downpaymment;
    const monthly_rents =
      monthly_noi / (1 - body.default_values.new_expenseRatio);
    return { available_equity, monthly_noi, monthly_rents };
  } catch (error) {
    console.error("❌ temp_vars: ", error);
    throw error;
  }
};

const getRefinancedTarget = (
  target_property: any,
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
    downPaymentPerc: body.new_downpayment_target,
  };
};

const getNewInvestment = (
  target_property: any,
  body: Request_1031_Props
): PortfolioForecastingProps => {
  try {
    const temps = temp_vars(target_property, body);
    if (!temps) throw new Error("No target property found");
    const { available_equity, monthly_rents } = temps;
    console.log("AAAÀaaaaaaaaa==========================");
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
      repairCosts: 0,
      currentValue: available_equity / body.new_downpaymment,
      annualAppreciationRate: body.default_values.new_appreciation,
      downPaymentPerc: body.new_downpaymment,
      taxRate: body.default_values.new_taxes,
    };
  } catch (error) {
    console.error("❌ getNewInvestment: ", error);
    throw error;
  }
};

function getNonTargetProperty(
  item: PortfolioForecastingProps,
  amortizationResponseNonTarget: AmortizationNonTargetType,
  forecasting: any[]
) {
  const propertyForecasting: any = Object.values(
    forecasting.find((f) => Object.keys(f)[0] === item.uuid)
  )[0];
  const allExpensesSum = Object.values(item.allExpenses).reduce(
    (acc, item) => acc + item,
    0
  );

  const noi =
    (item.avgRent +
      item.otherIncome -
      allExpensesSum -
      item.vacancyLossPercentage * (item.avgRent + item.otherIncome)) *
    12;
  const temp_non_target = amortizationResponseNonTarget[item.uuid];

  const cashflow = noi - temp_non_target.summary.monthlyPayment * 12;

  const closingcosts = item.closingCosts;
  const downpayment = item.downPaymentPerc * item.purchasePrice;
  const totalcashoutlay = downpayment + closingcosts + item.repairCosts;
  const local_valuation = item.currentValue;
  const arbappreciation = local_valuation * item.annualAppreciationRate;
  const arbdepreciation = ((item.purchasePrice * 0.85) / 27.5) * item.taxRate;
  const arbdownpayment =
    propertyForecasting[0].cumulativeAppreciations.mortgagePaydown;
  const equity =
    item.currentValue -
    item.loans.reduce((acc, item) => acc + item.balanceCurrent, 0);

  return {
    // non-target
    uid: item.uuid,
    name: item.name,
    valuation: item.currentValue,
    loanBalance: item.loans.reduce((acc, item) => acc + item.balanceCurrent, 0),
    equity: equity,
    cashFlow: cashflow,
    NOI: noi,
    arb: {
      cashOnCash: (cashflow / totalcashoutlay) * 100,
      avarageCap: (noi / item.currentValue) * 100,
      rentMultiplier:
        local_valuation / (item.avgRent * 12 + item.otherIncome * 12),
      arbAppreciation: local_valuation * item.annualAppreciationRate,
      arbDepreciation: ((item.purchasePrice * 0.85) / 27.5) * item.taxRate,
      arbDownPayment:
        propertyForecasting[0].cumulativeAppreciations.mortgagePaydown,
    },
    monthlyIncome: {
      rent: item.avgRent,
      otherIncome: item.otherIncome,
    },
    monthlyExpenses: (() => {
      const { avgRent, vacancyLossPercentage } = item;
      const { propTaxes, capEx, hoa, insurance, propManage, utils } =
        item.allExpenses;
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
      totalYears: item.loans[0].mortgageYears,
      initialBalance: item.loans[0].loanBalance,
      currentBalance: item.loans[0].startingBalance,
      interestRate: item.loans[0].interestRate,
      pmi: 0,
      extraPayments: item.loans[0].extraPayement,
      monthlyPayment:
        amortizationResponseNonTarget[item.uuid]?.summary.monthlyPayment ||
        amortizationResponse[item.uuid]?.summary.monthlyPayment,
    },
    assumptions: {
      expenseInflation: item.annualOperatingExpenseIncrease,
      rentalGrowth: item.annualRevenueIncrease,
      appreciation: item.annualAppreciationRate,
      maintenance: item.allExpenses.capEx / item.avgRent,
      vacancy: item.vacancyLossPercentage,
      management: item.allExpenses.propManage / item.avgRent,
    },
    acquisition: {
      totalCashOutlay: totalcashoutlay,
      purchasePrice: item.purchasePrice,
      closingCosts: item.closingCosts,
      downPayment: item.downPaymentPerc * item.purchasePrice,
      repairCosts: item.repairCosts,
    },
    picture: item.picture,
    taxRate: item.taxRate,
    ROE:
      (arbappreciation + arbdepreciation + arbdownpayment + cashflow) / equity,
  };
}

async function getTargetProperty(
  req: Request_1031_Props,
  portfolio: PortfolioProps,
  amortizationResponseNonTarget: AmortizationNonTargetType,
  targetAmortization: AmortizationResponseProps | undefined,
  forecasting: any[],
  env: Env
): Promise<PropertiesProps[] | undefined> {
  try {
    const target_property = portfolio.properties.find(
      (p) => p.uuid === req.target_property
    );
    const temp = temp_vars(target_property, req);
    if (!temp) throw new Error("No target property found");
    const { available_equity, monthly_noi, monthly_rents } = temp;

    let refinanced_target = getRefinancedTarget(target_property, req);
    const new_investment = getNewInvestment(target_property, req);
    const refiForecasting = await getRefiForecasting(refinanced_target, env);
    const refiAmortization = await getRefiAmortization(refinanced_target, env);
    const newInvestmentForecasting = await getRefiForecasting(
      new_investment,
      env
    );

    const newInvestmentAmortization = await getRefiAmortization(
      new_investment,
      env
    );
    const rt_valuation = refinanced_target.currentValue;
    const rt_cashflow =
      (monthly_noi - refiAmortization.summary.monthlyPayment) * 12;
    const closingcosts =
      (req.default_values.new_closingCosts / req.new_downpaymment) *
      available_equity;
    const noi = monthly_noi * 12;
    const ni_valuation = available_equity / req.new_downpaymment;
    const ni_cashflow =
      (monthly_noi - newInvestmentAmortization.summary.monthlyPayment) * 12;
    const totalcashoutlay = available_equity + closingcosts;
    const rt_arbappreciation =
      rt_valuation * req.default_values.new_appreciation;
    const rt_arbdepreciation =
      ((rt_valuation * 0.85) / 27.5) * req.default_values.new_taxes;
    const rt_arbdownpayment =
      refiForecasting[0].cumulativeAppreciations.mortgagePaydown;
    const rt_equity = available_equity;
    const ni_arbappreciation =
      ni_valuation * req.default_values.new_appreciation;
    const ni_arbdepreciation =
      ((ni_valuation * 0.85) / 27.5) * req.default_values.new_taxes;
    const ni_arbdownpayment =
      newInvestmentForecasting[0].cumulativeAppreciations.mortgagePaydown;
    const ni_equity = available_equity;

    const res = [
      {
        uid: "refi-target",
        name: `Refinanced ${target_property?.name}`,
        valuation: rt_valuation,
        loanBalance: refinanced_target.currentValue - available_equity,
        equity: rt_equity,
        cashFlow: rt_cashflow,
        NOI: noi,
        arb: {
          cashOnCash: (rt_cashflow / totalcashoutlay) * 100,
          avarageCap: (noi / rt_valuation) * 100,
          rentMultiplier: rt_valuation / noi,
          arbAppreciation: rt_arbappreciation,
          arbDepreciation: rt_arbdepreciation,
          arbDownPayment: rt_arbdownpayment,
        },
        monthlyIncome: {
          rent: monthly_rents,
          otherIncome: refinanced_target.otherIncome,
        },
        monthlyExpenses: (() => {
          const vacancy =
            refinanced_target.avgRent * refinanced_target.vacancyLossPercentage;
          const taxes = refinanced_target.allExpenses.propTaxes;
          const insurance = refinanced_target.allExpenses.insurance;
          const management = refinanced_target.allExpenses.propManage;
          const hoa = refinanced_target.allExpenses.hoa;
          const maintenance = refinanced_target.allExpenses.capEx;
          const utils = refinanced_target.allExpenses.utils;
          const total =
            vacancy +
            taxes +
            insurance +
            management +
            hoa +
            maintenance +
            utils;
          return {
            vacancy,
            taxes,
            insurance,
            management,
            hoa,
            maintenance,
            utils,
            total,
          };
        })(),
        loans: {
          totalYears: refinanced_target.loans.reduce((maxYears, loan) => {
            return Math.max(maxYears, loan.mortgageYears);
          }, 0),
          initialBalance: rt_valuation - available_equity,
          currentBalance: rt_valuation - available_equity,
          interestRate: refinanced_target.loans[0].interestRate,
          pmi: 0,
          extraPayments: refinanced_target.loans[0].extraPayement,
          monthlyPayment: refiAmortization.summary.monthlyPayment,
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
          totalCashOutlay: available_equity + closingcosts,
          purchasePrice: rt_valuation,
          closingCosts: closingcosts,
          downPayment: available_equity,
          repairCosts: 0,
        },
        picture: target_property?.picture,
        taxRate: req.default_values.new_taxRate,
        ROE:
          (rt_arbappreciation +
            rt_arbdepreciation +
            rt_arbdownpayment +
            rt_cashflow) /
          rt_equity,
      },
      {
        uid: "new-investment",
        name: "New Investment",
        valuation: ni_valuation,
        loanBalance: ni_valuation - available_equity,
        equity: available_equity,
        cashFlow: ni_cashflow,
        NOI: noi,
        arb: {
          cashOnCash: (ni_cashflow / totalcashoutlay) * 100,
          avarageCap: (noi / ni_valuation) * 100,
          rentMultiplier: (ni_valuation / noi) * 100,
          arbAppreciation: ni_valuation * req.default_values.new_appreciation,
          arbDepreciation:
            ((ni_valuation * 0.85) / 27.5) * req.default_values.new_taxes,
          arbDownPayment:
            newInvestmentForecasting[0].cumulativeAppreciations.mortgagePaydown,
        },
        monthlyIncome: {
          rent: monthly_rents,
          otherIncome: new_investment.otherIncome,
        },
        monthlyExpenses: (() => {
          const vacancy = monthly_rents * req.default_values.new_vacancy;
          const taxes = monthly_rents * req.default_values.new_taxes;
          const insurance = monthly_rents * req.default_values.new_insurance;
          const management = monthly_rents * req.default_values.new_management;
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
            vacancy,
            taxes,
            insurance,
            management,
            hoa,
            maintenance,
            utils,
            total,
          };
        })(),
        loans: {
          totalYears: new_investment.loans.reduce((maxYears, loan) => {
            return Math.max(maxYears, loan.mortgageYears);
          }, 0),
          initialBalance:
            available_equity / req.new_downpaymment - available_equity,
          currentBalance:
            available_equity / req.new_downpaymment - available_equity,
          interestRate: new_investment.loans[0].interestRate,
          pmi: 0,
          extraPayments: new_investment.loans[0].extraPayement,
          monthlyPayment: newInvestmentAmortization.summary.monthlyPayment,
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
          purchasePrice: ni_valuation,
          closingCosts: closingcosts,
          downPayment: available_equity,
          repairCosts: 0,
        },
        picture: target_property?.picture,
        taxRate: req.default_values.new_taxRate,
        ROE:
          (ni_arbappreciation +
            ni_arbdepreciation +
            ni_arbdownpayment +
            ni_cashflow) /
          ni_equity,
      },
    ];
    return res;
  } catch (error) {
    console.error("❌ getTargetProperty: ", error);
  }
}

const getPortolioPropertiesObjects = async (
  req: Request_1031_Props,
  portfolio: PortfolioProps,
  amortizationResponseNonTarget: AmortizationNonTargetType,
  targetAmortization: AmortizationResponseProps | undefined,
  forecasting: any[],
  env: Env
) => {
  let result: any[];
  const isTargetPortfolio = portfolio.id === req.target_portfolio;
  result = await Promise.all(
    portfolio.properties.flatMap(async (property) => {
      const isTargetProperty = property.uuid === req.target_property;
      return isTargetProperty && isTargetPortfolio
        ? await getTargetProperty(
            req,
            portfolio,
            amortizationResponseNonTarget,
            targetAmortization,
            forecasting,
            env
          )
        : getNonTargetProperty(
            property,
            amortizationResponseNonTarget,
            forecasting
          );
    })
  );
  return result;
};

const buildPortfolioResponse = (
  properties: PropertiesProps[],
  portfolio_id: string,
  portfolio_name: string,
  isTargetPortfolio = false
) => {
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

  const arbAppreciationSum = properties.reduce((acc, item) => {
    return item.arb.arbAppreciation + acc;
  }, 0);
  const arbDepreciationSum = properties.reduce((acc, item) => {
    return item.arb.arbDepreciation + acc;
  }, 0);
  const arbDownpaymentSum = properties.reduce((acc, item) => {
    return item.arb.arbDownPayment + acc;
  }, 0);

  const currentDate = new Date();
  const options = { year: "numeric", month: "long", day: "numeric" };
  const formattedDate = currentDate.toLocaleDateString(undefined, options);

  return {
    name: isTargetPortfolio ? `Refi - ${formattedDate}` : portfolio_name,
    cashFlow: cashflowSum,
    arb: {
      arbAppreciation: arbAppreciationSum,
      arbDepreciation: arbDepreciationSum,
      arbDownPayment: arbDownpaymentSum,
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
    ROE:
      (arbAppreciationSum +
        arbDepreciationSum +
        arbDownpaymentSum +
        cashflowSum) /
      equitySum,
    NOI: noiSum,
    uuid: portfolio_id,
    valuation: valuationSum,
    properties: properties,
  };
};

const getPortfolioResponse = async (
  req: Request_1031_Props,
  portfolio: PortfolioProps,
  amortizationResponseNonTarget: AmortizationNonTargetType,
  targetAmortization: AmortizationResponseProps | undefined,
  forecasting: any[],
  env: Env
) => {
  const portfolioPropertiesResponse = await getPortolioPropertiesObjects(
    req,
    portfolio,
    amortizationResponseNonTarget,
    targetAmortization,
    forecasting,
    env
  );
  const portfolio_res = buildPortfolioResponse(
    portfolioPropertiesResponse.flat(),
    portfolio.id,
    portfolio.name,
    portfolio.id === req.target_portfolio
  );
  portfolio_res.properties.forEach((property) => {
    console.log({ property });
  });
  return portfolio_res;
};

export const startRefi = async (req: Request_1031_Props, env: Env) => {
  try {
    const target_portfolio = req.portfolios.find(
      (p) => p.id === req.target_portfolio
    );
    const target_property =
      target_portfolio?.properties.find(
        (p) => p.uuid === req.target_property
      ) || null;
    const targetAmortization = await getAmortization(req, env);
    target_portfolio &&
      target_property &&
      req.portfolios.push({
        ...target_portfolio,
        id: `clone-${target_portfolio.id}`,
      });
    const portfolios = await Promise.all(
      req.portfolios.map(async (portfolio, idx = 0) => {
        const forecastingRequestObjects = await getForecastingRequestObjects(
          req,
          portfolio
        );

        const forecatingResponse = await getForecasting(
          forecastingRequestObjects,
          env
        );

        const amortizationResponseNonTarget: AmortizationNonTargetType =
          await getAmortizationNonTarget(portfolio, env);

        const portfolio_res: any = await getPortfolioResponse(
          req,
          portfolio,
          amortizationResponseNonTarget,
          targetAmortization,
          forecatingResponse,
          env
        );
        const forecastingRes = await getFinalForecasting(
          portfolio_res.properties,
          env
        );
        portfolio_res.forecasting = forecastingRes;
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
  } catch (error) {
    console.error("❌ startRefi: ", error);
    throw error;
  }
};
