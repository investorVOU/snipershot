import React, { useEffect, useRef, useState } from "react";
import { Animated } from "react-native";

interface Props {
  children: React.ReactNode;
  index: number;
  isNew?: boolean;
}

export function AnimatedTokenCard({ children, isNew }: Props) {
  const translateX = useRef(new Animated.Value(isNew ? 400 : 0)).current;
  const cardOpacity = useRef(new Animated.Value(isNew ? 0 : 1)).current;
  const borderGlow = useRef(new Animated.Value(0)).current;
  const shadowGlow = useRef(new Animated.Value(0)).current;
  const [borderColor, setBorderColor] = useState("transparent");
  const [shadowOpacity, setShadowOpacity] = useState(0);

  useEffect(() => {
    const borderListener = borderGlow.addListener(({ value }) => {
      setBorderColor(value <= 0 ? "transparent" : "#9945ff");
    });
    const shadowListener = shadowGlow.addListener(({ value }) => {
      setShadowOpacity(Math.max(0, Math.min(0.8, value * 0.8)));
    });
    return () => {
      borderGlow.removeListener(borderListener);
      shadowGlow.removeListener(shadowListener);
    };
  }, [borderGlow, shadowGlow]);

  useEffect(() => {
    if (!isNew) {
      setBorderColor("transparent");
      setShadowOpacity(0);
      return;
    }
    translateX.setValue(400);
    cardOpacity.setValue(0);
    borderGlow.setValue(0);
    shadowGlow.setValue(0);

    Animated.spring(translateX, { toValue: 0, tension: 80, friction: 10, useNativeDriver: true }).start();
    Animated.timing(cardOpacity, { toValue: 1, duration: 300, useNativeDriver: true }).start();

    Animated.sequence([
      Animated.timing(borderGlow, { toValue: 1, duration: 400, useNativeDriver: false }),
      Animated.timing(borderGlow, { toValue: 0.3, duration: 600, useNativeDriver: false }),
      Animated.timing(borderGlow, { toValue: 0, duration: 800, useNativeDriver: false }),
    ]).start();

    Animated.sequence([
      Animated.timing(shadowGlow, { toValue: 1, duration: 400, useNativeDriver: false }),
      Animated.timing(shadowGlow, { toValue: 0.3, duration: 600, useNativeDriver: false }),
      Animated.timing(shadowGlow, { toValue: 0, duration: 800, useNativeDriver: false }),
    ]).start();
  }, [borderGlow, cardOpacity, isNew, shadowGlow, translateX]);

  return (
    <Animated.View style={{ transform: [{ translateX }], opacity: cardOpacity, marginHorizontal: 16, marginBottom: 10 }}>
      <Animated.View style={{ borderRadius: 14, borderWidth: 1.5, borderColor, shadowColor: "#9945ff", shadowOffset: { width: 0, height: 0 }, shadowRadius: 12, shadowOpacity, overflow: "visible" }}>
        {children}
      </Animated.View>
    </Animated.View>
  );
}
