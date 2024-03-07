import {
  getAmortization,
  getAmortizationNonTarget,
  getFinalForecasting,
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
import {
  getForecastingBodyFromPorfolio,
  getForecastingRequestObjects,
} from "./utils";

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
    targetProperty.currentValue - targetProperty.loans[0].balanceCurrent;
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
    if (isTargetProperty && isTargetPortfolio && targetAmortization) {
      return (() => {
        const propertyForecasting: any = Object.values(
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
          uid: "new_investment",
          name: "New Investment",
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
            const otherExpenses = 0;
            const total =
              vacancy +
              taxes +
              insurance +
              management +
              hoa +
              maintenance +
              otherExpenses +
              utils;
            return {
              vacancy: vacancy,
              taxes: taxes,
              insurance: insurance,
              management: management,
              hoa: hoa,
              maintenance: maintenance,
              utils: utils,
              otherExpenses: otherExpenses,
              total: total,
            };
          })(),
          loans: {
            totalYears: 30,
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
            repairCosts: 0,
          },
          taxRate: req.default_values.new_taxRate,
          picture: "",
          ROE:
            (arbappreciation + arbdepreciation + arbdownpayment + cashflow) /
            equity,
        };
      })();
    } else
      return (() => {
        const propertyForecasting: any = Object.values(
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
            property.vacancyLossPercentage * property.avgRent) *
          12;
        const temp_non_target = amortizationResponseNonTarget[property.uuid];
        const cashflow =
          noi -
          (temp_non_target.summary.monthlyPayment +
            property.loans[0].pmi +
            property.loans[0].extraPayement) *
            12;

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
          property.loans.reduce((acc, item) => acc + item.balanceCurrent, 0);
        return {
          //1
          // type: "non-target",
          uid: property.uuid,
          name: property.name,
          valuation: property.currentValue,
          loanBalance: property.loans.reduce(
            (acc, item) => acc + item.balanceCurrent,
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
            const otherExpenses = property.allExpenses.othersExpenses;
            const total =
              vacancy +
              propTaxes +
              insurance +
              propManage +
              hoa +
              capEx +
              utils +
              otherExpenses;
            return {
              vacancy: vacancy,
              taxes: propTaxes,
              insurance: insurance,
              management: propManage,
              hoa: hoa,
              maintenance: capEx,
              utils: utils,
              otherExpenses: otherExpenses,
              total: total,
            };
          })(),
          loans: {
            totalYears: property.loans[0].mortgageYears,
            initialBalance: property.loans[0].loanBalance,
            currentBalance: property.loans[0].startingBalance,
            interestRate: property.loans[0].interestRate,
            pmi: property.loans[0].pmi,
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
            repairCosts: property.repairCosts,
          },
          picture: property.picture,
          taxRate: property.taxRate,
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
  portfolio_id: string,
  portfolio_name: string,
  passives: any = undefined,
  isTargetPortfolio: boolean = false
): PortfolioResponseProps => {
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
  const pi_first_year = !!passives
    ? passives.reduce(
        (acc, item) => {
          const output_cashflow =
            item.years[0]?.output_cashflow ??
            item.investment_value * item.years[0].cashflow_grow;
          const output_equity_grow =
            item.years[0]?.output_equity_grow ??
            item.investment_value * item.years[0].equity_grow;
          return {
            output_cashflow_sum: acc.output_cashflow_sum + output_cashflow,
            investment_value_sum:
              acc.investment_value_sum + item.investment_value,
            output_equity_grow_sum:
              acc.output_equity_grow_sum + output_equity_grow,
          };
        },
        {
          output_cashflow_sum: 0,
          investment_value_sum: 0,
          output_equity_grow_sum: 0,
        }
      )
    : {
        output_cashflow_sum: 0,
        investment_value_sum: 0,
        output_equity_grow_sum: 0,
      };

  const arbAppreciationSum = properties.reduce((acc, item) => {
    return item.arb.arbAppreciation + acc;
  }, 0);
  const arbDepreciationSum = properties.reduce((acc, item) => {
    return item.arb.arbDepreciation + acc;
  }, 0);
  const arbDownpaymentSum = properties.reduce((acc, item) => {
    return item.arb.arbDownPayment + acc;
  }, 0);

  const noi = noiSum + pi_first_year.output_cashflow_sum;
  const cashFlow = cashflowSum + pi_first_year.output_cashflow_sum;
  const arbAppreciation =
    arbAppreciationSum + pi_first_year.output_equity_grow_sum;
  const equity = equitySum + pi_first_year.investment_value_sum;
  const valuation = valuationSum + pi_first_year.investment_value_sum;
  return {
    name: isTargetPortfolio ? "1031 Exchange" : portfolio_name,
    cashFlow,
    arb: {
      arbAppreciation,
      arbDepreciation: arbDepreciationSum,
      arbDownPayment: arbDownpaymentSum,
      avarageCap: noi / valuation,
      cashOnCash:
        properties.reduce((acc, item) => {
          return item.arb.cashOnCash + acc;
        }, 0) / properties.length,
      rentMultiplier:
        properties.reduce((acc, item) => {
          return item.arb.rentMultiplier + acc;
        }, 0) / properties.length,
    },
    equity,
    LTV: (loanBalancesSum / valuationSum) * 100,
    ROE:
      (arbAppreciation + arbDepreciationSum + arbDownpaymentSum + cashFlow) /
      equity,
    NOI: noi,
    uuid: portfolio_id,
    valuation,
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
  const portfolioPropertiesResponse = getPortolioPropertiesObjects(
    req,
    portfolio,
    amortizationResponseNonTarget,
    targetAmortization,
    forecasting
  );

  // const portfolio_res = buildPortfolioResponse(
  //   portfolioPropertiesResponse,
  //   portfolio.id,
  //   portfolio.name,
  //   // [],
  //   portfolio?.passive_investments,
  //   portfolio.id === req.target_portfolio
  // );

  const forecastingRes: any = await getFinalForecasting(
    portfolioPropertiesResponse,
    env,
    portfolio.passive_investments
  );
  const pi =
    forecastingRes[0].passive_investments?.map((f_pi_obj: any) => {
      return {
        name: f_pi_obj.name,
        uid: f_pi_obj.uid,
        investment_value: portfolio.passive_investments?.find(
          (pi) => pi.uid === f_pi_obj.uid
        )?.investment_value,
        // investment_value: pi_investment_values[f_pi_obj.uid],
        years: forecastingRes
          .map((f_year: any) =>
            f_year.passive_investments.filter(
              (f: any) => f.uid === f_pi_obj.uid
            )
          )
          .flat(),
      };
    }) || null;

  const portfolio_result = buildPortfolioResponse(
    portfolioPropertiesResponse,
    portfolio.id,
    portfolio.name,
    pi,
    // portfolio?.passive_investments,
    portfolio.id === req.target_portfolio
  );
  return portfolio_result;
};

export const start = async (
  req: Request_1031_Props,
  env: Env
): Promise<any> => {
  try {
    const target_portfolio = req.portfolios.find(
      (p) => p.id === req.target_portfolio
    );
    if (target_portfolio) {
      const clone = {
        ...target_portfolio,
        id: `clone-${target_portfolio.id}`,
      };

      if (req.remove_primary) {
        clone.properties = clone.properties.filter(
          (p) => p.uuid !== req.target_property
        );
      }
      req.portfolios.push(clone);
    }
    let passive_investments_object: any = null;
    const targetAmortization = await getAmortization(req, env);
    let pi_investment_values: any = [];
    const portfolios = await Promise.all(
      req.portfolios.map(async (portfolio, idx = 0) => {
        const forecastingRequestObjects = await getForecastingRequestObjects(
          req,
          portfolio
        );

        // pi_investment_values =
        //   forecastingRequestObjects[0].passive_investments &&
        //   forecastingRequestObjects[0].passive_investments.reduce(
        //     (accumulator: any, r: any) => {
        //       accumulator[r.uid] = r.investment_value;
        //       return accumulator;
        //     },
        //     {}
        //   );

        if (!forecastingRequestObjects) return;

        const forecatingResponse = await getForecasting(
          forecastingRequestObjects,
          env
        );

        forecatingResponse.forEach((forecatingResponse) => {
          const value = Object.values(forecatingResponse).filter(
            (item: any) => !!item?.[0]?.passive_investments
          );
          if (value.length) {
            passive_investments_object = value;
          }
        });

        const amortizationResponseNonTarget: AmortizationNonTargetType =
          await getAmortizationNonTarget(portfolio, env);
        const portfolio_res = await getPortfolioResponse(
          req,
          portfolio,
          amortizationResponseNonTarget,
          targetAmortization,
          forecatingResponse,
          env
        );
        const { available_equity } = getTempVariables(req);
        // const piWithUpdatedInvestmentValue = {
        //   ...req.passive_investments?.[0],
        //   investment_value: available_equity,
        // };

        const forecastingRes: any = await getFinalForecasting(
          portfolio_res.properties,
          env,
          portfolio.passive_investments
        );

        portfolio_res.forecasting = forecastingRes;
        portfolio_res.pi =
          forecastingRes[0].passive_investments?.map((f_pi_obj: any) => {
            return {
              name: f_pi_obj.name,
              uid: f_pi_obj.uid,
              investment_value: portfolio.passive_investments?.find(
                (pi) => pi.uid === f_pi_obj.uid
              )?.investment_value,
              years: forecastingRes
                .map((f_year: any) =>
                  f_year.passive_investments.filter(
                    (f: any) => f.uid === f_pi_obj.uid
                  )
                )
                .flat(),
            };
          }) || null;
        return portfolio_res;
      })
    );

    let piObject = portfolios.find(
      (portfolio) =>
        portfolio?.name === "1031 Exchange" && req.passive_investments?.[0]
    );
    if (piObject) {
      piObject = { ...piObject };
      piObject.name = "PI Exchange";
      piObject.properties = piObject.properties.filter(
        (prop) => prop.uid !== "new_investment"
      );
      const temps = getTempVariables(req);
      const recalculatedPIPortfolio: PortfolioResponseProps =
        buildPortfolioResponse(
          piObject.properties,
          piObject.uuid,
          piObject.name,
          (piObject?.pi || []).concat(
            {
              ...req.passive_investments?.[0],
              investment_value: temps.available_equity,
            } || []
          ),
          false
        );

      const foundPiPortfolio = req.portfolios.find(
        (p) => p.id === recalculatedPIPortfolio.uuid
      );

      if (!foundPiPortfolio) return;
      const { available_equity } = getTempVariables(req);
      const passives = (foundPiPortfolio.passive_investments || [])?.concat({
        ...req.passive_investments[0],
        investment_value: available_equity,
      });

      const forecastingRes: any = await getFinalForecasting(
        recalculatedPIPortfolio.properties,
        env,
        passives
      );

      recalculatedPIPortfolio.forecasting = forecastingRes;
      const portfolio_ids = forecastingRes[0].passive_investments?.map(
        (p: any) => p.uid
      );

      const splitted_test =
        portfolio_ids &&
        portfolio_ids.map((id: string) => {
          const found = forecastingRes.map((pio: any) =>
            pio.passive_investments.filter((item: any) => item.uid === id)
          );
          return found.flat();
        });
      const bodyPiPortfolioName = req.passive_investments?.[0].name;
      recalculatedPIPortfolio.pi = splitted_test?.map((po: any, idx = 0) => {
        return {
          name: po[0].name,
          uid: po[0].uid,
          // investment_value: 0,
          investment_value:
            po[0].name === bodyPiPortfolioName
              ? available_equity
              : foundPiPortfolio.passive_investments?.find(
                  (p) => p.uid === po[0].uid
                )?.investment_value,
          // investment_value: pi_investment_values[po[0].uid] || available_equity,
          years: po,
        };
      });
      recalculatedPIPortfolio.uuid = `pi_${recalculatedPIPortfolio.uuid}`;
      portfolios.push(recalculatedPIPortfolio);
    }

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
