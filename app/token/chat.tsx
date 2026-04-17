import { Feather } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import React, { useRef, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTokenChat } from "../../hooks/useAI";
import { useColors } from "../../hooks/useColors";

const SUGGESTED = [
  "Is this token safe to buy?",
  "What are the red flags?",
  "What's a good entry strategy?",
  "What's the max I should invest?",
  "Does this look like a rug pull?",
];

export default function TokenChatScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { mint, tokenContext, tokenName } = useLocalSearchParams<{
    mint: string;
    tokenContext: string;
    tokenName: string;
  }>();

  const { messages, loading, send, reset } = useTokenChat(
    tokenContext ?? `Token mint: ${mint}`
  );
  const [input, setInput] = useState("");
  const listRef = useRef<FlatList>(null);

  const topPad = Platform.OS === "web" ? Math.max(insets.top, 67) : insets.top;
  const botPad = Platform.OS === "web" ? Math.max(insets.bottom, 34) : insets.bottom;

  const handleSend = async () => {
    const text = input.trim();
    if (!text || loading) return;
    setInput("");
    await send(text);
    setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 100);
  };

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: colors.background }]}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      keyboardVerticalOffset={0}
    >
      <View
        style={[
          styles.header,
          {
            paddingTop: topPad + 10,
            backgroundColor: colors.background,
            borderBottomColor: colors.border,
          },
        ]}
      >
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Feather name="arrow-left" size={18} color={colors.foreground} />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <View style={styles.aiPulse} />
          <Text style={[styles.headerTitle, { color: colors.foreground }]} numberOfLines={1}>
            AI: {tokenName ?? "Token"}
          </Text>
        </View>
        <TouchableOpacity onPress={reset} style={styles.resetBtn}>
          <Feather name="trash-2" size={16} color={colors.mutedForeground} />
        </TouchableOpacity>
      </View>

      <FlatList
        ref={listRef}
        data={messages}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{
          padding: 16,
          paddingBottom: botPad + 80,
          gap: 10,
          flexGrow: 1,
        }}
        ListHeaderComponent={
          messages.length === 0 ? (
            <View style={styles.welcomeBox}>
              <View style={[styles.aiIconBig, { backgroundColor: "#9945ff22" }]}>
                <Feather name="cpu" size={32} color="#9945ff" />
              </View>
              <Text style={[styles.welcomeTitle, { color: colors.foreground }]}>
                Ask me anything about this token
              </Text>
              <Text style={[styles.welcomeSub, { color: colors.mutedForeground }]}>
                Powered by Groq · LLaMA 3.3 70B
              </Text>
              <View style={styles.suggestions}>
                {SUGGESTED.map((s) => (
                  <TouchableOpacity
                    key={s}
                    style={[styles.suggestionChip, { backgroundColor: colors.card, borderColor: colors.border }]}
                    onPress={() => send(s)}
                  >
                    <Text style={[styles.suggestionText, { color: colors.foreground }]}>{s}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          ) : null
        }
        renderItem={({ item }) => {
          const isUser = item.role === "user";
          return (
            <View style={[styles.msgRow, isUser && styles.msgRowUser]}>
              {!isUser && (
                <View style={[styles.avatarIcon, { backgroundColor: "#9945ff22" }]}>
                  <Feather name="cpu" size={14} color="#9945ff" />
                </View>
              )}
              <View
                style={[
                  styles.bubble,
                  isUser
                    ? { backgroundColor: colors.primary, borderBottomRightRadius: 4 }
                    : { backgroundColor: colors.card, borderColor: colors.border, borderWidth: 1, borderBottomLeftRadius: 4 },
                ]}
              >
                <Text style={[styles.bubbleText, { color: isUser ? "#fff" : colors.foreground }]}>
                  {item.content}
                </Text>
              </View>
            </View>
          );
        }}
        ListFooterComponent={
          loading ? (
            <View style={styles.typingRow}>
              <View style={[styles.avatarIcon, { backgroundColor: "#9945ff22" }]}>
                <Feather name="cpu" size={14} color="#9945ff" />
              </View>
              <View style={[styles.typingBubble, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <ActivityIndicator size="small" color="#9945ff" />
                <Text style={[styles.typingText, { color: colors.mutedForeground }]}>Analyzing...</Text>
              </View>
            </View>
          ) : null
        }
        showsVerticalScrollIndicator={false}
      />

      <View
        style={[
          styles.inputBar,
          {
            backgroundColor: colors.background,
            borderTopColor: colors.border,
            paddingBottom: botPad + 8,
          },
        ]}
      >
        <TextInput
          style={[
            styles.input,
            {
              backgroundColor: colors.card,
              borderColor: colors.border,
              color: colors.foreground,
            },
          ]}
          value={input}
          onChangeText={setInput}
          placeholder="Ask about this token..."
          placeholderTextColor={colors.mutedForeground}
          multiline
          maxLength={400}
          onSubmitEditing={handleSend}
          returnKeyType="send"
        />
        <TouchableOpacity
          style={[
            styles.sendBtn,
            { backgroundColor: input.trim() ? colors.primary : colors.muted },
          ]}
          onPress={handleSend}
          disabled={!input.trim() || loading}
        >
          <Feather name="send" size={16} color={input.trim() ? "#fff" : colors.mutedForeground} />
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    gap: 10,
  },
  backBtn: { padding: 4 },
  headerCenter: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
  },
  aiPulse: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#9945ff",
  },
  headerTitle: { fontSize: 16, fontWeight: "700", flex: 1 },
  resetBtn: { padding: 4 },
  welcomeBox: {
    alignItems: "center",
    paddingTop: 40,
    paddingBottom: 20,
    gap: 12,
  },
  aiIconBig: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: "center",
    justifyContent: "center",
  },
  welcomeTitle: { fontSize: 18, fontWeight: "700", textAlign: "center" },
  welcomeSub: { fontSize: 12, textAlign: "center" },
  suggestions: { width: "100%", gap: 8, marginTop: 8 },
  suggestionChip: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
  },
  suggestionText: { fontSize: 13, fontWeight: "500" },
  msgRow: {
    flexDirection: "row",
    gap: 8,
    maxWidth: "90%",
  },
  msgRowUser: {
    alignSelf: "flex-end",
    flexDirection: "row-reverse",
  },
  avatarIcon: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
    marginTop: 2,
  },
  bubble: {
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 10,
    maxWidth: "100%",
  },
  bubbleText: { fontSize: 14, lineHeight: 20 },
  typingRow: {
    flexDirection: "row",
    gap: 8,
    alignItems: "center",
    marginTop: 4,
  },
  typingBubble: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 16,
    borderWidth: 1,
  },
  typingText: { fontSize: 13, fontStyle: "italic" },
  inputBar: {
    flexDirection: "row",
    alignItems: "flex-end",
    paddingHorizontal: 16,
    paddingTop: 10,
    borderTopWidth: 1,
    gap: 10,
  },
  input: {
    flex: 1,
    borderRadius: 20,
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 14,
    maxHeight: 100,
  },
  sendBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
});
