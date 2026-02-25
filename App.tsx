import React, { useEffect } from "react";
import { StatusBar } from "expo-status-bar";
import { useFonts } from "expo-font";
import * as DevClient from "expo-dev-client";
import { NavigationContainer } from "@react-navigation/native";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { Text, View, Platform } from "react-native";
import {
  Nunito_400Regular,
  Nunito_500Medium,
  Nunito_600SemiBold,
  Nunito_700Bold,
} from "@expo-google-fonts/nunito";
import { MainScreen } from "./src/screens/MainScreen";
import { StatisticsScreen } from "./src/screens/StatisticsScreen";
import { LoadDataScreen } from "./src/screens/LoadDataScreen";
import { CalculatorScreen } from "./src/screens/CalculatorScreen";
import { SettingsScreen } from "./src/screens/SettingsScreen";
import { ThemeProvider, useTheme } from "./src/contexts/ThemeContext";
import { LocaleProvider, useLocale } from "./src/contexts/LocaleContext";
import { fonts } from "./src/theme";
import type { RootTabParamList } from "./src/navigation/types";
import type { TranslationKey } from "./src/i18n/en";

const Tab = createBottomTabNavigator<RootTabParamList>();

const TAB_CONFIG: {
  name: keyof RootTabParamList;
  labelKey: TranslationKey;
  titleKey: TranslationKey;
  component: React.ComponentType<any>;
}[] = [
  { name: "Home", labelKey: "tabsHome", titleKey: "screenTitlesBabyFeed", component: MainScreen },
  {
    name: "Stats",
    labelKey: "tabsStats",
    titleKey: "screenTitlesStatistics",
    component: StatisticsScreen,
  },
  {
    name: "LoadData",
    labelKey: "tabsData",
    titleKey: "screenTitlesLoadData",
    component: LoadDataScreen,
  },
  {
    name: "Calculator",
    labelKey: "tabsCalc",
    titleKey: "screenTitlesCalculator",
    component: CalculatorScreen,
  },
  {
    name: "Settings",
    labelKey: "tabsSettings",
    titleKey: "settingsTitle",
    component: SettingsScreen,
  },
];

function TabIcon({
  label,
  focused,
  colors,
}: {
  label: string;
  focused: boolean;
  colors: { primary: string; textEmpty: string };
}) {
  return (
    <View style={{ alignItems: "center", justifyContent: "center" }}>
      <Text
        style={{
          fontSize: 16,
          color: focused ? colors.primary : colors.textEmpty,
          fontWeight: "600",
          fontFamily: fonts.semiBold,
        }}
      >
        {label[0]}
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
          tabBarLabelStyle: { fontSize: 12, marginTop: 4, paddingBottom: 4 },
        }}
      >
        {TAB_CONFIG.map(({ name, labelKey, titleKey, component }) => (
          <Tab.Screen
            key={name}
            name={name}
            component={component}
            options={{
              title: t(titleKey),
              tabBarLabel: t(labelKey),
              tabBarIcon: ({ focused }) => (
                <TabIcon label={t(labelKey)} focused={focused} colors={colors} />
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
    if (__DEV__ && Platform.OS !== "web") {
      DevClient.hideMenu();
    }
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
