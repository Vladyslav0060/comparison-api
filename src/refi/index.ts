import {
  getAmortization,
  getAmortizationNonTarget,
  getForecasting,
  getRefiAmortization,
  getRefiForecasting,
} from "../api";
import {
  ComparisonResponseObjectProps,
  Env,
  PropertiesProps,
} from "../types/types";
import {
  Request_1031_Props,
  TargetPortfolioProps,
  PortfolioForecastingProps,
} from "../types/types";
import { getForecastingRequestObject } from "../utils";

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
      target_property.loans[0].startingBalance -
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
    downPaymentPerc: body.new_downpayment_target,
  };
};

const getNewInvestment = (
  target_property: PortfolioForecastingProps,
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

export const startRefi = async (body: Request_1031_Props, env: Env) => {
  try {
    const target_property = body.target_portflio.find(
      (p) => p.uuid === body.target_property
    );
    if (!target_property) throw new Error("No target property found");
    const refinanced_target = getRefinancedTarget(target_property, body);
    const new_investment = getNewInvestment(target_property, body);
    console.log(new_investment);
    console.log(refinanced_target);

    const forecastingRequestObject: any = getForecastingRequestObject(body);
    const forecatingResponse = await getForecasting(
      forecastingRequestObject,
      env
    );

    const amortizationResponseNonTarget = await getAmortizationNonTarget(
      body,
      env
    );

    const amortizationResponse = await getAmortization(body, env);

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

    const temps = temp_vars(target_property, body);
    if (!temps) throw new Error("No target property found");
    const { available_equity, monthly_noi, monthly_rents } = temps;

    function getNonTargetProperty(item: TargetPortfolioProps) {
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

      return {
        // non-target
        uid: item.uuid,
        valuation: item.currentValue,
        loanBalance: item.loans.reduce(
          (acc, item) => acc + item.startingBalance,
          0
        ),
        equity:
          item.currentValue -
          item.loans.reduce((acc, item) => acc + item.startingBalance, 0),
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
            forecatingResponse[0].cumulativeAppreciations.mortgagePaydown,
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
        },
      };
    }

    const res: ComparisonResponseObjectProps = {
      comparison: {
        target_property: body.target_property,
        refinanced_property: body.target_property,
        "new-investemnt-id": body.target_property,
        portfolios: [
          {
            name: "portfolio_before_scenario",
            cashFlow: 0,
            arb: {
              arbAppreciation: 0,
              arbDepreciation: 0,
              arbDownPayment: 0,
              avarageCap: 0,
              cashOnCash: 0,
              rentMultiplier: 0,
            },
            equity: 0,
            LTV: 0,
            NOI: 0,
            uuid: body.target_property,
            valuation: 0,
            properties: body.target_portflio.map((item) =>
              getNonTargetProperty(item)
            ),
          },
          {
            name: "portfolio_after_scenario",
            cashFlow: 0,
            arb: {
              arbAppreciation: 0,
              arbDepreciation: 0,
              arbDownPayment: 0,
              avarageCap: 0,
              cashOnCash: 0,
              rentMultiplier: 0,
            },
            equity: 0,
            LTV: 0,
            NOI: 0,
            uuid: "aaa",
            valuation: 0,
            properties: body.target_portflio.flatMap((item) => {
              let res: PropertiesProps | PropertiesProps[] | null = null;

              if (item.uuid === body.target_property) {
                const rt_valuation = refinanced_target.currentValue;
                const rt_cashflow =
                  (monthly_noi - refiAmortization.summary.monthlyPayment) * 12;
                const closingcosts =
                  (body.default_values.new_closingCosts /
                    body.new_downpaymment) *
                  available_equity;
                const noi = monthly_noi * 12;
                const ni_valuation = available_equity / body.new_downpaymment;
                const ni_cashflow =
                  (monthly_noi -
                    newInvestmentAmortization.summary.monthlyPayment) *
                  12;
                const totalcashoutlay = available_equity + closingcosts;
                res = [
                  {
                    uid: "refi-target",
                    valuation: rt_valuation,
                    loanBalance:
                      refinanced_target.currentValue - available_equity,
                    equity: available_equity,
                    cashFlow: rt_cashflow,
                    NOI: noi,
                    arb: {
                      cashOnCash: (rt_cashflow / totalcashoutlay) * 100,
                      avarageCap: (noi / rt_valuation) * 100,
                      rentMultiplier: rt_valuation / noi,
                      arbAppreciation:
                        rt_valuation * body.default_values.new_appreciation,
                      arbDepreciation:
                        ((rt_valuation * 0.85) / 27.5) *
                        body.default_values.new_taxes,
                      arbDownPayment:
                        refiForecasting[0].cumulativeAppreciations
                          .mortgagePaydown,
                    },
                    monthlyIncome: {
                      rent: monthly_rents,
                      otherIncome: refinanced_target.otherIncome,
                    },
                    monthlyExpenses: (() => {
                      const vacancy =
                        refinanced_target.avgRent *
                        refinanced_target.vacancyLossPercentage;
                      const taxes = refinanced_target.allExpenses.propTaxes;
                      const insurance = refinanced_target.allExpenses.insurance;
                      const management =
                        refinanced_target.allExpenses.propManage;
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
                      totalYears: refinanced_target.loans.reduce(
                        (maxYears, loan) => {
                          return Math.max(maxYears, loan.mortgageYears);
                        },
                        0
                      ),
                      initialBalance: rt_valuation - available_equity,
                      currentBalance: rt_valuation - available_equity,
                      interestRate: refinanced_target.loans[0].interestRate,
                      pmi: 0,
                      extraPayments: refinanced_target.loans[0].extraPayement,
                      monthlyPayment: refiAmortization.summary.monthlyPayment,
                    },
                    assumptions: {
                      expenseInflation: body.default_values.new_expensInflation,
                      rentalGrowth: body.default_values.new_rentalGrowth,
                      appreciation: body.default_values.new_appreciation,
                      maintenance: body.default_values.new_maintenance,
                      vacancy: body.default_values.new_vacancy,
                      management: body.default_values.new_management,
                    },
                    acquisition: {
                      totalCashOutlay: available_equity + closingcosts,
                      purchasePrice: rt_valuation,
                      closingCosts: closingcosts,
                      downPayment: available_equity,
                    },
                  },
                  {
                    uid: "new-investment",
                    valuation: ni_valuation,
                    loanBalance: ni_valuation - available_equity,
                    equity: available_equity,
                    cashFlow: ni_cashflow,
                    NOI: noi,
                    arb: {
                      cashOnCash: (ni_cashflow / totalcashoutlay) * 100,
                      avarageCap: (noi / ni_valuation) * 100,
                      rentMultiplier: (ni_valuation / noi) * 100,
                      arbAppreciation:
                        ni_valuation * body.default_values.new_appreciation,
                      arbDepreciation:
                        ((ni_valuation * 0.85) / 27.5) *
                        body.default_values.new_taxes,
                      arbDownPayment:
                        newInvestmentForecasting[0].cumulativeAppreciations
                          .mortgagePaydown,
                    },
                    monthlyIncome: {
                      rent: monthly_rents,
                      otherIncome: new_investment.otherIncome,
                    },
                    monthlyExpenses: (() => {
                      const vacancy =
                        monthly_rents * body.default_values.new_vacancy;
                      const taxes =
                        monthly_rents * body.default_values.new_taxes;
                      const insurance =
                        monthly_rents * body.default_values.new_insurance;
                      const management =
                        monthly_rents * body.default_values.new_management;
                      const hoa = monthly_rents * body.default_values.new_hoa;
                      const maintenance =
                        monthly_rents * body.default_values.new_maintenance;
                      const utils =
                        monthly_rents * body.default_values.new_utils;
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
                      totalYears: new_investment.loans.reduce(
                        (maxYears, loan) => {
                          return Math.max(maxYears, loan.mortgageYears);
                        },
                        0
                      ),
                      initialBalance:
                        available_equity / body.new_downpaymment -
                        available_equity,
                      currentBalance:
                        available_equity / body.new_downpaymment -
                        available_equity,
                      interestRate: new_investment.loans[0].interestRate,
                      pmi: 0,
                      extraPayments: new_investment.loans[0].extraPayement,
                      monthlyPayment:
                        newInvestmentAmortization.summary.monthlyPayment,
                    },
                    assumptions: {
                      expenseInflation: body.default_values.new_expensInflation,
                      rentalGrowth: body.default_values.new_rentalGrowth,
                      appreciation: body.default_values.new_appreciation,
                      maintenance: body.default_values.new_maintenance,
                      vacancy: body.default_values.new_vacancy,
                      management: body.default_values.new_management,
                    },
                    acquisition: {
                      totalCashOutlay: totalcashoutlay,
                      purchasePrice: 0,
                      closingCosts: closingcosts,
                      downPayment: available_equity,
                    },
                  },
                ];
              } else {
                res = getNonTargetProperty(item);
              }
              return res;
            }),
          },
        ],
      },
    };

    res.comparison.portfolios.forEach((portfolio) => {
      if (portfolio.name === "portfolio_after_scenario") return;
      const { valuationSum, equitySum, loanBalancesSum, noiSum, cashflowSum } =
        portfolio.properties.reduce(
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
      portfolio.valuation = valuationSum;
      portfolio.equity = equitySum;
      portfolio.NOI = noiSum;
      portfolio.cashFlow = cashflowSum;
      portfolio.LTV = (loanBalancesSum / valuationSum) * 100;
      portfolio.arb = {
        cashOnCash:
          portfolio.properties.reduce((acc, item) => {
            return item.arb.cashOnCash + acc;
          }, 0) / portfolio.properties.length,
        avarageCap:
          portfolio.properties.reduce((acc, item) => {
            return item.arb.avarageCap + acc;
          }, 0) / portfolio.properties.length,
        rentMultiplier:
          portfolio.properties.reduce((acc, item) => {
            return item.arb.rentMultiplier + acc;
          }, 0) / portfolio.properties.length,
        arbAppreciation: portfolio.properties.reduce((acc, item) => {
          return item.arb.arbAppreciation + acc;
        }, 0),
        arbDepreciation: portfolio.properties.reduce((acc, item) => {
          return item.arb.arbDepreciation + acc;
        }, 0),
        arbDownPayment: portfolio.properties.reduce((acc, item) => {
          return item.arb.arbDownPayment + acc;
        }, 0),
      };
    });
    return res;
  } catch (error) {
    console.error("❌ startRefi: ", error);
    throw error;
  }
};
