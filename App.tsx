import React, { useEffect } from "react";
import { StatusBar } from "expo-status-bar";
import * as NavigationBar from "expo-navigation-bar";
import { useFonts } from "expo-font";
import { NavigationContainer } from "@react-navigation/native";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { AppState, Text, View, Platform } from "react-native";
import {
  Nunito_400Regular,
  Nunito_500Medium,
  Nunito_600SemiBold,
  Nunito_700Bold,
} from "@expo-google-fonts/nunito";
import { MainScreen } from "./src/screens/MainScreen";
import { DataScreen } from "./src/screens/DataScreen";
import { StatisticsScreen } from "./src/screens/StatisticsScreen";
import { BestPracticesScreen } from "./src/screens/BestPracticesScreen";
import { SettingsScreen } from "./src/screens/SettingsScreen";
import { ThemeProvider, useTheme } from "./src/contexts/ThemeContext";
import { LocaleProvider, useLocale } from "./src/contexts/LocaleContext";
import { fonts } from "./src/theme";
import type { RootTabParamList } from "./src/navigation/types";
import type { TranslationKey } from "./src/i18n/en";

const Tab = createBottomTabNavigator<RootTabParamList>();

const TAB_ICONS: Record<keyof RootTabParamList, string> = {
  Home: "🏠",
  Data: "📊",
  Stats: "📈",
  Guide: "📖",
  Settings: "⚙️",
};

const TAB_CONFIG: {
  name: keyof RootTabParamList;
  labelKey: TranslationKey;
  component: React.ComponentType<any>;
}[] = [
  { name: "Home", labelKey: "tabHome", component: MainScreen },
  { name: "Data", labelKey: "tabData", component: DataScreen },
  { name: "Stats", labelKey: "tabStats", component: StatisticsScreen },
  { name: "Guide", labelKey: "tabGuide", component: BestPracticesScreen },
  { name: "Settings", labelKey: "tabSettings", component: SettingsScreen },
];

function TabIcon({
  icon,
  focused,
  colors,
}: {
  icon: string;
  focused: boolean;
  colors: { primary: string; textEmpty: string };
}) {
  return (
    <View style={{ alignItems: "center", justifyContent: "center" }}>
      <Text
        style={{
          fontSize: 18,
          opacity: focused ? 1 : 0.5,
        }}
      >
        {icon}
      </Text>
    </View>
  );
}

function AppTabs() {
  const { colors, theme } = useTheme();
  const { t } = useLocale();
  return (
    <>
      <Tab.Navigator
        screenOptions={{
          headerShown: false,
          tabBarActiveTintColor: colors.primary,
          tabBarInactiveTintColor: colors.textEmpty,
          tabBarStyle: {
            backgroundColor: colors.card,
            height: 80,
            paddingBottom: 10,
            paddingTop: 8,
          },
          tabBarLabelStyle: {
            fontSize: 12,
            marginTop: 2,
            paddingBottom: 4,
            fontFamily: fonts.medium,
          },
        }}
      >
        {TAB_CONFIG.map(({ name, labelKey, component }) => (
          <Tab.Screen
            key={name}
            name={name}
            component={component}
            options={{
              tabBarLabel: t(labelKey),
              tabBarIcon: ({ focused }) => (
                <TabIcon
                  icon={TAB_ICONS[name]}
                  focused={focused}
                  colors={colors}
                />
              ),
            }}
          />
        ))}
      </Tab.Navigator>
      <StatusBar style={theme === "dark" ? "light" : "dark"} />
    </>
  );
}

export default function App() {
  const [fontsLoaded] = useFonts({
    Nunito_400Regular,
    Nunito_500Medium,
    Nunito_600SemiBold,
    Nunito_700Bold,
  });

  useEffect(() => {
    if (Platform.OS !== "android") return;

    const applyAndroidNavBarMode = async () => {
      try {
        await NavigationBar.setVisibilityAsync("hidden");
      } catch {}
    };

    void applyAndroidNavBarMode();

    const appStateSub = AppState.addEventListener("change", (state) => {
      if (state === "active") void applyAndroidNavBarMode();
    });

    const visSub = NavigationBar.addVisibilityListener(({ visibility }) => {
      if (visibility === "visible") void NavigationBar.setVisibilityAsync("hidden");
    });

    return () => {
      appStateSub.remove();
      visSub.remove();
    };
  }, []);

  if (!fontsLoaded) return null;

  return (
    <SafeAreaProvider>
      <LocaleProvider>
        <ThemeProvider>
          <NavigationContainer>
            <AppTabs />
          </NavigationContainer>
        </ThemeProvider>
      </LocaleProvider>
    </SafeAreaProvider>
  );
}
