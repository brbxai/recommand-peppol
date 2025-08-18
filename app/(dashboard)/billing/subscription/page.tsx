import { PageTemplate } from "@core/components/page-template";
import { rc } from "@recommand/lib/client";
import type { Subscription } from "api/subscription";
import { useEffect, useState } from "react";
import { Button } from "@core/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@core/components/ui/card";
import { toast } from "@core/components/ui/sonner";
import { useActiveTeam } from "@core/hooks/user";
import { Loader2, XCircle, CheckCircle, Pencil, Check, CreditCard } from "lucide-react";
import type { Subscription as SubscriptionType } from "@peppol/data/subscriptions";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@core/components/ui/alert-dialog";
import type {
  BillingProfile,
  BillingProfileData,
} from "@peppol/api/billing-profile";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@core/components/ui/dialog";
import { BillingProfileForm, DEFAULT_BILLING_PROFILE_FORM_DATA, type BillingProfileFormData } from "@peppol/components/billing-profile-form";
import { PlansGrid } from "@peppol/components/plans-grid";
import { updateBillingProfile, fetchBillingProfile as fetchBillingProfileFromApi } from "@peppol/lib/billing";
import { useIsPlayground } from "@peppol/lib/client/playgrounds";

const subscriptionClient = rc<Subscription>("peppol");
const billingProfileClient = rc<BillingProfile>("peppol");

