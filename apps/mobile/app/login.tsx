import { useState } from "react";
import {
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
  type TextStyle,
  type ViewStyle,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Eye, EyeOff, GraduationCap } from "lucide-react-native";
import { defaultLocale, getDictionary, signInWithUsername } from "@snr/core";
import { brand, colors } from "@snr/ui-tokens";
import { getSupabase } from "../lib/supabase";

const fieldLabel: TextStyle = { fontSize: 13, color: brand.inkMuted, fontWeight: "500" };
const fieldWrap: ViewStyle = { backgroundColor: brand.fieldBg, borderRadius: 12, overflow: "hidden" };
const input: TextStyle = { paddingHorizontal: 14, paddingVertical: 12, fontSize: 16, color: brand.ink };

export default function LoginScreen() {
  const d = getDictionary(defaultLocale);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [remember, setRemember] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit() {
    setLoading(true);
    setError(null);
    const { error: authError } = await signInWithUsername(getSupabase(), username, password);
    setLoading(false);
    if (authError) setError(d.auth.invalid);
    // успех -> onAuthStateChange в _layout редиректит
  }

  return (
    <View style={{ flex: 1, backgroundColor: brand.navy }}>
      {/* мягкие свечения (без blur — ограничение RN) */}
      <View style={{ position: "absolute", top: -80, right: -60, width: 260, height: 260, borderRadius: 130, backgroundColor: brand.glowBlue, opacity: 0.25 }} />
      <View style={{ position: "absolute", bottom: -100, left: -60, width: 300, height: 300, borderRadius: 150, backgroundColor: brand.glowPurple, opacity: 0.25 }} />

      <SafeAreaView style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={{ flexGrow: 1, justifyContent: "center", padding: 24, gap: 28 }}>
          {/* Брендинг */}
          <View style={{ alignItems: "center", gap: 12 }}>
            <View style={{ width: 96, height: 96, borderRadius: 28, backgroundColor: brand.logoFrom, alignItems: "center", justifyContent: "center" }}>
              <GraduationCap size={52} color="#fff" strokeWidth={2.5} />
            </View>
            <View style={{ flexDirection: "row", gap: 10 }}>
              <Text style={{ fontSize: 44, fontWeight: "700", color: "#fff" }}>SNR</Text>
              <Text style={{ fontSize: 44, fontWeight: "700", color: brand.logoAccent }}>EduOS</Text>
            </View>
            <Text style={{ fontSize: 16, color: "rgba(255,255,255,0.9)" }}>{d.auth.tagline}</Text>
          </View>

          {/* Карточка входа */}
          <View
            style={{
              backgroundColor: "#fff",
              borderRadius: 24,
              padding: 24,
              gap: 16,
              shadowColor: "#000",
              shadowOpacity: 0.3,
              shadowRadius: 30,
              shadowOffset: { width: 0, height: 20 },
              elevation: 8,
            }}
          >
            <Text style={{ fontSize: 22, fontWeight: "700", color: brand.ink }}>{d.auth.title}</Text>

            <View style={{ gap: 6 }}>
              <Text style={fieldLabel}>{d.auth.usernameLabel}</Text>
              <View style={fieldWrap}>
                <TextInput
                  value={username}
                  onChangeText={setUsername}
                  autoCapitalize="none"
                  autoCorrect={false}
                  placeholder={d.auth.usernamePlaceholder}
                  placeholderTextColor="#94A3B8"
                  style={input}
                />
              </View>
            </View>

            <View style={{ gap: 6 }}>
              <Text style={fieldLabel}>{d.auth.passwordLabel}</Text>
              <View style={[fieldWrap, { flexDirection: "row", alignItems: "center", paddingRight: 12 }]}>
                <TextInput
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry={!showPassword}
                  placeholder={d.auth.passwordPlaceholder}
                  placeholderTextColor="#94A3B8"
                  style={[input, { flex: 1 }]}
                />
                <Pressable onPress={() => setShowPassword((v) => !v)} hitSlop={8}>
                  {showPassword ? <EyeOff size={20} color="#A0ABC0" /> : <Eye size={20} color="#A0ABC0" />}
                </Pressable>
              </View>
            </View>

            <Pressable onPress={() => setRemember((v) => !v)} style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
              <View
                style={{
                  width: 18,
                  height: 18,
                  borderRadius: 4,
                  borderWidth: 1.5,
                  borderColor: remember ? brand.blue : "#CBD5E1",
                  backgroundColor: remember ? brand.blue : "#fff",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                {remember ? <Text style={{ color: "#fff", fontSize: 11, fontWeight: "700" }}>✓</Text> : null}
              </View>
              <Text style={{ fontSize: 14, color: brand.inkMuted }}>{d.auth.rememberMe}</Text>
            </Pressable>

            {error ? <Text style={{ color: colors.danger, fontSize: 13 }}>{error}</Text> : null}

            <Pressable
              onPress={onSubmit}
              disabled={loading}
              style={{ backgroundColor: brand.blue, borderRadius: 14, paddingVertical: 15, alignItems: "center", opacity: loading ? 0.6 : 1 }}
            >
              <Text style={{ color: "#fff", fontWeight: "700", fontSize: 16 }}>
                {loading ? d.common.loading : d.auth.submit}
              </Text>
            </Pressable>

            <Text style={{ textAlign: "center", color: brand.blue, fontSize: 14, fontWeight: "500" }}>
              {d.auth.forgot}
            </Text>
          </View>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}
