import { Button } from "@core/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@core/components/ui/card";
import { availablePlans } from "@peppol/data/plans";
import type { Subscription as SubscriptionType } from "@peppol/data/subscriptions";
import { toast } from "@core/components/ui/sonner";
import { rc } from "@recommand/lib/client";
import type { Subscription } from "api/subscription";
import { stringifyActionFailure } from "@recommand/lib/utils";

const subscriptionClient = rc<Subscription>('peppol');

interface PlansGridProps {
  currentSubscription: SubscriptionType | null;
  teamId: string;
  onSubscriptionUpdate?: (subscription: SubscriptionType) => void;
}

export function PlansGrid({ currentSubscription, teamId, onSubscriptionUpdate }: PlansGridProps) {
  const handleStartSubscription = async (planId: string) => {
    try {
      const response = await subscriptionClient[':teamId'].subscription.$post({
        param: { teamId: teamId },
        json: { planId }
      });

      const data = await response.json();
      if (data.success) {
        onSubscriptionUpdate?.({
          ...data.subscription,
          createdAt: new Date(data.subscription.createdAt),
          updatedAt: new Date(data.subscription.updatedAt),
          startDate: new Date(data.subscription.startDate),
          endDate: data.subscription.endDate ? new Date(data.subscription.endDate) : null,
          lastBilledAt: data.subscription.lastBilledAt ? new Date(data.subscription.lastBilledAt) : null,
        });
        toast.success('Subscription updated successfully');
      } else {
        toast.error(stringifyActionFailure(data.errors));
      }
    } catch (error) {
      toast.error('Failed to update subscription');
    }
  };

  return (
    <div className="grid gap-4 md:grid-cols-3">
      {availablePlans.map((plan) => (
        <Card key={plan.id} className={currentSubscription?.planId === plan.id ? "border-primary" : ""}>
          <CardHeader>
            <CardTitle>{plan.name}</CardTitle>
            <CardDescription>
              {plan.basePrice === 0 ? "Free" : `€${plan.basePrice.toFixed(2)}/month excl. VAT`}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">
                {plan.includedMonthlyDocuments} documents included
              </p>
              <p className="text-sm text-muted-foreground">
                €{plan.documentOveragePrice.toFixed(2)} per extra document
              </p>
            </div>
          </CardContent>
          <CardFooter>
            <Button
              className="w-full"
              variant={currentSubscription?.planId === plan.id ? "secondary" : "default"}
              onClick={() => handleStartSubscription(plan.id)}
              disabled={currentSubscription?.planId === plan.id}
            >
              {currentSubscription?.planId === plan.id ? "Current Plan" : "Select Plan"}
            </Button>
          </CardFooter>
        </Card>
      ))}
    </div>
  );
} 