import { redirect } from "next/navigation";
import { requireAuthenticatedUser } from "@/server/request-context";
import { ReleaseForm } from "@/features/catalog/release-form";
export default async function Create() {
  const auth = await requireAuthenticatedUser(["artist"]);
  if (auth.errorResponse) redirect("/login");
  return (
    <main className="max-w-5xl mx-auto p-8 text-white">
      <a href="/studio/dashboard">← Artist Studio</a>
      <h1 className="text-3xl my-6">Upload a release</h1>
      <ReleaseForm />
    </main>
  );
}
