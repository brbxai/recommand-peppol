import { useActiveTeam } from "@core/hooks/user";
import { PlansGrid } from "../plans-grid";
import PlaygroundOption from "./playground-option";
import { CreateTeamButton } from "@core/components/create-team-button";

export default function SubscriptionOnboarding({ onComplete }: { onComplete: () => Promise<void> }) {
  const team = useActiveTeam();

  if (!team) {
    return <div className="text-center space-y-4">
      <p>You must be in a team to complete this step</p>
      <CreateTeamButton />
    </div>;
  }

  return <div>
    <PlansGrid
      currentSubscription={null}
      teamId={team.id}
      onSubscriptionUpdate={onComplete}
    />
    <PlaygroundOption 
      buttonText="Skip Subscription - Create Playground" 
      description="Skip subscription setup by creating a playground to test your Peppol API integrations without billing requirements, or switch to another team."
    />
  </div>;
}