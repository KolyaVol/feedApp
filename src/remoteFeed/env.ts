type PrivateEnv = {
  REMOTE_FEED_URL?: string;
};

const privateEnv = (() => {
  try {
    return require("./envPrivate") as PrivateEnv;
  } catch {
    return {} as PrivateEnv;
  }
})();

function pickValue(...values: Array<string | undefined>): string {
  for (const value of values) {
    if (typeof value !== "string") continue;
    const trimmed = value.trim();
    if (trimmed) return trimmed;
  }
  return "";
}

export const GITHUB_API_BASE = "https://api.github.com";
export const GITHUB_OWNER = "KolyaVol";
export const GITHUB_REPO = "feedData";
export const GITHUB_BRANCH = "master";
export const GITHUB_DATA_JSON_PATH = "data.json";

export const REMOTE_FEED_URL = pickValue(
  privateEnv.REMOTE_FEED_URL,
  typeof process !== "undefined" && process?.env ? process.env.EXPO_PUBLIC_REMOTE_FEED_URL : undefined,
  "https://raw.githubusercontent.com/KolyaVol/feedData/master/data.json",
);
