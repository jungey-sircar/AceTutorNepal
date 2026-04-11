import React, { useState, useRef } from 'react';
import {
  View, Text, TextInput, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, KeyboardAvoidingView, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { api } from '../_lib/api';
import { COLORS, SPACING, RADIUS, SHADOWS } from '../_lib/theme';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
}

export default function ChatScreen() {
  const [messages, setMessages] = useState<Message[]>([
    { id: '0', role: 'assistant', content: 'Namaste! I\'m your ExamAce AI Tutor. Ask me anything about your exam preparation - I can explain concepts, generate practice questions, or help you study any topic.' },
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const scrollRef = useRef<ScrollView>(null);

  const sendMessage = async () => {
    if (!input.trim() || loading) return;
    const userMsg: Message = { id: Date.now().toString(), role: 'user', content: input.trim() };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setLoading(true);

    try {
      const res = await api.post<{ response: string; session_id: string }>('/ai/chat', {
        message: userMsg.content,
        session_id: sessionId,
      });
      setSessionId(res.session_id);
      const aiMsg: Message = { id: (Date.now() + 1).toString(), role: 'assistant', content: res.response };
      setMessages(prev => [...prev, aiMsg]);
    } catch (err: any) {
      const errMsg: Message = {
        id: (Date.now() + 1).toString(), role: 'assistant',
        content: 'Sorry, I encountered an error. Please try again.',
      };
      setMessages(prev => [...prev, errMsg]);
    } finally {
      setLoading(false);
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);
    }
  };

  const quickPrompts = [
    'Explain Newton\'s laws',
    'Quiz me on Set Theory',
    'Tips for Loksewa exam',
    'Summarize photosynthesis',
  ];

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Ionicons name="chatbubbles" size={24} color={COLORS.primary} />
          <Text style={styles.headerTitle}>AI Tutor</Text>
        </View>
        <TouchableOpacity testID="new-chat-btn" onPress={() => {
          setMessages([{ id: '0', role: 'assistant', content: 'Namaste! How can I help you study today?' }]);
          setSessionId(null);
        }}>
          <Ionicons name="add-circle" size={28} color={COLORS.primary} />
        </TouchableOpacity>
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
      >
        <ScrollView
          ref={scrollRef}
          contentContainerStyle={styles.messageList}
          onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: true })}
        >
          {/* Quick Prompts */}
          {messages.length <= 1 && (
            <View style={styles.quickPrompts}>
              <Text style={styles.quickLabel}>TRY ASKING</Text>
              {quickPrompts.map((p, i) => (
                <TouchableOpacity
                  key={i}
                  testID={`quick-prompt-${i}`}
                  style={styles.quickChip}
                  onPress={() => { setInput(p); }}
                >
                  <Ionicons name="sparkles" size={16} color={COLORS.primary} />
                  <Text style={styles.quickText}>{p}</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}

          {messages.map((msg) => (
            <View key={msg.id} style={[styles.messageBubble, msg.role === 'user' ? styles.userBubble : styles.aiBubble]}>
              {msg.role === 'assistant' && (
                <View style={styles.aiAvatar}>
                  <Ionicons name="sparkles" size={14} color={COLORS.secondary} />
                </View>
              )}
              <View style={[styles.bubbleContent, msg.role === 'user' ? styles.userContent : styles.aiContent]}>
                <Text style={[styles.messageText, msg.role === 'user' && styles.userText]}>{msg.content}</Text>
              </View>
            </View>
          ))}

          {loading && (
            <View style={[styles.messageBubble, styles.aiBubble]}>
              <View style={styles.aiAvatar}>
                <Ionicons name="sparkles" size={14} color={COLORS.secondary} />
              </View>
              <View style={[styles.bubbleContent, styles.aiContent]}>
                <ActivityIndicator size="small" color={COLORS.primary} />
              </View>
            </View>
          )}
        </ScrollView>

        {/* Input Bar */}
        <View style={styles.inputBar}>
          <TextInput
            testID="chat-input"
            style={styles.textInput}
            value={input}
            onChangeText={setInput}
            placeholder="Ask anything..."
            placeholderTextColor={COLORS.textSecondary}
            multiline
            maxLength={1000}
            onSubmitEditing={sendMessage}
          />
          <TouchableOpacity
            testID="send-btn"
            style={[styles.sendBtn, (!input.trim() || loading) && styles.sendBtnDisabled]}
            onPress={sendMessage}
            disabled={!input.trim() || loading}
          >
            <Ionicons name="send" size={20} color="#fff" />
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: SPACING.lg, paddingVertical: SPACING.md,
    borderBottomWidth: 2, borderBottomColor: COLORS.border, backgroundColor: COLORS.surface,
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm },
  headerTitle: { fontSize: 20, fontWeight: '800', color: COLORS.textPrimary },
  messageList: { padding: SPACING.lg, paddingBottom: SPACING.lg },
  quickPrompts: { marginBottom: SPACING.lg },
  quickLabel: { fontSize: 11, fontWeight: '800', color: COLORS.textSecondary, letterSpacing: 1.5, marginBottom: SPACING.sm },
  quickChip: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.surface,
    borderWidth: 2, borderColor: COLORS.border, borderRadius: RADIUS.xl,
    padding: SPACING.md, marginBottom: SPACING.sm, gap: SPACING.sm,
  },
  quickText: { fontWeight: '600', fontSize: 14, color: COLORS.textPrimary },
  messageBubble: { flexDirection: 'row', marginBottom: SPACING.md },
  userBubble: { justifyContent: 'flex-end' },
  aiBubble: { justifyContent: 'flex-start' },
  aiAvatar: {
    width: 28, height: 28, borderRadius: RADIUS.full, backgroundColor: COLORS.secondaryLight,
    justifyContent: 'center', alignItems: 'center', marginRight: SPACING.sm, marginTop: 4,
  },
  bubbleContent: { maxWidth: '80%', borderRadius: RADIUS.xl, padding: SPACING.md },
  userContent: { backgroundColor: COLORS.primary, borderBottomRightRadius: 4, marginLeft: 'auto' },
  aiContent: { backgroundColor: COLORS.secondaryLight, borderBottomLeftRadius: 4, borderWidth: 2, borderColor: '#BBF7D0' },
  messageText: { fontSize: 15, lineHeight: 22, color: COLORS.textPrimary, fontWeight: '500' },
  userText: { color: '#fff' },
  inputBar: {
    flexDirection: 'row', alignItems: 'flex-end', paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm, backgroundColor: COLORS.surface,
    borderTopWidth: 2, borderTopColor: COLORS.border,
  },
  textInput: {
    flex: 1, backgroundColor: COLORS.background, borderWidth: 2, borderColor: COLORS.border,
    borderRadius: RADIUS.xl, paddingHorizontal: SPACING.md, paddingVertical: 12,
    fontSize: 15, color: COLORS.textPrimary, maxHeight: 100, marginRight: SPACING.sm,
  },
  sendBtn: {
    width: 44, height: 44, borderRadius: RADIUS.full, backgroundColor: COLORS.primary,
    justifyContent: 'center', alignItems: 'center',
  },
  sendBtnDisabled: { backgroundColor: COLORS.border },
});
