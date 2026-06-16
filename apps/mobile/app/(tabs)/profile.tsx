import { useCallback, useEffect, useState } from "react";
import {
  Alert,
  Pressable,
  Switch,
  Text,
  TextInput,
  View,
} from "react-native";
import * as SecureStore from "expo-secure-store";
import * as DocumentPicker from "expo-document-picker";
import { useRouter } from "expo-router";
import {
  defaultLocale,
  getDictionary,
  getMyStudent,
  getMyGroups,
  getNotificationSettings,
  getTeachers,
  getSubjectStyle,
  upsertNotificationSettings,
  updateStudentAvatar,
} from "@snr/core";
import type { Database, Locale } from "@snr/core";
import { colors } from "@snr/ui-tokens";
import { Screen, SegmentedTabs, SubjectIcon } from "../../components";
import { getSupabase } from "../../lib/supabase";

type Student = Database["public"]["Tables"]["students"]["Row"];
type Group = Database["public"]["Tables"]["groups"]["Row"];
type NotifSettings = Database["public"]["Tables"]["notification_settings"]["Row"];
type ProfileTab = "profile" | "security" | "notifications" | "interface";

const THEME_KEY = "snr-theme";
const LOCALE_KEY = "snr-locale";

const cardStyle = {
  backgroundColor: colors.bgCard,
  borderRadius: 20,
  padding: 16,
  marginBottom: 16,
  shadowColor: "#000",
  shadowOpacity: 0.04,
  shadowRadius: 6,
  elevation: 1,
} as const;

