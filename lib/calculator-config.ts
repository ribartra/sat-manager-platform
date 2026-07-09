export const CALCULATOR_PROVIDERS = [
  "none",
  "desmos_sat",
  "desmos_api",
  "geogebra",
  "geogebra_api",
  "local_2d",
  "local_3d",
] as const;

export type CalculatorProvider = (typeof CALCULATOR_PROVIDERS)[number];

export interface CalculatorConfig {
  provider: CalculatorProvider;
  desmosApiKey?: string;
  desmosApiUrl: string;
  desmosSatUrl: string;
  geogebraUrl: string;
  geogebraDeployUrl: string;
  geogebraAppName: string;
  enabledInPracticeSets: boolean;
  enabledInFullTests: boolean;
}

function providerFromEnv(value: string | undefined): CalculatorProvider {
  return CALCULATOR_PROVIDERS.includes(value as CalculatorProvider)
    ? (value as CalculatorProvider)
    : "desmos_sat";
}

function boolFromEnv(value: string | undefined, fallback: boolean) {
  if (value === undefined) return fallback;
  return value === "1" || value.toLowerCase() === "true";
}

export function getPublicCalculatorConfig(): CalculatorConfig {
  return {
    provider: providerFromEnv(process.env.NEXT_PUBLIC_CALCULATOR_PROVIDER),
    desmosApiKey: process.env.NEXT_PUBLIC_DESMOS_API_KEY,
    desmosApiUrl: process.env.NEXT_PUBLIC_DESMOS_API_URL ?? "https://www.desmos.com/api/v1.12/calculator.js",
    desmosSatUrl: process.env.NEXT_PUBLIC_DESMOS_SAT_URL ?? "https://www.desmos.com/testing/sat/calculator",
    geogebraUrl: process.env.NEXT_PUBLIC_GEOGEBRA_URL ?? "https://www.geogebra.org/calculator",
    geogebraDeployUrl: process.env.NEXT_PUBLIC_GEOGEBRA_DEPLOY_URL ?? "https://www.geogebra.org/apps/deployggb.js",
    geogebraAppName: process.env.NEXT_PUBLIC_GEOGEBRA_APP_NAME ?? "graphing",
    enabledInPracticeSets: boolFromEnv(process.env.NEXT_PUBLIC_CALCULATOR_PRACTICE_SETS, true),
    enabledInFullTests: boolFromEnv(process.env.NEXT_PUBLIC_CALCULATOR_FULL_TESTS, true),
  };
}
