import { Button } from "@core/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@core/components/ui/card";
import { Badge } from "@core/components/ui/badge";
import { availablePlans } from "@peppol/data/plans";
import type { Subscription as SubscriptionType } from "@peppol/data/subscriptions";
import { toast } from "@core/components/ui/sonner";
import { rc } from "@recommand/lib/client";
import type { Subscription } from "api/subscription";
import { stringifyActionFailure } from "@recommand/lib/utils";
import { Check } from "lucide-react";

const subscriptionClient = rc<Subscription>("v1");

interface PlansGridProps {
  currentSubscription: SubscriptionType | null;
  teamId: string;
  onSubscriptionUpdate?: (subscription: SubscriptionType) => void;
}

export function PlansGrid({
  currentSubscription,
  teamId,
  onSubscriptionUpdate,
}: PlansGridProps) {
  const handleStartSubscription = async (planId: string) => {
    try {
      const response = await subscriptionClient[":teamId"].subscription.$post({
        param: { teamId: teamId },
        json: { planId },
      });

      const data = await response.json();
      if (data.success) {
        onSubscriptionUpdate?.({
          ...data.subscription,
          createdAt: new Date(data.subscription.createdAt),
          updatedAt: new Date(data.subscription.updatedAt),
          startDate: new Date(data.subscription.startDate),
          endDate: data.subscription.endDate
            ? new Date(data.subscription.endDate)
            : null,
          lastBilledAt: data.subscription.lastBilledAt
            ? new Date(data.subscription.lastBilledAt)
            : null,
        });
        toast.success("Subscription updated successfully");
      } else {
        toast.error(stringifyActionFailure(data.errors));
      }
    } catch (error) {
      toast.error("Failed to update subscription");
    }
  };

  const isCurrentPlan = (planId: string) =>
    currentSubscription?.planId === planId;

  return (
    <div>
      <div className="mb-6">
        <h2 className="text-xl font-semibold mb-2">Available Plans</h2>
        <p className="text-muted-foreground">
          {currentSubscription
            ? "Upgrade or change your current plan"
            : "Choose the perfect plan for your needs"}
        </p>
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        {availablePlans.map((plan) => (
          <Card
            key={plan.id}
            className={`relative ${
              isCurrentPlan(plan.id) ? "border-primary" : ""
            }`}
          >
            {isCurrentPlan(plan.id) && (
              <div className="absolute -top-3 right-4">
                <Badge variant="secondary">
                  <Check className="h-3 w-3 mr-1" />
                  Current
                </Badge>
              </div>
            )}

            <CardHeader>
              <CardTitle>{plan.name}</CardTitle>
              <CardDescription>
                {plan.basePrice === 0
                  ? "Free"
                  : `€${plan.basePrice.toFixed(2)}/month excl. VAT`}
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
                variant={isCurrentPlan(plan.id) && !currentSubscription?.endDate ? "secondary" : "default"}
                onClick={() => handleStartSubscription(plan.id)}
                disabled={isCurrentPlan(plan.id) && !currentSubscription?.endDate}
              >
                {isCurrentPlan(plan.id) ? (currentSubscription?.endDate ? "Resume Subscription" : "Current Plan") : "Select Plan"}
              </Button>
            </CardFooter>
          </Card>
        ))}
      </div>
    </div>
  );
}
