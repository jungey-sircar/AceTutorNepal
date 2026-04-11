import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useAuthStore } from '../_lib/store';
import { api } from '../_lib/api';
import { COLORS, SPACING, RADIUS, SHADOWS } from '../_lib/theme';

export default function SubjectsScreen() {
  const { user } = useAuthStore();
  const router = useRouter();
  const [exams, setExams] = useState<any[]>([]);
  const [selectedExam, setSelectedExam] = useState<string>('');
  const [subjects, setSubjects] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadExams();
  }, []);

  useEffect(() => {
    if (selectedExam) loadSubjects(selectedExam);
  }, [selectedExam]);

  const loadExams = async () => {
    try {
      const data = await api.get<any[]>('/exams');
      setExams(data);
      const userExam = (user?.exam_type || 'SEE').toLowerCase();
      const match = data.find((e: any) => e.exam_id === userExam);
      setSelectedExam(match ? match.exam_id : data[0]?.exam_id || '');
    } catch (err) { console.error(err); }
  };

  const loadSubjects = async (examId: string) => {
    setLoading(true);
    try {
      const data = await api.get<any[]>(`/subjects?exam_id=${examId}`);
      setSubjects(data);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Subjects</Text>
        <Text style={styles.subtitle}>Choose your exam and explore subjects</Text>
      </View>

      {/* Exam Selector */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.examScroll} contentContainerStyle={styles.examScrollContent}>
        {exams.map((exam) => (
          <TouchableOpacity
            key={exam.exam_id}
            testID={`exam-filter-${exam.exam_id}`}
            style={[styles.examPill, selectedExam === exam.exam_id && styles.examPillActive]}
            onPress={() => setSelectedExam(exam.exam_id)}
          >
            <Ionicons name={(exam.icon || 'school') as any} size={18}
              color={selectedExam === exam.exam_id ? '#fff' : COLORS.textSecondary} />
            <Text style={[styles.examPillText, selectedExam === exam.exam_id && styles.examPillTextActive]}>
              {exam.name}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Subject List */}
      <ScrollView contentContainerStyle={styles.subjectList}>
        {loading ? (
          <ActivityIndicator color={COLORS.primary} style={{ marginTop: SPACING.xxl }} />
        ) : subjects.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="book-outline" size={48} color={COLORS.textSecondary} />
            <Text style={styles.emptyText}>No subjects available for this exam yet</Text>
          </View>
        ) : (
          subjects.map((subject, idx) => (
            <TouchableOpacity
              key={subject.subject_id}
              testID={`subject-item-${subject.subject_id}`}
              style={styles.subjectCard}
              onPress={() => router.push(`/subject/${subject.subject_id}`)}
            >
              <View style={[styles.subjectIconWrap, { backgroundColor: (subject.color || COLORS.primary) + '20' }]}>
                <Ionicons name={(subject.icon || 'book') as any} size={28} color={subject.color || COLORS.primary} />
              </View>
              <View style={styles.subjectInfo}>
                <Text style={styles.subjectName}>{subject.name}</Text>
                <Text style={styles.subjectDesc} numberOfLines={2}>{subject.description}</Text>
                <View style={styles.subjectMeta}>
                  <Ionicons name="layers" size={14} color={COLORS.textSecondary} />
                  <Text style={styles.chapterCount}>{subject.chapter_count || 0} chapters</Text>
                </View>
              </View>
              <Ionicons name="chevron-forward" size={22} color={COLORS.border} />
            </TouchableOpacity>
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  header: { paddingHorizontal: SPACING.lg, paddingTop: SPACING.lg },
  title: { fontSize: 28, fontWeight: '900', color: COLORS.textPrimary },
  subtitle: { fontSize: 14, color: COLORS.textSecondary, marginTop: 4 },
  examScroll: { maxHeight: 60, marginTop: SPACING.md },
  examScrollContent: { paddingHorizontal: SPACING.lg, gap: SPACING.sm },
  examPill: {
    flexDirection: 'row', alignItems: 'center', paddingHorizontal: SPACING.md, paddingVertical: 10,
    borderRadius: RADIUS.full, borderWidth: 2, borderColor: COLORS.border, backgroundColor: COLORS.surface,
    gap: 6,
  },
  examPillActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primaryDark },
  examPillText: { fontWeight: '700', fontSize: 13, color: COLORS.textSecondary },
  examPillTextActive: { color: '#fff' },
  subjectList: { padding: SPACING.lg, paddingBottom: 100 },
  subjectCard: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.surface,
    borderRadius: RADIUS.xl, padding: SPACING.lg, marginBottom: SPACING.md,
    borderWidth: 2, borderColor: COLORS.border, ...SHADOWS.sm,
  },
  subjectIconWrap: { width: 56, height: 56, borderRadius: RADIUS.lg, justifyContent: 'center', alignItems: 'center' },
  subjectInfo: { flex: 1, marginLeft: SPACING.md },
  subjectName: { fontSize: 17, fontWeight: '800', color: COLORS.textPrimary },
  subjectDesc: { fontSize: 13, color: COLORS.textSecondary, marginTop: 4, lineHeight: 18 },
  subjectMeta: { flexDirection: 'row', alignItems: 'center', marginTop: 8, gap: 4 },
  chapterCount: { fontSize: 12, fontWeight: '600', color: COLORS.textSecondary },
  emptyState: { alignItems: 'center', marginTop: SPACING.xxl },
  emptyText: { color: COLORS.textSecondary, marginTop: SPACING.md, fontSize: 15 },
});
