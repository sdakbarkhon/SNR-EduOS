import { useCallback, useEffect, useRef, useState } from "react";
import {
  Alert,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import * as DocumentPicker from "expo-document-picker";
import { ArrowLeft, Download, FileText, Paperclip, Send } from "lucide-react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  defaultLocale,
  getDictionary,
  getHomeworkById,
  getSubjectStyle,
  submitHomework,
  uploadHomeworkFile,
  type HomeworkWithSubmission,
} from "@snr/core";
import { colors } from "@snr/ui-tokens";
import { SubjectIcon } from "../../components";
import { getSupabase } from "../../lib/supabase";

const d = getDictionary(defaultLocale);
const sb = getSupabase();
const MAX_FILE_BYTES = 10 * 1024 * 1024; // 10 MB

type PickedFile = {
  name: string;
  uri: string;
  mimeType: string;
  size: number;
};

function SubmissionBlock({ hw }: { hw: HomeworkWithSubmission }) {
  const sub = hw.submission!;
  const submittedDate = new Date(sub.submitted_at).toLocaleDateString("ru-RU", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  return (
    <View
      style={{
        backgroundColor: "rgba(255,255,255,0.7)",
        borderRadius: 20,
        borderWidth: 1,
        borderColor: "rgba(255,255,255,0.6)",
        padding: 16,
        marginTop: 12,
      }}
    >
      <Text
        style={{
          fontSize: 10,
          fontWeight: "600",
          textTransform: "uppercase",
          letterSpacing: 0.8,
          color: colors.textMuted,
          marginBottom: 10,
        }}
      >
        {d.homework.detailYourSubmission}
      </Text>

      {sub.answer_text ? (
        <View
          style={{
            backgroundColor: "#F8FAFC",
            borderRadius: 12,
            padding: 12,
            marginBottom: 8,
          }}
        >
          <Text style={{ fontSize: 14, color: colors.textPrimary, lineHeight: 20 }}>
            {sub.answer_text}
          </Text>
        </View>
      ) : null}

      {sub.file_url ? (
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: 6,
            marginBottom: 8,
          }}
        >
          <Paperclip size={12} color={colors.textMuted} />
          <Text style={{ fontSize: 12, color: colors.textMuted }}>
            {sub.file_url.split("/").pop()}
          </Text>
        </View>
      ) : null}

      <Text style={{ fontSize: 11, color: colors.textMuted }}>
        {d.homework.submittedOn.replace("{date}", submittedDate)}
      </Text>

      {sub.grade != null ? (
        <View
          style={{
            marginTop: 10,
            borderTopWidth: 1,
            borderTopColor: "#F1F5F9",
            paddingTop: 10,
          }}
        >
          <Text style={{ fontSize: 14, fontWeight: "600", color: colors.textPrimary }}>
            {d.homework.grade}: {sub.grade}
          </Text>
        </View>
      ) : null}

      {sub.teacher_comment ? (
        <View
          style={{
            marginTop: 8,
            backgroundColor: "#EFF6FF",
            borderRadius: 12,
            padding: 10,
          }}
        >
          <Text style={{ fontSize: 13, color: "#1E40AF" }}>
            <Text style={{ fontWeight: "600" }}>{d.homework.teacherComment}: </Text>
            {sub.teacher_comment}
          </Text>
        </View>
      ) : null}
    </View>
  );
}

