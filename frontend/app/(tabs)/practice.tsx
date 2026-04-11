import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useAuthStore } from '../_lib/store';
import { api } from '../_lib/api';
import { COLORS, SPACING, RADIUS, SHADOWS } from '../_lib/theme';

export default function PracticeScreen() {
  const { user } = useAuthStore();
  const router = useRouter();
  const [subjects, setSubjects] = useState<any[]>([]);
  const [selectedSubject, setSelectedSubject] = useState<string>('');
  const [difficulty, setDifficulty] = useState<string>('medium');
  const [questionCount, setQuestionCount] = useState(10);
  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState(false);

  useEffect(() => {
    loadSubjects();
  }, []);

  const loadSubjects = async () => {
    try {
      const examId = (user?.exam_type || 'SEE').toLowerCase();
      const data = await api.get<any[]>(`/subjects?exam_id=${examId}`);
      setSubjects(data);
      if (data.length > 0) setSelectedSubject(data[0].subject_id);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  const startPractice = async () => {
    if (!selectedSubject) {
      Alert.alert('Select Subject', 'Please select a subject to practice');
      return;
    }
    setStarting(true);
    try {
      const questions = await api.get<any[]>(
        `/questions?subject_id=${selectedSubject}&difficulty=${difficulty}&limit=${questionCount}`
      );
      if (questions.length === 0) {
        Alert.alert('No Questions', 'No questions available for this selection. Try a different difficulty.');
        return;
      }
      router.push({
        pathname: '/quiz',
        params: {
          questions: JSON.stringify(questions),
          subjectId: selectedSubject,
          difficulty,
        },
      });
    } catch (err: any) {
      Alert.alert('Error', err.message);
    } finally {
      setStarting(false);
    }
  };

  const difficulties = [
    { id: 'easy', label: 'Easy', color: COLORS.secondary, icon: 'happy' },
    { id: 'medium', label: 'Medium', color: COLORS.streakAccent, icon: 'flash' },
    { id: 'hard', label: 'Hard', color: COLORS.error, icon: 'flame' },
  ];

  const counts = [5, 10, 15, 20];

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.title}>Practice</Text>
        <Text style={styles.subtitle}>Customize your practice session</Text>

        {/* Subject Selection */}
        <Text style={styles.sectionLabel}>SELECT SUBJECT</Text>
        {loading ? (
          <ActivityIndicator color={COLORS.primary} />
        ) : (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.horizontalScroll}>
            {subjects.map((sub) => (
              <TouchableOpacity
                key={sub.subject_id}
                testID={`practice-subject-${sub.subject_id}`}
                style={[styles.subjectChip, selectedSubject === sub.subject_id && styles.subjectChipActive]}
                onPress={() => setSelectedSubject(sub.subject_id)}
              >
                <Ionicons name={(sub.icon || 'book') as any} size={18}
                  color={selectedSubject === sub.subject_id ? '#fff' : sub.color || COLORS.textSecondary} />
                <Text style={[styles.subjectChipText, selectedSubject === sub.subject_id && styles.subjectChipTextActive]}>
                  {sub.name}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        )}

        {/* Difficulty */}
        <Text style={styles.sectionLabel}>DIFFICULTY</Text>
        <View style={styles.difficultyRow}>
          {difficulties.map((d) => (
            <TouchableOpacity
              key={d.id}
              testID={`difficulty-${d.id}`}
              style={[styles.difficultyCard, difficulty === d.id && { borderColor: d.color, backgroundColor: d.color + '15' }]}
              onPress={() => setDifficulty(d.id)}
            >
              <Ionicons name={d.icon as any} size={24} color={difficulty === d.id ? d.color : COLORS.textSecondary} />
              <Text style={[styles.difficultyText, difficulty === d.id && { color: d.color }]}>{d.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Question Count */}
        <Text style={styles.sectionLabel}>NUMBER OF QUESTIONS</Text>
        <View style={styles.countRow}>
          {counts.map((c) => (
            <TouchableOpacity
              key={c}
              testID={`count-${c}`}
              style={[styles.countChip, questionCount === c && styles.countChipActive]}
              onPress={() => setQuestionCount(c)}
            >
              <Text style={[styles.countText, questionCount === c && styles.countTextActive]}>{c}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Start Button */}
        <TouchableOpacity
          testID="start-practice-btn"
          style={[styles.startBtn, starting && styles.disabledBtn]}
          onPress={startPractice}
          disabled={starting}
        >
          {starting ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <>
              <Ionicons name="play" size={22} color="#fff" />
              <Text style={styles.startBtnText}>Start Practice</Text>
            </>
          )}
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  scroll: { padding: SPACING.lg, paddingBottom: 100 },
  title: { fontSize: 28, fontWeight: '900', color: COLORS.textPrimary },
  subtitle: { fontSize: 14, color: COLORS.textSecondary, marginTop: 4, marginBottom: SPACING.lg },
  sectionLabel: { fontSize: 12, fontWeight: '800', color: COLORS.textSecondary, letterSpacing: 1.5, marginTop: SPACING.lg, marginBottom: SPACING.md },
  horizontalScroll: { flexDirection: 'row' },
  subjectChip: {
    flexDirection: 'row', alignItems: 'center', paddingHorizontal: SPACING.md, paddingVertical: 12,
    borderRadius: RADIUS.xl, borderWidth: 2, borderColor: COLORS.border, backgroundColor: COLORS.surface,
    marginRight: SPACING.sm, gap: 6,
  },
  subjectChipActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primaryDark },
  subjectChipText: { fontWeight: '700', fontSize: 14, color: COLORS.textSecondary },
  subjectChipTextActive: { color: '#fff' },
  difficultyRow: { flexDirection: 'row', gap: SPACING.sm },
  difficultyCard: {
    flex: 1, alignItems: 'center', padding: SPACING.md, borderRadius: RADIUS.xl,
    borderWidth: 2, borderColor: COLORS.border, backgroundColor: COLORS.surface, borderBottomWidth: 4,
  },
  difficultyText: { fontWeight: '700', fontSize: 13, color: COLORS.textSecondary, marginTop: 6 },
  countRow: { flexDirection: 'row', gap: SPACING.sm },
  countChip: {
    flex: 1, alignItems: 'center', paddingVertical: 14, borderRadius: RADIUS.xl,
    borderWidth: 2, borderColor: COLORS.border, backgroundColor: COLORS.surface,
  },
  countChipActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primaryDark },
  countText: { fontWeight: '800', fontSize: 16, color: COLORS.textSecondary },
  countTextActive: { color: '#fff' },
  startBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    backgroundColor: COLORS.primary, borderRadius: RADIUS.xl, paddingVertical: 18,
    marginTop: SPACING.xl, borderBottomWidth: 4, borderBottomColor: COLORS.primaryDark, gap: SPACING.sm,
  },
  disabledBtn: { opacity: 0.7 },
  startBtnText: { color: '#fff', fontWeight: '800', fontSize: 18 },
});
