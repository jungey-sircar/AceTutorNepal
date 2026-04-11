import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { api } from '../_lib/api';
import { COLORS, SPACING, RADIUS, SHADOWS } from '../_lib/theme';

export default function SubjectDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [subject, setSubject] = useState<any>(null);
  const [chapters, setChapters] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, [id]);

  const loadData = async () => {
    try {
      const [subData, chData] = await Promise.all([
        api.get(`/subjects/${id}`),
        api.get<any[]>(`/chapters?subject_id=${id}`),
      ]);
      setSubject(subData);
      setChapters(chData);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  const startChapterPractice = async (chapterId: string) => {
    try {
      const questions = await api.get<any[]>(`/questions?chapter_id=${chapterId}&limit=10`);
      if (questions.length === 0) {
        alert('No questions available for this chapter yet.');
        return;
      }
      router.push({
        pathname: '/quiz',
        params: { questions: JSON.stringify(questions), subjectId: id || '', difficulty: 'all' },
      });
    } catch (err: any) {
      alert(err.message);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <ActivityIndicator color={COLORS.primary} style={{ marginTop: 100 }} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity testID="back-btn" onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color={COLORS.textPrimary} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>{subject?.name || 'Subject'}</Text>
          <Text style={styles.headerDesc}>{subject?.description || ''}</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.sectionLabel}>CHAPTERS</Text>
        {chapters.map((chapter, idx) => (
          <View key={chapter.chapter_id} style={styles.chapterCard}>
            <View style={styles.chapterNumber}>
              <Text style={styles.chapterNumText}>{idx + 1}</Text>
            </View>
            <View style={styles.chapterContent}>
              <Text style={styles.chapterName}>{chapter.name}</Text>
              <Text style={styles.chapterDesc} numberOfLines={2}>{chapter.description}</Text>
              <View style={styles.chapterActions}>
                <TouchableOpacity
                  testID={`chapter-detail-${chapter.chapter_id}`}
                  style={styles.chapterBtn}
                  onPress={() => router.push(`/chapter/${chapter.chapter_id}`)}
                >
                  <Ionicons name="book" size={16} color={COLORS.primary} />
                  <Text style={styles.chapterBtnText}>Study</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  testID={`chapter-practice-${chapter.chapter_id}`}
                  style={[styles.chapterBtn, styles.practiceBtn]}
                  onPress={() => startChapterPractice(chapter.chapter_id)}
                >
                  <Ionicons name="play" size={16} color="#fff" />
                  <Text style={[styles.chapterBtnText, { color: '#fff' }]}>Practice</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  header: {
    flexDirection: 'row', alignItems: 'center', paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md, borderBottomWidth: 2, borderBottomColor: COLORS.border,
    backgroundColor: COLORS.surface,
  },
  backBtn: { width: 40, height: 40, justifyContent: 'center', alignItems: 'center', marginRight: SPACING.sm },
  headerTitle: { fontSize: 20, fontWeight: '800', color: COLORS.textPrimary },
  headerDesc: { fontSize: 13, color: COLORS.textSecondary, marginTop: 2 },
  scroll: { padding: SPACING.lg, paddingBottom: 100 },
  sectionLabel: { fontSize: 12, fontWeight: '800', color: COLORS.textSecondary, letterSpacing: 1.5, marginBottom: SPACING.md },
  chapterCard: {
    flexDirection: 'row', backgroundColor: COLORS.surface, borderRadius: RADIUS.xl,
    padding: SPACING.md, marginBottom: SPACING.md, borderWidth: 2, borderColor: COLORS.border, ...SHADOWS.sm,
  },
  chapterNumber: {
    width: 40, height: 40, borderRadius: RADIUS.full, backgroundColor: COLORS.primaryLight,
    justifyContent: 'center', alignItems: 'center', marginRight: SPACING.md,
  },
  chapterNumText: { fontWeight: '900', fontSize: 16, color: COLORS.primaryDark },
  chapterContent: { flex: 1 },
  chapterName: { fontSize: 16, fontWeight: '700', color: COLORS.textPrimary },
  chapterDesc: { fontSize: 13, color: COLORS.textSecondary, marginTop: 4, lineHeight: 18 },
  chapterActions: { flexDirection: 'row', gap: SPACING.sm, marginTop: SPACING.md },
  chapterBtn: {
    flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 8,
    borderRadius: RADIUS.full, borderWidth: 2, borderColor: COLORS.primary, gap: 4,
  },
  chapterBtnText: { fontWeight: '700', fontSize: 13, color: COLORS.primary },
  practiceBtn: { backgroundColor: COLORS.primary, borderColor: COLORS.primaryDark },
});
