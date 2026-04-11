import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { api } from '../_lib/api';
import { COLORS, SPACING, RADIUS, SHADOWS } from '../_lib/theme';

export default function ChapterDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [chapter, setChapter] = useState<any>(null);
  const [questions, setQuestions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedQ, setExpandedQ] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, [id]);

  const loadData = async () => {
    try {
      const [chData, qData] = await Promise.all([
        api.get(`/chapters/${id}`),
        api.get<any[]>(`/questions?chapter_id=${id}&limit=20`),
      ]);
      setChapter(chData);
      setQuestions(qData);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  const startPractice = () => {
    if (questions.length === 0) {
      alert('No questions available.');
      return;
    }
    router.push({
      pathname: '/quiz',
      params: { questions: JSON.stringify(questions), subjectId: chapter?.subject_id || '', difficulty: 'all' },
    });
  };

  if (loading) {
    return <SafeAreaView style={styles.container}><ActivityIndicator color={COLORS.primary} style={{ marginTop: 100 }} /></SafeAreaView>;
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity testID="back-btn" onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color={COLORS.textPrimary} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>{chapter?.name || 'Chapter'}</Text>
          <Text style={styles.headerDesc}>{chapter?.description || ''}</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>
        {/* Practice Button */}
        <TouchableOpacity testID="start-chapter-practice" style={styles.practiceCard} onPress={startPractice}>
          <View style={styles.practiceBadge}>
            <Ionicons name="play-circle" size={32} color="#fff" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.practiceTitle}>Practice this chapter</Text>
            <Text style={styles.practiceDesc}>{questions.length} questions available</Text>
          </View>
          <Ionicons name="arrow-forward-circle" size={28} color="#fff" />
        </TouchableOpacity>

        {/* Study Mode - Questions */}
        <Text style={styles.sectionLabel}>STUDY MODE</Text>
        <Text style={styles.studyHint}>Tap a question to see the answer and explanation</Text>

        {questions.map((q, idx) => (
          <TouchableOpacity
            key={q.question_id}
            testID={`study-question-${idx}`}
            style={styles.questionCard}
            onPress={() => setExpandedQ(expandedQ === q.question_id ? null : q.question_id)}
          >
            <View style={styles.questionHeader}>
              <View style={styles.qBadge}>
                <Text style={styles.qBadgeText}>Q{idx + 1}</Text>
              </View>
              <Text style={styles.questionText}>{q.text}</Text>
            </View>

            {/* Options */}
            {q.options?.map((opt: string, i: number) => (
              <View key={i} style={[
                styles.optionRow,
                expandedQ === q.question_id && i === q.correct_answer && styles.correctOption,
              ]}>
                <Text style={styles.optionLetter}>{String.fromCharCode(65 + i)}</Text>
                <Text style={[
                  styles.optionText,
                  expandedQ === q.question_id && i === q.correct_answer && styles.correctOptionText,
                ]}>{opt}</Text>
              </View>
            ))}

            {/* Explanation */}
            {expandedQ === q.question_id && q.explanation && (
              <View style={styles.explanationBox}>
                <Ionicons name="bulb" size={18} color={COLORS.streakAccent} />
                <Text style={styles.explanationText}>{q.explanation}</Text>
              </View>
            )}
          </TouchableOpacity>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  header: {
    flexDirection: 'row', alignItems: 'center', paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md, borderBottomWidth: 2, borderBottomColor: COLORS.border, backgroundColor: COLORS.surface,
  },
  backBtn: { width: 40, height: 40, justifyContent: 'center', alignItems: 'center', marginRight: SPACING.sm },
  headerTitle: { fontSize: 20, fontWeight: '800', color: COLORS.textPrimary },
  headerDesc: { fontSize: 13, color: COLORS.textSecondary, marginTop: 2 },
  scroll: { padding: SPACING.lg, paddingBottom: 100 },
  practiceCard: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.primary,
    borderRadius: RADIUS.xl, padding: SPACING.lg, marginBottom: SPACING.lg,
    borderBottomWidth: 4, borderBottomColor: COLORS.primaryDark,
  },
  practiceBadge: { marginRight: SPACING.md },
  practiceTitle: { fontSize: 17, fontWeight: '800', color: '#fff' },
  practiceDesc: { fontSize: 13, color: '#fff', opacity: 0.8, marginTop: 2 },
  sectionLabel: { fontSize: 12, fontWeight: '800', color: COLORS.textSecondary, letterSpacing: 1.5, marginBottom: SPACING.xs },
  studyHint: { fontSize: 13, color: COLORS.textSecondary, marginBottom: SPACING.md },
  questionCard: {
    backgroundColor: COLORS.surface, borderRadius: RADIUS.xl, padding: SPACING.md,
    marginBottom: SPACING.md, borderWidth: 2, borderColor: COLORS.border,
  },
  questionHeader: { flexDirection: 'row', marginBottom: SPACING.sm },
  qBadge: {
    width: 32, height: 32, borderRadius: RADIUS.full, backgroundColor: COLORS.primaryLight,
    justifyContent: 'center', alignItems: 'center', marginRight: SPACING.sm,
  },
  qBadgeText: { fontWeight: '800', fontSize: 12, color: COLORS.primaryDark },
  questionText: { flex: 1, fontSize: 15, fontWeight: '600', color: COLORS.textPrimary, lineHeight: 22 },
  optionRow: {
    flexDirection: 'row', alignItems: 'center', paddingVertical: 8, paddingHorizontal: SPACING.sm,
    borderRadius: RADIUS.md, marginBottom: 4,
  },
  correctOption: { backgroundColor: COLORS.successLight },
  optionLetter: { fontWeight: '800', fontSize: 14, color: COLORS.textSecondary, width: 24 },
  optionText: { fontSize: 14, color: COLORS.textPrimary, flex: 1 },
  correctOptionText: { color: COLORS.secondaryDark, fontWeight: '700' },
  explanationBox: {
    flexDirection: 'row', backgroundColor: COLORS.streakLight, borderRadius: RADIUS.lg,
    padding: SPACING.md, marginTop: SPACING.sm, gap: SPACING.sm,
  },
  explanationText: { flex: 1, fontSize: 13, color: COLORS.textPrimary, lineHeight: 20 },
});
