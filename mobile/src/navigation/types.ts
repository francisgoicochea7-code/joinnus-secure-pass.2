import { NavigatorScreenParams } from '@react-navigation/native';

export type RootStackParamList = {
  Main: NavigatorScreenParams<TabParamList> | undefined;
  Ticket: { codigo: string };
  Transfer: { codigo: string };
  Login: undefined;
  Staff: undefined;
};

export type TabParamList = {
  Inicio: undefined;
  Entradas: undefined;
  Verificar: undefined;
  Historial: undefined;
  Perfil: undefined;
};
