const appJson = require("./app.json");

try {
  require("dotenv").config();
} catch {
  // dotenv optional
}

module.exports = {
  expo: {
    ...appJson.expo,
    extra: {
      ...appJson.expo.extra,
      apiUrl: process.env.EXPO_PUBLIC_API_URL ?? "",
      apiKey: process.env.EXPO_PUBLIC_API_KEY ?? "",
    },
  },
};
