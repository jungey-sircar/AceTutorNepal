import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, Redirect } from 'expo-router';
import { useAuthStore } from '../_lib/store';
import { api } from '../_lib/api';
import { COLORS, SPACING, RADIUS, SHADOWS } from '../_lib/theme';

interface DashboardData {
  total_questions_attempted: number;
  correct_answers: number;
  accuracy: number;
  daily_streak: number;
  subjects_count: number;
  exam_type: string;
}

export default function Dashboard() {
  const { user, isAuthenticated, isLoading: authLoading } = useAuthStore();
  const router = useRouter();
  const [data, setData] = useState<DashboardData | null>(null);
  const [subjects, setSubjects] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      const [dashRes, subRes] = await Promise.all([
        api.get<DashboardData>('/analytics/dashboard'),
        api.get<any[]>(`/subjects?exam_id=${(user?.exam_type || 'SEE').toLowerCase()}`),
      ]);
      setData(dashRes);
      setSubjects(subRes);
    } catch (err) {
      console.error('Dashboard fetch error:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user]);

  useEffect(() => {
    if (isAuthenticated) fetchData();
  }, [isAuthenticated, fetchData]);

  if (authLoading) {
    return <View style={styles.loadingContainer}><ActivityIndicator size="large" color={COLORS.primary} /></View>;
  }

  if (!isAuthenticated) {
    return <Redirect href="/" />;
  }

  const onRefresh = () => {
    setRefreshing(true);
    fetchData();
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.primary} />}
      >
        {/* Welcome Header */}
        <View style={styles.welcomeSection}>
          <View>
            <Text style={styles.greeting}>Welcome back,</Text>
            <Text style={styles.userName}>{user?.name || 'Student'}</Text>
          </View>
          <View style={styles.streakBadge}>
            <Ionicons name="flame" size={22} color={COLORS.streakAccent} />
            <Text style={styles.streakCount}>{data?.daily_streak || user?.daily_streak || 0}</Text>
          </View>
        </View>

        {/* Stats Row */}
        <View style={styles.statsRow}>
          <View style={[styles.statCard, { backgroundColor: COLORS.primaryLight }]}>
            <Ionicons name="help-circle" size={24} color={COLORS.primaryDark} />
            <Text style={styles.statNumber}>{data?.total_questions_attempted || 0}</Text>
            <Text style={styles.statLabel}>Questions</Text>
          </View>
          <View style={[styles.statCard, { backgroundColor: COLORS.successLight }]}>
            <Ionicons name="checkmark-circle" size={24} color={COLORS.secondaryDark} />
            <Text style={styles.statNumber}>{data?.accuracy || 0}%</Text>
            <Text style={styles.statLabel}>Accuracy</Text>
          </View>
          <View style={[styles.statCard, { backgroundColor: COLORS.streakLight }]}>
            <Ionicons name="flame" size={24} color={COLORS.streakAccent} />
            <Text style={styles.statNumber}>{data?.daily_streak || 0}</Text>
            <Text style={styles.statLabel}>Streak</Text>
          </View>
        </View>

        {/* Quick Actions */}
        <Text style={styles.sectionTitle}>Quick Start</Text>
        <View style={styles.actionsRow}>
          <TouchableOpacity
            testID="quick-practice-btn"
            style={[styles.actionCard, { borderColor: COLORS.primary }]}
            onPress={() => router.push('/(tabs)/practice')}
          >
            <Ionicons name="flash" size={28} color={COLORS.primary} />
            <Text style={styles.actionText}>Quick Practice</Text>
          </TouchableOpacity>
          <TouchableOpacity
            testID="ai-chat-btn"
            style={[styles.actionCard, { borderColor: COLORS.secondary }]}
            onPress={() => router.push('/(tabs)/chat')}
          >
            <Ionicons name="chatbubbles" size={28} color={COLORS.secondary} />
            <Text style={styles.actionText}>AI Tutor</Text>
          </TouchableOpacity>
        </View>

        {/* Subjects */}
        <Text style={styles.sectionTitle}>Your Subjects ({user?.exam_type || 'SEE'})</Text>
        {loading ? (
          <ActivityIndicator color={COLORS.primary} style={{ marginTop: SPACING.lg }} />
        ) : (
          subjects.map((subject) => (
            <TouchableOpacity
              key={subject.subject_id}
              testID={`subject-card-${subject.subject_id}`}
              style={styles.subjectCard}
              onPress={() => router.push(`/subject/${subject.subject_id}`)}
            >
              <View style={[styles.subjectIcon, { backgroundColor: subject.color + '20' }]}>
                <Ionicons name={(subject.icon || 'book') as any} size={24} color={subject.color || COLORS.primary} />
              </View>
              <View style={styles.subjectInfo}>
                <Text style={styles.subjectName}>{subject.name}</Text>
                <Text style={styles.subjectDesc} numberOfLines={1}>{subject.description}</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color={COLORS.textSecondary} />
            </TouchableOpacity>
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: COLORS.background },
  scroll: { padding: SPACING.lg, paddingBottom: 100 },
  welcomeSection: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: SPACING.lg },
  greeting: { fontSize: 14, color: COLORS.textSecondary, fontWeight: '600' },
  userName: { fontSize: 24, fontWeight: '900', color: COLORS.textPrimary, marginTop: 2 },
  streakBadge: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.streakLight,
    borderWidth: 2, borderColor: '#FDE68A', borderRadius: RADIUS.xl, paddingHorizontal: 14, paddingVertical: 8,
  },
  streakCount: { fontWeight: '900', fontSize: 18, color: COLORS.streakAccent, marginLeft: 6 },
  statsRow: { flexDirection: 'row', gap: SPACING.sm, marginBottom: SPACING.lg },
  statCard: {
    flex: 1, borderRadius: RADIUS.xl, padding: SPACING.md, alignItems: 'center',
    borderWidth: 1, borderColor: COLORS.border,
  },
  statNumber: { fontSize: 22, fontWeight: '900', color: COLORS.textPrimary, marginTop: 6 },
  statLabel: { fontSize: 11, fontWeight: '700', color: COLORS.textSecondary, marginTop: 2, textTransform: 'uppercase' },
  sectionTitle: { fontSize: 18, fontWeight: '800', color: COLORS.textPrimary, marginBottom: SPACING.md, marginTop: SPACING.sm },
  actionsRow: { flexDirection: 'row', gap: SPACING.md, marginBottom: SPACING.lg },
  actionCard: {
    flex: 1, backgroundColor: COLORS.surface, borderRadius: RADIUS.xl, padding: SPACING.lg,
    alignItems: 'center', borderWidth: 2, borderBottomWidth: 4, ...SHADOWS.sm,
  },
  actionText: { fontWeight: '700', fontSize: 13, color: COLORS.textPrimary, marginTop: SPACING.sm },
  subjectCard: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.surface,
    borderRadius: RADIUS.xl, padding: SPACING.md, marginBottom: SPACING.sm,
    borderWidth: 2, borderColor: COLORS.border, ...SHADOWS.sm,
  },
  subjectIcon: { width: 48, height: 48, borderRadius: RADIUS.lg, justifyContent: 'center', alignItems: 'center' },
  subjectInfo: { flex: 1, marginLeft: SPACING.md },
  subjectName: { fontSize: 16, fontWeight: '700', color: COLORS.textPrimary },
  subjectDesc: { fontSize: 13, color: COLORS.textSecondary, marginTop: 2 },
});
