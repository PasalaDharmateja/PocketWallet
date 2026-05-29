import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useWallet } from '../context/WalletContext';
import { COLORS, SHADOWS, RADIUS, SPACING } from '../utils/theme';

const NOTIF_CONFIG = {
  success: { icon: 'checkmark-circle-outline', iconColor: COLORS.success,  bg: '#F0FDF4', border: '#BBF7D0', dot: COLORS.success  },
  warning: { icon: 'warning-outline',           iconColor: '#D97706',       bg: '#FFFBEB', border: '#FDE68A', dot: '#F59E0B'        },
  info:    { icon: 'information-circle-outline', iconColor: COLORS.primary, bg: '#EEF2FF', border: '#C7D2FE', dot: COLORS.primary   },
  alert:   { icon: 'notifications-outline',      iconColor: COLORS.info,    bg: '#EFF6FF', border: '#BFDBFE', dot: COLORS.info      },
};

export default function NotificationsScreen() {
  const { notifications, unreadCount, markAllRead, dismissNotif, clearAllNotifs } = useWallet();

  const handleClearAll = () => {
    Alert.alert('Clear All Notifications', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Clear All', style: 'destructive', onPress: clearAllNotifs },
    ]);
  };

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      {/* Action Bar */}
      {notifications.length > 0 && (
        <View style={styles.actionBar}>
          <TouchableOpacity onPress={markAllRead} disabled={unreadCount === 0} style={[styles.actionBtn, unreadCount === 0 && { opacity: 0.3 }]}>
            <Ionicons name="checkmark-done-outline" size={16} color={COLORS.primary} />
            <Text style={styles.actionBtnText}>Mark all read</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={handleClearAll} style={styles.actionBtn}>
            <Ionicons name="trash-outline" size={16} color={COLORS.danger} />
            <Text style={[styles.actionBtnText, { color: COLORS.danger }]}>Clear all</Text>
          </TouchableOpacity>
        </View>
      )}

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {notifications.length === 0 ? (
          <View style={styles.emptyState}>
            <View style={styles.emptyIcon}>
              <Ionicons name="notifications-off-outline" size={40} color={COLORS.textLight} />
            </View>
            <Text style={styles.emptyTitle}>All caught up!</Text>
            <Text style={styles.emptyDesc}>No notifications yet. We'll alert you on payments, transfers, and balance changes.</Text>
          </View>
        ) : (
          notifications.map(notif => {
            const cfg = NOTIF_CONFIG[notif.type] || NOTIF_CONFIG.info;
            return (
              <View
                key={notif.id}
                style={[
                  styles.notifCard,
                  { backgroundColor: cfg.bg, borderColor: cfg.border },
                  !notif.read && styles.notifUnread,
                ]}
              >
                {/* Unread accent */}
                {!notif.read && <View style={[styles.unreadBar, { backgroundColor: cfg.dot }]} />}

                <View style={styles.notifContent}>
                  {/* Icon */}
                  <View style={[styles.notifIconWrap, { backgroundColor: cfg.bg }]}>
                    <Ionicons name={cfg.icon} size={24} color={cfg.iconColor} />
                  </View>

                  {/* Text */}
                  <View style={styles.notifBody}>
                    <View style={styles.notifTitleRow}>
                      <Text style={styles.notifTitle} numberOfLines={1}>{notif.title}</Text>
                      {!notif.read && <View style={[styles.unreadDot, { backgroundColor: cfg.dot }]} />}
                    </View>
                    <Text style={styles.notifMessage}>{notif.message}</Text>
                    <Text style={styles.notifTime}>
                      <Ionicons name="time-outline" size={11} color={COLORS.textLight} /> {notif.time}
                    </Text>
                  </View>

                  {/* Dismiss */}
                  <TouchableOpacity onPress={() => dismissNotif(notif.id)} style={styles.dismissBtn} hitSlop={{ top: 10, right: 10, bottom: 10, left: 10 }}>
                    <Ionicons name="close" size={18} color={COLORS.textLight} />
                  </TouchableOpacity>
                </View>
              </View>
            );
          })
        )}
        <View style={{ height: 20 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.background },
  actionBar: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: SPACING.md, paddingVertical: 12, backgroundColor: COLORS.white, borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
  actionBtn: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  actionBtnText: { fontSize: 13, fontWeight: '600', color: COLORS.primary },
  scroll: { paddingHorizontal: SPACING.md, paddingTop: SPACING.md, paddingBottom: 30 },
  emptyState: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 80, paddingHorizontal: 32 },
  emptyIcon: { width: 80, height: 80, borderRadius: 24, backgroundColor: COLORS.white, alignItems: 'center', justifyContent: 'center', marginBottom: 16, ...SHADOWS.sm },
  emptyTitle: { fontSize: 20, fontWeight: '700', color: COLORS.text, marginBottom: 8 },
  emptyDesc: { fontSize: 14, color: COLORS.textSecondary, textAlign: 'center', lineHeight: 22 },
  notifCard: { borderRadius: RADIUS.lg, borderWidth: 1.5, marginBottom: 10, overflow: 'hidden', ...SHADOWS.sm },
  notifUnread: { borderWidth: 1.5 },
  unreadBar: { position: 'absolute', left: 0, top: 12, bottom: 12, width: 4, borderRadius: 2 },
  notifContent: { flexDirection: 'row', alignItems: 'flex-start', padding: 14, paddingLeft: 18 },
  notifIconWrap: { width: 44, height: 44, borderRadius: 13, alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  notifBody: { flex: 1 },
  notifTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 3 },
  notifTitle: { fontSize: 14, fontWeight: '700', color: COLORS.text, flex: 1 },
  unreadDot: { width: 8, height: 8, borderRadius: 4 },
  notifMessage: { fontSize: 13, color: COLORS.textSecondary, lineHeight: 18, marginBottom: 5 },
  notifTime: { fontSize: 11, color: COLORS.textLight, fontWeight: '500' },
  dismissBtn: { paddingLeft: 8, paddingTop: 2 },
});
