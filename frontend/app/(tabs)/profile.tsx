import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert,
  TextInput, ActivityIndicator, Share, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useAuthStore } from '../_lib/store';
import { api } from '../_lib/api';
import { COLORS, SPACING, RADIUS, SHADOWS } from '../_lib/theme';
import { clearAllCache, getCacheSize } from '../_lib/cache';

export default function ProfileScreen() {
  const { user, logout, updateUser } = useAuthStore();
  const router = useRouter();
  const [stats, setStats] = useState<any>(null);
  const [referralInfo, setReferralInfo] = useState<any>(null);
  const [referralInput, setReferralInput] = useState('');
  const [applyingReferral, setApplyingReferral] = useState(false);
  const [referralMsg, setReferralMsg] = useState('');
  const [cacheSize, setCacheSize] = useState('0 B');
  const [clearingCache, setClearingCache] = useState(false);

  useEffect(() => {
    loadStats();
    loadReferralInfo();
    loadCacheSize();
  }, []);

  const loadStats = async () => {
    try {
      const data = await api.get('/analytics/dashboard');
      setStats(data);
    } catch (err) { console.error(err); }
  };

  const loadReferralInfo = async () => {
    try {
      const data = await api.get('/referral/info');
      setReferralInfo(data);
    } catch (err) { console.error(err); }
  };

  const loadCacheSize = async () => {
    const size = await getCacheSize();
    setCacheSize(size);
  };

  const handleShareReferral = async () => {
    const code = referralInfo?.referral_code || user?.referral_code || '';
    const msg = `Join ExamAce Nepal and prepare for exams with AI! Use my referral code "${code}" to get 1 week FREE premium. Download now!`;
    try {
      if (Platform.OS === 'web') {
        if (navigator.clipboard) {
          await navigator.clipboard.writeText(code);
          Alert.alert('Copied!', `Referral code "${code}" copied to clipboard`);
        }
      } else {
        await Share.share({ message: msg });
      }
    } catch {}
  };

  const handleApplyReferral = async () => {
    if (!referralInput.trim()) return;
    setApplyingReferral(true);
    setReferralMsg('');
    try {
      const res = await api.post<{ success: boolean; message: string; user: any }>('/referral/apply', {
        referral_code: referralInput.trim(),
      });
      setReferralMsg(res.message);
      if (res.user) updateUser(res.user);
      setReferralInput('');
      loadReferralInfo();
    } catch (err: any) {
      setReferralMsg(err.message || 'Failed to apply referral code');
    } finally {
      setApplyingReferral(false);
    }
  };

  const handleClearCache = async () => {
    setClearingCache(true);
    await clearAllCache();
    const size = await getCacheSize();
    setCacheSize(size);
    setClearingCache(false);
    Alert.alert('Cache Cleared', 'Offline data has been cleared.');
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

  const isPremium = user?.subscription_status === 'premium';
  const referralCode = referralInfo?.referral_code || user?.referral_code || '';

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
          <View style={styles.badgeRow}>
            <View style={styles.examBadge}>
              <Ionicons name="school" size={14} color={COLORS.primaryDark} />
              <Text style={styles.examBadgeText}>{user?.exam_type || 'SEE'}</Text>
            </View>
            {isPremium && (
              <View style={[styles.examBadge, { backgroundColor: COLORS.streakLight }]}>
                <Ionicons name="star" size={14} color={COLORS.streakAccent} />
                <Text style={[styles.examBadgeText, { color: COLORS.streakAccent }]}>PREMIUM</Text>
              </View>
            )}
          </View>
        </View>

        {/* Stats */}
        <View style={styles.statsGrid}>
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{stats?.total_questions_attempted || 0}</Text>
            <Text style={styles.statLabel}>Questions</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{stats?.accuracy || 0}%</Text>
            <Text style={styles.statLabel}>Accuracy</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{stats?.daily_streak || user?.daily_streak || 0}</Text>
            <Text style={styles.statLabel}>Streak</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{referralInfo?.referral_count || 0}</Text>
            <Text style={styles.statLabel}>Referrals</Text>
          </View>
        </View>

        {/* Referral Section */}
        <View style={styles.referralCard}>
          <View style={styles.referralHeader}>
            <Ionicons name="gift" size={24} color={COLORS.secondary} />
            <View style={{ marginLeft: SPACING.sm, flex: 1 }}>
              <Text style={styles.referralTitle}>Invite Friends, Get Premium!</Text>
              <Text style={styles.referralSubtitle}>Both you & your friend get 1 week free premium</Text>
            </View>
          </View>

          {/* Your code */}
          <View style={styles.codeContainer}>
            <Text style={styles.codeLabel}>YOUR REFERRAL CODE</Text>
            <View style={styles.codeRow}>
              <Text testID="referral-code-display" style={styles.codeText}>{referralCode}</Text>
              <TouchableOpacity testID="share-referral-btn" style={styles.shareBtn} onPress={handleShareReferral}>
                <Ionicons name="share-social" size={18} color="#fff" />
                <Text style={styles.shareBtnText}>Share</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Enter code */}
          {!referralInfo?.subscription_status || referralInfo?.subscription_status === 'free' ? (
            <View style={styles.applySection}>
              <Text style={styles.codeLabel}>HAVE A REFERRAL CODE?</Text>
              <View style={styles.applyRow}>
                <TextInput
                  testID="referral-input"
                  style={styles.referralInputField}
                  value={referralInput}
                  onChangeText={setReferralInput}
                  placeholder="Enter code"
                  autoCapitalize="characters"
                  maxLength={6}
                  placeholderTextColor={COLORS.textSecondary}
                />
                <TouchableOpacity
                  testID="apply-referral-btn"
                  style={[styles.applyBtn, (!referralInput.trim() || applyingReferral) && styles.disabledBtn]}
                  onPress={handleApplyReferral}
                  disabled={!referralInput.trim() || applyingReferral}
                >
                  {applyingReferral ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <Text style={styles.applyBtnText}>Apply</Text>
                  )}
                </TouchableOpacity>
              </View>
              {referralMsg ? (
                <Text testID="referral-message" style={[
                  styles.referralMsg,
                  referralMsg.includes('applied') ? { color: COLORS.secondaryDark } : { color: COLORS.error }
                ]}>{referralMsg}</Text>
              ) : null}
            </View>
          ) : null}
        </View>

        {/* Menu Items */}
        <View style={styles.menuSection}>
          <TouchableOpacity testID="menu-offline" style={styles.menuItem} onPress={handleClearCache}>
            <View style={[styles.menuIcon, { backgroundColor: COLORS.primaryLight }]}>
              <Ionicons name="cloud-offline" size={20} color={COLORS.primary} />
            </View>
            <View style={styles.menuInfo}>
              <Text style={styles.menuTitle}>Offline Cache</Text>
              <Text style={styles.menuDesc}>
                {clearingCache ? 'Clearing...' : `${cacheSize} cached • Tap to clear`}
              </Text>
            </View>
            <Ionicons name="trash-outline" size={20} color={COLORS.textSecondary} />
          </TouchableOpacity>

          <TouchableOpacity testID="menu-subscription" style={styles.menuItem} onPress={() => Alert.alert('Premium', isPremium ? `Premium active until ${referralInfo?.premium_expires?.split('T')[0] || 'N/A'}` : 'Invite friends to get premium free!')}>
            <View style={[styles.menuIcon, { backgroundColor: COLORS.streakLight }]}>
              <Ionicons name="star" size={20} color={COLORS.streakAccent} />
            </View>
            <View style={styles.menuInfo}>
              <Text style={styles.menuTitle}>{isPremium ? 'Premium Active' : 'Upgrade to Premium'}</Text>
              <Text style={styles.menuDesc}>{isPremium ? 'Enjoy unlimited access' : 'Use referral or eSewa/Khalti'}</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={COLORS.textSecondary} />
          </TouchableOpacity>

          <TouchableOpacity testID="menu-about" style={styles.menuItem} onPress={() => Alert.alert('ExamAce Nepal', 'Version 1.1.0\nAI-powered exam prep for Nepali students')}>
            <View style={[styles.menuIcon, { backgroundColor: COLORS.secondaryLight }]}>
              <Ionicons name="information-circle" size={20} color={COLORS.secondary} />
            </View>
            <View style={styles.menuInfo}>
              <Text style={styles.menuTitle}>About</Text>
              <Text style={styles.menuDesc}>Version 1.1.0</Text>
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
  badgeRow: { flexDirection: 'row', gap: SPACING.sm, marginTop: SPACING.sm },
  examBadge: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.primaryLight,
    borderRadius: RADIUS.full, paddingHorizontal: 12, paddingVertical: 6, gap: 4,
  },
  examBadgeText: { fontWeight: '700', fontSize: 13, color: COLORS.primaryDark },
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.sm, marginTop: SPACING.lg },
  statItem: {
    width: '48%', backgroundColor: COLORS.surface, borderRadius: RADIUS.xl, padding: SPACING.md,
    alignItems: 'center', borderWidth: 2, borderColor: COLORS.border,
  },
  statValue: { fontSize: 24, fontWeight: '900', color: COLORS.textPrimary },
  statLabel: { fontSize: 11, fontWeight: '700', color: COLORS.textSecondary, marginTop: 4, textTransform: 'uppercase' },

  // Referral
  referralCard: {
    backgroundColor: COLORS.surface, borderRadius: RADIUS.xxl, padding: SPACING.lg,
    marginTop: SPACING.lg, borderWidth: 2, borderColor: '#BBF7D0', ...SHADOWS.md,
  },
  referralHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: SPACING.md },
  referralTitle: { fontSize: 17, fontWeight: '800', color: COLORS.textPrimary },
  referralSubtitle: { fontSize: 13, color: COLORS.textSecondary, marginTop: 2 },
  codeContainer: { marginBottom: SPACING.md },
  codeLabel: { fontSize: 11, fontWeight: '800', color: COLORS.textSecondary, letterSpacing: 1.5, marginBottom: SPACING.xs },
  codeRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm },
  codeText: {
    flex: 1, fontSize: 24, fontWeight: '900', color: COLORS.secondaryDark, letterSpacing: 4,
    backgroundColor: COLORS.secondaryLight, borderWidth: 2, borderColor: '#BBF7D0',
    borderRadius: RADIUS.lg, paddingVertical: 12, paddingHorizontal: SPACING.md, textAlign: 'center',
  },
  shareBtn: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.secondary,
    borderRadius: RADIUS.xl, paddingVertical: 14, paddingHorizontal: SPACING.md, gap: 6,
    borderBottomWidth: 3, borderBottomColor: COLORS.secondaryDark,
  },
  shareBtnText: { fontWeight: '700', fontSize: 14, color: '#fff' },
  applySection: { borderTopWidth: 1, borderTopColor: COLORS.border, paddingTop: SPACING.md },
  applyRow: { flexDirection: 'row', gap: SPACING.sm },
  referralInputField: {
    flex: 1, backgroundColor: COLORS.background, borderWidth: 2, borderColor: COLORS.border,
    borderRadius: RADIUS.lg, paddingHorizontal: SPACING.md, paddingVertical: 12,
    fontSize: 16, fontWeight: '700', color: COLORS.textPrimary, letterSpacing: 2, textAlign: 'center',
  },
  applyBtn: {
    backgroundColor: COLORS.primary, borderRadius: RADIUS.lg, paddingHorizontal: SPACING.lg,
    justifyContent: 'center', borderBottomWidth: 3, borderBottomColor: COLORS.primaryDark,
  },
  disabledBtn: { opacity: 0.5 },
  applyBtnText: { fontWeight: '700', fontSize: 15, color: '#fff' },
  referralMsg: { fontSize: 13, fontWeight: '600', marginTop: SPACING.sm },

  // Menu
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
