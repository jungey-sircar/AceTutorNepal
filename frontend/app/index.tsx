import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, ScrollView, ActivityIndicator, Alert,
} from 'react-native';
import { useRouter, Redirect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuthStore } from './_lib/store';
import { api } from './_lib/api';
import { COLORS, SPACING, RADIUS, SHADOWS } from './_lib/theme';

export default function AuthScreen() {
  const { isAuthenticated, isLoading, login } = useAuthStore();
  const router = useRouter();
  const [isLogin, setIsLogin] = useState(true);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [examType, setExamType] = useState('SEE');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={COLORS.primary} />
        <Text style={styles.loadingText}>Loading ExamAce...</Text>
      </View>
    );
  }

  if (isAuthenticated) {
    return <Redirect href="/(tabs)/dashboard" />;
  }

  const examTypes = ['SEE', 'NEB +2', 'TU', 'CTEVT', 'Loksewa'];

  const handleAuth = async () => {
    if (!email || !password || (!isLogin && !name)) {
      Alert.alert('Error', 'Please fill in all fields');
      return;
    }
    setLoading(true);
    try {
      if (isLogin) {
        const res = await api.post<{ token: string; user: any }>('/auth/login', { email, password });
        await login(res.token, res.user);
      } else {
        const res = await api.post<{ token: string; user: any }>('/auth/register', {
          name, email, password, exam_type: examType,
        });
        await login(res.token, res.user);
      }
      router.replace('/(tabs)/dashboard');
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleAuth = async () => {
    try {
      const { state } = await api.post<{ state: string }>('/auth/google/init');
      const backendUrl = process.env.EXPO_PUBLIC_BACKEND_URL || '';
      // REMINDER: DO NOT HARDCODE THE URL, OR ADD ANY FALLBACKS OR REDIRECT URLS, THIS BREAKS THE AUTH
      const redirectUrl = `${backendUrl}/api/auth/google/callback?state=${state}`;
      const authUrl = `https://auth.emergentagent.com/?redirect=${encodeURIComponent(redirectUrl)}`;
      
      if (Platform.OS === 'web') {
        // Store state for polling when we return
        const AsyncStorage = (await import('@react-native-async-storage/async-storage')).default;
        await AsyncStorage.setItem('google_auth_state', state);
        window.location.href = authUrl;
      } else {
        const WebBrowser = await import('expo-web-browser');
        await WebBrowser.openBrowserAsync(authUrl);
        // Poll for result
        const pollResult = async () => {
          for (let i = 0; i < 30; i++) {
            await new Promise(r => setTimeout(r, 2000));
            try {
              const result = await api.get<any>(`/auth/google/status?state=${state}`);
              if (result.status === 'completed') {
                await login(result.token, result.user);
                router.replace('/(tabs)/dashboard');
                return;
              }
            } catch {}
          }
        };
        pollResult();
      }
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Google auth failed');
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.logoContainer}>
              <Ionicons name="school" size={48} color={COLORS.primary} />
            </View>
            <Text style={styles.appName}>ExamAce Nepal</Text>
            <Text style={styles.tagline}>AI-powered exam prep for Nepali students</Text>
          </View>

          {/* Auth Form */}
          <View style={styles.formCard}>
            {/* Tab Switcher */}
            <View style={styles.tabContainer}>
              <TouchableOpacity
                testID="login-tab"
                style={[styles.tab, isLogin && styles.activeTab]}
                onPress={() => setIsLogin(true)}
              >
                <Text style={[styles.tabText, isLogin && styles.activeTabText]}>Login</Text>
              </TouchableOpacity>
              <TouchableOpacity
                testID="signup-tab"
                style={[styles.tab, !isLogin && styles.activeTab]}
                onPress={() => setIsLogin(false)}
              >
                <Text style={[styles.tabText, !isLogin && styles.activeTabText]}>Sign Up</Text>
              </TouchableOpacity>
            </View>

            {!isLogin && (
              <View style={styles.inputGroup}>
                <Text style={styles.label}>Full Name</Text>
                <TextInput
                  testID="name-input"
                  style={styles.input}
                  value={name}
                  onChangeText={setName}
                  placeholder="Enter your name"
                  placeholderTextColor={COLORS.textSecondary}
                />
              </View>
            )}

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Email</Text>
              <TextInput
                testID="email-input"
                style={styles.input}
                value={email}
                onChangeText={setEmail}
                placeholder="your@email.com"
                keyboardType="email-address"
                autoCapitalize="none"
                placeholderTextColor={COLORS.textSecondary}
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Password</Text>
              <View style={styles.passwordContainer}>
                <TextInput
                  testID="password-input"
                  style={styles.passwordInput}
                  value={password}
                  onChangeText={setPassword}
                  placeholder="Enter password"
                  secureTextEntry={!showPassword}
                  placeholderTextColor={COLORS.textSecondary}
                />
                <TouchableOpacity testID="toggle-password" onPress={() => setShowPassword(!showPassword)}>
                  <Ionicons name={showPassword ? 'eye-off' : 'eye'} size={20} color={COLORS.textSecondary} />
                </TouchableOpacity>
              </View>
            </View>

            {!isLogin && (
              <View style={styles.inputGroup}>
                <Text style={styles.label}>Exam Type</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.examRow}>
                  {examTypes.map((type) => (
                    <TouchableOpacity
                      key={type}
                      testID={`exam-type-${type.replace(/\s/g, '-').toLowerCase()}`}
                      style={[styles.examChip, examType === type && styles.examChipActive]}
                      onPress={() => setExamType(type)}
                    >
                      <Text style={[styles.examChipText, examType === type && styles.examChipTextActive]}>
                        {type}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
            )}

            <TouchableOpacity
              testID="auth-submit-btn"
              style={[styles.primaryBtn, loading && styles.disabledBtn]}
              onPress={handleAuth}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.primaryBtnText}>{isLogin ? 'Login' : 'Create Account'}</Text>
              )}
            </TouchableOpacity>

            <View style={styles.divider}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>or</Text>
              <View style={styles.dividerLine} />
            </View>

            <TouchableOpacity testID="google-auth-btn" style={styles.googleBtn} onPress={handleGoogleAuth}>
              <Ionicons name="logo-google" size={20} color={COLORS.textPrimary} />
              <Text style={styles.googleBtnText}>Continue with Google</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: COLORS.background },
  loadingText: { marginTop: SPACING.md, color: COLORS.textSecondary, fontSize: 16 },
  scroll: { flexGrow: 1, padding: SPACING.lg },
  header: { alignItems: 'center', marginTop: SPACING.xl, marginBottom: SPACING.xl },
  logoContainer: {
    width: 80, height: 80, borderRadius: RADIUS.xl,
    backgroundColor: COLORS.primaryLight, justifyContent: 'center', alignItems: 'center',
    marginBottom: SPACING.md,
  },
  appName: { fontSize: 28, fontWeight: '900', color: COLORS.textPrimary, letterSpacing: -0.5 },
  tagline: { fontSize: 14, color: COLORS.textSecondary, marginTop: SPACING.xs },
  formCard: {
    backgroundColor: COLORS.surface, borderRadius: RADIUS.xxl, padding: SPACING.lg,
    borderWidth: 2, borderColor: COLORS.border, ...SHADOWS.md,
  },
  tabContainer: {
    flexDirection: 'row', backgroundColor: COLORS.background, borderRadius: RADIUS.lg,
    padding: 4, marginBottom: SPACING.lg,
  },
  tab: { flex: 1, paddingVertical: 12, alignItems: 'center', borderRadius: RADIUS.md },
  activeTab: { backgroundColor: COLORS.primary },
  tabText: { fontWeight: '700', fontSize: 15, color: COLORS.textSecondary },
  activeTabText: { color: '#fff' },
  inputGroup: { marginBottom: SPACING.md },
  label: { fontWeight: '700', fontSize: 13, color: COLORS.textSecondary, marginBottom: SPACING.xs, textTransform: 'uppercase', letterSpacing: 1 },
  input: {
    backgroundColor: COLORS.background, borderWidth: 2, borderColor: COLORS.border,
    borderRadius: RADIUS.lg, paddingHorizontal: SPACING.md, paddingVertical: 14,
    fontSize: 16, color: COLORS.textPrimary, fontWeight: '500',
  },
  passwordContainer: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.background,
    borderWidth: 2, borderColor: COLORS.border, borderRadius: RADIUS.lg,
    paddingHorizontal: SPACING.md,
  },
  passwordInput: { flex: 1, paddingVertical: 14, fontSize: 16, color: COLORS.textPrimary, fontWeight: '500' },
  examRow: { flexDirection: 'row', marginTop: SPACING.xs },
  examChip: {
    paddingHorizontal: SPACING.md, paddingVertical: 10, borderRadius: RADIUS.full,
    borderWidth: 2, borderColor: COLORS.border, marginRight: SPACING.sm, backgroundColor: COLORS.background,
  },
  examChipActive: { borderColor: COLORS.primary, backgroundColor: COLORS.primaryLight },
  examChipText: { fontWeight: '700', color: COLORS.textSecondary, fontSize: 13 },
  examChipTextActive: { color: COLORS.primaryDark },
  primaryBtn: {
    backgroundColor: COLORS.primary, borderRadius: RADIUS.xl, paddingVertical: 16,
    alignItems: 'center', marginTop: SPACING.sm,
    borderBottomWidth: 4, borderBottomColor: COLORS.primaryDark,
  },
  disabledBtn: { opacity: 0.7 },
  primaryBtnText: { color: '#fff', fontWeight: '800', fontSize: 17 },
  divider: { flexDirection: 'row', alignItems: 'center', marginVertical: SPACING.lg },
  dividerLine: { flex: 1, height: 1, backgroundColor: COLORS.border },
  dividerText: { marginHorizontal: SPACING.md, color: COLORS.textSecondary, fontWeight: '600' },
  googleBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    backgroundColor: COLORS.surface, borderWidth: 2, borderColor: COLORS.border,
    borderRadius: RADIUS.xl, paddingVertical: 14, borderBottomWidth: 4,
  },
  googleBtnText: { marginLeft: SPACING.sm, fontWeight: '700', fontSize: 15, color: COLORS.textPrimary },
});
