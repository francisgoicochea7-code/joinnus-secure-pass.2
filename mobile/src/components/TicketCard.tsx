import React from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { ArrowUpRight, CalendarDays, MapPin, Ticket as TicketIcon } from 'lucide-react-native';
import { Ticket } from '../api/types';
import { useTheme } from '../theme/ThemeContext';
import { fontFamily } from '../theme/tokens';
import { formatEventDate, formatPrice, seatLabel } from '../utils/format';
import { posterFor } from '../utils/posters';
import { Badge } from './Badge';

export function TicketCard({ ticket, onPress }: { ticket: Ticket; onPress: () => void }) {
  const { theme } = useTheme();
  const statusColor = ticket.estadoDetalle?.color || theme.muted;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Entrada ${ticket.codigo}, ${ticket.evento}`}
      onPress={onPress}
      style={({ pressed }) => [
        styles.card,
        { backgroundColor: theme.surface, borderColor: theme.border, shadowColor: theme.shadow },
        pressed && { opacity: 0.86, transform: [{ scale: 0.995 }] },
      ]}
    >
      <Image source={posterFor(ticket.evento, ticket.codigo)} style={styles.poster} resizeMode="cover" />
      <View style={styles.content}>
        <View style={styles.topRow}>
          <Badge label={ticket.estadoDetalle?.corta || ticket.estadoEtiqueta} color={statusColor} compact />
          <Text style={[styles.code, { color: theme.muted }]}>{ticket.codigo}</Text>
        </View>
        <Text style={[styles.event, { color: theme.text }]} numberOfLines={2}>
          {ticket.evento}
        </Text>
        <View style={styles.metaRow}>
          <CalendarDays size={12} color={theme.muted} strokeWidth={2.1} />
          <Text style={[styles.meta, { color: theme.textSoft }]} numberOfLines={1}>
            {formatEventDate(ticket.fecha, ticket.hora)}
          </Text>
        </View>
        <View style={styles.metaRow}>
          <MapPin size={12} color={theme.muted} strokeWidth={2.1} />
          <Text style={[styles.meta, { color: theme.textSoft }]} numberOfLines={1}>
            {ticket.lugar}
          </Text>
        </View>
        <View style={styles.footer}>
          <View style={styles.seat}>
            <TicketIcon size={12} color={theme.muted} strokeWidth={2.1} />
            <Text style={[styles.seatText, { color: theme.muted }]} numberOfLines={1}>
              {seatLabel(ticket)}
            </Text>
          </View>
          <ArrowUpRight size={16} color={theme.brand} strokeWidth={2.2} />
        </View>
      </View>
    </Pressable>
  );
}

export function FeaturedTicket({ ticket, onPress }: { ticket: Ticket; onPress: () => void }) {
  const { theme } = useTheme();
  const statusColor = ticket.estadoDetalle?.color || theme.accent;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Abrir ${ticket.evento}`}
      onPress={onPress}
      style={({ pressed }) => [
        styles.featured,
        { borderColor: theme.border, shadowColor: theme.shadow },
        pressed && { opacity: 0.9, transform: [{ scale: 0.995 }] },
      ]}
    >
      <Image source={posterFor(ticket.evento, ticket.codigo)} style={styles.featuredImage} resizeMode="cover" />
      <LinearGradient
        colors={['rgba(8,9,13,0.06)', 'rgba(8,9,13,0.35)', 'rgba(8,9,13,0.94)']}
        style={StyleSheet.absoluteFill}
      />
      <View style={styles.featuredTop}>
        <Badge label={ticket.estadoDetalle?.corta || ticket.estadoEtiqueta} color={statusColor} />
        <View style={styles.featuredCode}>
          <Text style={styles.featuredCodeText}>{ticket.codigo}</Text>
        </View>
      </View>
      <View style={styles.featuredBottom}>
        <Text style={styles.featuredKicker}>{ticket.esMia ? 'TU PROXIMA ENTRADA' : 'ENTRADA DESTACADA'}</Text>
        <Text style={styles.featuredTitle} numberOfLines={2}>
          {ticket.evento}
        </Text>
        <View style={styles.featuredMeta}>
          <Text style={styles.featuredMetaText}>{formatEventDate(ticket.fecha, ticket.hora)}</Text>
          <View style={styles.dot} />
          <Text style={styles.featuredMetaText} numberOfLines={1}>
            {ticket.lugar}
          </Text>
        </View>
        <View style={styles.featuredFooter}>
          <View>
            <Text style={styles.featuredSeat}>{seatLabel(ticket)}</Text>
            <Text style={styles.featuredPrice}>{formatPrice(ticket.precio)}</Text>
          </View>
          <View style={styles.openButton}>
            <Text style={styles.openText}>Abrir pase</Text>
            <ArrowUpRight size={16} color="#17131f" strokeWidth={2.4} />
          </View>
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    borderWidth: 1,
    borderRadius: 22,
    overflow: 'hidden',
    marginBottom: 12,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.12,
    shadowRadius: 18,
    elevation: 2,
    minHeight: 144,
  },
  poster: { width: 106, height: 144, backgroundColor: '#11101a' },
  content: { flex: 1, padding: 13, gap: 5 },
  topRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  code: { fontFamily, fontSize: 9.5, fontWeight: '800', letterSpacing: 0.7 },
  event: { fontFamily, fontSize: 15, fontWeight: '800', letterSpacing: -0.3, lineHeight: 19, marginTop: 1 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  meta: { fontFamily, fontSize: 10.5, flex: 1, fontWeight: '500' },
  footer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 3 },
  seat: { flexDirection: 'row', alignItems: 'center', gap: 5, flex: 1 },
  seatText: { fontFamily, fontSize: 9.5, flex: 1, fontWeight: '600' },
  featured: {
    height: 342,
    borderRadius: 28,
    overflow: 'hidden',
    borderWidth: 1,
    marginBottom: 20,
    shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 0.25,
    shadowRadius: 28,
    elevation: 6,
    backgroundColor: '#0b0c12',
  },
  featuredImage: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, width: '100%', height: '100%' },
  featuredTop: {
    position: 'absolute',
    top: 15,
    left: 15,
    right: 15,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  featuredCode: {
    backgroundColor: 'rgba(8,9,13,0.58)',
    borderColor: 'rgba(255,255,255,0.18)',
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  featuredCodeText: { fontFamily, color: '#f4f2f8', fontSize: 9.5, fontWeight: '800', letterSpacing: 0.7 },
  featuredBottom: { position: 'absolute', left: 18, right: 18, bottom: 16 },
  featuredKicker: { fontFamily, color: '#a9f0cf', fontSize: 9.5, fontWeight: '800', letterSpacing: 1.5, marginBottom: 5 },
  featuredTitle: { fontFamily, color: '#fffdf9', fontSize: 28, lineHeight: 31, fontWeight: '800', letterSpacing: -1 },
  featuredMeta: { flexDirection: 'row', alignItems: 'center', gap: 7, marginTop: 7, paddingRight: 8 },
  featuredMetaText: { fontFamily, color: 'rgba(255,253,249,0.75)', fontSize: 10.5, fontWeight: '600', maxWidth: '65%' },
  dot: { width: 3, height: 3, borderRadius: 2, backgroundColor: 'rgba(255,253,249,0.45)' },
  featuredFooter: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', marginTop: 14 },
  featuredSeat: { fontFamily, color: 'rgba(255,253,249,0.66)', fontSize: 10.5, fontWeight: '600' },
  featuredPrice: { fontFamily, color: '#fffdf9', fontSize: 19, fontWeight: '800', marginTop: 2 },
  openButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#f4ede2',
    borderRadius: 999,
    paddingHorizontal: 13,
    paddingVertical: 9,
  },
  openText: { fontFamily, color: '#17131f', fontSize: 11, fontWeight: '800' },
});
