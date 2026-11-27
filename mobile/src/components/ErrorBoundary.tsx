import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ShieldAlert } from 'lucide-react-native';
import { Button } from './Button';
import { useTheme } from '../theme/ThemeContext';
import { fontFamily } from '../theme/tokens';

type Props = { children: React.ReactNode };
type State = { hasError: boolean };

/**
 * Ultimo recurso ante un fallo de render: en vez de dejar la pantalla en
 * blanco, ofrece reintentar sin cerrar la sesion.
 */
export class ErrorBoundary extends React.Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('Error no controlado en la app:', error, info.componentStack);
  }

  reset = () => this.setState({ hasError: false });

  render() {
    if (this.state.hasError) return <Fallback onRetry={this.reset} />;
    return this.props.children;
  }
}

function Fallback({ onRetry }: { onRetry: () => void }) {
  const { theme } = useTheme();

  return (
    <SafeAreaView style={[styles.root, { backgroundColor: theme.bg }]}>
      <View style={[styles.icon, { backgroundColor: `${theme.warn}16`, borderColor: `${theme.warn}3D` }]}>
        <ShieldAlert size={30} color={theme.warn} strokeWidth={1.8} />
      </View>
      <Text style={[styles.title, { color: theme.text }]}>Algo salio mal</Text>
      <Text style={[styles.text, { color: theme.muted }]}>
        La app encontro un error inesperado. Puedes reintentar sin cerrar la sesion.
      </Text>
      <Button label="Reintentar" onPress={onRetry} style={styles.button} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32 },
  icon: { width: 74, height: 74, borderRadius: 24, borderWidth: 1, alignItems: 'center', justifyContent: 'center', marginBottom: 18 },
  title: { fontFamily, fontSize: 20, fontWeight: '800', textAlign: 'center' },
  text: { fontFamily, fontSize: 12, lineHeight: 19, textAlign: 'center', marginTop: 8, maxWidth: 310 },
  button: { marginTop: 22, minWidth: 180 },
});
