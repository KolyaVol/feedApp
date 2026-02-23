export type RootTabParamList = {
  Home: undefined;
  Stats: undefined;
  FoodTypes: undefined;
  Reminders: undefined;
  Settings: undefined;
};

declare global {
  namespace ReactNavigation {
    interface RootParamList extends RootTabParamList {}
  }
}
