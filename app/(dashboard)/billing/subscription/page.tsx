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
import { Badge } from "@core/components/ui/badge";
import { Progress } from "@core/components/ui/progress";
import { Separator } from "@core/components/ui/separator";
import { toast } from "@core/components/ui/sonner";
import { useActiveTeam } from "@core/hooks/user";
import {
  Loader2,
  XCircle,
  CheckCircle,
  Pencil,
  Check,
  CreditCard,
  Calendar,
  FileText,
  TrendingUp,
  AlertTriangle,
} from "lucide-react";
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
import {
  BillingProfileForm,
  DEFAULT_BILLING_PROFILE_FORM_DATA,
  type BillingProfileFormData,
} from "@peppol/components/billing-profile-form";
import { PlansGrid } from "@peppol/components/plans-grid";
import {
  updateBillingProfile,
  fetchBillingProfile as fetchBillingProfileFromApi,
} from "@peppol/lib/billing";
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
  const [profileForm, setProfileForm] = useState<BillingProfileFormData>(
    DEFAULT_BILLING_PROFILE_FORM_DATA
  );
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
        vatNumber: billingProfile.vatNumber || "",
      });
    } else {
      setBillingProfile(null);
    }
  };

  useEffect(() => {
    if (isPlayground) {
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
    return (
      <PageTemplate
        breadcrumbs={[
          { label: "Team Settings" },
          { label: "Billing" },
          { label: "Subscription" },
        ]}
      >
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      </PageTemplate>
    );
  }

  if (isPlayground) {
    return (
      <PageTemplate
        breadcrumbs={[
          { label: "Team Settings" },
          { label: "Billing" },
          { label: "Subscription" },
        ]}
      >
        <div className="flex items-center justify-center py-8 text-center">
          <p className="text-muted-foreground">
            This is a playground environment. Playground usage is entirely free
            of charge.
            <br />
            Switch to a production team to manage your subscription.
          </p>
        </div>
      </PageTemplate>
    );
  }

  return (
    <PageTemplate
      breadcrumbs={[
        { label: "Team Settings" },
        { label: "Billing" },
        { label: "Subscription" },
      ]}
      description="Manage your subscription plan and billing information"
    >
      <div className="space-y-6">
        <div className="grid gap-6 md:grid-cols-2 items-start">
          <div>
            {currentSubscription ? (
              <Card className="border-l-4 border-l-primary">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="text-xl flex items-center gap-2">
                        {/* <Shield className="h-5 w-5 text-primary" /> */}
                        {currentSubscription.planName} Plan
                      </CardTitle>
                      <CardDescription className="mt-1">
                        Active subscription with full access
                      </CardDescription>
                    </div>
                    <Badge variant="success">
                      <CheckCircle className="h-3 w-3 mr-1" />
                      Active
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-6">
                  {/* Usage Progress */}
                  {currentUsage !== -1 && (
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <FileText className="h-4 w-4 text-muted-foreground" />
                          <span className="text-sm font-medium">
                            Document Usage
                          </span>
                        </div>
                        <span className="text-sm text-muted-foreground">
                          {currentSubscription.billingConfig
                            .includedMonthlyDocuments === 0
                            ? `${currentUsage} documents`
                            : `${currentUsage} / ${currentSubscription.billingConfig.includedMonthlyDocuments}`}
                        </span>
                      </div>
                      {currentSubscription.billingConfig
                        .includedMonthlyDocuments > 0 ? (
                        <>
                          <Progress
                            value={
                              (currentUsage /
                                currentSubscription.billingConfig
                                  .includedMonthlyDocuments) *
                              100
                            }
                            className="h-2"
                          />
                          <p className="text-xs text-muted-foreground">
                            {currentSubscription.billingConfig
                              .includedMonthlyDocuments -
                              currentUsage >
                            0
                              ? `${currentSubscription.billingConfig.includedMonthlyDocuments - currentUsage} documents remaining this month`
                              : `${currentUsage - currentSubscription.billingConfig.includedMonthlyDocuments} documents over limit`}
                          </p>
                        </>
                      ) : (
                        <div className="p-3 bg-muted/50 rounded-lg">
                          <p className="text-xs text-muted-foreground">
                            Unlimited usage - pay per document transmitted (€
                            {currentSubscription.billingConfig.documentOveragePrice.toFixed(
                              2
                            )}{" "}
                            each)
                          </p>
                        </div>
                      )}
                    </div>
                  )}

                  <Separator />

                  {/* Plan Details Grid */}
                  <div className="grid grid-cols-2 gap-6">
                    <div className="space-y-4">
                      <div>
                        <div className="flex items-center gap-2 text-sm font-medium mb-1">
                          <CreditCard className="h-4 w-4 text-muted-foreground" />
                          {currentSubscription.billingConfig.basePrice === 0
                            ? "Pricing Model"
                            : "Monthly Price"}
                        </div>
                        {currentSubscription.billingConfig.basePrice === 0 ? (
                          <p className="text-sm text-muted-foreground">
                            Volume-based
                          </p>
                        ) : (
                          <p className="text-2xl font-bold text-primary">
                            €
                            {currentSubscription.billingConfig.basePrice.toFixed(
                              2
                            )}
                          </p>
                        )}
                      </div>
                      <div>
                        <div className="flex items-center gap-2 text-sm font-medium mb-1">
                          <Calendar className="h-4 w-4 text-muted-foreground" />
                          Start Date
                        </div>
                        <p className="text-sm text-muted-foreground">
                          {new Date(
                            currentSubscription.startDate
                          ).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                    <div className="space-y-4">
                      <div>
                        <div className="flex items-center gap-2 text-sm font-medium mb-1">
                          <FileText className="h-4 w-4 text-muted-foreground" />
                          Included Documents
                        </div>
                        {currentSubscription.billingConfig
                          .includedMonthlyDocuments === 0 ? (
                          <p className="text-sm text-muted-foreground">∞</p>
                        ) : (
                          <p className="text-lg font-semibold">
                            {
                              currentSubscription.billingConfig
                                .includedMonthlyDocuments
                            }
                            <span className="text-sm font-normal text-muted-foreground ml-1">
                              per month
                            </span>
                          </p>
                        )}
                      </div>
                      <div>
                        <div className="flex items-center gap-2 text-sm font-medium mb-1">
                          <TrendingUp className="h-4 w-4 text-muted-foreground" />
                          {currentSubscription.billingConfig
                            .includedMonthlyDocuments === 0
                            ? "Price per Document"
                            : "Overage Rate"}
                        </div>
                        <p className="text-sm text-muted-foreground">
                          €
                          {currentSubscription.billingConfig.documentOveragePrice.toFixed(
                            2
                          )}{" "}
                          per document
                        </p>
                      </div>
                    </div>
                  </div>
                </CardContent>
                <CardFooter className="pt-6">
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="destructive">
                        <XCircle className="h-4 w-4" />
                        Cancel Subscription
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle className="flex items-center gap-2">
                          <AlertTriangle className="h-5 w-5 text-destructive" />
                          Cancel Subscription?
                        </AlertDialogTitle>
                        <AlertDialogDescription>
                          This action cannot be undone. You will lose access to
                          your current plan features immediately. Billing will
                          be prorated for the current month.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Keep Subscription</AlertDialogCancel>
                        <AlertDialogAction
                          onClick={handleCancelSubscription}
                          className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        >
                          <CheckCircle className="h-4 w-4" />
                          Yes, Cancel Subscription
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </CardFooter>
              </Card>
            ) : (
              <Card className="border-dashed border-2 border-muted-foreground/25">
                <CardHeader className="text-center pb-2">
                  <div className="mx-auto w-12 h-12 rounded-full bg-muted flex items-center justify-center mb-4">
                    <CreditCard className="h-6 w-6 text-muted-foreground" />
                  </div>
                  <CardTitle className="text-xl">
                    No Active Subscription
                  </CardTitle>
                  <CardDescription className="text-base">
                    Choose a plan below to get started with Peppol document
                    transmission
                  </CardDescription>
                </CardHeader>
              </Card>
            )}
          </div>

          <div>
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <CreditCard className="h-4 w-4" />
                      Billing Profile
                    </CardTitle>
                    <CardDescription className="mt-1">
                      Your billing information for invoices
                    </CardDescription>
                  </div>
                  {billingProfile && (
                    <Badge
                      variant={
                        billingProfile.isMandateValidated
                          ? "secondary"
                          : "destructive"
                      }
                    >
                      {billingProfile.isMandateValidated ? (
                        <>
                          <Check className="h-3 w-3 mr-1" />
                          Verified
                        </>
                      ) : (
                        <>
                          <AlertTriangle className="h-3 w-3 mr-1" />
                          Pending
                        </>
                      )}
                    </Badge>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                {billingProfile ? (
                  <div className="space-y-4">
                    <div>
                      <h3 className="text-sm font-medium text-foreground mb-1">
                        Company Name
                      </h3>
                      <p className="text-sm text-muted-foreground">
                        {billingProfile.companyName}
                      </p>
                    </div>
                    <div>
                      <h3 className="text-sm font-medium text-foreground mb-1">
                        Address
                      </h3>
                      <p className="text-sm text-muted-foreground">
                        {billingProfile.address}
                        <br />
                        {billingProfile.postalCode} {billingProfile.city}
                        <br />
                        {billingProfile.country}
                      </p>
                    </div>
                    {billingProfile.vatNumber && (
                      <div>
                        <h3 className="text-sm font-medium text-foreground mb-1">
                          VAT Number
                        </h3>
                        <p className="text-sm text-muted-foreground font-mono">
                          {billingProfile.vatNumber}
                        </p>
                      </div>
                    )}

                    <Separator />

                    <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/50">
                      {billingProfile.isMandateValidated ? (
                        <CheckCircle className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                      ) : (
                        <AlertTriangle className="h-4 w-4 text-amber-600 mt-0.5 flex-shrink-0" />
                      )}
                      <div>
                        <p className="text-sm font-medium">
                          Payment Mandate{" "}
                          {billingProfile.isMandateValidated
                            ? "Verified"
                            : "Pending"}
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">
                          {billingProfile.isMandateValidated
                            ? "Your payment method is set up and ready for billing."
                            : "Complete payment setup to activate your subscription."}
                        </p>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-6">
                    <div className="mx-auto w-12 h-12 rounded-full bg-muted flex items-center justify-center mb-3">
                      <CreditCard className="h-6 w-6 text-muted-foreground" />
                    </div>
                    <p className="text-sm text-muted-foreground">
                      No billing profile set up yet.
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Set up your billing profile to manage subscriptions.
                    </p>
                  </div>
                )}
              </CardContent>
              <CardFooter>
                {/* <Button
              onClick={() => billingProfileClient[':teamId']['billing-profile']['end-billing-cycle'].$post({
                param: { teamId: activeTeam!.id }
              })}
            >Test billing period end</Button> */}
                <Dialog
                  open={isEditingProfile}
                  onOpenChange={setIsEditingProfile}
                >
                  <DialogTrigger asChild>
                    <Button>
                      {billingProfile && !billingProfile.isMandateValidated && (
                        <CreditCard className="h-4 w-4 mr-2" />
                      )}
                      {((billingProfile && billingProfile.isMandateValidated) ||
                        !billingProfile) && <Pencil className="h-4 w-4 mr-2" />}
                      {billingProfile
                        ? billingProfile.isMandateValidated
                          ? "Edit Billing Profile"
                          : "Validate Payment Mandate"
                        : "Set Up Profile"}
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>
                        {billingProfile
                          ? "Edit Billing Profile"
                          : "Set Up Billing Profile"}
                      </DialogTitle>
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
        </div>

        {activeTeam?.id && (
          <PlansGrid
            currentSubscription={currentSubscription}
            teamId={activeTeam.id}
            onSubscriptionUpdate={setCurrentSubscription}
          />
        )}
      </div>
    </PageTemplate>
  );
}
