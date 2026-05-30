import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { api } from '../_lib/api';
import { fetchWithCache } from '../_lib/cache';
import { COLORS, SPACING, RADIUS, SHADOWS } from '../_lib/theme';
import { getChildPreviewTitles, questionBankRoots as fallbackQuestionBankRoots, QuestionBankNode } from '../_lib/questionBank';

export default function QuestionBankScreen() {
  const router = useRouter();
  const [sections, setSections] = useState<QuestionBankNode[]>(fallbackQuestionBankRoots);
  const [loading, setLoading] = useState(true);
  const [isOffline, setIsOffline] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const { data, fromCache } = await fetchWithCache<QuestionBankNode[]>(
        'question-bank-roots',
        () => api.get<QuestionBankNode[]>('/question-bank'),
      );
      setSections(data);
      setIsOffline(fromCache);
    } catch (err) {
      console.error('Question bank load failed:', err);
      setSections(fallbackQuestionBankRoots);
      setIsOffline(true);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingState}>
          <ActivityIndicator color={COLORS.primary} />
          <Text style={styles.loadingText}>Loading Question Bank & Notes...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.heroCard}>
          <View style={styles.heroIconWrap}>
            <Ionicons name="bookmarks" size={28} color={COLORS.primaryDark} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.heroTitle}>Question Bank & Notes</Text>
            <Text style={styles.heroDesc}>
              Browse academic resources by level, board, program, semester, and subject.
            </Text>
          </View>
        </View>

        {isOffline && (
          <View style={styles.offlineBadge}>
            <Ionicons name="cloud-offline" size={14} color={COLORS.streakAccent} />
            <Text style={styles.offlineText}>Showing cached/offline data</Text>
          </View>
        )}

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Browse categories</Text>
          <Text style={styles.sectionSubtitle}>Tap any category to expand its subcategories.</Text>
        </View>

        {sections.map((section) => {
          const previewTitles = getChildPreviewTitles(section);
          return (
            <TouchableOpacity
              key={section.id}
              testID={`question-bank-root-${section.id}`}
              style={styles.sectionCard}
              onPress={() => router.push(`/question-bank/${section.id}`)}
            >
              <View style={styles.sectionIconWrap}>
                <Ionicons name={section.icon as any} size={24} color={COLORS.primaryDark} />
              </View>
              <View style={styles.sectionInfo}>
                <View style={styles.sectionRow}>
                  <Text style={styles.sectionName}>{section.title}</Text>
                  <Text style={styles.sectionCount}>{section.children?.length || 0} groups</Text>
                </View>
                <Text style={styles.sectionDesc} numberOfLines={2}>
                  {section.description}
                </Text>
                <View style={styles.previewRow}>
                  {previewTitles.map((title) => (
                    <View key={title} style={styles.previewChip}>
                      <Text style={styles.previewChipText}>{title}</Text>
                    </View>
                  ))}
                </View>
              </View>
              <Ionicons name="chevron-forward" size={22} color={COLORS.border} />
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  scroll: { padding: SPACING.lg, paddingBottom: 110 },
  loadingState: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: SPACING.md },
  loadingText: { color: COLORS.textSecondary, fontSize: 14, fontWeight: '700' },
  heroCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.xl,
    padding: SPACING.lg,
    borderWidth: 2,
    borderColor: COLORS.border,
    ...SHADOWS.sm,
  },
  heroIconWrap: {
    width: 56,
    height: 56,
    borderRadius: RADIUS.lg,
    backgroundColor: COLORS.primaryLight,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: SPACING.md,
  },
  heroTitle: { fontSize: 22, fontWeight: '900', color: COLORS.textPrimary },
  heroDesc: { fontSize: 13, color: COLORS.textSecondary, marginTop: 4, lineHeight: 18 },
  offlineBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 6,
    backgroundColor: COLORS.streakLight,
    borderRadius: RADIUS.full,
    paddingHorizontal: 10,
    paddingVertical: 6,
    marginTop: SPACING.md,
  },
  offlineText: { color: COLORS.streakAccent, fontSize: 11, fontWeight: '800' },
  sectionHeader: { marginTop: SPACING.lg, marginBottom: SPACING.sm },
  sectionTitle: { fontSize: 18, fontWeight: '800', color: COLORS.textPrimary },
  sectionSubtitle: { fontSize: 13, color: COLORS.textSecondary, marginTop: 4 },
  sectionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.xl,
    padding: SPACING.md,
    marginBottom: SPACING.md,
    borderWidth: 2,
    borderColor: COLORS.border,
    ...SHADOWS.sm,
  },
  sectionIconWrap: {
    width: 48,
    height: 48,
    borderRadius: RADIUS.lg,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.primaryLight,
  },
  sectionInfo: { flex: 1, marginLeft: SPACING.md, marginRight: SPACING.sm },
  sectionRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  sectionName: { fontSize: 16, fontWeight: '800', color: COLORS.textPrimary, flex: 1, marginRight: SPACING.sm },
  sectionCount: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.primaryDark,
    backgroundColor: COLORS.primaryLight,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: RADIUS.full,
  },
  sectionDesc: { fontSize: 13, color: COLORS.textSecondary, marginTop: 4, lineHeight: 18 },
  previewRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 10 },
  previewChip: {
    backgroundColor: COLORS.secondaryLight,
    borderRadius: RADIUS.full,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  previewChipText: { fontSize: 11, fontWeight: '700', color: COLORS.secondaryDark },
});

