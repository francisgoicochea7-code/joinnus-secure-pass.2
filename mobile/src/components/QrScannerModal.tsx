import React, { useRef } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { Flashlight, ScanLine, X } from 'lucide-react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../theme/ThemeContext';
import { fontFamily } from '../theme/tokens';
import { Button } from './Button';

type Props = {
  visible: boolean;
  onClose: () => void;
  onScanned: (data: string) => void;
  title?: string;
};

export function QrScannerModal({ visible, onClose, onScanned, title = 'Escanear QR' }: Props) {
  const { theme } = useTheme();
  const [permission, requestPermission] = useCameraPermissions();
  const [torch, setTorch] = React.useState(false);
  const scanned = useRef(false);

  const handleScan = (data: string) => {
    if (scanned.current) return;
    scanned.current = true;
    onScanned(data);
    setTimeout(() => {
      scanned.current = false;
    }, 1200);
    onClose();
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="fullScreen" onRequestClose={onClose}>
      <View style={styles.root}>
        {permission?.granted ? (
          <CameraView
            style={StyleSheet.absoluteFill}
            facing="back"
            enableTorch={torch}
            barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
            onBarcodeScanned={({ data }) => handleScan(data)}
          />
        ) : (
          <View style={styles.permission}>
            <View style={[styles.permissionIcon, { backgroundColor: theme.surface, borderColor: theme.border }]}>
              <ScanLine size={32} color={theme.brand} strokeWidth={1.8} />
            </View>
            <Text style={[styles.permissionTitle, { color: theme.text }]}>Necesitamos la camara</Text>
            <Text style={[styles.permissionText, { color: theme.textSoft }]}>
              La camara solo se usa mientras esta pantalla esta abierta, para leer el QR de una entrada.
            </Text>
            <Button label="Permitir camara" onPress={() => requestPermission()} style={styles.permissionButton} />
          </View>
        )}

        <View style={styles.overlay} pointerEvents="box-none">
          <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
            <View style={styles.topBar}>
              <Pressable onPress={onClose} style={styles.close} accessibilityRole="button" accessibilityLabel="Cerrar camara">
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
              <Text style={styles.hint}>Apunta al QR del pase. Se leera automaticamente.</Text>
            </View>
          </SafeAreaView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#050609' },
  permission: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32 },
  permissionIcon: { width: 74, height: 74, borderRadius: 24, borderWidth: 1, alignItems: 'center', justifyContent: 'center', marginBottom: 18 },
  permissionTitle: { fontFamily, fontSize: 20, fontWeight: '800', textAlign: 'center' },
  permissionText: { fontFamily, fontSize: 12.5, lineHeight: 19, textAlign: 'center', marginTop: 8, maxWidth: 310 },
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
  hint: { fontFamily, color: 'rgba(255,255,255,0.72)', fontSize: 11.5, textAlign: 'center', marginTop: 18 },
});
