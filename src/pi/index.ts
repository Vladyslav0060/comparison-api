import {
  getAmortization,
  getAmortizationNonTarget,
  getFinalForecasting,
  getForecasting,
  getPIForecasting,
} from "../api";
import {
  AmortizationNonTargetType,
  AmortizationResponseProps,
  Env,
  PortfolioProps,
  PortfolioResponseProps,
  PropertiesProps,
} from "../types/types";
import {
  Request_1031_Props,
  ComparisonResponseObjectProps,
} from "../types/types";
import {
  getForecastingBodyFromPorfolio,
  getForecastingRequestObjects,
} from "../utils";

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
  let result: PropertiesProps[];
  result = portfolio.properties.flatMap((property) => {
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
      const totalcashoutlay = downpayment + closingcosts + property.repairCosts;
      const local_valuation = property.currentValue;
      const arbappreciation = local_valuation * property.annualAppreciationRate;
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
  isTargetPortfolio = false
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
  const arbAppreciationSum = properties.reduce((acc, item) => {
    return item.arb.arbAppreciation + acc;
  }, 0);
  const arbDepreciationSum = properties.reduce((acc, item) => {
    return item.arb.arbDepreciation + acc;
  }, 0);
  const arbDownpaymentSum = properties.reduce((acc, item) => {
    return item.arb.arbDownPayment + acc;
  }, 0);

  return {
    name: isTargetPortfolio ? "PI Exchange" : portfolio_name,
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
    portfolio.id,
    portfolio.name,
    portfolio.id === req.target_portfolio
  );
  return portfolio_res;
};

export const startPI = async (
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
        const forecastingRes = await getFinalForecasting(
          portfolio_res.properties,
          env
        );
        portfolio_res.forecasting = forecastingRes;
        const pi_object = forecatingResponse.find((f) => {
          return (
            Object.keys(f)[0] === req.target_property &&
            !!f?.[req.target_property]?.[0].passive_investments
          );
        });
        portfolio_res.pi = pi_object?.[req.target_property].map(
          (item) => item.passive_investments
        );
        if (portfolio_res.uuid === req.target_portfolio) {
          portfolio_res.properties = portfolio_res.properties.filter(
            (prop) => prop.uid !== req.target_property
          );
        }
        return portfolio_res;
      })
    );
    const { available_equity = 0 } = getTempVariables(req);
    const piPortfolio = portfolios.find((p) => p?.name === "PI Exchange");
    if (piPortfolio) {
      piPortfolio.equity += available_equity;
      piPortfolio.valuation += available_equity;
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
