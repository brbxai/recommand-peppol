import { useActiveTeam } from "@core/hooks/user";
import { PlansGrid } from "../plans-grid";

export default function SubscriptionOnboarding({ onComplete }: { onComplete: () => Promise<void> }) {
  const team = useActiveTeam();

  if (!team) {
    return <p>
      You must be in a team to complete this step
    </p>;
  }

  return <div>
    <PlansGrid
      currentSubscription={null}
      teamId={team.id}
      onSubscriptionUpdate={onComplete}
    />
  </div>;
}