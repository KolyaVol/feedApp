import React from "react";
import { StatusBar } from "expo-status-bar";
import { useFonts } from "expo-font";
import { NavigationContainer } from "@react-navigation/native";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { Text, View } from "react-native";
import {
  Nunito_400Regular,
  Nunito_500Medium,
  Nunito_600SemiBold,
  Nunito_700Bold,
} from "@expo-google-fonts/nunito";
import { MainScreen } from "./src/screens/MainScreen";
import { StatisticsScreen } from "./src/screens/StatisticsScreen";
import { FoodTypesScreen } from "./src/screens/FoodTypesScreen";
import { RemindersScreen } from "./src/screens/RemindersScreen";
import { SettingsScreen } from "./src/screens/SettingsScreen";
import { ThemeProvider, useTheme } from "./src/contexts/ThemeContext";
import { LocaleProvider, useLocale } from "./src/contexts/LocaleContext";
import { fonts } from "./src/theme";
import type { RootTabParamList } from "./src/navigation/types";
import type { TranslationKey } from "./src/i18n/en";

const Tab = createBottomTabNavigator<RootTabParamList>();
const Stack = createNativeStackNavigator();

const TAB_CONFIG: {
  name: keyof RootTabParamList;
  labelKey: TranslationKey;
  titleKey: TranslationKey;
  component: React.ComponentType<any>;
}[] = [
  { name: "Home", labelKey: "tabsHome", titleKey: "screenTitlesBabyFeed", component: () => null },
  { name: "Stats", labelKey: "tabsStats", titleKey: "screenTitlesStatistics", component: StatisticsScreen },
  { name: "FoodTypes", labelKey: "tabsTypes", titleKey: "screenTitlesFoodTypes", component: FoodTypesScreen },
  { name: "Reminders", labelKey: "tabsReminders", titleKey: "tabsReminders", component: RemindersScreen },
  { name: "Settings", labelKey: "tabsSettings", titleKey: "settingsTitle", component: SettingsScreen },
];

function HomeStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Main">
        {({ navigation }) => (
          <MainScreen onAddVariant={() => navigation.getParent()?.navigate("FoodTypes")} />
        )}
      </Stack.Screen>
    </Stack.Navigator>
  );
}

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
        <Tab.Screen
          name="Home"
          component={HomeStack}
          options={{
            title: t("screenTitlesBabyFeed"),
            tabBarLabel: t("tabsHome"),
            tabBarIcon: ({ focused }) => (
              <TabIcon label={t("tabsHome")} focused={focused} colors={colors} />
            ),
          }}
        />
        {TAB_CONFIG.slice(1).map(({ name, labelKey, titleKey, component }) => (
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
