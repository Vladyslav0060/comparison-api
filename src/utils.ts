import { Request_1031_Props } from "./types/types";

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
          taxRate: req.default_values.new_taxes,
          costToSell: 0.07,
        },
      ],
    };
  } catch (error) {
    console.log(error);
  }
};

export { getTempVariables, getForecastingRequestObject };
