import React, { useEffect, useRef } from 'react';
import { AppState, Linking, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { AlertTriangle, CheckCircle2, Flashlight, ScanLine, Settings, X, XCircle } from 'lucide-react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../theme/ThemeContext';
import { fontFamily } from '../theme/tokens';
import { Button } from './Button';

export type ScanFeedback = {
  tone: 'ok' | 'warn' | 'error';
  title: string;
  message?: string;
};

type Props = {
  visible: boolean;
  onClose: () => void;
  onScanned: (data: string) => void;
  title?: string;
  /** Deja la camara abierta para validar varios pases seguidos. */
  continuous?: boolean;
  /** Pausa la lectura mientras se valida el pase anterior. */
  busy?: boolean;
  /** Resultado breve que se muestra encima de la camara. */
  feedback?: ScanFeedback | null;
  /** La lectura queda pausada mientras el encargado decide si registra el ingreso. */
  confirmation?: { codigo: string } | null;
  onConfirm?: () => void;
  onCancel?: () => void;
};

const feedbackPalette = {
  ok: { background: 'rgba(15,122,79,0.94)', border: '#3ddc97', Icon: CheckCircle2 },
  warn: { background: 'rgba(168,107,0,0.94)', border: '#ffc857', Icon: AlertTriangle },
  error: { background: 'rgba(179,38,30,0.94)', border: '#ff7b72', Icon: XCircle },
};

export function QrScannerModal({
  visible,
  onClose,
  onScanned,
  title = 'Escanear QR',
  continuous = false,
  busy = false,
  feedback = null,
  confirmation = null,
  onConfirm,
  onCancel,
}: Props) {
  const { theme } = useTheme();
  const [permission, requestPermission, getPermission] = useCameraPermissions();
  const [torch, setTorch] = React.useState(false);
  const scanned = useRef(false);
  const cooldown = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Cada vez que se abre la camara el lector debe quedar listo de nuevo.
  useEffect(() => {
    if (!visible) return;
    scanned.current = false;
  }, [visible]);

  useEffect(() => () => {
    if (cooldown.current) clearTimeout(cooldown.current);
  }, []);

  const handleClose = () => {
    if (cooldown.current) clearTimeout(cooldown.current);
    setTorch(false);
    onClose();
  };

  // Si el usuario fue a los ajustes del telefono y concedio la camara, la
  // pantalla se actualiza al volver a la app.
  useEffect(() => {
    if (!visible) return;
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') void getPermission();
    });
    return () => subscription.remove();
  }, [visible, getPermission]);

  const handleScan = (data: string) => {
    if (scanned.current || busy || confirmation) return;
    scanned.current = true;
    onScanned(data);
    if (continuous) {
      if (cooldown.current) clearTimeout(cooldown.current);
      cooldown.current = setTimeout(() => {
        scanned.current = false;
      }, 1500);
    } else {
      handleClose();
    }
  };

  const denied = Boolean(permission && !permission.granted && permission.canAskAgain === false);
  const FeedbackIcon = feedback ? feedbackPalette[feedback.tone].Icon : null;

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="fullScreen" onRequestClose={handleClose}>
      <View style={styles.root}>
        {permission?.granted ? (
          <>
            <CameraView
              style={StyleSheet.absoluteFill}
              facing="back"
              enableTorch={torch}
              barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
              onBarcodeScanned={({ data }) => handleScan(data)}
            />

            <View style={styles.overlay} pointerEvents="box-none">
              <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
                <View style={styles.topBar}>
                  <Pressable onPress={handleClose} style={styles.close} accessibilityRole="button" accessibilityLabel="Cerrar camara">
                    <X size={22} color="#fff" strokeWidth={2.2} />
                  </Pressable>
                  <Text style={styles.title}>{title}</Text>
                  <Pressable onPress={() => setTorch((value) => !value)} style={styles.close} accessibilityRole="button" accessibilityLabel="Linterna">
                    <Flashlight size={20} color={torch ? '#a9f0cf' : '#fff'} strokeWidth={2.2} />
                  </Pressable>
                </View>

                <View style={styles.frameWrap}>
                  <View style={styles.frame}>
                    <View style={[styles.corner, styles.cornerTL]} />
                    <View style={[styles.corner, styles.cornerTR]} />
                    <View style={[styles.corner, styles.cornerBL]} />
                    <View style={[styles.corner, styles.cornerBR]} />
                    <View style={styles.scanLine} />
                  </View>
                  <Text style={styles.hint}>
                    {continuous
                      ? 'Escanea el siguiente pase. La camara seguira abierta.'
                      : 'Apunta al QR del pase. Se leera automaticamente.'}
                  </Text>
                </View>
              </SafeAreaView>
            </View>

            {feedback && FeedbackIcon ? (
              <View pointerEvents="none" style={styles.feedbackWrap}>
                <View
                  style={[
                    styles.feedbackCard,
                    {
                      backgroundColor: feedbackPalette[feedback.tone].background,
                      borderColor: feedbackPalette[feedback.tone].border,
                    },
                  ]}
                  accessibilityLiveRegion="assertive"
                >
                  <View style={styles.feedbackHead}>
                    <FeedbackIcon size={26} color="#fffdf9" strokeWidth={2.3} />
                    <Text style={styles.feedbackTitle} numberOfLines={2}>{feedback.title}</Text>
                  </View>
                  {feedback.message ? (
                    <Text style={styles.feedbackText} numberOfLines={3}>{feedback.message}</Text>
                  ) : null}
                </View>
              </View>
            ) : null}

            {confirmation ? (
              <View style={styles.confirmWrap}>
                <View style={styles.confirmCard} accessibilityLiveRegion="assertive">
                  <Text style={styles.confirmTitle}>¿Registrar el ingreso?</Text>
                  <Text style={styles.confirmName}>{confirmation.codigo}</Text>
                  <Text style={styles.confirmHint}>El titular y evento se mostraran despues de validar. Solo se marcara como usada si la entrada y el QR siguen vigentes.</Text>
                  <Button label="Registrar ingreso" onPress={onConfirm} loading={busy} fullWidth />
                  <Button label="Cancelar y seguir escaneando" onPress={onCancel} disabled={busy} variant="secondary" fullWidth />
                </View>
              </View>
            ) : null}
          </>
        ) : (
          <SafeAreaView style={styles.permission} edges={['top', 'bottom']}>
            <Pressable onPress={handleClose} style={[styles.close, styles.permissionClose]} accessibilityRole="button" accessibilityLabel="Cerrar camara">
              <X size={22} color="#fff" strokeWidth={2.2} />
            </Pressable>
            <View style={styles.permissionBody}>
              <View style={styles.permissionIcon}>
                <ScanLine size={32} color={theme.brand} strokeWidth={1.8} />
              </View>
              <Text style={styles.permissionTitle}>Necesitamos la camara</Text>
              <Text style={styles.permissionText}>
                La camara solo se usa mientras esta pantalla esta abierta, para leer el QR de una entrada.
              </Text>
              {denied ? (
                <>
                  <Text style={styles.permissionNote}>
                    La camara esta bloqueada en los ajustes del telefono. Habilitala para poder escanear pases.
                  </Text>
                  <Button
                    label="Abrir ajustes"
                    icon={Settings}
                    onPress={() => { void Linking.openSettings(); }}
                    style={styles.permissionButton}
                  />
                </>
              ) : (
                <Button
                  label="Permitir camara"
                  onPress={() => { void requestPermission(); }}
                  style={styles.permissionButton}
                />
              )}
            </View>
          </SafeAreaView>
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#050609' },
  permission: { flex: 1, justifyContent: 'center' },
  permissionBody: { alignItems: 'center', paddingHorizontal: 32 },
  permissionClose: { position: 'absolute', top: 14, left: 18, zIndex: 2 },
  permissionIcon: {
    width: 74,
    height: 74,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
    backgroundColor: 'rgba(255,255,255,0.06)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 18,
  },
  permissionTitle: { fontFamily, fontSize: 20, fontWeight: '800', textAlign: 'center', color: '#fffdf9' },
  permissionText: { fontFamily, fontSize: 12.5, lineHeight: 19, textAlign: 'center', marginTop: 8, maxWidth: 310, color: 'rgba(255,253,249,0.72)' },
  permissionNote: { fontFamily, fontSize: 11.5, lineHeight: 17, textAlign: 'center', marginTop: 12, maxWidth: 310, color: '#ffc857', fontWeight: '600' },
  permissionButton: { marginTop: 22 },
  overlay: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 },
  safe: { flex: 1, justifyContent: 'space-between' },
  topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 18, paddingTop: 6 },
  close: { width: 42, height: 42, borderRadius: 15, backgroundColor: 'rgba(0,0,0,0.45)', alignItems: 'center', justifyContent: 'center' },
  title: { fontFamily, color: '#fff', fontSize: 14, fontWeight: '800' },
  frameWrap: { alignItems: 'center', paddingBottom: 70 },
  frame: { width: 245, height: 245, borderRadius: 26, borderWidth: 1, borderColor: 'rgba(169,240,207,0.35)', justifyContent: 'center', alignItems: 'center' },
  corner: { position: 'absolute', width: 34, height: 34, borderColor: '#a9f0cf' },
  cornerTL: { top: -1, left: -1, borderTopWidth: 4, borderLeftWidth: 4, borderTopLeftRadius: 24 },
  cornerTR: { top: -1, right: -1, borderTopWidth: 4, borderRightWidth: 4, borderTopRightRadius: 24 },
  cornerBL: { bottom: -1, left: -1, borderBottomWidth: 4, borderLeftWidth: 4, borderBottomLeftRadius: 24 },
  cornerBR: { bottom: -1, right: -1, borderBottomWidth: 4, borderRightWidth: 4, borderBottomRightRadius: 24 },
  scanLine: { width: 185, height: 2, backgroundColor: '#a9f0cf', shadowColor: '#a9f0cf', shadowOpacity: 0.8, shadowRadius: 8 },
  hint: { fontFamily, color: 'rgba(255,255,255,0.72)', fontSize: 11.5, textAlign: 'center', marginTop: 18, paddingHorizontal: 24 },
  feedbackWrap: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 28 },
  feedbackCard: {
    width: '100%',
    maxWidth: 340,
    borderWidth: 2,
    borderRadius: 22,
    paddingVertical: 20,
    paddingHorizontal: 18,
    shadowColor: '#000',
    shadowOpacity: 0.35,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
    elevation: 12,
  },
  feedbackHead: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  feedbackTitle: { fontFamily, color: '#fffdf9', fontSize: 20, fontWeight: '800', flex: 1, letterSpacing: -0.3 },
  feedbackText: { fontFamily, color: 'rgba(255,253,249,0.92)', fontSize: 12, lineHeight: 18, marginTop: 8, fontWeight: '600' },
  confirmWrap: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24, backgroundColor: 'rgba(5,6,9,0.72)' },
  confirmCard: { width: '100%', maxWidth: 360, borderRadius: 22, padding: 20, gap: 12, backgroundColor: '#fffdf9' },
  confirmTitle: { fontFamily, fontSize: 20, fontWeight: '800', color: '#17131f' },
  confirmName: { fontFamily, fontSize: 17, fontWeight: '700', color: '#17131f' },
  confirmHint: { fontFamily, fontSize: 11, lineHeight: 16, color: '#484450', marginBottom: 6 },
});
