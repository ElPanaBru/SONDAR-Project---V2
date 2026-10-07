import { useEffect, useMemo, useRef, useState, type PropsWithChildren } from 'react';
import { Animated, Easing, PanResponder, Pressable, StyleSheet, View } from 'react-native';
import { palette } from '@/constants/sondar';

export function EventPanel({ children }: PropsWithChildren) {
  const [expanded, setExpanded] = useState(true);
  const progress = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const animation = Animated.timing(progress, {
      toValue: expanded ? 1 : 0,
      duration: 240,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    });
    animation.start();
    return () => animation.stop();
  }, [expanded, progress]);

  // Only the handle captures vertical gestures; lists keep their horizontal scroll.
  const gesture = useMemo(() => PanResponder.create({
    onMoveShouldSetPanResponder: (_, { dx, dy }) => Math.abs(dy) > 8 && Math.abs(dy) > Math.abs(dx),
    onPanResponderRelease: (_, { dy, vy }) => {
      if (dy < -16 || vy < -0.35) setExpanded(true);
      else if (dy > 16 || vy > 0.35) setExpanded(false);
    },
  }), []);

  return (
    <Animated.View pointerEvents="box-none" style={[styles.panel, {
      height: progress.interpolate({ inputRange: [0, 1], outputRange: [56, 272] }),
      backgroundColor: progress.interpolate({ inputRange: [0, 1], outputRange: ['transparent', palette.bg] }),
    }]}>
      <View {...gesture.panHandlers} style={styles.handleRow} pointerEvents="box-none">
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={expanded ? 'Cerrar panel de eventos' : 'Abrir panel de eventos'}
          accessibilityHint="Tambien podes deslizar hacia arriba para abrir o hacia abajo para cerrar"
          accessibilityState={{ expanded }}
          onPress={() => setExpanded(value => !value)}
          hitSlop={8}
          style={({ pressed }) => [styles.handleButton, !expanded && styles.handleClosed, pressed && { opacity: 0.7 }]}
        >
          <View style={[styles.handleBar, !expanded && styles.handleBarClosed]} />
        </Pressable>
      </View>
      <Animated.View
        pointerEvents={expanded ? 'auto' : 'none'}
        accessibilityElementsHidden={!expanded}
        importantForAccessibility={expanded ? 'auto' : 'no-hide-descendants'}
        style={[styles.content, { opacity: progress }]}
      >
        {children}
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  panel: { position: 'absolute', bottom: 0, left: 0, right: 0, borderTopLeftRadius: 24, borderTopRightRadius: 24, overflow: 'hidden' },
  handleRow: { height: 44, alignItems: 'center', justifyContent: 'center' },
  handleButton: { width: 96, height: 28, alignItems: 'center', justifyContent: 'center', borderRadius: 14 },
  handleClosed: { backgroundColor: palette.bg, borderWidth: 1, borderColor: palette.border },
  handleBar: { width: 72, height: 5, borderRadius: 3, backgroundColor: palette.muted },
  handleBarClosed: { backgroundColor: palette.orange },
  content: { position: 'absolute', top: 44, left: 0, right: 0, height: 228, paddingBottom: 12 },
});
