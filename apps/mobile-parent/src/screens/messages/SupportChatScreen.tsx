/**
 * Настоящая переписка родителя со школой — раздел «Поддержка» (миграция 234).
 *
 * ЧТО ЭТО НЕ. Это не витрина. Витрина — соседний SupportScreen с выдуманной
 * перепиской и «средним временем ответа 5 мин»; её видит демо-гость, и она не
 * тронута ни строкой. Развилку держит demoOr: демо → витрина, настоящий вход
 * → этот экран.
 *
 * КОГДА ЗАВОДИТСЯ КОМНАТА — ПРИ ПЕРВОМ СООБЩЕНИИ, А НЕ ПРИ ОТКРЫТИИ ЭКРАНА.
 * fn_ensure_support_thread создаёт комнату и вписывает туда всех админов
 * школы. Зови её на открытии — и у каждого родителя, кто просто заглянул в
 * раздел, заведётся пустая комната, а у админа список обращений забьётся
 * пустышками, среди которых потеряются настоящие. Поэтому комната появляется
 * ровно тогда, когда человеку есть что сказать.
 *
 * ЕСЛИ АДМИНА В ШКОЛЕ НЕТ. Признак — ни одного участника с ролью admin.
 * Экран говорит об этом прямо и не даёт отправлять: сделать вид, что
 * сообщение ушло, хуже отказа. Узнать это ДО создания комнаты нельзя —
 * таблицу админов родитель не читает вовсе (единственное правило чтения на
 * public.admins пускает админа к своей записи), а имена приходят через
 * chat_admin_names, которое отдаёт только тех, с кем ты уже в одной комнате.
 * Поэтому при первом сообщении порядок такой: завести комнату → посмотреть
 * состав → и только потом отправлять.
 *
 * ПОДПИСЬ КОМНАТЫ. В базе заголовок — имя самого родителя (админу нужно
 * видеть, кто написал). Родителю показываем «Поддержка школы»: собственное
 * имя читалось бы как переписка с самим собой.
 */
import { useMemo, useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import Svg, { Path } from "react-native-svg";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  ensureSupportThread,
  getSupportThread,
  getThreadMessages,
  markThreadRead,
  sendChatMessage,
  type ChatMessageRow,
  type SupportThread,
} from "@snr/core";
import { AppBackground, fonts, useTheme } from "../../theme";
import { ChatBubble, EmptyBlock, ErrorBlock, GlassCard, InnerHeader, LoadingBlock } from "../../ui";
import { useAsyncData } from "../../hooks/useAsyncData";
import { getSupabase } from "../../lib/supabase";
import { useAppLocale } from "../../i18n";

type Загруженное = { thread: SupportThread | null; messages: ChatMessageRow[] };

