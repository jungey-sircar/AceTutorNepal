import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { api } from '../_lib/api';
import { fetchWithCache } from '../_lib/cache';
import { COLORS, SPACING, RADIUS, SHADOWS } from '../_lib/theme';
import { getQuestionBankNode, QuestionBankNode } from '../_lib/questionBank';
import ResourcesViewer from '../_lib/ResourcesViewer';

interface QuestionBankDetailResponse {
  node: QuestionBankNode;
  breadcrumbs: QuestionBankNode[];
}

interface ViewerTab {
  key: 'overview' | 'resources';
  label: string;
}

export default function QuestionBankNodeScreen() {
  const { node } = useLocalSearchParams<{ node: string }>();
  const router = useRouter();
  const [currentNode, setCurrentNode] = useState<QuestionBankNode | null>(null);
  const [breadcrumbs, setBreadcrumbs] = useState<QuestionBankNode[]>([]);
  const [loading, setLoading] = useState(true);
  const [isOffline, setIsOffline] = useState(false);
  const [activeTab, setActiveTab] = useState<'overview' | 'resources'>('overview');

  useEffect(() => {
    if (node) {
      loadData(node);
    }
  }, [node]);

  const loadData = async (nodeId: string) => {
    setLoading(true);
    try {
      const { data, fromCache } = await fetchWithCache<QuestionBankDetailResponse>(
        `question-bank-node-${nodeId}`,
        () => api.get<QuestionBankDetailResponse>(`/question-bank/${nodeId}`),
      );
      setCurrentNode(data.node);
      setBreadcrumbs(data.breadcrumbs);
      setIsOffline(fromCache);
    } catch (err) {
      console.error('Question bank node load failed:', err);
      const local = getQuestionBankNode(nodeId);
      if (local) {
        setCurrentNode(local.node);
        setBreadcrumbs(local.breadcrumbs);
        setIsOffline(true);
      } else {
        setCurrentNode(null);
        setBreadcrumbs([]);
      }
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingState}>
          <ActivityIndicator color={COLORS.primary} />
          <Text style={styles.loadingText}>Loading category...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!currentNode) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.errorState}>
          <Ionicons name="alert-circle" size={44} color={COLORS.error} />
          <Text style={styles.errorTitle}>Category not found</Text>
          <Text style={styles.errorDesc}>
            The selected question bank category could not be loaded.
          </Text>
          <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={18} color="#fff" />
            <Text style={styles.backButtonText}>Go back</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const childCount = currentNode.children?.length || 0;
  const questionCount = currentNode.questionCount ?? Math.max(childCount * 12, 0);
  const noteCount = currentNode.noteCount ?? Math.max(childCount * 2, 0);
  const isLeaf = childCount === 0;

  const resourceCards = [
    {
      title: 'Question Bank',
      description: 'Past questions, practice sets, and focused revision material.',
      icon: 'help-circle',
      count: questionCount,
      accent: COLORS.primaryLight,
      color: COLORS.primaryDark,
    },
    {
      title: 'Notes',
      description: 'Short notes, formulas, and chapter summaries for quick revision.',
      icon: 'document-text',
      count: noteCount,
      accent: COLORS.secondaryLight,
      color: COLORS.secondaryDark,
    },
  ];

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity testID="back-btn" onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color={COLORS.textPrimary} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>{currentNode.title}</Text>
          <Text style={styles.headerDesc}>{currentNode.description}</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>
        {isOffline && (
          <View style={styles.offlineBadge}>
            <Ionicons name="cloud-offline" size={14} color={COLORS.streakAccent} />
            <Text style={styles.offlineText}>Showing cached/offline data</Text>
          </View>
        )}

        <View style={styles.breadcrumbRow}>
          {breadcrumbs.map((item, index) => (
            <View key={item.id} style={styles.breadcrumbChip}>
              <Text style={styles.breadcrumbText} numberOfLines={1}>
                {item.title}
              </Text>
              {index < breadcrumbs.length - 1 && (
                <Ionicons name="chevron-forward" size={12} color={COLORS.textSecondary} style={{ marginLeft: 4 }} />
              )}
            </View>
          ))}
        </View>

        <View style={styles.heroCard}>
          <View style={[styles.heroIconWrap, { backgroundColor: COLORS.primaryLight }]}>
            <Ionicons name={currentNode.icon as any} size={28} color={COLORS.primaryDark} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.heroTitle}>{currentNode.title}</Text>
            <Text style={styles.heroDesc}>{currentNode.description}</Text>
          </View>
        </View>

        <View style={styles.statsRow}>
          <View style={styles.statCard}>
            <Text style={styles.statNumber}>{childCount}</Text>
            <Text style={styles.statLabel}>{isLeaf ? 'Subsections' : 'Subcategories'}</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statNumber}>{questionCount}</Text>
            <Text style={styles.statLabel}>Questions</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statNumber}>{noteCount}</Text>
            <Text style={styles.statLabel}>Notes</Text>
          </View>
        </View>

        {childCount > 0 && (
          <>
            <Text style={styles.sectionTitle}>Subcategories</Text>
            {currentNode.children?.map((child) => (
              <TouchableOpacity
                key={child.id}
                testID={`question-bank-child-${child.id}`}
                style={styles.childCard}
                onPress={() => router.push(`/question-bank/${child.id}`)}
              >
                <View style={styles.childIconWrap}>
                  <Ionicons name={child.icon as any} size={22} color={COLORS.primaryDark} />
                </View>
                <View style={styles.childInfo}>
                  <Text style={styles.childTitle}>{child.title}</Text>
                  <Text style={styles.childDesc} numberOfLines={2}>{child.description}</Text>
                  <Text style={styles.childMeta}>
                    {child.children?.length ? `${child.children.length} deeper categories` : `${child.questionCount || 0} questions • ${child.noteCount || 0} notes`}
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color={COLORS.border} />
              </TouchableOpacity>
            ))}
          </>
        )}

        <Text style={styles.sectionTitle}>{isLeaf ? 'Available resources' : 'Resource types'}</Text>
        {resourceCards.map((item) => (
          <View key={item.title} style={[styles.resourceCard, { backgroundColor: item.accent }]}>
            <View style={styles.resourceIconWrap}>
              <Ionicons name={item.icon as any} size={24} color={item.color} />
            </View>
            <View style={{ flex: 1, marginHorizontal: SPACING.md }}>
              <View style={styles.resourceHeader}>
                <Text style={styles.resourceTitle}>{item.title}</Text>
                <Text style={styles.resourceCount}>{item.count}</Text>
              </View>
              <Text style={styles.resourceDesc}>{item.description}</Text>
            </View>
          </View>
        ))}

        <View style={styles.noteCard}>
          <Ionicons name="sparkles" size={20} color={COLORS.streakAccent} />
          <Text style={styles.noteText}>
            This hierarchy is expandable, so new programs, semesters, and subjects can be added without changing the browsing flow.
          </Text>
        </View>

            <View style={styles.tabsRow}>
              <TouchableOpacity
                style={[styles.tabBtn, activeTab === 'overview' && styles.tabBtnActive]}
                onPress={() => setActiveTab('overview')}
              >
                <Text style={[styles.tabBtnText, activeTab === 'overview' && styles.tabBtnTextActive]}>
                  Overview
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.tabBtn, activeTab === 'resources' && styles.tabBtnActive]}
                onPress={() => setActiveTab('resources')}
              >
                <Text style={[styles.tabBtnText, activeTab === 'resources' && styles.tabBtnTextActive]}>
                  Resources
                </Text>
              </TouchableOpacity>
            </View>

            {activeTab === 'resources' && currentNode && (
              <ResourcesViewer nodeId={currentNode.id} nodeName={currentNode.title} />
            )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  loadingState: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: SPACING.md },
  loadingText: { color: COLORS.textSecondary, fontSize: 14, fontWeight: '700' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    borderBottomWidth: 2,
    borderBottomColor: COLORS.border,
    backgroundColor: COLORS.surface,
  },
  backBtn: { width: 40, height: 40, justifyContent: 'center', alignItems: 'center', marginRight: SPACING.sm },
  headerTitle: { fontSize: 20, fontWeight: '800', color: COLORS.textPrimary },
  headerDesc: { fontSize: 13, color: COLORS.textSecondary, marginTop: 2, lineHeight: 18 },
  scroll: { padding: SPACING.lg, paddingBottom: 110 },
  offlineBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 6,
    backgroundColor: COLORS.streakLight,
    borderRadius: RADIUS.full,
    paddingHorizontal: 10,
    paddingVertical: 6,
    marginBottom: SPACING.md,
  },
  offlineText: { color: COLORS.streakAccent, fontSize: 11, fontWeight: '800' },
  breadcrumbRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: SPACING.md },
  breadcrumbChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.full,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  breadcrumbText: { fontSize: 11, fontWeight: '700', color: COLORS.textSecondary, maxWidth: 120 },
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
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: SPACING.md,
  },
  heroTitle: { fontSize: 22, fontWeight: '900', color: COLORS.textPrimary },
  heroDesc: { fontSize: 13, color: COLORS.textSecondary, marginTop: 4, lineHeight: 18 },
  statsRow: { flexDirection: 'row', gap: SPACING.sm, marginTop: SPACING.md, marginBottom: SPACING.lg },
  statCard: {
    flex: 1,
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.xl,
    paddingVertical: SPACING.md,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: COLORS.border,
    ...SHADOWS.sm,
  },
  statNumber: { fontSize: 22, fontWeight: '900', color: COLORS.textPrimary },
  statLabel: { fontSize: 11, fontWeight: '700', color: COLORS.textSecondary, marginTop: 2, textTransform: 'uppercase' },
  sectionTitle: { fontSize: 18, fontWeight: '800', color: COLORS.textPrimary, marginBottom: SPACING.md },
  childCard: {
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
  childIconWrap: {
    width: 48,
    height: 48,
    borderRadius: RADIUS.lg,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.primaryLight,
  },
  childInfo: { flex: 1, marginLeft: SPACING.md, marginRight: SPACING.sm },
  childTitle: { fontSize: 16, fontWeight: '800', color: COLORS.textPrimary },
  childDesc: { fontSize: 13, color: COLORS.textSecondary, marginTop: 4, lineHeight: 18 },
  childMeta: { fontSize: 11, fontWeight: '700', color: COLORS.primaryDark, marginTop: 6 },
  resourceCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: RADIUS.xl,
    padding: SPACING.md,
    marginBottom: SPACING.md,
    borderWidth: 2,
    borderColor: COLORS.border,
  },
  resourceIconWrap: {
    width: 46,
    height: 46,
    borderRadius: RADIUS.lg,
    backgroundColor: COLORS.surface,
    justifyContent: 'center',
    alignItems: 'center',
  },
  resourceHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  resourceTitle: { fontSize: 15, fontWeight: '800', color: COLORS.textPrimary },
  resourceCount: {
    fontSize: 11,
    fontWeight: '800',
    color: COLORS.primaryDark,
    backgroundColor: COLORS.surface,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: RADIUS.full,
  },
  resourceDesc: { fontSize: 13, color: COLORS.textSecondary, marginTop: 4, lineHeight: 18 },
  noteCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    backgroundColor: COLORS.streakLight,
    borderRadius: RADIUS.xl,
    padding: SPACING.md,
    borderWidth: 1,
    borderColor: '#FCD34D',
  },
  noteText: { flex: 1, fontSize: 13, color: COLORS.textPrimary, lineHeight: 19 },
  errorState: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: SPACING.lg },
  errorTitle: { fontSize: 22, fontWeight: '900', color: COLORS.textPrimary, marginTop: SPACING.md },
  errorDesc: { fontSize: 14, color: COLORS.textSecondary, textAlign: 'center', marginTop: 6, lineHeight: 20 },
  tabsRow: { flexDirection: 'row', gap: SPACING.sm, marginTop: SPACING.lg, marginBottom: SPACING.md },
  tabBtn: {
    flex: 1,
    paddingVertical: SPACING.md,
    borderRadius: RADIUS.lg,
    backgroundColor: COLORS.surface,
    borderWidth: 2,
    borderColor: COLORS.border,
    alignItems: 'center',
  },
  tabBtnActive: { borderColor: COLORS.primary, backgroundColor: COLORS.primaryLight },
  tabBtnText: { fontSize: 13, fontWeight: '800', color: COLORS.textSecondary },
  tabBtnTextActive: { color: COLORS.primary },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: SPACING.lg,
    backgroundColor: COLORS.primary,
    borderRadius: RADIUS.full,
    paddingHorizontal: 18,
    paddingVertical: 10,
  },
  backButtonText: { fontSize: 13, fontWeight: '800', color: '#fff' },
});


