export type RootTabParamList = {
  Home: undefined;
  Stats: undefined;
  LoadData: undefined;
  Reminders: undefined;
  Settings: undefined;
};

declare global {
  namespace ReactNavigation {
    interface RootParamList extends RootTabParamList {}
  }
}
