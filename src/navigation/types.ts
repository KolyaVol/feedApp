export type RootTabParamList = {
  Home: undefined;
  Stats: undefined;
  LoadData: undefined;
  Calculator: undefined;
  Settings: undefined;
};

declare global {
  namespace ReactNavigation {
    interface RootParamList extends RootTabParamList {}
  }
}
