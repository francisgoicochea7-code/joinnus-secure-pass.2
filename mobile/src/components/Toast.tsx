import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';
import { AlertTriangle, CheckCircle2, Info, XCircle } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../theme/ThemeContext';
import { fontFamily } from '../theme/tokens';

type ToastType = 'success' | 'error' | 'info';

type ToastInput = {
  type?: ToastType;
  title: string;
  message?: string;
};

type ToastItem = ToastInput & { id: number };

type ToastContextValue = {
  showToast: (input: ToastInput) => void;
};

const ToastContext = createContext<ToastContextValue | null>(null);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toast, setToast] = useState<ToastItem | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showToast = useCallback((input: ToastInput) => {
    if (timer.current) clearTimeout(timer.current);
    setToast({ ...input, id: Date.now() });
    timer.current = setTimeout(() => setToast(null), 3800);
  }, []);

  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  const value = useMemo(() => ({ showToast }), [showToast]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      {toast ? <ToastView key={toast.id} toast={toast} /> : null}
    </ToastContext.Provider>
  );
}

function ToastView({ toast }: { toast: ToastItem }) {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const [opacity] = useState(() => new Animated.Value(0));
  const [translateY] = useState(() => new Animated.Value(-16));

  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity, { toValue: 1, duration: 240, useNativeDriver: true }),
      Animated.spring(translateY, { toValue: 0, damping: 16, stiffness: 190, useNativeDriver: true }),
    ]).start();
  }, [opacity, translateY]);

  const type = toast.type || 'info';
  const palette = {
    success: { color: theme.ok, Icon: CheckCircle2 },
    error: { color: theme.danger, Icon: XCircle },
    info: { color: theme.info, Icon: Info },
  }[type];

  const Icon = type === 'info' ? Info : type === 'error' ? (AlertTriangle as typeof Info) : palette.Icon;

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.wrap,
        {
          top: insets.top + 10,
          backgroundColor: theme.surfaceRaised,
          borderColor: `${palette.color}55`,
          shadowColor: theme.shadow,
          opacity,
          transform: [{ translateY }],
        },
      ]}
    >
      <View style={[styles.icon, { backgroundColor: `${palette.color}1A` }]}>
        <Icon size={20} color={palette.color} strokeWidth={2.2} />
      </View>
      <View style={styles.content}>
        <Text style={[styles.title, { color: theme.text }]}>{toast.title}</Text>
        {toast.message ? <Text style={[styles.message, { color: theme.textSoft }]}>{toast.message}</Text> : null}
      </View>
    </Animated.View>
  );
}

export function useToast() {
  const value = useContext(ToastContext);
  if (!value) throw new Error('useToast debe usarse dentro de ToastProvider');
  return value;
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    left: 16,
    right: 16,
    zIndex: 1000,
    elevation: 12,
    borderWidth: 1,
    borderRadius: 18,
    padding: 13,
    flexDirection: 'row',
    gap: 11,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.24,
    shadowRadius: 20,
  },
  icon: { width: 38, height: 38, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  content: { flex: 1, justifyContent: 'center' },
  title: { fontFamily, fontSize: 13, fontWeight: '800' },
  message: { fontFamily, fontSize: 11.5, marginTop: 2, lineHeight: 16 },
});
