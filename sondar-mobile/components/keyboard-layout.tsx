import { createContext, forwardRef, useCallback, useContext, useEffect, useImperativeHandle, useRef } from 'react';
import { Keyboard, KeyboardAvoidingView, Platform, ScrollView, TextInput } from 'react-native';
import type { KeyboardAvoidingViewProps, ScrollViewProps } from 'react-native';

const FocusContext = createContext<(input: TextInput | null) => void>(() => {});
export const useKeyboardField = () => useContext(FocusContext);

// Use once around fixed composers or modal backdrops. Android resizes its window.
export function KeyboardArea(props: KeyboardAvoidingViewProps) {
  return <FocusContext.Provider value={() => {}}><KeyboardAvoidingView {...props} behavior={Platform.OS === 'ios' ? 'padding' : undefined} /></FocusContext.Provider>;
}

// The enclosing KeyboardArea reserves space. Scroll only within that visible viewport.
export const KeyboardScrollView = forwardRef<ScrollView, ScrollViewProps>(function KeyboardScrollView({ onScroll, onLayout, children, ...props }, forwardedRef) {
  const scroll = useRef<ScrollView>(null);
  useImperativeHandle(forwardedRef, () => scroll.current!);
  const focused = useRef<TextInput | null>(null);
  const offset = useRef(0);
  const frame = useRef<number | null>(null);
  const reveal = useCallback(() => {
    if (frame.current !== null) cancelAnimationFrame(frame.current);
    frame.current = requestAnimationFrame(() => {
      frame.current = null;
      const input = focused.current;
      if (!input || !Keyboard.isVisible()) return;
      scroll.current?.getNativeScrollRef()?.measureInWindow((_x, top, _width, height) => {
        input.measureInWindow((_ix, inputTop, _iw, inputHeight) => {
          if (focused.current !== input) return;
          const bottom = Math.min(top + height, Keyboard.metrics()?.screenY ?? Infinity) - 16;
          const hidden = inputTop + Math.min(inputHeight, Math.max(44, bottom - top - 16)) - bottom;
          if (hidden > 0) scroll.current?.scrollTo({ y: Math.max(0, offset.current + hidden), animated: true });
        });
      });
    });
  }, []);
  const focus = useCallback((input: TextInput | null) => {
    focused.current = input;
    if (input) reveal();
  }, [reveal]);
  useEffect(() => {
    const shown = Keyboard.addListener('keyboardDidShow', reveal);
    const changed = Keyboard.addListener('keyboardDidChangeFrame', reveal);
    return () => {
      shown.remove();
      changed.remove();
      if (frame.current !== null) cancelAnimationFrame(frame.current);
    };
  }, [reveal]);
  return <FocusContext.Provider value={focus}>
    <ScrollView
      automaticallyAdjustKeyboardInsets={false}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
      scrollEventThrottle={16}
      {...props}
      ref={scroll}
      onScroll={event => { offset.current = event.nativeEvent.contentOffset.y; onScroll?.(event); }}
      onLayout={event => { onLayout?.(event); reveal(); }}>
      {children}
    </ScrollView>
  </FocusContext.Provider>;
});
