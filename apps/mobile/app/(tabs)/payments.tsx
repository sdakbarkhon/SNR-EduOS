import { useCallback, useEffect, useState } from "react";
import {
  Modal,
  Pressable,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import {
  defaultLocale,
  getDictionary,
  getMyStudent,
  getMyGroups,
  getPayments,
  getCharges,
  getSubjectStyle,
} from "@snr/core";
import type { Database } from "@snr/core";
import { colors } from "@snr/ui-tokens";
import { Screen, SubjectIcon } from "../../components";
import { getSupabase } from "../../lib/supabase";

type Student = Database["public"]["Tables"]["students"]["Row"];
type Group = Database["public"]["Tables"]["groups"]["Row"];
type Payment = Database["public"]["Tables"]["payments"]["Row"];
type Charge = Database["public"]["Tables"]["charges"]["Row"];

function formatUZS(n: number) {
  return Math.abs(n).toLocaleString("ru-RU");
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("ru-RU", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function statusLabel(s: Student["status"], d: ReturnType<typeof getDictionary>) {
  if (s === "active") return d.payments.statusActive;
  if (s === "debtor") return d.payments.statusDebtor;
  return d.payments.statusFrozen;
}

function statusColor(s: Student["status"]) {
  if (s === "active") return colors.success;
  if (s === "debtor") return colors.danger;
  return colors.warning;
}

function statusBg(s: Student["status"]) {
  if (s === "active") return "rgba(45,190,126,0.12)";
  if (s === "debtor") return "rgba(240,85,107,0.12)";
  return "rgba(245,166,35,0.12)";
}

function thisMonthTotal(
  items: Array<Record<string, unknown>>,
  dateKey: string,
): number {
  const now = new Date();
  return items
    .filter((i) => {
      const raw = i[dateKey];
      if (!raw) return false;
      const d = new Date(raw as string);
      return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
    })
    .reduce((sum, i) => sum + (i.amount as number), 0);
}

const LIMIT = 4;

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

/** Строка платежа */
function PaymentRow({ p, d }: { p: Payment; d: ReturnType<typeof getDictionary> }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: "rgba(0,0,0,0.04)" }}>
      <View style={{ flex: 1, marginRight: 8 }}>
        <Text style={{ fontSize: 14, fontWeight: "600", color: colors.textPrimary }}>
          {p.kind === "subscription" ? d.payments.subscription : d.payments.oneTime}
        </Text>
        {p.note ? <Text style={{ fontSize: 11, color: colors.textMuted, marginTop: 2 }}>{p.note}</Text> : null}
        <Text style={{ fontSize: 11, color: colors.textMuted, marginTop: 1 }}>{formatDate(p.paid_at)}</Text>
      </View>
      <Text style={{ fontWeight: "700", color: colors.success }}>+{formatUZS(p.amount)} UZS</Text>
    </View>
  );
}

/** Строка списания */
function ChargeRow({ c }: { c: Charge }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: "rgba(0,0,0,0.04)" }}>
      <View style={{ flex: 1, marginRight: 8 }}>
        <Text style={{ fontSize: 14, fontWeight: "600", color: colors.textPrimary }}>
          {c.note ?? "Занятие"}
        </Text>
        <Text style={{ fontSize: 11, color: colors.textMuted, marginTop: 2 }}>{formatDate(c.charged_at)}</Text>
      </View>
      <Text style={{ fontWeight: "700", color: colors.textPrimary }}>−{formatUZS(c.amount)} UZS</Text>
    </View>
  );
}

/** Универсальная нативная модалка */
function BottomSheet({
  visible,
  onClose,
  title,
  children,
}: {
  visible: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.4)", justifyContent: "flex-end" }} onPress={onClose}>
        <Pressable
          style={{ backgroundColor: "#fff", borderTopLeftRadius: 24, borderTopRightRadius: 24, maxHeight: "80%", paddingBottom: 32 }}
          onPress={() => undefined}
        >
          {/* Handle */}
          <View style={{ alignItems: "center", paddingTop: 12, paddingBottom: 8 }}>
            <View style={{ width: 36, height: 4, borderRadius: 2, backgroundColor: "rgba(0,0,0,0.12)" }} />
          </View>
          {/* Header */}
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 20, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: "rgba(0,0,0,0.06)" }}>
            <Text style={{ fontSize: 17, fontWeight: "700", color: "#1D1D1F" }}>{title}</Text>
            <TouchableOpacity onPress={onClose} style={{ padding: 4 }}>
              <Text style={{ fontSize: 22, color: "#8E8E93", lineHeight: 24 }}>×</Text>
            </TouchableOpacity>
          </View>
          <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 8 }}>
            {children}
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