function SubmitForm({ hw, onSuccess }: { hw: HomeworkWithSubmission; onSuccess: () => void }) {
  const [text, setText] = useState("");
  const [file, setFile] = useState<PickedFile | null>(null);
  const [status, setStatus] = useState<"idle" | "submitting" | "success" | "error">("idle");

  const pickFile = async () => {
    const result = await DocumentPicker.getDocumentAsync({
      multiple: false,
      copyToCacheDirectory: true,
    });
    if (result.canceled) return;
    const asset = result.assets[0];
    if (!asset) return;
    if (asset.size && asset.size > MAX_FILE_BYTES) {
      Alert.alert("Файл слишком большой", "Максимальный размер файла — 10 МБ");
      return;
    }
    setFile({
      name: asset.name,
      uri: asset.uri,
      mimeType: asset.mimeType ?? "application/octet-stream",
      size: asset.size ?? 0,
    });
  };

  const handleSubmit = async () => {
    if (!text.trim() && !file) {
      Alert.alert(d.homework.formValidation);
      return;
    }
    setStatus("submitting");
    try {
      const student = await sb.from("students").select("id").single();
      if (student.error) throw student.error;
      const studentId = student.data.id;

      let filePath: string | undefined;
      if (file) {
        const blob = await fetch(file.uri).then((r) => r.blob());
        filePath = await uploadHomeworkFile(sb, {
          studentId,
          homeworkId: hw.id,
          fileName: file.name,
          blob,
        });
      }

      await submitHomework(sb, {
        homework_id: hw.id,
        student_id: studentId,
        ...(text.trim() ? { answer_text: text.trim() } : {}),
        ...(filePath ? { file_url: filePath } : {}),
        status: "submitted",
      });

      setStatus("success");
      onSuccess();
    } catch {
      setStatus("error");
      Alert.alert(d.homework.formError);
    }
  };

  if (status === "success") {
    return (
      <View
        style={{
          backgroundColor: "#DCFCE7",
          borderRadius: 16,
          padding: 16,
          alignItems: "center",
          marginTop: 12,
        }}
      >
        <Text style={{ color: "#16A34A", fontWeight: "600", fontSize: 15 }}>
          {d.homework.formSuccess}
        </Text>
      </View>
    );
  }

  return (
    <View
      style={{
        backgroundColor: "rgba(255,255,255,0.7)",
        borderRadius: 20,
        borderWidth: 1,
        borderColor: "rgba(255,255,255,0.6)",
        padding: 16,
        marginTop: 12,
        gap: 12,
      }}
    >
      <Text
        style={{
          fontSize: 10,
          fontWeight: "600",
          textTransform: "uppercase",
          letterSpacing: 0.8,
          color: colors.textMuted,
        }}
      >
        {d.homework.submit}
      </Text>

      <TextInput
        value={text}
        onChangeText={setText}
        placeholder={d.homework.answerPlaceholder}
        placeholderTextColor={colors.textMuted}
        multiline
        numberOfLines={4}
        style={{
          borderWidth: 1,
          borderColor: "#E2E8F0",
          borderRadius: 14,
          paddingHorizontal: 12,
          paddingVertical: 10,
          fontSize: 14,
          color: colors.textPrimary,
          backgroundColor: "rgba(255,255,255,0.9)",
          minHeight: 100,
          textAlignVertical: "top",
        }}
      />

      <Pressable
        onPress={pickFile}
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: 8,
          borderWidth: 1,
          borderStyle: "dashed",
          borderColor: file ? colors.primary : "#CBD5E1",
          borderRadius: 14,
          paddingHorizontal: 14,
          paddingVertical: 12,
        }}
      >
        <Paperclip size={16} color={file ? colors.primary : colors.textMuted} />
        <Text
          style={{
            fontSize: 14,
            color: file ? colors.primary : colors.textMuted,
            flex: 1,
          }}
          numberOfLines={1}
        >
          {file ? file.name : d.homework.attachFile}
        </Text>
        {file && (
          <Pressable
            onPress={() => setFile(null)}
            hitSlop={8}
          >
            <Text style={{ fontSize: 16, color: colors.textMuted }}>✕</Text>
          </Pressable>
        )}
      </Pressable>

      {status === "error" && (
        <Text style={{ fontSize: 12, color: "#EF4444" }}>{d.homework.formError}</Text>
      )}

      <Pressable
        onPress={handleSubmit}
        disabled={status === "submitting"}
        style={{
          borderRadius: 14,
          overflow: "hidden",
          opacity: status === "submitting" ? 0.6 : 1,
        }}
      >
        <View
          style={{
            backgroundColor: colors.primary,
            paddingVertical: 14,
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "center",
            gap: 8,
          }}
        >
          <Send size={16} color="#fff" />
          <Text style={{ color: "#fff", fontWeight: "600", fontSize: 15 }}>
            {status === "submitting" ? d.homework.formSubmitting : d.homework.send}
          </Text>
        </View>
      </Pressable>
    </View>
  );
}

