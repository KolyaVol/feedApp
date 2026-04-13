export type RootTabParamList = {
  Home: undefined;
  Data: undefined;
  Stats: undefined;
  Guide: undefined;
  Settings: undefined;
};

declare global {
  namespace ReactNavigation {
    interface RootParamList extends RootTabParamList {}
  }
}