export default function PaymentsScreen() {
  const d = getDictionary(defaultLocale);
  const sb = getSupabase();

  const [student, setStudent] = useState<Student | null>(null);
  const [groups, setGroups] = useState<Group[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [charges, setCharges] = useState<Charge[]>([]);
  const [showTopup, setShowTopup] = useState(false);
  const [showAllPay, setShowAllPay] = useState(false);
  const [showAllChg, setShowAllChg] = useState(false);

  const load = useCallback(async () => {
    const [s, g, p, c] = await Promise.all([
      getMyStudent(sb),
      getMyGroups(sb),
      getPayments(sb),
      getCharges(sb),
    ]);
    setStudent(s);
    setGroups(g);
    setPayments(p);
    setCharges(c);
  }, [sb]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    const channel = sb
      .channel("mobile-payments-rt")
      .on("postgres_changes", { event: "*", schema: "public", table: "payments" }, load)
      .on("postgres_changes", { event: "*", schema: "public", table: "charges" }, load)
      .subscribe();
    return () => { sb.removeChannel(channel); };
  }, [sb, load]);

  const paidMonth = thisMonthTotal(payments as unknown as Array<Record<string, unknown>>, "paid_at");
  const chargedMonth = thisMonthTotal(charges as unknown as Array<Record<string, unknown>>, "charged_at");
  const progressPct = (paidMonth + chargedMonth) === 0 ? 0 : Math.min(1, paidMonth / (paidMonth + chargedMonth));

  const shownPayments = payments.slice(0, LIMIT);
  const shownCharges = charges.slice(0, LIMIT);

  return (
    <Screen title={d.payments.title}>
      {/* ── Баланс ── */}
      <View style={cardStyle}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 6 }}>
          <Text style={{ fontSize: 11, fontWeight: "600", color: colors.textMuted, textTransform: "uppercase", letterSpacing: 1 }}>
            {d.payments.balance}
          </Text>
          {student && (
            <View style={{ paddingHorizontal: 10, paddingVertical: 3, backgroundColor: statusBg(student.status), borderRadius: 999 }}>
              <Text style={{ fontSize: 11, fontWeight: "700", color: statusColor(student.status) }}>
                {statusLabel(student.status, d)}
              </Text>
            </View>
          )}
        </View>
        <Text style={{ fontSize: 36, fontWeight: "900", color: student && student.balance < 0 ? colors.danger : colors.textPrimary }}>
          {student ? (student.balance < 0 ? "−" : "") + formatUZS(student.balance) : "—"} UZS
        </Text>
        {student && student.balance < 0 && (
          <Text style={{ fontSize: 12, color: colors.danger, marginTop: 4, fontWeight: "500" }}>
            Необходимо пополнить счёт
          </Text>
        )}
        {/* Кнопка Пополнить */}
        <TouchableOpacity
          onPress={() => setShowTopup(true)}
          style={{ marginTop: 16, backgroundColor: colors.primary, borderRadius: 14, paddingVertical: 12, alignItems: "center" }}
        >
          <Text style={{ fontSize: 15, fontWeight: "700", color: "#fff" }}>{d.payments.topupButton}</Text>
        </TouchableOpacity>
      </View>

      {/* ── Мои курсы ── */}
      {groups.length > 0 && (
        <View style={cardStyle}>
          <Text style={{ fontSize: 13, fontWeight: "700", color: colors.textMuted, textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 12 }}>
            {d.payments.myCourses}
          </Text>
          <View style={{ gap: 8 }}>
            {groups.map((g) => {
              const style = getSubjectStyle(g.subject);
              return (
                <View key={g.id} style={{ flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: "rgba(255,255,255,0.7)", borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10 }}>
                  <SubjectIcon subject={g.subject} size={20} />
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 13, fontWeight: "700", color: style.color }}>{style.label}</Text>
                    <Text style={{ fontSize: 13, fontWeight: "900", color: colors.textPrimary, marginTop: 2 }}>
                      {g.course_price.toLocaleString("ru-RU")} UZS
                    </Text>
                  </View>
                </View>
              );
            })}
          </View>
        </View>
      )}

      {/* ── Статус оплаты ── */}
      <View style={cardStyle}>
        <Text style={{ fontSize: 13, fontWeight: "700", color: colors.textMuted, textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 12 }}>
          {d.payments.paymentStatusTitle}
        </Text>
        <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 6 }}>
          <Text style={{ fontSize: 13, fontWeight: "600", color: colors.textMuted }}>{d.payments.paidThisMonth}</Text>
          <Text style={{ fontSize: 13, fontWeight: "700", color: colors.textPrimary }}>{formatUZS(paidMonth)} UZS</Text>
        </View>
        <View style={{ height: 8, backgroundColor: "rgba(0,0,0,0.06)", borderRadius: 4, overflow: "hidden", marginBottom: 6 }}>
          <View style={{ width: `${progressPct * 100}%`, height: "100%", backgroundColor: colors.primary, borderRadius: 4 }} />
        </View>
        <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
          <Text style={{ fontSize: 13, fontWeight: "600", color: colors.textMuted }}>{d.payments.chargedThisMonth}</Text>
          <Text style={{ fontSize: 13, fontWeight: "700", color: colors.textPrimary }}>{formatUZS(chargedMonth)} UZS</Text>
        </View>
      </View>

      {/* ── История пополнений ── */}
      <View style={cardStyle}>
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
          <Text style={{ fontSize: 15, fontWeight: "700", color: colors.textPrimary }}>
            {d.payments.paymentsHistory}
          </Text>
          {payments.length > LIMIT && (
            <TouchableOpacity onPress={() => setShowAllPay(true)}>
              <Text style={{ fontSize: 13, fontWeight: "600", color: colors.primary }}>{d.payments.showAll}</Text>
            </TouchableOpacity>
          )}
        </View>
        {payments.length === 0 ? (
          <Text style={{ textAlign: "center", color: colors.textMuted, fontSize: 13 }}>{d.payments.noPayments}</Text>
        ) : (
          shownPayments.map((p) => <PaymentRow key={p.id} p={p} d={d} />)
        )}
      </View>

      {/* ── История списаний ── */}
      <View style={{ ...cardStyle, marginBottom: 0 }}>
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
          <Text style={{ fontSize: 15, fontWeight: "700", color: colors.textPrimary }}>
            {d.payments.chargesHistory}
          </Text>
          {charges.length > LIMIT && (
            <TouchableOpacity onPress={() => setShowAllChg(true)}>
              <Text style={{ fontSize: 13, fontWeight: "600", color: colors.primary }}>{d.payments.showAll}</Text>
            </TouchableOpacity>
          )}
        </View>
        {charges.length === 0 ? (
          <Text style={{ textAlign: "center", color: colors.textMuted, fontSize: 13 }}>{d.payments.noCharges}</Text>
        ) : (
          shownCharges.map((c) => <ChargeRow key={c.id} c={c} />)
        )}
      </View>

      {/* ── Модалка «Пополнить» ── */}
      <BottomSheet visible={showTopup} onClose={() => setShowTopup(false)} title={d.payments.topupTitle}>
        <View style={{ alignItems: "center", paddingVertical: 24, gap: 12 }}>
          <View style={{ width: 56, height: 56, borderRadius: 16, backgroundColor: "rgba(0,122,255,0.1)", alignItems: "center", justifyContent: "center" }}>
            <Text style={{ fontSize: 28 }}>ℹ️</Text>
          </View>
          <Text style={{ fontSize: 15, fontWeight: "600", color: "#1D1D1F", textAlign: "center" }}>{d.payments.topupStub}</Text>
          <Text style={{ fontSize: 13, color: "#8E8E93", textAlign: "center" }}>{d.payments.topupContacts}</Text>
          <TouchableOpacity
            onPress={() => setShowTopup(false)}
            style={{ marginTop: 8, backgroundColor: colors.primary, borderRadius: 14, paddingVertical: 12, paddingHorizontal: 40 }}
          >
            <Text style={{ fontSize: 15, fontWeight: "700", color: "#fff" }}>{d.payments.topupClose}</Text>
          </TouchableOpacity>
        </View>
      </BottomSheet>

      {/* ── Модалка все пополнения ── */}
      <BottomSheet visible={showAllPay} onClose={() => setShowAllPay(false)} title={d.payments.paymentsHistory}>
        {payments.map((p) => <PaymentRow key={p.id} p={p} d={d} />)}
      </BottomSheet>

      {/* ── Модалка все списания ── */}
      <BottomSheet visible={showAllChg} onClose={() => setShowAllChg(false)} title={d.payments.chargesHistory}>
        {charges.map((c) => <ChargeRow key={c.id} c={c} />)}
      </BottomSheet>
    </Screen>
  );
}
