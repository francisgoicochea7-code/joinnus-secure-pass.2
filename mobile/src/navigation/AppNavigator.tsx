import React from 'react';
import { NavigationContainer, DarkTheme, DefaultTheme } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { History, Home, ScanLine, Ticket as TicketIcon, UserRound } from 'lucide-react-native';
import { useTheme } from '../theme/ThemeContext';
import { fontFamily } from '../theme/tokens';
import { RootStackParamList, TabParamList } from './types';
import { HomeScreen } from '../screens/HomeScreen';
import { TicketsScreen } from '../screens/TicketsScreen';
import { VerifyScreen } from '../screens/VerifyScreen';
import { HistoryScreen } from '../screens/HistoryScreen';
import { ProfileScreen } from '../screens/ProfileScreen';
import { TicketScreen } from '../screens/TicketScreen';
import { TransferScreen } from '../screens/TransferScreen';
import { LoginScreen } from '../screens/LoginScreen';
import { StaffScreen } from '../screens/StaffScreen';

const Stack = createNativeStackNavigator<RootStackParamList>();
const Tabs = createBottomTabNavigator<TabParamList>();

function MainTabs() {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <Tabs.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarHideOnKeyboard: true,
        tabBarActiveTintColor: theme.brand,
        tabBarInactiveTintColor: theme.muted,
        tabBarLabelStyle: {
          fontFamily,
          fontSize: 9.5,
          fontWeight: '700',
          marginTop: -1,
        },
        tabBarStyle: {
          backgroundColor: theme.mode === 'dark' ? 'rgba(15,17,22,0.98)' : 'rgba(255,253,249,0.98)',
          borderTopColor: theme.border,
          borderTopWidth: 1,
          height: 61 + insets.bottom,
          paddingTop: 7,
          paddingBottom: Math.max(insets.bottom, 8),
          elevation: 0,
        },
        tabBarItemStyle: { paddingVertical: 0 },
        tabBarIcon: ({ color, focused, size }) => {
          const iconSize = focused ? size + 1 : size;
          const props = { color, size: iconSize, strokeWidth: focused ? 2.5 : 2 };
          if (route.name === 'Inicio') return <Home {...props} />;
          if (route.name === 'Entradas') return <TicketIcon {...props} />;
          if (route.name === 'Verificar') return <ScanLine {...props} />;
          if (route.name === 'Historial') return <History {...props} />;
          return <UserRound {...props} />;
        },
      })}
    >
      <Tabs.Screen name="Inicio" component={HomeScreen} />
      <Tabs.Screen name="Entradas" component={TicketsScreen} />
      <Tabs.Screen name="Verificar" component={VerifyScreen} />
      <Tabs.Screen name="Historial" component={HistoryScreen} />
      <Tabs.Screen name="Perfil" component={ProfileScreen} />
    </Tabs.Navigator>
  );
}

export function AppNavigator() {
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
          animation: 'slide_from_right',
        }}
      >
        <Stack.Screen name="Main" component={MainTabs} />
        <Stack.Screen name="Ticket" component={TicketScreen} />
        <Stack.Screen name="Transfer" component={TransferScreen} />
        <Stack.Screen name="Staff" component={StaffScreen} />
        <Stack.Screen name="Login" component={LoginScreen} options={{ presentation: 'modal', animation: 'slide_from_bottom' }} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
