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
import { fonts } from "./src/theme";
import type { RootTabParamList } from "./src/navigation/types";

const Tab = createBottomTabNavigator<RootTabParamList>();
const Stack = createNativeStackNavigator();

const TAB_CONFIG: {
  name: keyof RootTabParamList;
  label: string;
  title: string;
  component: React.ComponentType<any>;
}[] = [
  { name: "Home", label: "Home", title: "Baby Feed", component: () => null },
  { name: "Stats", label: "Stats", title: "Statistics", component: StatisticsScreen },
  { name: "FoodTypes", label: "Types", title: "Food types", component: FoodTypesScreen },
  { name: "Reminders", label: "Reminders", title: "Reminders", component: RemindersScreen },
  { name: "Settings", label: "Settings", title: "Settings", component: SettingsScreen },
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
            title: "Baby Feed",
            tabBarLabel: "Home",
            tabBarIcon: ({ focused }) => <TabIcon label="Home" focused={focused} colors={colors} />,
          }}
        />
        {TAB_CONFIG.slice(1).map(({ name, label, title, component }) => (
          <Tab.Screen
            key={name}
            name={name}
            component={component}
            options={{
              title,
              tabBarLabel: label,
              tabBarIcon: ({ focused }) => (
                <TabIcon label={label} focused={focused} colors={colors} />
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
      <ThemeProvider>
        <NavigationContainer>
          <AppTabs />
        </NavigationContainer>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}
