import {
  Request_1031_Props,
  ForecastingResponseObjectProps,
} from "./types/types";

const getForecastingRequestObject = (req: Request_1031_Props) => {
  try {
    const { target_property, default_values } = req;
    const object = req.target_portflio.find(
      (item) => item.uuid === target_property
    );
    if (!object) throw new Error("Object with this uuid is not found");
    const loanBalanceSum = object.loans.reduce(
      (acc, item) => acc + item.loanBalance,
      0
    );
    const available_equity = object.currentValue - loanBalanceSum;
    const mothlyNOI =
      (available_equity * req.new_caprate) / 12 / req.new_downpaymment;
    const monthly_rents = mothlyNOI / (1 - req.default_values.new_expenseRatio);
    return {
      array: [
        {
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

const getComparisonResponseObject = (
  f_req: any,
  f_res: ForecastingResponseObjectProps[]
) => {
  return {
    comprarison: {
      target_property: 0,
      refinanced_property: f_req.array[0].uuid,
    },
  };
};

export const start = async (req: Request_1031_Props) => {
  const forecastingRequestObject: any = getForecastingRequestObject(req);
  let forecatingResponse: ForecastingResponseObjectProps[] = [];
  try {
    const data = await fetch(
      "https://dev-portfolio-forecasting.rei-workers.workers.dev",
      {
        method: "POST",
        body: JSON.stringify(forecastingRequestObject),
      }
    );

    forecatingResponse =
      (await data.json()) as ForecastingResponseObjectProps[];
    console.log(forecatingResponse[0]);
    const res = getComparisonResponseObject(
      forecastingRequestObject,
      forecatingResponse
    );
  } catch (err) {
    console.log(err);
  }
};
