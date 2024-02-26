import { getForecastingBodyFromPorfolio, getTempVariables } from "./utils";
import {
  Request_1031_Props,
  ForecastingResponseObjectProps,
  Env,
  AmortizationResponseProps,
  PortfolioForecastingProps,
  PortfolioProps,
  PropertiesProps,
} from "./types/types";

const getForecasting = async (forecastingRequestObjects: any, env: Env) => {
  try {
    let forecatingResponse: ForecastingResponseObjectProps[] = [];
    const fetchPromises = forecastingRequestObjects.map(
      async (requestObj: any) => {
        const data = await env.dev_forecasting.fetch(env.FORECASTING_URL, {
          method: "POST",
          body: JSON.stringify(requestObj),
        });
        forecatingResponse =
          (await data.json()) as ForecastingResponseObjectProps[];
        return { [requestObj.array[0].uuid]: forecatingResponse };
      }
    );

    const res = await Promise.all(fetchPromises);
    return res;
  } catch (error) {
    console.error("❌ getForecasting: ", error);
    throw error;
  }
};

const getAmortization = async (req: Request_1031_Props, env: Env) => {
  const targetProperty = req.portfolios.find(
    (portfolio) => portfolio.id === req.target_portfolio
  );
  const targetPortfolio = targetProperty?.properties.find(
    (property) => property.uuid === req.target_property
  );
  if (!targetProperty) return;
  const { available_equity, valuation } = getTempVariables(req, targetProperty);
  const newInterestRate = req.new_loan_interest_rate;
  const params = new URLSearchParams({
    amount: (valuation - available_equity).toString(),
    startingBalance: (valuation - available_equity).toString(),
    interestRate: (newInterestRate * 100).toString(),
    termInMonths: (30 * 12).toString(),
  });
  const amortizationResponse: AmortizationResponseProps = await env.amortization
    .fetch(`${env.AMORTIZATION_URL}/?${params}`)
    .then((res: any) => res.json());
  return amortizationResponse;
};

const getRefiAmortization = async (
  req: PortfolioForecastingProps,
  env: Env
) => {
  const params = new URLSearchParams({
    amount: req.loans[0].loanBalance.toString(),
    startingBalance: req.loans[0].startingBalance.toString(),
    interestRate: (req.loans[0].interestRate * 100).toString(),
    termInMonths: (req.loans[0].mortgageYears * 12).toString(),
  });
  const amortizationResponse: AmortizationResponseProps = await env.amortization
    .fetch(`${env.AMORTIZATION_URL}/?${params}`)
    .then((res: any) => res.json());
  return amortizationResponse;
};

const getRefiForecasting = async (req: PortfolioForecastingProps, env: Env) => {
  let forecatingResponse: ForecastingResponseObjectProps[] = [];
  try {
    const forecastingRequestObject: any = {
      array: [req],
    };
    const data = await env.dev_forecasting.fetch(env.FORECASTING_URL, {
      method: "POST",
      body: JSON.stringify(forecastingRequestObject),
    });

    forecatingResponse =
      (await data.json()) as ForecastingResponseObjectProps[];
    return forecatingResponse;
  } catch (error) {
    console.error("❌ getForecasting REFI: ", error);
    throw error;
  }
};

const getAmortizationNonTarget = async (
  portfolios: PortfolioProps,
  env: Env
) => {
  const fetchPromises = portfolios.properties.map(async (portfolio) => {
    const { startingBalance, mortgageYears, interestRate, loanBalance } =
      portfolio.loans[0];

    const params = new URLSearchParams({
      amount: loanBalance.toString(),
      startingBalance: startingBalance.toString(),
      interestRate: (interestRate * 100).toString(),
      termInMonths: (mortgageYears * 12).toString(),
    });

    const amortizationResponse: AmortizationResponseProps =
      await env.amortization
        .fetch(`${env.AMORTIZATION_URL}?${params}`)
        .then((res: any) => res.json());
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

const getPIForecasting = async (
  req: PortfolioForecastingProps,
  passive_investments: any,
  env: Env
) => {
  let forecatingResponse: ForecastingResponseObjectProps[] = [];
  try {
    const forecastingRequestObject: any = {
      array: req,
      passive_investments: passive_investments,
    };
    const data = await env.dev_forecasting.fetch(env.FORECASTING_URL, {
      method: "POST",
      body: JSON.stringify(forecastingRequestObject),
    });

    forecatingResponse =
      (await data.json()) as ForecastingResponseObjectProps[];
    return forecatingResponse;
  } catch (error) {
    console.error("❌ getForecasting REFI: ", error);
    throw error;
  }
};

const getFinalForecasting = async (
  properties: PropertiesProps[],
  env: Env,
  passive_investments: any = null
) => {
  const forecastingRequestArray = getForecastingBodyFromPorfolio(
    properties,
    passive_investments
  );
  let forecatingResponse: ForecastingResponseObjectProps;
  const data = await env.dev_forecasting.fetch(env.FORECASTING_URL, {
    method: "POST",
    body: JSON.stringify(forecastingRequestArray),
  });
  forecatingResponse = (await data.json()) as ForecastingResponseObjectProps;
  return forecatingResponse;
};

export {
  getForecasting,
  getPIForecasting,
  getAmortization,
  getAmortizationNonTarget,
  getRefiAmortization,
  getRefiForecasting,
  getFinalForecasting,
};
