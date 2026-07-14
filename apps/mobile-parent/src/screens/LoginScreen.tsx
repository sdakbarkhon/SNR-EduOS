import { useState } from "react";
import {
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import Ionicons from "@expo/vector-icons/Ionicons";
import type { Locale } from "@snr/core";
import { useAppLocale } from "../i18n";
import { loginAsParent, NotParentError, type ParentProfile } from "../lib/auth";

const ORANGE_FROM = "#F97316";
const ORANGE_TO = "#FBBF24";

// Соотношение сторон брендового логотипа (тот же PNG, что и на вебе).
// Высота и ширина заданы явными числами (не через style.aspectRatio) —
// на Android aspectRatio у Image ненадёжно резолвится с локальным require(),
// изображение может отрисоваться в исходных пикселях (849×285) и обрезаться.
const LOGO_ASPECT = 849 / 285;
const LOGIN_LOGO_HEIGHT = 90;
const LOGIN_LOGO_WIDTH = Math.round(LOGIN_LOGO_HEIGHT * LOGO_ASPECT);

const LANGS: { code: Locale; label: string }[] = [
  { code: "ru", label: "RU" },
  { code: "uz", label: "UZ" },
  { code: "en", label: "EN" },
];

export default function LoginScreen({
  onLoggedIn,
}: {
  onLoggedIn: (profile: ParentProfile) => void;
}) {
  const { locale, d, setLocale } = useAppLocale();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit() {
    if (!username.trim() || !password) return;
    setLoading(true);
    setError(null);
    try {
      const profile = await loginAsParent(username, password);
      onLoggedIn(profile);
    } catch (e) {
      // loginAsParent already console.error's the real underlying cause
      // before rethrowing a short label — this switch only picks the UI
      // copy, it never swallows the original error silently.
      if (e instanceof NotParentError) {
        setError(e.reason === "no_profile" ? d.parentMobile.notParentDbError : d.parentMobile.notParentError);
      } else if (e && typeof e === "object" && "status" in e) {
        setError(d.auth.invalid);
      } else if (e instanceof Error && e.message === "config_error") {
        console.error("[LoginScreen] login failed due to app configuration, not connectivity:", e.message);
        setError(d.parentMobile.configError);
      } else {
        console.error("[LoginScreen] login failed with an unrecognized error:", e);
        setError(d.parentMobile.networkError);
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <View style={{ flex: 1, backgroundColor: "#FFFFFF" }}>
      <SafeAreaView style={{ flex: 1 }}>
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === "ios" ? "padding" : "height"}
        >
        <ScrollView
          contentContainerStyle={{ flexGrow: 1, justifyContent: "center", padding: 24, gap: 28 }}
          keyboardShouldPersistTaps="handled"
        >
          <View style={{ alignItems: "center", gap: 12 }}>
            <Image
              source={require("../../assets/logo-full.png")}
              style={{ width: LOGIN_LOGO_WIDTH, height: LOGIN_LOGO_HEIGHT }}
              resizeMode="contain"
            />
            <Text style={{ fontSize: 15, color: "#6B7280" }}>{d.parentMobile.loginSubtitle}</Text>
          </View>

          <View style={{ gap: 16 }}>
            <View style={{ gap: 6 }}>
              <Text style={{ fontSize: 13, color: "#4A5568", fontWeight: "500" }}>
                {d.auth.usernameLabel}
              </Text>
              <TextInput
                value={username}
                onChangeText={setUsername}
                autoCapitalize="none"
                autoCorrect={false}
                spellCheck={false}
                autoComplete="username"
                textContentType="username"
                importantForAutofill="no"
                placeholder={d.auth.usernamePlaceholder}
                placeholderTextColor="#94A3B8"
                style={{
                  backgroundColor: "#F4F6FB",
                  borderRadius: 12,
                  paddingHorizontal: 14,
                  paddingVertical: 12,
                  fontSize: 16,
                  color: "#1A1A24",
                }}
              />
            </View>

            <View style={{ gap: 6 }}>
              <Text style={{ fontSize: 13, color: "#4A5568", fontWeight: "500" }}>
                {d.auth.passwordLabel}
              </Text>
              <View style={{ justifyContent: "center" }}>
                <TextInput
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry={!showPassword}
                  autoCapitalize="none"
                  autoCorrect={false}
                  spellCheck={false}
                  autoComplete="password"
                  textContentType={Platform.OS === "ios" ? "password" : "none"}
                  importantForAutofill="no"
                  keyboardType={showPassword ? "visible-password" : "default"}
                  placeholder={d.auth.passwordPlaceholder}
                  placeholderTextColor="#94A3B8"
                  style={{
                    backgroundColor: "#F4F6FB",
                    borderRadius: 12,
                    paddingHorizontal: 14,
                    paddingRight: 44,
                    paddingVertical: 12,
                    fontSize: 16,
                    color: "#1A1A24",
                  }}
                />
                <Pressable
                  onPress={() => setShowPassword((v) => !v)}
                  hitSlop={10}
                  style={{ position: "absolute", right: 12 }}
                >
                  <Ionicons
                    name={showPassword ? "eye-off" : "eye"}
                    size={20}
                    color="#8A93A8"
                  />
                </Pressable>
              </View>
            </View>

            {error ? <Text style={{ color: "#DC2626", fontSize: 13 }}>{error}</Text> : null}

            <Pressable onPress={onSubmit} disabled={loading} style={{ opacity: loading ? 0.7 : 1 }}>
              <LinearGradient
                colors={[ORANGE_FROM, ORANGE_TO]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={{ borderRadius: 14, paddingVertical: 15, alignItems: "center" }}
              >
                {loading ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={{ color: "#fff", fontWeight: "700", fontSize: 16 }}>
                    {d.auth.submit}
                  </Text>
                )}
              </LinearGradient>
            </Pressable>
          </View>

          <View style={{ flexDirection: "row", justifyContent: "center", gap: 10 }}>
            {LANGS.map((l) => (
              <Pressable
                key={l.code}
                onPress={() => setLocale(l.code)}
                style={{
                  paddingHorizontal: 14,
                  paddingVertical: 6,
                  borderRadius: 999,
                  backgroundColor: locale === l.code ? ORANGE_FROM : "#F4F6FB",
                }}
              >
                <Text
                  style={{
                    fontSize: 13,
                    fontWeight: "600",
                    color: locale === l.code ? "#fff" : "#4A5568",
                  }}
                >
                  {l.label}
                </Text>
              </Pressable>
            ))}
          </View>
        </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}
