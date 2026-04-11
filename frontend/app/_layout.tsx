import { useEffect } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useAuthStore } from './_lib/store';
import { api } from './_lib/api';

export default function RootLayout() {
  const loadAuth = useAuthStore((s) => s.loadAuth);

  useEffect(() => {
    api.init().then(() => loadAuth());
  }, []);

  return (
    <>
      <StatusBar style="dark" />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="index" />
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="subject/[id]" options={{ headerShown: false }} />
        <Stack.Screen name="chapter/[id]" options={{ headerShown: false }} />
        <Stack.Screen name="quiz" options={{ headerShown: false, gestureEnabled: false }} />
      </Stack>
    </>
  );
}
