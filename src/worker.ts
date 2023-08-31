import { Env } from "./types/types";
import {
  Request_1031_Props,
  ForecastingResponseObjectProps,
  AmortizationResponseProps,
  ComparisonResponseObjectProps,
} from "./types/types";

const getTempVariables = (req: Request_1031_Props) => {
  const { target_property } = req;
  const object = req.target_portflio.find(
    (item) => item.uuid === target_property
  );
  if (!object) throw new Error("Object with this uuid is not found");
  const loanBalanceSum = object.loans.reduce(
    (acc, item) => acc + item.loanBalance,
    0
  );
  const available_equity =
    object.currentValue - object.loans[0].startingBalance;
  const mothlyNOI =
    (available_equity * req.new_caprate) / 12 / req.new_downpaymment;
  const monthly_rents = mothlyNOI / (1 - req.default_values.new_expenseRatio);
  const valuation = available_equity / req.new_downpaymment;

  return { available_equity, mothlyNOI, monthly_rents, valuation };
};

const getForecastingRequestObject = (req: Request_1031_Props) => {
  try {
    const { target_property } = req;
    const object = req.target_portflio.find(
      (item) => item.uuid === target_property
    );
    if (!object) throw new Error("Object with this uuid is not found");
    const loanBalanceSum = object.loans.reduce(
      (acc, item) => acc + item.loanBalance,
      0
    );
    const { available_equity, monthly_rents, mothlyNOI } =
      getTempVariables(req);
    return {
      array: [
        {
          available_equity: available_equity,
          mothlyNOI: mothlyNOI,
          monthly_rents: monthly_rents,
          uuid: req.target_property,
          allExpenses: {
            propTaxes: monthly_rents * req.default_values.new_taxes,
            insurance: monthly_rents * req.default_values.new_insurance,
            capEx: monthly_rents * req.default_values.new_maintenance,
            propManage: monthly_rents * req.default_values.new_management,
            othersExpenses: 0,
            utils: monthly_rents * req.default_values.new_utils,
            hoa: monthly_rents * req.default_values.new_hoa,
          },
          loans: [
            {
              startingBalance:
                available_equity / req.new_downpaymment - available_equity,
              mortgageYears: 30,
              loanBalance:
                available_equity / req.new_downpaymment - available_equity,
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
            (req.default_values.new_closingCosts / req.new_downpaymment) *
            available_equity,
          repairCosts: 0,
          currentValue: available_equity / req.new_downpaymment,
          annualAppreciationRate: req.default_values.new_appreciation,
          downPaymentPerc: req.new_downpaymment,
          taxRate: req.default_values.new_taxRate,
          costToSell: 0.07,
        },
      ],
    };
  } catch (error) {
    console.log(error);
  }
};

export const start = async (
  req: Request_1031_Props,
  env: Env
): Promise<any> => {
  const forecastingRequestObject: any = getForecastingRequestObject(req);
  let forecatingResponse: ForecastingResponseObjectProps[] = [];
  try {
    const data = await fetch(env.FORECASTING_URL, {
      method: "POST",
      body: JSON.stringify(forecastingRequestObject),
    });

    forecatingResponse =
      (await data.json()) as ForecastingResponseObjectProps[];

    const getAmortization = async (): Promise<AmortizationResponseProps> => {
      const mortgageYears =
        req.target_portflio.find((item) => item.uuid === req.target_property)
          ?.loans[0].mortgageYears || 0;
      const { available_equity, valuation } = getTempVariables(req);
      const newInterestRate = req.new_loan_interest_rate;
      const params = new URLSearchParams({
        amount: (valuation - available_equity).toString(),
        startingBalance: (valuation - available_equity).toString(),
        interestRate: (newInterestRate * 100).toString(),
        termInMonths: (mortgageYears * 12).toString(),
      });

      const amortizationResponse: AmortizationResponseProps = await fetch(
        `${env.AMORTIZATION_URL}/?${params}`
      ).then((res) => res.json());
      return amortizationResponse;
    };

    const getAmortizationNonTarget = async () => {
      const nonTargetPortfolios = req.target_portflio.filter(
        (item) => item.uuid !== req.target_property
      );

      const fetchPromises = nonTargetPortfolios.map(async (portfolio) => {
        const { startingBalance, mortgageYears, interestRate, loanBalance } =
          portfolio.loans[0];

        const params = new URLSearchParams({
          amount: loanBalance.toString(),
          startingBalance: startingBalance.toString(),
          interestRate: (interestRate * 100).toString(),
          termInMonths: (mortgageYears * 12).toString(),
        });

        const amortizationResponse: AmortizationResponseProps = await fetch(
          `${env.AMORTIZATION_URL}?${params}`
        ).then((res) => res.json());
        return {
          [portfolio.uuid]: {
            summary: amortizationResponse.summary,
            amortization: amortizationResponse.amortization,
          },
        };
      });

      const amortizationResults = await Promise.all(fetchPromises);
      const response: { [uuid: string]: AmortizationResponseProps } = {};
      amortizationResults.forEach((item) => {
        const key = Object.keys(item)[0];
        response[key] = item[key];
      });

      return response;
    };

    // const getAmortizationAll = async () => {
    //     const portfolios = req.target_portflio;

    //   const getParamsForTarget = () => {
    //           const mortgageYears =
    //             req.target_portflio.find(
    //               (item) => item.uuid === req.target_property
    //             )?.loans[0].mortgageYears || 0;
    //           const { available_equity, valuation } = getTempVariables(req);
    //     const newInterestRate = req.new_loan_interest_rate;
    //     return {
    //       amount: valuation - available_equity,
    //       startingBalance: valuation - available_equity,
    //       interestRate: (newInterestRate * 100),
    //       termInMonths: (mortgageYears * 12),
    //     };
    //    }
    //   const getParamsForNonTarget = () => {
    //             const {
    //               startingBalance,
    //               mortgageYears,
    //               interestRate,
    //               loanBalance,
    //             } = portfolio.loans[0];
    //   };
    //     const fetchPromises = portfolios.map(async (portfolio) => {
    //       const { startingBalance, mortgageYears, interestRate, loanBalance } =
    //         portfolio.loans[0];

    //             const params = new URLSearchParams({
    //               amount: (valuation - available_equity).toString(),
    //               startingBalance: (valuation - available_equity).toString(),
    //               interestRate: (newInterestRate * 100).toString(),
    //               termInMonths: (mortgageYears * 12).toString(),
    //             });

    //       const params =
    //         portfolio.uuid === req.target_property
    //           ? new URLSearchParams({
    //               amount: loanBalance.toString(),
    //               startingBalance: startingBalance.toString(),
    //               interestRate: (interestRate * 100).toString(),
    //               termInMonths: (mortgageYears * 12).toString(),
    //             })
    //           : new URLSearchParams({
    //               amount: loanBalance.toString(),
    //               startingBalance: startingBalance.toString(),
    //               interestRate: (interestRate * 100).toString(),
    //               termInMonths: (mortgageYears * 12).toString(),
    //             });

    //       const amortizationResponse: AmortizationResponseProps = await fetch(
    //       ).then((res) => res.json());
    //       return {
    //         [portfolio.uuid]: {
    //           summary: amortizationResponse.summary,
    //           amortization: amortizationResponse.amortization,
    //         },
    //       };
    //     });

    //     const amortizationResults = await Promise.all(fetchPromises);
    //     const response = {};
    //     amortizationResults.forEach((item) => {
    //       const key = Object.keys(item)[0];
    //       response[key] = item[key];
    //     });
    //     console.log("response: ", response);

    //     return response;
    //   };

    const amortizationResponseNonTarget = await getAmortizationNonTarget();
    const amortizationResponse = await getAmortization();
    const { available_equity, monthly_rents, mothlyNOI, valuation } =
      getTempVariables(req);
    const res: ComparisonResponseObjectProps = {
      comparison: {
        target_property: forecastingRequestObject.array[0].uuid,
        refinanced_property: forecastingRequestObject.array[0].uuid,
        "new-investemnt-id": forecastingRequestObject.array[0].uuid,
        portfolios: [
          {
            name: "my portfolio",
            cashFlow: mothlyNOI * 12,
            arb: {
              arbAppreciation: 0,
              arbDepreciation: 0,
              arbDownPayment: 0,
              avarageCap: 0,
              cashOnCash: 9,
              rentMultiplier: 0,
            },
            equity: 0,
            LTV: 0,
            NOI: 0,
            uuid: req.target_property,
            valuation: 0,
            properties: req.target_portflio.map((item) => {
              const allExpensesSum = Object.values(item.allExpenses).reduce(
                (acc, item) => acc + item,
                0
              );

              const noi =
                item.uuid === req.target_property
                  ? mothlyNOI * 12
                  : (item.avgRent +
                      item.otherIncome -
                      allExpensesSum -
                      item.vacancyLossPercentage *
                        (item.avgRent + item.otherIncome)) *
                    12;
              const temp_non_target = amortizationResponseNonTarget[item.uuid];

              const cashflow =
                item.uuid === req.target_property
                  ? (mothlyNOI - amortizationResponse.summary.monthlyPayment) *
                    12
                  : noi - temp_non_target.summary.monthlyPayment * 12;

              const closingcosts =
                item.uuid === req.target_property
                  ? (req.default_values.new_closingCosts /
                      req.new_downpaymment) *
                    available_equity
                  : item.closingCosts;
              const downpayment =
                item.uuid === req.target_property
                  ? available_equity
                  : item.downPaymentPerc * item.purchasePrice;
              const totalcashoutlay =
                item.uuid === req.target_property
                  ? downpayment + closingcosts
                  : downpayment + closingcosts + item.repairCosts;
              const local_valuation =
                item.uuid === req.target_property
                  ? valuation
                  : item.currentValue;
              // const totalcashoutlay = item.uuid === req.target_property ?
              return item.uuid === req.target_property
                ? {
                    // target
                    uid: "new-investment",
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
                        ((local_valuation * 0.85) / 27.5) * item.taxRate,
                      arbDownPayment:
                        forecatingResponse[0].cumulativeAppreciations
                          .mortgagePaydown,
                    },
                    monthlyIncome: {
                      rent: monthly_rents,
                      otherIncome: 0,
                    },
                    monthlyExpenses: (() => {
                      const vacancy =
                        monthly_rents * req.default_values.new_vacancy;
                      const taxes =
                        monthly_rents * req.default_values.new_taxes;
                      const insurance =
                        monthly_rents * req.default_values.new_insurance;
                      const management =
                        monthly_rents * req.default_values.new_management;
                      const hoa = monthly_rents * req.default_values.new_hoa;
                      const maintenance =
                        monthly_rents * req.default_values.new_maintenance;
                      const utils =
                        monthly_rents * req.default_values.new_utils;
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
                      totalYears: item.loans.reduce((maxYears, loan) => {
                        return Math.max(maxYears, loan.mortgageYears);
                      }, 0),
                      initialBalance:
                        available_equity / req.new_downpaymment -
                        available_equity,
                      currentBalance:
                        available_equity / req.new_downpaymment -
                        available_equity,
                      interestRate: req.new_loan_interest_rate,
                      pmi: 0,
                      extraPayments: 0,
                      monthlyPayment:
                        amortizationResponse.summary.monthlyPayment,
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
                  }
                : {
                    // non-target
                    uid: item.uuid,
                    valuation: item.currentValue,
                    loanBalance: item.loans.reduce(
                      (acc, item) => acc + item.loanBalance,
                      0
                    ),
                    equity:
                      item.currentValue -
                      item.loans.reduce(
                        (acc, item) => acc + item.loanBalance,
                        0
                      ),
                    cashFlow: cashflow,
                    NOI: noi,
                    arb: {
                      cashOnCash: (cashflow / totalcashoutlay) * 100,
                      avarageCap: (noi / item.currentValue) * 100,
                      rentMultiplier:
                        local_valuation /
                        (item.avgRent * 12 + item.otherIncome * 12),
                      arbAppreciation:
                        local_valuation * item.annualAppreciationRate,
                      arbDepreciation:
                        ((item.purchasePrice * 0.85) / 27.5) * item.taxRate,
                      arbDownPayment:
                        forecatingResponse[0].cumulativeAppreciations
                          .mortgagePaydown,
                    },
                    monthlyIncome: {
                      rent: item.avgRent,
                      otherIncome: item.otherIncome,
                    },
                    monthlyExpenses: (() => {
                      const { avgRent, vacancyLossPercentage } = item;
                      const {
                        propTaxes,
                        capEx,
                        hoa,
                        insurance,
                        propManage,
                        utils,
                      } = item.allExpenses;
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
                        amortizationResponseNonTarget[item.uuid].summary
                          .monthlyPayment,
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
            }),
          },
        ],
      },
    };

    res.comparison.portfolios.forEach((portfolio) => {
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

    // const res = getComparisonResponseObject(
    //   forecastingRequestObject,
    //   forecatingResponse
    // );
    console.log(res.comparison);
    return res;
  } catch (err) {
    console.log(err);
  }
};
