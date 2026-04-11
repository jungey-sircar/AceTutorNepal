import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { api } from './_lib/api';
import { COLORS, SPACING, RADIUS, SHADOWS } from './_lib/theme';

interface Question {
  question_id: string;
  text: string;
  options: string[];
  correct_answer: number;
  explanation?: string;
}

export default function QuizScreen() {
  const { questions: questionsParam } = useLocalSearchParams<{ questions: string }>();
  const router = useRouter();

  const [questions, setQuestions] = useState<Question[]>([]);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null);
  const [showResult, setShowResult] = useState(false);
  const [score, setScore] = useState(0);
  const [timeLeft, setTimeLeft] = useState(30);
  const [finished, setFinished] = useState(false);
  const [aiExplanation, setAiExplanation] = useState<string | null>(null);
  const [loadingExplanation, setLoadingExplanation] = useState(false);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (questionsParam) {
      try {
        setQuestions(JSON.parse(questionsParam));
      } catch { }
    }
  }, [questionsParam]);

  useEffect(() => {
    if (questions.length > 0 && !finished && !showResult) {
      setTimeLeft(30);
      timerRef.current = setInterval(() => {
        setTimeLeft(prev => {
          if (prev <= 1) {
            clearInterval(timerRef.current!);
            handleTimeout();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
      return () => { if (timerRef.current) clearInterval(timerRef.current); };
    }
  }, [currentIdx, questions, finished]);

  const handleTimeout = () => {
    setShowResult(true);
    submitAnswer(-1);
  };

  const handleSelect = (idx: number) => {
    if (showResult) return;
    setSelectedAnswer(idx);
    setShowResult(true);
    if (timerRef.current) clearInterval(timerRef.current);

    const q = questions[currentIdx];
    if (idx === q.correct_answer) setScore(prev => prev + 1);
    submitAnswer(idx);
  };

  const submitAnswer = async (idx: number) => {
    const q = questions[currentIdx];
    try {
      await api.post('/practice/submit', {
        question_id: q.question_id,
        selected_answer: idx,
        time_taken: 30 - timeLeft,
      });
    } catch { }
  };

  const handleNext = () => {
    if (currentIdx + 1 >= questions.length) {
      setFinished(true);
    } else {
      setCurrentIdx(prev => prev + 1);
      setSelectedAnswer(null);
      setShowResult(false);
      setAiExplanation(null);
    }
  };

  const getAIExplanation = async () => {
    const q = questions[currentIdx];
    setLoadingExplanation(true);
    try {
      const res = await api.post<{ explanation: string }>('/ai/explain', {
        question_id: q.question_id,
        question_text: q.text,
        options: q.options,
        correct_answer: q.correct_answer,
      });
      setAiExplanation(res.explanation);
    } catch {
      setAiExplanation('Could not load AI explanation.');
    } finally {
      setLoadingExplanation(false);
    }
  };

  if (questions.length === 0) {
    return (
      <SafeAreaView style={styles.container}>
        <ActivityIndicator color={COLORS.primary} style={{ marginTop: 100 }} />
      </SafeAreaView>
    );
  }

  // Finished Screen
  if (finished) {
    const percentage = Math.round((score / questions.length) * 100);
    return (
      <SafeAreaView style={styles.container}>
        <ScrollView contentContainerStyle={styles.finishedContainer}>
          <View style={styles.resultIcon}>
            <Ionicons name={percentage >= 70 ? 'trophy' : percentage >= 40 ? 'thumbs-up' : 'sad'}
              size={64} color={percentage >= 70 ? COLORS.streakAccent : percentage >= 40 ? COLORS.primary : COLORS.error} />
          </View>
          <Text style={styles.resultTitle}>
            {percentage >= 70 ? 'Excellent!' : percentage >= 40 ? 'Good Effort!' : 'Keep Practicing!'}
          </Text>
          <Text style={styles.resultScore}>{score}/{questions.length}</Text>
          <Text style={styles.resultPercentage}>{percentage}% correct</Text>

          <View style={styles.resultStats}>
            <View style={styles.resultStatItem}>
              <Ionicons name="checkmark-circle" size={20} color={COLORS.secondary} />
              <Text style={styles.resultStatText}>{score} correct</Text>
            </View>
            <View style={styles.resultStatItem}>
              <Ionicons name="close-circle" size={20} color={COLORS.error} />
              <Text style={styles.resultStatText}>{questions.length - score} wrong</Text>
            </View>
          </View>

          <TouchableOpacity testID="back-to-practice" style={styles.backBtn} onPress={() => router.back()}>
            <Text style={styles.backBtnText}>Back to Practice</Text>
          </TouchableOpacity>
        </ScrollView>
      </SafeAreaView>
    );
  }

  const currentQ = questions[currentIdx];
  const isCorrect = selectedAnswer === currentQ.correct_answer;

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity testID="quiz-close-btn" onPress={() => router.back()}>
          <Ionicons name="close" size={28} color={COLORS.textPrimary} />
        </TouchableOpacity>
        <View style={styles.progressBar}>
          <View style={[styles.progressFill, { width: `${((currentIdx + 1) / questions.length) * 100}%` }]} />
        </View>
        <Text style={styles.counter}>{currentIdx + 1}/{questions.length}</Text>
      </View>

      {/* Timer */}
      <View style={styles.timerRow}>
        <Ionicons name="time" size={18} color={timeLeft <= 10 ? COLORS.error : COLORS.textSecondary} />
        <Text style={[styles.timerText, timeLeft <= 10 && { color: COLORS.error }]}>{timeLeft}s</Text>
      </View>

      <ScrollView contentContainerStyle={styles.questionContainer}>
        {/* Question */}
        <Text style={styles.questionText}>{currentQ.text}</Text>

        {/* Options */}
        {currentQ.options.map((opt, idx) => {
          let optStyle = styles.option;
          let optTextStyle = styles.optionText;
          if (showResult) {
            if (idx === currentQ.correct_answer) {
              optStyle = { ...styles.option, ...styles.correctOpt };
              optTextStyle = { ...styles.optionText, color: COLORS.secondaryDark };
            } else if (idx === selectedAnswer && !isCorrect) {
              optStyle = { ...styles.option, ...styles.wrongOpt };
              optTextStyle = { ...styles.optionText, color: COLORS.error };
            }
          } else if (idx === selectedAnswer) {
            optStyle = { ...styles.option, ...styles.selectedOpt };
          }

          return (
            <TouchableOpacity
              key={idx}
              testID={`quiz-option-${idx}`}
              style={optStyle}
              onPress={() => handleSelect(idx)}
              disabled={showResult}
            >
              <Text style={styles.optionLetter}>{String.fromCharCode(65 + idx)}</Text>
              <Text style={optTextStyle}>{opt}</Text>
              {showResult && idx === currentQ.correct_answer && (
                <Ionicons name="checkmark-circle" size={22} color={COLORS.secondary} />
              )}
              {showResult && idx === selectedAnswer && !isCorrect && idx !== currentQ.correct_answer && (
                <Ionicons name="close-circle" size={22} color={COLORS.error} />
              )}
            </TouchableOpacity>
          );
        })}

        {/* Feedback */}
        {showResult && (
          <View style={[styles.feedbackCard, isCorrect ? styles.correctFeedback : styles.wrongFeedback]}>
            <Text style={styles.feedbackTitle}>{isCorrect ? 'Correct!' : selectedAnswer === -1 ? 'Time\'s up!' : 'Incorrect'}</Text>
            {currentQ.explanation && <Text style={styles.feedbackText}>{currentQ.explanation}</Text>}

            <TouchableOpacity testID="ai-explain-btn" style={styles.aiExplainBtn} onPress={getAIExplanation} disabled={loadingExplanation}>
              {loadingExplanation ? (
                <ActivityIndicator size="small" color={COLORS.primary} />
              ) : (
                <>
                  <Ionicons name="sparkles" size={16} color={COLORS.primary} />
                  <Text style={styles.aiExplainText}>AI Explanation</Text>
                </>
              )}
            </TouchableOpacity>

            {aiExplanation && (
              <View style={styles.aiExplanationBox}>
                <Text style={styles.aiExplanationText}>{aiExplanation}</Text>
              </View>
            )}
          </View>
        )}

        {showResult && (
          <TouchableOpacity testID="quiz-next-btn" style={styles.nextBtn} onPress={handleNext}>
            <Text style={styles.nextBtnText}>
              {currentIdx + 1 >= questions.length ? 'See Results' : 'Next Question'}
            </Text>
            <Ionicons name="arrow-forward" size={20} color="#fff" />
          </TouchableOpacity>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  header: {
    flexDirection: 'row', alignItems: 'center', paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md, gap: SPACING.md,
  },
  progressBar: { flex: 1, height: 8, backgroundColor: COLORS.border, borderRadius: RADIUS.full, overflow: 'hidden' },
  progressFill: { height: '100%', backgroundColor: COLORS.primary, borderRadius: RADIUS.full },
  counter: { fontWeight: '800', fontSize: 14, color: COLORS.textSecondary },
  timerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, marginBottom: SPACING.sm },
  timerText: { fontWeight: '800', fontSize: 16, color: COLORS.textSecondary },
  questionContainer: { padding: SPACING.lg, paddingBottom: 100 },
  questionText: { fontSize: 18, fontWeight: '700', color: COLORS.textPrimary, lineHeight: 28, marginBottom: SPACING.lg },
  option: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.surface,
    borderWidth: 2, borderColor: COLORS.border, borderRadius: RADIUS.xl, borderBottomWidth: 4,
    padding: SPACING.md, marginBottom: SPACING.sm,
  },
  selectedOpt: { borderColor: COLORS.primary, backgroundColor: COLORS.primaryLight },
  correctOpt: { borderColor: COLORS.secondary, backgroundColor: COLORS.successLight },
  wrongOpt: { borderColor: COLORS.error, backgroundColor: COLORS.errorLight },
  optionLetter: { fontWeight: '900', fontSize: 16, color: COLORS.textSecondary, marginRight: SPACING.md, width: 24 },
  optionText: { flex: 1, fontSize: 15, fontWeight: '600', color: COLORS.textPrimary },
  feedbackCard: { borderRadius: RADIUS.xl, padding: SPACING.lg, marginTop: SPACING.md, borderWidth: 2 },
  correctFeedback: { backgroundColor: COLORS.successLight, borderColor: '#86EFAC' },
  wrongFeedback: { backgroundColor: COLORS.errorLight, borderColor: '#FCA5A5' },
  feedbackTitle: { fontSize: 18, fontWeight: '800', marginBottom: SPACING.sm },
  feedbackText: { fontSize: 14, color: COLORS.textPrimary, lineHeight: 22 },
  aiExplainBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: SPACING.md,
    paddingVertical: 8, paddingHorizontal: 14, backgroundColor: COLORS.surface,
    borderRadius: RADIUS.full, borderWidth: 2, borderColor: COLORS.primary, alignSelf: 'flex-start',
  },
  aiExplainText: { fontWeight: '700', fontSize: 13, color: COLORS.primary },
  aiExplanationBox: {
    marginTop: SPACING.md, backgroundColor: COLORS.surface, borderRadius: RADIUS.lg,
    padding: SPACING.md, borderWidth: 1, borderColor: COLORS.border,
  },
  aiExplanationText: { fontSize: 14, color: COLORS.textPrimary, lineHeight: 22 },
  nextBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    backgroundColor: COLORS.primary, borderRadius: RADIUS.xl, paddingVertical: 16,
    marginTop: SPACING.lg, borderBottomWidth: 4, borderBottomColor: COLORS.primaryDark, gap: SPACING.sm,
  },
  nextBtnText: { color: '#fff', fontWeight: '800', fontSize: 17 },
  finishedContainer: { flexGrow: 1, justifyContent: 'center', alignItems: 'center', padding: SPACING.xl },
  resultIcon: { marginBottom: SPACING.lg },
  resultTitle: { fontSize: 28, fontWeight: '900', color: COLORS.textPrimary },
  resultScore: { fontSize: 48, fontWeight: '900', color: COLORS.primary, marginTop: SPACING.md },
  resultPercentage: { fontSize: 18, fontWeight: '700', color: COLORS.textSecondary, marginTop: SPACING.xs },
  resultStats: { flexDirection: 'row', gap: SPACING.xl, marginTop: SPACING.lg },
  resultStatItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  resultStatText: { fontWeight: '700', fontSize: 15, color: COLORS.textPrimary },
  backBtn: {
    backgroundColor: COLORS.primary, borderRadius: RADIUS.xl, paddingVertical: 16,
    paddingHorizontal: SPACING.xl, marginTop: SPACING.xl, borderBottomWidth: 4, borderBottomColor: COLORS.primaryDark,
  },
  backBtnText: { color: '#fff', fontWeight: '800', fontSize: 17 },
});