export default function Page() {
  const [isLoading, setIsLoading] = useState(true);
  const [currentSubscription, setCurrentSubscription] =
    useState<SubscriptionType | null>(null);
  const [currentUsage, setCurrentUsage] = useState(-1);
  const [billingProfile, setBillingProfile] =
    useState<BillingProfileData | null>(null);
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [profileForm, setProfileForm] = useState<BillingProfileFormData>(DEFAULT_BILLING_PROFILE_FORM_DATA);
  const activeTeam = useActiveTeam();
  const isPlayground = useIsPlayground();

  const fetchSubscription = async () => {
    if (!activeTeam?.id) {
      setIsLoading(false);
      return;
    }

    try {
      const response = await subscriptionClient[":teamId"]["subscription"].$get(
        {
          param: { teamId: activeTeam.id },
        }
      );
      const data = await response.json();

      if (!data.success || !data.subscription) {
        setCurrentSubscription(null);
        return;
      }

      setCurrentSubscription({
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
    } catch (error) {
      console.error("Error fetching subscription:", error);
      toast.error("Failed to load subscription");
    } finally {
      setIsLoading(false);
    }
  };

  const fetchCurrentUsage = async () => {
    if (!activeTeam?.id) return;

    try {
      const response = await billingProfileClient[":teamId"]["billing-profile"][
        "current-usage"
      ].$get({
        param: { teamId: activeTeam.id },
      });
      const data = await response.json();

      if (data.success) {
        setCurrentUsage(data.usage);
      }
    } catch (error) {
      console.error("Error fetching current usage:", error);
      toast.error("Failed to load current usage");
    }
  };

  const fetchBillingProfile = async () => {
    if (!activeTeam?.id) return;

    const billingProfile = await fetchBillingProfileFromApi(activeTeam.id);
    if (billingProfile) {
      setBillingProfile(billingProfile);
      setProfileForm({
        companyName: billingProfile.companyName,
        address: billingProfile.address,
        postalCode: billingProfile.postalCode,
        city: billingProfile.city,
        country: billingProfile.country,
        vatNumber: billingProfile.vatNumber || '',
      });
    }else{
      setBillingProfile(null);
    }
  };

  useEffect(() => {
    if(isPlayground){
      return;
    }
    fetchSubscription();
    fetchCurrentUsage();
    fetchBillingProfile();
  }, [activeTeam?.id, isPlayground]);

  const handleCancelSubscription = async () => {
    if (!activeTeam?.id) return;

    try {
      const response = await subscriptionClient[
        ":teamId"
      ].subscription.cancel.$post({
        param: { teamId: activeTeam.id },
      });

      const data = await response.json();
      setCurrentSubscription(null);
      toast.success("Subscription cancelled successfully");
    } catch (error) {
      toast.error("Failed to cancel subscription");
    }
  };

  const handleUpdateProfile = async () => {
    if (!activeTeam?.id) return;

    await updateBillingProfile(activeTeam.id, profileForm, (billingProfile) => {
      setBillingProfile(billingProfile);
      setIsEditingProfile(false);
    });
  };

  if (isLoading) {
    return <PageTemplate
      breadcrumbs={[
        { label: "Team Settings" },
        { label: "Billing" },
        { label: "Subscription" },
      ]}
    >
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    </PageTemplate>;
  }

  if(isPlayground){
    return <PageTemplate
      breadcrumbs={[
        { label: "Team Settings" },
        { label: "Billing" },
        { label: "Subscription" },
      ]}
    >
      <div className="flex items-center justify-center py-8 text-center">
        <p className="text-muted-foreground">This is a playground environment. Playground usage is entirely free of charge.<br/>Switch to a production team to manage your subscription.</p>
      </div>
    </PageTemplate>;
  }

  return <PageTemplate
    breadcrumbs={[
      { label: "Team Settings" },
      { label: "Billing" },
      { label: "Subscription" },
    ]}
  >
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-2 items-start">
        {currentSubscription ? (
          <Card>
            <CardHeader>
              <CardTitle>Current Subscription</CardTitle>
              <CardDescription>
                Your current plan and subscription details
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div>
                  <h3 className="text-sm">Plan</h3>
                  <p className="text-muted-foreground">{currentSubscription.planName}</p>
                </div>
                <div>
                  <h3 className="text-sm">Monthly Price</h3>
                  <p className="text-muted-foreground">€{currentSubscription.billingConfig.basePrice.toFixed(2)}</p>
                </div>
                {currentUsage !== -1 && (
                  <div>
                    <h3 className="text-sm">Transmitted Documents</h3>
                    <p className="text-muted-foreground">{currentUsage} documents were transmitted this month</p>
                  </div>
                )}
                <div>
                  <h3 className="text-sm">Included Documents</h3>
                  <p className="text-muted-foreground">{currentSubscription.billingConfig.includedMonthlyDocuments} documents per month</p>
                </div>
                <div>
                  <h3 className="text-sm">Overage Rate</h3>
                  <p className="text-muted-foreground">€{currentSubscription.billingConfig.documentOveragePrice.toFixed(2)} per document</p>
                </div>
                <div>
                  <h3 className="text-sm">Start Date</h3>
                  <p className="text-muted-foreground">{new Date(currentSubscription.startDate).toLocaleDateString()}</p>
                </div>
              </div>
            </CardContent>
            <CardFooter>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="destructive">
                    <XCircle className="h-4 w-4" />
                    Cancel Subscription
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Are you sure you want to cancel your subscription?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This action cannot be undone. You will lose access to your current plan features immediately. Billing will be prorated for the current month.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>
                      <XCircle className="h-4 w-4" />
                      Keep Subscription
                    </AlertDialogCancel>
                    <AlertDialogAction onClick={handleCancelSubscription} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                      <CheckCircle className="h-4 w-4" />
                      Yes, Cancel Subscription
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </CardFooter>
          </Card>
        ) : (
          <Card>
            <CardHeader>
              <CardTitle>No Active Subscription</CardTitle>
              <CardDescription>
                Choose a plan to get started with Peppol
              </CardDescription>
            </CardHeader>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle>Billing Profile</CardTitle>
            <CardDescription>
              Your billing information for invoices
            </CardDescription>
          </CardHeader>
          <CardContent>
            {billingProfile ? (
              <div className="space-y-4">
                <div>
                  <h3 className="text-sm">Company Name</h3>
                  <p className="text-muted-foreground">{billingProfile.companyName}</p>
                </div>
                <div>
                  <h3 className="text-sm">Address</h3>
                  <p className="text-muted-foreground">{billingProfile.address} {billingProfile.postalCode} {billingProfile.city}</p>
                </div>
                <div>
                  <h3 className="text-sm">Country</h3>
                  <p className="text-muted-foreground">{billingProfile.country}</p>
                </div>
                {billingProfile.vatNumber && (
                  <div>
                    <h3 className="text-sm">VAT Number</h3>
                    <p className="text-muted-foreground">{billingProfile.vatNumber}</p>
                  </div>
                )}
                <div className="pt-4">
                  <div className="flex items-center space-x-2 mt-2">
                    {billingProfile.isMandateValidated ? (
                      <Check className="h-4 w-4 text-accent" />
                    ) : (
                      <XCircle className="h-4 w-4 text-destructive" />
                    )}
                    <p className="text-muted-foreground text-sm">
                      Payment Mandate: {billingProfile.isMandateValidated ? 'Validated' : 'Not validated'}
                    </p>
                  </div>
                </div>
              </div>
            ) : (
              <p className="text-muted-foreground">No billing profile set up yet.</p>
            )}
          </CardContent>
          <CardFooter>
            {/* <Button
              onClick={() => billingProfileClient[':teamId']['billing-profile']['end-billing-cycle'].$post({
                param: { teamId: activeTeam!.id }
              })}
            >Test billing period end</Button> */}
            <Dialog open={isEditingProfile} onOpenChange={setIsEditingProfile}>
              <DialogTrigger asChild>
                <Button>
                  {billingProfile && !billingProfile.isMandateValidated && <CreditCard className="h-4 w-4 mr-2" />}
                  {(billingProfile && billingProfile.isMandateValidated || !billingProfile) && <Pencil className="h-4 w-4 mr-2" />}
                  {billingProfile ? (billingProfile.isMandateValidated ? 'Edit Billing Profile' : 'Validate Payment Mandate') : 'Set Up Profile'}
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>{billingProfile ? 'Edit Billing Profile' : 'Set Up Billing Profile'}</DialogTitle>
                  <DialogDescription>
                    Update your billing information for invoices
                  </DialogDescription>
                </DialogHeader>
                <BillingProfileForm
                  profileForm={profileForm}
                  onChange={setProfileForm}
                  onCancel={() => setIsEditingProfile(false)}
                  onSubmit={handleUpdateProfile}
                />
              </DialogContent>
            </Dialog>
          </CardFooter>
        </Card>
      </div>

      {activeTeam?.id && (
        <PlansGrid
          currentSubscription={currentSubscription}
          teamId={activeTeam.id}
          onSubscriptionUpdate={setCurrentSubscription}
        />
      )}
    </div>
  </PageTemplate>;
}
