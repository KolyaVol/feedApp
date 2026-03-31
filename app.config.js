const appJson = require("./app.json");

const isDevelopmentProfile = process.env.EAS_BUILD_PROFILE === "development";

module.exports = () => {
  const config = appJson.expo;
  const plugins = Array.isArray(config.plugins) ? [...config.plugins] : [];

  if (!isDevelopmentProfile) {
    return {
      ...config,
      plugins: plugins.filter((plugin) => {
        if (typeof plugin === "string") return plugin !== "expo-dev-client";
        if (Array.isArray(plugin)) return plugin[0] !== "expo-dev-client";
        return true;
      }),
    };
  }

  return {
    ...config,
    plugins,
  };
};
