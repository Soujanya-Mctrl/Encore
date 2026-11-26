import { redirect } from "next/navigation";
import { getAuthenticatedUser } from "@/server/request-context";
import { OnboardingWizard } from "@/features/onboarding/onboarding-wizard";

export default async function OnboardingPage() {
  const user = await getAuthenticatedUser();
  if (!user) {
    redirect("/login");
  }

  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-12">
      <OnboardingWizard />
    </main>
  );
}
