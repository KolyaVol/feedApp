export const GITHUB_API_BASE = "https://api.github.com";
export const GITHUB_OWNER = "KolyaVol";
export const GITHUB_REPO = "feedData";
export const GITHUB_BRANCH = "master";
export const GITHUB_DATA_JSON_PATH = "data.json";
const privateEnv = (() => {
  try {
    return require("./envPrivate") as { GITHUB_TOKEN?: string };
  } catch {
    return {};
  }
})();
export const GITHUB_TOKEN = privateEnv.GITHUB_TOKEN ?? "";

export const REMOTE_FEED_URL = "https://raw.githubusercontent.com/KolyaVol/feedData/master/data.json";
