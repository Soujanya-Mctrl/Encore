import { redirect } from "next/navigation";
import { OnboardingWizard } from "@/features/onboarding/onboarding-wizard";
import { getStudioChannel } from "@/server/onboarding-access";
import { getAuthenticatedUser } from "@/server/request-context";

export default async function OnboardingPage({
  searchParams
}: {
  searchParams: Promise<{ journey?: string }>;
}) {
  const user = await getAuthenticatedUser();
  if (!user) redirect("/login");

  const { journey } = await searchParams;
  const enablingStudio = journey === "artist";
  if (user.onboardingStatus === "completed") {
    const channel = await getStudioChannel(user.id);
    if (channel) redirect("/studio/dashboard");
    if (!enablingStudio) redirect("/discover");
  }

  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-12">
      <OnboardingWizard
        initialDisplayName={user.displayName}
        initialAvatarUrl={user.avatarUrl ?? ""}
        enablingStudio={enablingStudio}
        preserveProfile={user.onboardingStatus === "completed"}
      />
    </main>
  );
}