export default function HomeworkDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [hw, setHw] = useState<HomeworkWithSubmission | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!id) return;
    try {
      const data = await getHomeworkById(sb, id);
      setHw(data);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  const subj = hw?.group.subject ?? null;
  const style = getSubjectStyle(subj);

  const dueLabel = hw?.due_date
    ? new Date(hw.due_date).toLocaleDateString("ru-RU", {
        day: "numeric",
        month: "long",
        year: "numeric",
      })
    : null;

  return (
    <SafeAreaView edges={["top"]} style={{ flex: 1, backgroundColor: colors.bgApp }}>
      {/* Back button */}
      <Pressable
        onPress={() => router.back()}
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: 6,
          paddingHorizontal: 16,
          paddingVertical: 10,
        }}
      >
        <ArrowLeft size={18} color={colors.textMuted} />
        <Text style={{ fontSize: 14, color: colors.textMuted }}>{d.common.back}</Text>
      </Pressable>

      {loading || !hw ? (
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
          <Text style={{ color: colors.textMuted }}>{d.common.loading}</Text>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
          showsVerticalScrollIndicator={false}
        >
          {/* Header card */}
          <View
            style={{
              backgroundColor: "rgba(255,255,255,0.7)",
              borderRadius: 20,
              borderWidth: 1,
              borderColor: "rgba(255,255,255,0.6)",
              padding: 16,
              marginBottom: 12,
            }}
          >
            <View style={{ flexDirection: "row", gap: 14, alignItems: "flex-start" }}>
              <SubjectIcon subject={subj} size={48} />
              <View style={{ flex: 1 }}>
                <Text
                  style={{
                    fontSize: 10,
                    fontWeight: "600",
                    textTransform: "uppercase",
                    letterSpacing: 0.8,
                    color: style.color,
                    marginBottom: 4,
                  }}
                >
                  {subj} · {hw.group.name}
                </Text>
                <Text
                  style={{
                    fontSize: 17,
                    fontWeight: "700",
                    color: colors.textPrimary,
                    marginBottom: 6,
                  }}
                >
                  {hw.title}
                </Text>
                {dueLabel && (
                  <Text style={{ fontSize: 12, color: colors.textMuted }}>
                    {d.homework.detailDeadline}: {dueLabel}
                  </Text>
                )}
              </View>
            </View>

            {hw.description ? (
              <View
                style={{
                  marginTop: 14,
                  borderTopWidth: 1,
                  borderTopColor: "#F1F5F9",
                  paddingTop: 14,
                }}
              >
                <Text
                  style={{
                    fontSize: 14,
                    color: colors.textMuted,
                    lineHeight: 22,
                  }}
                >
                  {hw.description}
                </Text>
              </View>
            ) : null}
          </View>

          {/* Teacher attachments */}
          {hw.attachments.length > 0 && (
            <View
              style={{
                backgroundColor: "rgba(255,255,255,0.7)",
                borderRadius: 20,
                borderWidth: 1,
                borderColor: "rgba(255,255,255,0.6)",
                padding: 16,
                marginBottom: 12,
              }}
            >
              <Text
                style={{
                  fontSize: 10,
                  fontWeight: "600",
                  textTransform: "uppercase",
                  letterSpacing: 0.8,
                  color: colors.textMuted,
                  marginBottom: 10,
                }}
              >
                {d.homework.detailAttachments}
              </Text>
              {hw.attachments.map((att, i) => (
                <View
                  key={i}
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 8,
                    paddingVertical: 8,
                    borderBottomWidth: i < hw.attachments.length - 1 ? 1 : 0,
                    borderBottomColor: "#F1F5F9",
                  }}
                >
                  <FileText size={16} color={colors.textMuted} />
                  <Text style={{ flex: 1, fontSize: 13, color: colors.textPrimary }} numberOfLines={1}>
                    {att.name}
                  </Text>
                  <Download size={14} color={colors.primary} />
                </View>
              ))}
            </View>
          )}

          {/* Submission or form */}
          {hw.submission ? (
            <SubmissionBlock hw={hw} />
          ) : (
            <SubmitForm hw={hw} onSuccess={load} />
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}
