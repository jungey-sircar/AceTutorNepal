import { useEffect } from 'react';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { View, ActivityIndicator, Text, StyleSheet } from 'react-native';
import { useAuthStore } from './_lib/store';
import { api } from './_lib/api';
import { COLORS } from './_lib/theme';

export default function RootLayout() {
  const { isAuthenticated, isLoading, loadAuth } = useAuthStore();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    api.init().then(() => loadAuth());
  }, []);

  useEffect(() => {
    if (isLoading) return;

    const inTabs = segments[0] === '(tabs)';

    if (isAuthenticated && !inTabs) {
      router.replace('/(tabs)/dashboard');
    } else if (!isAuthenticated && inTabs) {
      router.replace('/');
    }
  }, [isAuthenticated, isLoading, segments]);

  if (isLoading) {
    return (
      <View style={styles.splash}>
        <Text style={styles.splashTitle}>ExamAce Nepal</Text>
        <ActivityIndicator size="large" color={COLORS.primary} style={{ marginTop: 16 }} />
      </View>
    );
  }

  return (
    <>
      <StatusBar style="dark" />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="index" />
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="subject/[id]" />
        <Stack.Screen name="chapter/[id]" />
        <Stack.Screen name="quiz" options={{ gestureEnabled: false }} />
      </Stack>
    </>
  );
}

const styles = StyleSheet.create({
  splash: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.background,
  },
  splashTitle: {
    fontSize: 28,
    fontWeight: '900',
    color: COLORS.textPrimary,
  },
});
