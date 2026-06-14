import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';

interface State {
  error: Error | null;
}

interface Props {
  children: React.ReactNode;
}

export class ErrorBoundary extends React.Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    // Wire up to crash reporting (Sentry, etc.) here when ready
    console.error('[ErrorBoundary]', error, info.componentStack);
  }

  reset = () => this.setState({ error: null });

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;

    return (
      <View style={styles.container}>
        <Text style={styles.emoji}>😕</Text>
        <Text style={styles.title}>Something went wrong</Text>
        <Text style={styles.message} numberOfLines={4}>
          {error.message}
        </Text>
        <Pressable style={styles.btn} onPress={this.reset}>
          <Text style={styles.btnText}>Try again</Text>
        </Pressable>
      </View>
    );
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
    backgroundColor: '#fff',
  },
  emoji: { fontSize: 48, marginBottom: 16 },
  title: { fontSize: 18, fontWeight: '700', marginBottom: 8, textAlign: 'center' },
  message: { fontSize: 13, color: '#666', textAlign: 'center', marginBottom: 32 },
  btn: {
    paddingVertical: 12,
    paddingHorizontal: 32,
    borderRadius: 999,
    backgroundColor: '#FF5C5C',
  },
  btnText: { fontSize: 14, fontWeight: '700', color: '#fff' },
});