/** Время сообщения. Формат тот же, что у остальных переписок приложения. */
function времяЧЧММ(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

/** Бумажный самолётик кнопки отправки. */
function SendIcon({ color }: { color: string }) {
  return (
    <Svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <Path d="m22 2-7 20-4-9-9-4Z" />
      <Path d="M22 2 11 13" />
    </Svg>
  );
}

export function SupportChatScreen() {
  const { tokens } = useTheme();
  const { d } = useAppLocale();
  const t = d.parentApp.msg;
  const insets = useSafeAreaInsets();

  const [черновик, setЧерновик] = useState("");
  const [отправка, setОтправка] = useState(false);
  const [сбой, setСбой] = useState<string | null>(null);

  const state = useAsyncData<Загруженное>(async () => {
    const db = getSupabase();
    const thread = await getSupportThread(db);
    if (!thread) return { thread: null, messages: [] };
    const messages = await getThreadMessages(db, thread.id);
    // Открыли — прочитано. Отметка не критична: не легла — счётчик просто
    // останется гореть, ронять из-за этого экран нечего.
    const последнее = messages.length > 0 ? messages[messages.length - 1] : null;
    if (последнее) await markThreadRead(db, thread.id, последнее.id).catch(() => undefined);
    return { thread, messages };
  }, []);

  const данные = state.data;
  const комната = данные?.thread ?? null;
  const сообщения = данные?.messages ?? [];

  /** Кто есть кто в комнате: имя и роль по идентификатору отправителя. */
  const ктоЕсть = useMemo(() => {
    const m = new Map<string, { имя: string; админ: boolean }>();
    for (const p of комната?.participants ?? []) {
      m.set(p.user_id, { имя: p.full_name, админ: p.role_in_thread === "admin" });
    }
    return m;
  }, [комната]);

  /** Отвечать некому — ни одного админа в комнате. Пока комнаты нет, это
   *  неизвестно, и до первой отправки поле остаётся открытым. */
  const админовНет = комната !== null
    && (комната.participants ?? []).every((p) => p.role_in_thread !== "admin");

  const отправить = async () => {
    const текст = черновик.trim();
    if (!текст || отправка || админовНет) return;
    setОтправка(true);
    setСбой(null);
    try {
      const db = getSupabase();
      // Комнаты может ещё не быть — заводим её ровно здесь, при первом
      // сообщении. Вызов идемпотентен: второй раз он ничего не создаёт, но
      // добирает админов, заведённых после создания комнаты.
      let id = комната?.id ?? null;
      if (!id) {
        id = await ensureSupportThread(db);
        if (!id) throw new Error(t.supportSendFailed);
        // Проверяем состав ДО отправки: если админов нет, сообщение уйдёт в
        // комнату, которую никто не читает. Лучше сказать словами.
        const свежая = await getSupportThread(db);
        const естьАдмин = (свежая?.participants ?? []).some((p) => p.role_in_thread === "admin");
        if (!естьАдмин) {
          await state.refresh();
          return;
        }
      }
      await sendChatMessage(db, id, текст);
      setЧерновик("");
      await state.refresh();
    } catch (e) {
      setСбой((e as { message?: string })?.message ?? t.supportSendFailed);
    } finally {
      setОтправка(false);
    }
  };

  const можноПисать = !админовНет && !отправка;

  return (
    <AppBackground>
      <InnerHeader title={t.supportRealTitle} />
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={insets.top + 56}
      >
        <ScrollView
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 16, gap: 10 }}
          showsVerticalScrollIndicator={false}
        >
          <Text style={{ fontFamily: fonts.manrope600, fontSize: 11, lineHeight: 16, color: tokens.ink3, paddingHorizontal: 2 }}>
            {t.supportRealSub}
          </Text>

          {state.loading ? (
            <LoadingBlock />
          ) : state.error ? (
            <ErrorBlock
              title={d.parentApp.more4.loadFailed}
              message={state.error.message}
              retryLabel={d.common.retry}
              onRetry={() => state.refresh()}
            />
          ) : админовНет ? (
            <EmptyBlock title={t.supportNoAdminTitle} text={t.supportNoAdminText} />
          ) : сообщения.length === 0 ? (
            <EmptyBlock title={t.supportStartTitle} text={t.supportStartText} />
          ) : (
            сообщения.map((m) => {
              const кто = m.sender_id ? ктоЕсть.get(m.sender_id) : undefined;
              const мой = !кто?.админ;
              return (
                <View key={m.id} style={{ gap: 3 }}>
                  {/* Имя отправителя — только у чужих: своё имя над своим же
                      сообщением не нужно, а вот кто из админов ответил —
                      нужно, их в школе может быть несколько. */}
                  {!мой ? (
                    <Text
                      style={{
                        fontFamily: fonts.manrope700,
                        fontSize: 9.5,
                        color: tokens.ink3,
                        paddingHorizontal: 4,
                      }}
                    >
                      {(кто?.имя ?? "") + " · " + t.supportRoleAdmin}
                    </Text>
                  ) : null}
                  <View style={{ flexDirection: "row", justifyContent: мой ? "flex-end" : "flex-start" }}>
                    <ChatBubble direction={мой ? "out" : "in"} text={m.body} time={времяЧЧММ(m.created_at)} />
                  </View>
                </View>
              );
            })
          )}

          {сбой ? (
            <GlassCard radius={16} contentStyle={{ padding: 12 }}>
              <Text style={{ fontFamily: fonts.manrope700, fontSize: 11, color: tokens.status.red.text }}>
                {t.supportSendFailed}
              </Text>
              <Text style={{ fontFamily: fonts.manrope600, fontSize: 10.5, color: tokens.ink3, marginTop: 2 }}>
                {сбой}
              </Text>
            </GlassCard>
          ) : null}
        </ScrollView>

        {/* Поле ввода. Пока отвечать некому — закрыто: сделать вид, что
            сообщение ушло, хуже честного отказа. */}
        <View
          style={{
            flexDirection: "row",
            alignItems: "flex-end",
            gap: 8,
            paddingHorizontal: 16,
            paddingTop: 8,
            paddingBottom: Math.max(insets.bottom, 10),
          }}
        >
          <View style={{ flex: 1 }}>
            <GlassCard radius={18} contentStyle={{ paddingHorizontal: 12, paddingVertical: 6 }}>
              <TextInput
                value={черновик}
                onChangeText={setЧерновик}
                editable={можноПисать}
                multiline
                placeholder={t.typeMessage}
                placeholderTextColor={tokens.ink3}
                style={{
                  fontFamily: fonts.manrope600,
                  fontSize: 11.5,
                  color: tokens.ink1,
                  maxHeight: 96,
                  minHeight: 28,
                  opacity: можноПисать ? 1 : 0.5,
                }}
              />
            </GlassCard>
          </View>
          <Pressable
            onPress={отправить}
            disabled={!можноПисать || !черновик.trim()}
            style={({ pressed }) => ({
              width: 40,
              height: 40,
              borderRadius: 999,
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: tokens.accent,
              opacity: !можноПисать || !черновик.trim() ? 0.45 : pressed ? 0.8 : 1,
            })}
          >
            <SendIcon color="#FFFFFF" />
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </AppBackground>
  );
}