export default function ProfileScreen() {
  const sb = getSupabase();
  const router = useRouter();
  const [locale, setLocaleState] = useState<Locale>(defaultLocale);
  const d = getDictionary(locale);

  const [student, setStudent] = useState<Student | null>(null);
  const [groups, setGroups] = useState<Group[]>([]);
  const [notif, setNotif] = useState({
    push_homework: true,
    push_schedule: true,
    push_grades: true,
    push_attendance: false,
  });
  const [curatorName, setCuratorName] = useState("");
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<ProfileTab>("profile");
  const [notifSaving, setNotifSaving] = useState(false);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [pwResetSent, setPwResetSent] = useState(false);
  const [savedTheme, setSavedTheme] = useState<string>("system");

  // Load persisted locale/theme from SecureStore
  useEffect(() => {
    SecureStore.getItemAsync(LOCALE_KEY).then((v) => {
      if (v === "ru" || v === "en" || v === "uz") setLocaleState(v as Locale);
    });
    SecureStore.getItemAsync(THEME_KEY).then((v) => {
      if (v) setSavedTheme(v);
    });
  }, []);

  const handleLocale = useCallback(async (l: Locale) => {
    setLocaleState(l);
    await SecureStore.setItemAsync(LOCALE_KEY, l);
  }, []);

  const handleTheme = useCallback(async (t: string) => {
    setSavedTheme(t);
    await SecureStore.setItemAsync(THEME_KEY, t);
  }, []);

  // Fetch profile data
  useEffect(() => {
    let mounted = true;
    async function load() {
      try {
        const [s, g] = await Promise.all([getMyStudent(sb), getMyGroups(sb)]);
        if (!mounted) return;
        setStudent(s);
        setGroups(g);
        if (s.curator_id) {
          const teachers = await getTeachers(sb);
          const c = teachers.find((t) => t.id === s.curator_id);
          if (mounted) setCuratorName(c?.full_name ?? "");
        }
        try {
          const ns: NotifSettings = await getNotificationSettings(sb);
          if (mounted) {
            setNotif({
              push_homework: ns.push_homework,
              push_schedule: ns.push_schedule,
              push_grades: ns.push_grades,
              push_attendance: ns.push_attendance,
            });
          }
        } catch {
          // new student — keep defaults
        }
      } finally {
        if (mounted) setLoading(false);
      }
    }
    load();
    return () => { mounted = false; };
  }, []);

  async function handleToggle(key: keyof typeof notif) {
    if (!student) return;
    const next = { ...notif, [key]: !notif[key] };
    setNotif(next);
    setNotifSaving(true);
    try {
      await upsertNotificationSettings(sb, { student_id: student.id, ...next });
    } finally {
      setNotifSaving(false);
    }
  }

  async function handleAvatarPick() {
    if (!student) return;
    const result = await DocumentPicker.getDocumentAsync({
      type: "image/*",
      copyToCacheDirectory: true,
    });
    if (result.canceled || !result.assets?.[0]) return;
    const asset = result.assets[0];
    setAvatarUploading(true);
    try {
      const response = await fetch(asset.uri);
      const blob = await response.blob();
      const ext = asset.name?.split(".").pop() ?? "jpg";
      const path = `${student.id}/avatar.${ext}`;
      const { error: uploadErr } = await sb.storage
        .from("avatars")
        .upload(path, blob, { upsert: true, contentType: asset.mimeType ?? undefined });
      if (uploadErr) throw uploadErr;
      const { data, error: urlErr } = await sb.storage
        .from("avatars")
        .createSignedUrl(path, 60 * 60 * 24 * 365);
      if (urlErr) throw urlErr;
      const signedUrl = data!.signedUrl;
      await updateStudentAvatar(sb, { studentId: student.id, avatarUrl: signedUrl });
      setStudent((s) => (s ? { ...s, avatar_url: signedUrl } : s));
    } catch {
      Alert.alert("Ошибка", "Не удалось загрузить аватар");
    } finally {
      setAvatarUploading(false);
    }
  }

  async function handleSignOut() {
    await sb.auth.signOut();
    router.replace("/(auth)/login" as never);
  }

  async function handlePasswordReset() {
    if (!student) return;
    const email = `${student.username?.toLowerCase()}@students.snr.local`;
    await sb.auth.resetPasswordForEmail(email);
    setPwResetSent(true);
    Alert.alert("Готово", "Письмо для сброса пароля отправлено на почту");
  }

  if (loading || !student) {
    return (
      <Screen title={d.profile.title}>
        <Text style={{ color: colors.textMuted, textAlign: "center" }}>{d.common.loading}</Text>
      </Screen>
    );
  }

  const initials = student.full_name
    .split(" ")
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  const TABS = [
    { key: "profile" as const, label: d.profile.tabProfile },
    { key: "security" as const, label: d.profile.tabSecurity },
    { key: "notifications" as const, label: d.profile.tabNotifications },
    { key: "interface" as const, label: d.profile.tabInterface },
  ];

  // ── Профиль ─────────────────────────────────────────────────────────────
  const ProfileTabContent = (
    <View>
      <View style={{ flexDirection: "row", gap: 10, marginBottom: 12 }}>
        <View style={{ ...cardStyle, flex: 1, marginBottom: 0 }}>
          <Text style={{ fontSize: 10, fontWeight: "700", color: colors.textMuted, textTransform: "uppercase", letterSpacing: 1, marginBottom: 4 }}>
            {d.profile.gradeLabel}
          </Text>
          <Text style={{ fontSize: 18, fontWeight: "700", color: colors.textPrimary }}>{student.grade}</Text>
        </View>
        <View style={{ ...cardStyle, flex: 1, marginBottom: 0 }}>
          <Text style={{ fontSize: 10, fontWeight: "700", color: colors.textMuted, textTransform: "uppercase", letterSpacing: 1, marginBottom: 4 }}>
            {d.profile.curator}
          </Text>
          <Text style={{ fontSize: 16, fontWeight: "700", color: colors.textPrimary, flexShrink: 1 }} numberOfLines={2}>{curatorName || "—"}</Text>
        </View>
      </View>

      <View style={cardStyle}>
        <Text style={{ fontSize: 10, fontWeight: "700", color: colors.textMuted, textTransform: "uppercase", letterSpacing: 1, marginBottom: 12 }}>
          {d.profile.groups}
        </Text>
        {groups.map((g) => {
          const style = getSubjectStyle(g.subject);
          return (
            <View
              key={g.id}
              style={{
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
                paddingVertical: 12,
                paddingHorizontal: 14,
                backgroundColor: colors.bgApp,
                borderRadius: 14,
                marginBottom: 8,
                borderLeftWidth: 4,
                borderLeftColor: style.color,
              }}
            >
              <View style={{ flexDirection: "row", alignItems: "center", gap: 10, flex: 1 }}>
                <SubjectIcon subject={g.subject} size={20} />
                <Text style={{ fontSize: 15, fontWeight: "700", color: colors.textPrimary, flexShrink: 1 }}>
                  {style.label}
                </Text>
              </View>
              {g.schedule_days ? (
                <View style={{ backgroundColor: colors.bgCard, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4, borderWidth: 1, borderColor: "rgba(0,0,0,0.06)", marginLeft: 8 }}>
                  <Text style={{ fontSize: 11, fontWeight: "700", color: colors.textMuted }}>{g.schedule_days}</Text>
                </View>
              ) : null}
            </View>
          );
        })}
      </View>
    </View>
  );

  // ── Безопасность ─────────────────────────────────────────────────────────
  const secEmail = `${student.username?.toLowerCase()}@students.snr.local`;

  const SecurityTabContent = (
    <View>
      <View style={cardStyle}>
        <Text style={{ fontSize: 10, fontWeight: "700", color: colors.textMuted, textTransform: "uppercase", letterSpacing: 1, marginBottom: 8 }}>
          Логин / телефон
        </Text>
        <TextInput
          value={student.username || ""}
          editable={false}
          style={{ backgroundColor: colors.bgApp, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, fontWeight: "600", color: colors.textMuted, marginBottom: 16 }}
        />
        <Text style={{ fontSize: 10, fontWeight: "700", color: colors.textMuted, textTransform: "uppercase", letterSpacing: 1, marginBottom: 8 }}>
          Привязанный E-mail
        </Text>
        <TextInput
          value={secEmail}
          editable={false}
          style={{ backgroundColor: colors.bgApp, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, fontWeight: "600", color: colors.textMuted }}
        />
      </View>

      <View style={{ ...cardStyle, gap: 10 }}>
        <Text style={{ fontSize: 15, fontWeight: "700", color: colors.textPrimary }}>Смена пароля</Text>
        <Text style={{ fontSize: 13, color: colors.textMuted, lineHeight: 20 }}>
          Вам на почту будет отправлена ссылка для сброса и создания нового пароля.
        </Text>
        {pwResetSent ? (
          <Text style={{ fontSize: 14, fontWeight: "600", color: colors.success }}>✓ Письмо отправлено</Text>
        ) : (
          <Pressable
            onPress={handlePasswordReset}
            style={{ backgroundColor: colors.bgApp, borderRadius: 12, paddingVertical: 13, paddingHorizontal: 16, alignItems: "center" }}
          >
            <Text style={{ fontSize: 14, fontWeight: "700", color: colors.textPrimary }}>Изменить пароль</Text>
          </Pressable>
        )}
      </View>
    </View>
  );

  // ── Уведомления ──────────────────────────────────────────────────────────
  const NotificationsTabContent = (
    <View style={cardStyle}>
      {notifSaving ? (
        <Text style={{ fontSize: 11, color: colors.textMuted, textAlign: "right", marginBottom: 8 }}>Сохранение…</Text>
      ) : null}
      {(
        [
          ["push_homework", d.profile.notifHomework],
          ["push_schedule", d.profile.notifSchedule],
          ["push_grades", d.profile.notifGrades],
          ["push_attendance", d.profile.notifAttendance],
        ] as const
      ).map(([key, label], i, arr) => (
        <View
          key={key}
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            paddingVertical: 14,
            borderBottomWidth: i < arr.length - 1 ? 1 : 0,
            borderBottomColor: "rgba(0,0,0,0.05)",
          }}
        >
          <Text style={{ fontSize: 15, fontWeight: "500", color: notif[key] ? colors.textPrimary : colors.textMuted, flex: 1, marginRight: 12 }}>
            {label}
          </Text>
          <Switch
            value={notif[key]}
            onValueChange={() => handleToggle(key)}
            trackColor={{ false: "#d1d5db", true: colors.success }}
            thumbColor="#fff"
          />
        </View>
      ))}
    </View>
  );

  // ── Интерфейс ────────────────────────────────────────────────────────────
  const THEMES = [
    { id: "light", label: "Светлая" },
    { id: "dark", label: "Тёмная" },
    { id: "system", label: "Системная" },
  ];
  const LANGS: { id: Locale; flag: string; label: string }[] = [
    { id: "ru", flag: "🇷🇺", label: "Русский" },
    { id: "en", flag: "🇺🇸", label: "Английский" },
    { id: "uz", flag: "🇺🇿", label: "Узбекский" },
  ];

  const InterfaceTabContent = (
    <View>
      <View style={cardStyle}>
        <Text style={{ fontSize: 10, fontWeight: "700", color: colors.textMuted, textTransform: "uppercase", letterSpacing: 1, marginBottom: 12 }}>
          {d.profile.theme}
        </Text>
        <View style={{ flexDirection: "row", gap: 8 }}>
          {THEMES.map(({ id, label }) => {
            const isActive = savedTheme === id;
            return (
              <Pressable
                key={id}
                onPress={() => handleTheme(id)}
                style={{
                  flex: 1,
                  paddingVertical: 12,
                  borderRadius: 12,
                  alignItems: "center",
                  backgroundColor: isActive ? colors.primary : colors.bgApp,
                  borderWidth: 1.5,
                  borderColor: isActive ? colors.primary : "rgba(0,0,0,0.06)",
                }}
              >
                <Text style={{ fontSize: 13, fontWeight: "700", color: isActive ? "#fff" : colors.textMuted }}>
                  {label}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      <View style={cardStyle}>
        <Text style={{ fontSize: 10, fontWeight: "700", color: colors.textMuted, textTransform: "uppercase", letterSpacing: 1, marginBottom: 12 }}>
          {d.profile.language}
        </Text>
        <View style={{ gap: 8 }}>
          {LANGS.map(({ id, flag, label }) => {
            const isActive = locale === id;
            return (
              <Pressable
                key={id}
                onPress={() => handleLocale(id)}
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 12,
                  paddingVertical: 13,
                  paddingHorizontal: 16,
                  borderRadius: 12,
                  backgroundColor: isActive ? "rgba(45,91,255,0.08)" : colors.bgApp,
                  borderWidth: 1.5,
                  borderColor: isActive ? colors.primary : "rgba(0,0,0,0.06)",
                }}
              >
                <Text style={{ fontSize: 22 }}>{flag}</Text>
                <Text style={{ fontSize: 15, fontWeight: "600", color: isActive ? colors.primary : colors.textPrimary }}>
                  {label}
                </Text>
                {isActive ? (
                  <Text style={{ color: colors.primary, fontSize: 16, fontWeight: "700", marginLeft: "auto" }}>✓</Text>
                ) : null}
              </Pressable>
            );
          })}
        </View>
      </View>
    </View>
  );

  const tabContent: Record<ProfileTab, React.ReactNode> = {
    profile: ProfileTabContent,
    security: SecurityTabContent,
    notifications: NotificationsTabContent,
    interface: InterfaceTabContent,
  };

  return (
    <Screen title={d.profile.title}>
      {/* Avatar card */}
      <View style={{ ...cardStyle, alignItems: "center", paddingVertical: 24 }}>
        <Pressable onPress={handleAvatarPick} disabled={avatarUploading} style={{ alignItems: "center" }}>
          <View
            style={{
              width: 96,
              height: 96,
              borderRadius: 48,
              backgroundColor: "#3B82F6",
              alignItems: "center",
              justifyContent: "center",
              marginBottom: 12,
              borderWidth: 3,
              borderColor: colors.bgCard,
              shadowColor: "#000",
              shadowOpacity: 0.12,
              shadowRadius: 12,
            }}
          >
            <Text style={{ fontSize: 32, fontWeight: "900", color: "#fff" }}>{initials}</Text>
          </View>
          <View
            style={{
              position: "absolute",
              bottom: 10,
              right: -4,
              backgroundColor: colors.primary,
              width: 28,
              height: 28,
              borderRadius: 14,
              alignItems: "center",
              justifyContent: "center",
              borderWidth: 2,
              borderColor: colors.bgCard,
            }}
          >
            <Text style={{ color: "#fff", fontSize: 14 }}>📷</Text>
          </View>
        </Pressable>
        <Text style={{ fontSize: 18, fontWeight: "800", color: colors.textPrimary }}>{student.full_name}</Text>
        <Text style={{ fontSize: 11, fontWeight: "700", color: colors.primary, textTransform: "uppercase", letterSpacing: 1, marginTop: 4 }}>
          Студент EduOS
        </Text>
        <Text style={{ fontSize: 13, color: colors.textMuted, marginTop: 4 }}>@{student.username}</Text>
        {avatarUploading ? (
          <Text style={{ fontSize: 12, color: colors.textMuted, marginTop: 8 }}>Загрузка аватара…</Text>
        ) : null}
      </View>

      {/* Tabs */}
      <View style={{ marginBottom: 16 }}>
        <SegmentedTabs
          tabs={TABS}
          value={activeTab}
          onChange={(k) => setActiveTab(k as ProfileTab)}
        />
      </View>

      {/* Tab content */}
      {tabContent[activeTab]}

      {/* Sign out */}
      <Pressable
        onPress={handleSignOut}
        style={{
          backgroundColor: "rgba(240,85,107,0.08)",
          borderRadius: 14,
          paddingVertical: 14,
          alignItems: "center",
          borderWidth: 1,
          borderColor: "rgba(240,85,107,0.2)",
          marginTop: 4,
          marginBottom: 8,
        }}
      >
        <Text style={{ color: colors.danger, fontWeight: "700", fontSize: 15 }}>
          {d.profile.logout}
        </Text>
      </Pressable>
    </Screen>
  );
}
