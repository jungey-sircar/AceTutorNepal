import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useAuthStore } from '../_lib/store';
import { api } from '../_lib/api';
import { COLORS, SPACING, RADIUS, SHADOWS } from '../_lib/theme';

export default function ProfileScreen() {
  const { user, logout } = useAuthStore();
  const router = useRouter();
  const [stats, setStats] = useState<any>(null);

  useEffect(() => {
    loadStats();
  }, []);

  const loadStats = async () => {
    try {
      const data = await api.get('/analytics/dashboard');
      setStats(data);
    } catch (err) { console.error(err); }
  };

  const handleLogout = () => {
    Alert.alert('Logout', 'Are you sure you want to logout?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Logout', style: 'destructive', onPress: async () => {
        await logout();
        router.replace('/');
      }},
    ]);
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.title}>Profile</Text>

        {/* Profile Card */}
        <View style={styles.profileCard}>
          <View style={styles.avatarContainer}>
            <Text style={styles.avatarText}>{(user?.name || 'U')[0].toUpperCase()}</Text>
          </View>
          <Text style={styles.profileName}>{user?.name || 'Student'}</Text>
          <Text style={styles.profileEmail}>{user?.email || ''}</Text>
          <View style={styles.examBadge}>
            <Ionicons name="school" size={14} color={COLORS.primaryDark} />
            <Text style={styles.examBadgeText}>{user?.exam_type || 'SEE'}</Text>
          </View>
        </View>

        {/* Stats */}
        <View style={styles.statsGrid}>
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{stats?.total_questions_attempted || 0}</Text>
            <Text style={styles.statLabel}>Questions Practiced</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{stats?.accuracy || 0}%</Text>
            <Text style={styles.statLabel}>Accuracy</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{stats?.daily_streak || user?.daily_streak || 0}</Text>
            <Text style={styles.statLabel}>Day Streak</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={[styles.statValue, { color: COLORS.secondary }]}>
              {user?.subscription_status === 'premium' ? 'PRO' : 'Free'}
            </Text>
            <Text style={styles.statLabel}>Plan</Text>
          </View>
        </View>

        {/* Menu Items */}
        <View style={styles.menuSection}>
          <TouchableOpacity testID="menu-subscription" style={styles.menuItem} onPress={() => Alert.alert('Premium', 'Premium subscription with eSewa/Khalti payment coming soon!')}>
            <View style={[styles.menuIcon, { backgroundColor: COLORS.streakLight }]}>
              <Ionicons name="star" size={20} color={COLORS.streakAccent} />
            </View>
            <View style={styles.menuInfo}>
              <Text style={styles.menuTitle}>Upgrade to Premium</Text>
              <Text style={styles.menuDesc}>Unlock unlimited AI tutor & mock exams</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={COLORS.textSecondary} />
          </TouchableOpacity>

          <TouchableOpacity testID="menu-about" style={styles.menuItem} onPress={() => Alert.alert('ExamAce Nepal', 'Version 1.0.0\nAI-powered exam prep for Nepali students')}>
            <View style={[styles.menuIcon, { backgroundColor: COLORS.primaryLight }]}>
              <Ionicons name="information-circle" size={20} color={COLORS.primary} />
            </View>
            <View style={styles.menuInfo}>
              <Text style={styles.menuTitle}>About</Text>
              <Text style={styles.menuDesc}>Version 1.0.0</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={COLORS.textSecondary} />
          </TouchableOpacity>
        </View>

        {/* Logout */}
        <TouchableOpacity testID="logout-btn" style={styles.logoutBtn} onPress={handleLogout}>
          <Ionicons name="log-out" size={20} color={COLORS.error} />
          <Text style={styles.logoutText}>Logout</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  scroll: { padding: SPACING.lg, paddingBottom: 100 },
  title: { fontSize: 28, fontWeight: '900', color: COLORS.textPrimary, marginBottom: SPACING.lg },
  profileCard: {
    backgroundColor: COLORS.surface, borderRadius: RADIUS.xxl, padding: SPACING.xl,
    alignItems: 'center', borderWidth: 2, borderColor: COLORS.border, ...SHADOWS.md,
  },
  avatarContainer: {
    width: 72, height: 72, borderRadius: RADIUS.full, backgroundColor: COLORS.primary,
    justifyContent: 'center', alignItems: 'center', marginBottom: SPACING.md,
  },
  avatarText: { fontSize: 28, fontWeight: '900', color: '#fff' },
  profileName: { fontSize: 22, fontWeight: '800', color: COLORS.textPrimary },
  profileEmail: { fontSize: 14, color: COLORS.textSecondary, marginTop: 4 },
  examBadge: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.primaryLight,
    borderRadius: RADIUS.full, paddingHorizontal: 12, paddingVertical: 6, marginTop: SPACING.sm, gap: 4,
  },
  examBadgeText: { fontWeight: '700', fontSize: 13, color: COLORS.primaryDark },
  statsGrid: {
    flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.sm, marginTop: SPACING.lg,
  },
  statItem: {
    width: '48%', backgroundColor: COLORS.surface, borderRadius: RADIUS.xl, padding: SPACING.md,
    alignItems: 'center', borderWidth: 2, borderColor: COLORS.border,
  },
  statValue: { fontSize: 24, fontWeight: '900', color: COLORS.textPrimary },
  statLabel: { fontSize: 11, fontWeight: '700', color: COLORS.textSecondary, marginTop: 4, textTransform: 'uppercase' },
  menuSection: { marginTop: SPACING.lg },
  menuItem: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.surface,
    borderRadius: RADIUS.xl, padding: SPACING.md, marginBottom: SPACING.sm,
    borderWidth: 2, borderColor: COLORS.border,
  },
  menuIcon: { width: 40, height: 40, borderRadius: RADIUS.lg, justifyContent: 'center', alignItems: 'center' },
  menuInfo: { flex: 1, marginLeft: SPACING.md },
  menuTitle: { fontSize: 15, fontWeight: '700', color: COLORS.textPrimary },
  menuDesc: { fontSize: 12, color: COLORS.textSecondary, marginTop: 2 },
  logoutBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    backgroundColor: COLORS.errorLight, borderRadius: RADIUS.xl, paddingVertical: 16,
    marginTop: SPACING.lg, borderWidth: 2, borderColor: '#FCA5A5', gap: SPACING.sm,
  },
  logoutText: { fontWeight: '700', fontSize: 16, color: COLORS.error },
});
