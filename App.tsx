import React from "react";
import { StatusBar } from "expo-status-bar";
import { useFonts } from "expo-font";
import { NavigationContainer } from "@react-navigation/native";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { Text, View, StyleSheet } from "react-native";
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

const Tab = createBottomTabNavigator();
const Stack = createNativeStackNavigator();

function HomeStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Main">
        {({ navigation }) => (
          <MainScreen onAddVariant={() => navigation.getParent()?.navigate("FoodTypes" as never)} />
        )}
      </Stack.Screen>
    </Stack.Navigator>
  );
}

function TabIcon({ label, focused }: { label: string; focused: boolean }) {
  return (
    <View style={styles.tabIcon}>
      <Text style={[styles.tabIconText, focused && styles.tabIconTextActive]}>{label[0]}</Text>
    </View>
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
      <NavigationContainer>
        <Tab.Navigator
          screenOptions={{
            headerShown: false,
            tabBarActiveTintColor: "#4a9eff",
            tabBarInactiveTintColor: "#888",
            tabBarStyle: { backgroundColor: "#fff", height: 80, paddingBottom: 10, paddingTop: 8 },
            tabBarLabelStyle: { fontSize: 12, marginTop: 4, paddingBottom: 4 },
          }}
        >
          <Tab.Screen
            name="Home"
            component={HomeStack}
            options={{
              title: "Baby Feed",
              tabBarLabel: "Home",
              tabBarIcon: ({ focused }) => <TabIcon label="Home" focused={focused} />,
            }}
          />
          <Tab.Screen
            name="Stats"
            component={StatisticsScreen}
            options={{
              title: "Statistics",
              tabBarLabel: "Stats",
              tabBarIcon: ({ focused }) => <TabIcon label="Stats" focused={focused} />,
            }}
          />
          <Tab.Screen
            name="FoodTypes"
            component={FoodTypesScreen}
            options={{
              title: "Food types",
              tabBarLabel: "Types",
              tabBarIcon: ({ focused }) => <TabIcon label="Types" focused={focused} />,
            }}
          />
          <Tab.Screen
            name="Reminders"
            component={RemindersScreen}
            options={{
              title: "Reminders",
              tabBarLabel: "Reminders",
              tabBarIcon: ({ focused }) => <TabIcon label="Reminders" focused={focused} />,
            }}
          />
        </Tab.Navigator>
      </NavigationContainer>
      <StatusBar style="dark" />
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  tabIcon: {
    alignItems: "center",
    justifyContent: "center",
  },
  tabIconText: {
    fontSize: 16,
    color: "#888",
    fontWeight: "600",
    fontFamily: "Nunito_600SemiBold",
  },
  tabIconTextActive: {
    color: "#4a9eff",
  },
});
