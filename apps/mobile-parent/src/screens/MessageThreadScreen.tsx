import { useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation, useRoute, type RouteProp } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import {
  getMyThreadSummaries,
  getThreadMessages,
  sendChatMessage,
  markThreadRead,
  formatDate,
  formatTime,
  type ChatMessageRow,
  type ChatThreadSummary,
  type Dictionary,
} from "@snr/core";
import { useAppLocale } from "../i18n";
import { useAsyncData } from "../hooks/useAsyncData";
import { useRealtimeChannel } from "../hooks/useRealtimeChannel";
import { getSupabase } from "../lib/supabase";
import { ScreenSkeleton, ErrorState } from "../components/ScreenState";
import { colors, gradients, radii, shadow, spacing } from "../theme";
import type { MainStackParamList } from "../navigation/MainNavigator";

function initials(name: string): string {
  return name.split(" ").map((p) => p[0]).filter(Boolean).slice(0, 2).join("").toUpperCase();
}

/** Тот же расчёт заголовка, что MessagesScreen, но с настоящим myUserId (там
 *  захардкожен null — известный баг, см. системный промт МОБ-4). Для
 *  direct-треда имя "собеседника" резолвится верно только если знать, кто
 *  "я". */
function threadTitle(t: ChatThreadSummary, myUserId: string | null): string {
  if (t.kind === "group") return t.title ?? t.directGroupName ?? "—";
  if (t.kind === "direct") {
    const other = t.participants.find((p) => p.user_id !== myUserId);
    return other?.full_name ?? t.title ?? "—";
  }
  return t.title ?? "—";
}

/** Бейдж-подзаголовок под именем: реальный предмет/группа, если он есть в
 *  данных — ничего не придумываем, если предмета нет (см. схемную оговорку
 *  в системном промте про directSubjectName). */
function threadSubtitle(t: ChatThreadSummary, d: Dictionary): string {
  if (t.kind === "group") return t.directGroupName ?? t.title ?? d.chat.sectionGroupChat;
  if (t.kind === "direct") {
    if (t.isCuratorThread) return d.chat.sectionCurator;
    if (t.directSubjectName) return `${d.parentMobile.subjTeacherLabel} ${t.directSubjectName}`;
    return d.parentMobile.subjTeacherLabel;
  }
  return t.title ?? "";
}

// Школа в Asia/Tashkent (UTC+5, см. packages/core/src/utils/date.ts) — тот же
// сдвиг-трюк, что NotificationsScreen.tsx использует для isToday/isYesterday,
// применяем его здесь для группировки сообщений по календарным дням.
function dayKey(iso: string): string {
  return new Date(new Date(iso).getTime() + 5 * 3600000).toISOString().slice(0, 10);
}
function todayKey(): string {
  return new Date(Date.now() + 5 * 3600000).toISOString().slice(0, 10);
}
function yesterdayKey(): string {
  return new Date(Date.now() + 5 * 3600000 - 86400000).toISOString().slice(0, 10);
}
function daySeparatorLabel(iso: string, d: Dictionary): string {
  const key = dayKey(iso);
  if (key === todayKey()) return d.chat.today;
  if (key === yesterdayKey()) return d.chat.yesterday;
  return formatDate(iso);
}

type RealtimeMessagePayload = { eventType: string; new?: ChatMessageRow };

