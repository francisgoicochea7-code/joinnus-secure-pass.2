import { CompositeNavigationProp, useNavigation } from '@react-navigation/native';
import { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList, TabParamList } from './types';

export type TabNavigation = CompositeNavigationProp<
  BottomTabNavigationProp<TabParamList>,
  NativeStackNavigationProp<RootStackParamList>
>;

export type StackNavigation = NativeStackNavigationProp<RootStackParamList>;

export function useTabNavigation() {
  return useNavigation<TabNavigation>();
}

export function useStackNavigation() {
  return useNavigation<StackNavigation>();
}
