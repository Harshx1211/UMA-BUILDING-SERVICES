// OfflineBanner — animated yellow banner shown when device has no internet connection
import { useEffect, useRef } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';
import { useNetworkStatus } from '@/hooks/useNetworkStatus';
import Colors from '@/constants/Colors';
import { useColorScheme } from '@/hooks/use-color-scheme';

const BANNER_HEIGHT = 36;

export function OfflineBanner() {
  const { isOnline } = useNetworkStatus();
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const translateY = useRef(new Animated.Value(-BANNER_HEIGHT)).current;

  useEffect(() => {
    Animated.timing(translateY, {
      toValue: isOnline ? -BANNER_HEIGHT : 0,
      duration: 300,
      useNativeDriver: true,
    }).start();
  }, [isOnline]);

  return (
    <Animated.View
      style={[
        styles.banner,
        {
          backgroundColor: colors.warning,
          transform: [{ translateY }],
        },
      ]}
    >
      <Text style={styles.text}>
        ⚠️  Offline Mode — Changes will sync when connected
      </Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  banner: {
    height: BANNER_HEIGHT,
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 999,
  },
  text: {
    color: '#000000',
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
  },
});
