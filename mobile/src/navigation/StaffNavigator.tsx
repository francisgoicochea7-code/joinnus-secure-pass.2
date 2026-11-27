import React from 'react';
import { NavigationContainer, DarkTheme, DefaultTheme } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useTheme } from '../theme/ThemeContext';
import { StaffScreen } from '../screens/StaffScreen';

type StaffStackParamList = {
  StaffRoot: undefined;
};

const Stack = createNativeStackNavigator<StaffStackParamList>();

function StaffRootScreen() {
  return <StaffScreen root />;
}

/**
 * App de encargados: una sola pantalla con login, escaner y validacion.
 * No incluye pestañas ni funciones del publico.
 */
export function StaffNavigator() {
  const { theme } = useTheme();
  const base = theme.mode === 'dark' ? DarkTheme : DefaultTheme;
  const navTheme = {
    ...base,
    colors: {
      ...base.colors,
      primary: theme.brand,
      background: theme.bg,
      card: theme.surface,
      text: theme.text,
      border: theme.border,
      notification: theme.danger,
    },
  };

  return (
    <NavigationContainer theme={navTheme}>
      <Stack.Navigator
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: theme.bg },
        }}
      >
        <Stack.Screen name="StaffRoot" component={StaffRootScreen} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
