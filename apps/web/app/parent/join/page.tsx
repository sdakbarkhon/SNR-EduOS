import { JoinForm } from "./JoinForm";

export default async function ParentJoinPage({
  searchParams,
}: {
  searchParams: Promise<{ code?: string }>;
}) {
  const { code } = await searchParams;
  return (
    <div
      className="flex min-h-screen items-center justify-center p-4"
      style={{ background: "linear-gradient(135deg, #f5f3ff 0%, #ede9fe 50%, #ddd6fe 100%)" }}
    >
      <JoinForm initialCode={code ?? ""} />
    </div>
  );
}