export default function MessageThreadScreen() {
  const { d } = useAppLocale();
  const db = getSupabase();
  const nav = useNavigation<NativeStackNavigationProp<MainStackParamList>>();
  const route = useRoute<RouteProp<MainStackParamList, "MessageThread">>();
  const { threadId } = route.params;

  const [myUserId, setMyUserId] = useState<string | null>(null);
  useEffect(() => {
    db.auth.getUser().then(({ data }) => setMyUserId(data.user?.id ?? null));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Нет отдельного getThreadById — тот же паттерн, что и везде в этом
  // кодбейзе для похожей формы задачи: переиспользуем список тредов и ищем
  // нужный по id (см. системный промт МОБ-4).
  const threadsQuery = useAsyncData<ChatThreadSummary[]>(() => getMyThreadSummaries(db), []);
  const thread = threadsQuery.data?.find((t) => t.id === threadId) ?? null;

  const messagesQuery = useAsyncData<ChatMessageRow[]>(() => getThreadMessages(db, threadId), [threadId]);
  const baseMessages = messagesQuery.data ?? [];

  // Сообщения, добавленные локально (свои только что отправленные + пришедшие
  // по realtime), которых ещё нет в последнем fetch — мёржим поверх
  // baseMessages по id, не затирая исходный fetch и не создавая гонку с
  // отложенным useEffect (порядок важен: baseMessages должен быть виден в
  // ТОМ ЖЕ рендере, где messagesQuery.loading становится false).
  const [extraMessages, setExtraMessages] = useState<ChatMessageRow[]>([]);
  const messages = useMemo(() => {
    if (extraMessages.length === 0) return baseMessages;
    const merged = [...baseMessages];
    for (const m of extraMessages) {
      if (!merged.some((x) => x.id === m.id)) merged.push(m);
    }
    return merged;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [baseMessages, extraMessages]);

  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<ScrollView>(null);

  // Отмечаем тред прочитанным при загрузке и при каждом новом сообщении —
  // fire-and-forget (не блокирует и не отображается на экране), но ошибка
  // всё равно логируется, а не проглатывается молча — тот же принцип, что
  // и во всех остальных запросах этого приложения.
  useEffect(() => {
    if (messages.length === 0) return;
    const last = messages[messages.length - 1];
    markThreadRead(db, threadId, last.id).catch((e: unknown) => {
      console.error("[MessageThreadScreen] markThreadRead failed:", e);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [threadId, messages.length]);

  // Тот же channelName/table/filter формат, что и веб (apps/web/components/
  // chat/MessagesView.tsx: `chat-thread-${activeThreadId}`, "chat_messages",
  // `thread_id=eq.${activeThreadId}`) — честный порт рабочего паттерна, а не
  // повторное изобретение.
  useRealtimeChannel(
    db,
    `chat-thread-${threadId}`,
    "chat_messages",
    `thread_id=eq.${threadId}`,
    (payload) => {
      const p = payload as RealtimeMessagePayload;
      if (p.eventType !== "INSERT" || !p.new) return;
      const row = p.new;
      setExtraMessages((prev) => (prev.some((m) => m.id === row.id) ? prev : [...prev, row]));
    },
  );

  async function onSend() {
    const body = draft.trim();
    if (!body || sending) return;
    setSending(true);
    try {
      const saved = await sendChatMessage(db, threadId, body);
      setExtraMessages((prev) => (prev.some((m) => m.id === saved.id) ? prev : [...prev, saved]));
      setDraft("");
    } catch {
      // Черновик НЕ очищаем при ошибке — пользователь может повторить попытку,
      // сообщение не пропадает молча (запрещённый анти-паттерн).
      Alert.alert(d.chat.sendError);
    } finally {
      setSending(false);
    }
  }

  // TODO(voice-video): в продукте нет инфраструктуры звонков ни на вебе, ни
  // здесь — кнопки звонка/видео полностью мок.
  function onCallPress() {
    Alert.alert(d.parentMobile.threadCallMockTitle, d.parentMobile.threadCallMockNotice);
  }
  function onVideoPress() {
    Alert.alert(d.parentMobile.threadCallMockTitle, d.parentMobile.threadCallMockNotice);
  }

  // TODO(chat-attachments): chat_messages.attachments существует в схеме, но
  // нигде в продукте не используется (веб тоже без UI вложений) — кнопка "+"
  // полностью мок.
  function onAttachPress() {
    Alert.alert(d.parentMobile.threadAttachMockNotice);
  }

  const loading = threadsQuery.loading || messagesQuery.loading;
  const error = threadsQuery.error ?? messagesQuery.error;

  const grouped = useMemo(() => {
    const out: { separatorLabel: string | null; message: ChatMessageRow }[] = [];
    let lastKey: string | null = null;
    for (const m of messages) {
      const key = dayKey(m.created_at);
      out.push({ separatorLabel: key !== lastKey ? daySeparatorLabel(m.created_at, d) : null, message: m });
      lastKey = key;
    }
    return out;
  }, [messages, d]);

  const showDot = !!thread && (thread.isCuratorThread || thread.kind !== "group");

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <SafeAreaView style={{ flex: 1 }} edges={["top"]}>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
          <View
            style={{
              flexDirection: "row", alignItems: "center", gap: 9,
              paddingHorizontal: spacing.lg, paddingTop: spacing.md, paddingBottom: spacing.sm,
            }}
          >
            <Pressable
              onPress={() => nav.goBack()}
              style={({ pressed }) => [{
                width: 38, height: 38, borderRadius: 19, backgroundColor: "#fff", alignItems: "center", justifyContent: "center",
                opacity: pressed ? 0.85 : 1, ...shadow.soft,
              }]}
            >
              <Ionicons name="chevron-back" size={20} color={colors.textPrimary} />
            </Pressable>

            {thread ? (
              <>
                <View style={{ position: "relative" }}>
                  <View style={{ width: 42, height: 42, borderRadius: 21, backgroundColor: "#F1EBFF", alignItems: "center", justifyContent: "center" }}>
                    {thread.kind === "group" ? (
                      <Ionicons name="people" size={19} color={colors.primary} />
                    ) : (
                      <Text style={{ fontSize: 13, fontWeight: "800", color: colors.primary }}>
                        {initials(threadTitle(thread, myUserId))}
                      </Text>
                    )}
                  </View>
                  {/* TODO(presence): chat_participants не хранит online/last_seen,
                      presence-канала в проекте нет ни на вебе, ни здесь — точка
                      декоративная и НЕ отражает реальный статус собеседника. */}
                  {showDot && (
                    <View
                      style={{
                        position: "absolute", right: 0, bottom: 0, width: 11, height: 11, borderRadius: 5.5,
                        backgroundColor: colors.textFaint, borderWidth: 2, borderColor: colors.bg,
                      }}
                    />
                  )}
                </View>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text numberOfLines={1} style={{ fontSize: 14.5, fontWeight: "800", color: colors.textPrimary }}>
                    {threadTitle(thread, myUserId)}
                  </Text>
                  <Text
                    numberOfLines={1}
                    style={{
                      fontSize: 9, fontWeight: "800", color: colors.primary, backgroundColor: "#F1EBFF",
                      borderRadius: 6, paddingVertical: 2, paddingHorizontal: 7, marginTop: 3, alignSelf: "flex-start",
                    }}
                  >
                    {threadSubtitle(thread, d)}
                  </Text>
                </View>
                <Pressable
                  onPress={onCallPress}
                  style={({ pressed }) => [{
                    width: 36, height: 36, borderRadius: 18, backgroundColor: "#fff", alignItems: "center", justifyContent: "center",
                    opacity: pressed ? 0.85 : 1, ...shadow.soft,
                  }]}
                >
                  <Ionicons name="call-outline" size={16} color={colors.primary} />
                </Pressable>
                <Pressable
                  onPress={onVideoPress}
                  style={({ pressed }) => [{
                    width: 36, height: 36, borderRadius: 18, backgroundColor: "#fff", alignItems: "center", justifyContent: "center",
                    opacity: pressed ? 0.85 : 1, ...shadow.soft,
                  }]}
                >
                  <Ionicons name="videocam-outline" size={17} color={colors.primary} />
                </Pressable>
              </>
            ) : (
              <Text style={{ flex: 1, fontSize: 15, fontWeight: "800", color: colors.textPrimary }}>{d.chat.title}</Text>
            )}
          </View>

          <ScrollView
            ref={scrollRef}
            contentContainerStyle={{ paddingHorizontal: spacing.lg, paddingBottom: 20 }}
            keyboardShouldPersistTaps="handled"
            onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: false })}
          >
            {error ? (
              <ErrorState
                message={d.parentMobile.errorGeneric}
                retryLabel={d.common.retry}
                onRetry={() => {
                  threadsQuery.refresh();
                  messagesQuery.refresh();
                }}
              />
            ) : loading ? (
              <ScreenSkeleton />
            ) : messages.length === 0 ? (
              <View style={{ alignItems: "center", paddingTop: 48, paddingBottom: 16 }}>
                <View style={{ width: 72, height: 72, borderRadius: 36, backgroundColor: "#EFEAFF", alignItems: "center", justifyContent: "center", marginBottom: spacing.md }}>
                  <Ionicons name="chatbubble-ellipses-outline" size={28} color={colors.primary} />
                </View>
                <Text style={{ fontSize: 15, fontWeight: "800", color: colors.textPrimary, marginBottom: 5 }}>
                  {d.chat.noMessagesInThread}
                </Text>
                <Text style={{ fontSize: 12.5, color: colors.textSecondary, textAlign: "center" }}>
                  {d.parentMobile.threadEmptyDesc}
                </Text>
              </View>
            ) : (
              grouped.map(({ separatorLabel, message }) => (
                <View key={message.id}>
                  {separatorLabel && (
                    <View style={{ alignItems: "center", marginVertical: 12 }}>
                      <Text
                        style={{
                          fontSize: 10.5, fontWeight: "700", color: colors.textSecondary, backgroundColor: colors.chipBg,
                          borderRadius: 9, paddingVertical: 5, paddingHorizontal: 12,
                        }}
                      >
                        {separatorLabel}
                      </Text>
                    </View>
                  )}
                  <MessageBubble message={message} isMe={message.sender_id != null && message.sender_id === myUserId} />
                </View>
              ))
            )}
          </ScrollView>

          <View
            style={{
              flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: spacing.md, paddingVertical: 10,
              backgroundColor: colors.bgAlt, borderTopWidth: 1, borderTopColor: colors.border,
            }}
          >
            <Pressable
              onPress={onAttachPress}
              style={({ pressed }) => [{
                width: 38, height: 38, borderRadius: 19, backgroundColor: "#fff", borderWidth: 1.5, borderColor: colors.borderAlt,
                alignItems: "center", justifyContent: "center", opacity: pressed ? 0.85 : 1, flexShrink: 0,
              }]}
            >
              <Ionicons name="add" size={20} color={colors.primary} />
            </Pressable>
            <View
              style={{
                flex: 1, flexDirection: "row", alignItems: "center", backgroundColor: "#fff", borderWidth: 1.5,
                borderColor: colors.borderAlt, borderRadius: 20, height: 40, paddingHorizontal: 14,
              }}
            >
              <TextInput
                value={draft}
                onChangeText={setDraft}
                placeholder={d.chat.composerPlaceholder}
                placeholderTextColor={colors.textFaint}
                style={{ flex: 1, fontSize: 12.5, fontWeight: "500", color: colors.textPrimary, padding: 0 }}
                onSubmitEditing={onSend}
                returnKeyType="send"
              />
            </View>
            <Pressable
              onPress={onSend}
              disabled={!draft.trim() || sending}
              style={({ pressed }) => [{ opacity: pressed || !draft.trim() ? 0.6 : 1, flexShrink: 0 }]}
            >
              <LinearGradient
                colors={gradients.primary}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={{ width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center" }}
              >
                <Ionicons name="send" size={16} color="#fff" />
              </LinearGradient>
            </Pressable>
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}

function MessageBubble({ message, isMe }: { message: ChatMessageRow; isMe: boolean }) {
  const time = formatTime(message.created_at);

  if (isMe) {
    return (
      <View style={{ flexDirection: "row", justifyContent: "flex-end", marginBottom: 9 }}>
        <LinearGradient
          colors={gradients.primary}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{ maxWidth: "78%", borderRadius: radii.lg, borderBottomRightRadius: 4, padding: 11, paddingHorizontal: 13 }}
        >
          <Text style={{ fontSize: 12.5, lineHeight: 18, color: "#fff" }}>{message.body}</Text>
          {/* "✓✓" — декоративный признак успешной отправки, не per-сообщение
              read-receipt: chat_read_state хранит только last_read_message_id
              на весь тред, точного "прочитано ли именно это сообщение" в
              схеме нет. */}
          <Text style={{ fontSize: 9, fontWeight: "600", color: "rgba(255,255,255,0.75)", textAlign: "right", marginTop: 4 }}>
            {time} ✓✓
          </Text>
        </LinearGradient>
      </View>
    );
  }

  return (
    <View style={{ flexDirection: "row", justifyContent: "flex-start", marginBottom: 9 }}>
      <View style={{ maxWidth: "78%", backgroundColor: colors.card, borderRadius: radii.lg, borderBottomLeftRadius: 4, padding: 11, paddingHorizontal: 13, ...shadow.soft }}>
        <Text style={{ fontSize: 12.5, lineHeight: 18, color: colors.textPrimary }}>{message.body}</Text>
        <Text style={{ fontSize: 9, fontWeight: "600", color: colors.textFaint, textAlign: "right", marginTop: 4 }}>{time}</Text>
      </View>
    </View>
  );
}
