import { PageTemplate } from "@core/components/page-template";
import { rc } from "@recommand/lib/client";
import type { Subscription } from "api/subscription";
import { useEffect, useState } from "react";
import { Button } from "@core/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@core/components/ui/card";
import { toast } from "@core/components/ui/sonner";
import { useUser } from "@core/hooks/use-user";
import { Loader2, XCircle, CheckCircle, Pencil, Check, CreditCard } from "lucide-react";
import { allPlans } from "@peppol/data/plans";
import { stringifyActionFailure } from "@recommand/lib/utils";
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
import type { BillingProfile, BillingProfileData } from "@peppol/api/billing-profile";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@core/components/ui/dialog";
import { Input } from "@core/components/ui/input";
import { Label } from "@core/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@core/components/ui/select";

const subscriptionClient = rc<Subscription>('peppol');
const billingProfileClient = rc<BillingProfile>('peppol');

type BillingProfileFormData = {
  companyName: string;
  address: string;
  postalCode: string;
  city: string;
  country: "BE";
  vatNumber: string | null;
};

export default function Page() {
  const [isLoading, setIsLoading] = useState(true);
  const [currentSubscription, setCurrentSubscription] = useState<SubscriptionType | null>(null);
  const [billingProfile, setBillingProfile] = useState<BillingProfileData | null>(null);
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [profileForm, setProfileForm] = useState<BillingProfileFormData>({
    companyName: '',
    address: '',
    postalCode: '',
    city: '',
    country: 'BE',
    vatNumber: '',
  });
  const { activeTeam } = useUser();

  const fetchSubscription = async () => {
    if (!activeTeam?.id) {
      setIsLoading(false);
      return;
    }

    try {
      const response = await subscriptionClient[':teamId']['subscription'].$get({
        param: { teamId: activeTeam.id }
      });
      const data = await response.json();

      if (!data.success || !data.subscription) {
        return;
      }

      setCurrentSubscription({
        ...data.subscription,
        createdAt: new Date(data.subscription.createdAt),
        startDate: new Date(data.subscription.startDate),
        endDate: data.subscription.endDate ? new Date(data.subscription.endDate) : null,
        lastBilledAt: data.subscription.lastBilledAt ? new Date(data.subscription.lastBilledAt) : null,
      });
    } catch (error) {
      console.error('Error fetching subscription:', error);
      toast.error('Failed to load subscription');
    } finally {
      setIsLoading(false);
    }
  };

  const fetchBillingProfile = async () => {
    if (!activeTeam?.id) return;

    try {
      const response = await billingProfileClient[':teamId']['billing-profile'].$get({
        param: { teamId: activeTeam.id }
      });
      const data = await response.json();

      if (data.success && data.billingProfile) {
        setBillingProfile(data.billingProfile);
        setProfileForm({
          companyName: data.billingProfile.companyName,
          address: data.billingProfile.address,
          postalCode: data.billingProfile.postalCode,
          city: data.billingProfile.city,
          country: data.billingProfile.country,
          vatNumber: data.billingProfile.vatNumber || '',
        });
      }
    } catch (error) {
      console.error('Error fetching billing profile:', error);
      toast.error('Failed to load billing profile');
    }
  };

  useEffect(() => {
    fetchSubscription();
    fetchBillingProfile();
  }, [activeTeam?.id]);

  const handleStartSubscription = async (planId: string) => {
    if (!activeTeam?.id) return;

    try {
      const response = await subscriptionClient[':teamId'].subscription.$post({
        param: { teamId: activeTeam.id },
        json: { planId }
      });

      const data = await response.json();
      if (data.success) {
        setCurrentSubscription({
          ...data.subscription,
          createdAt: new Date(data.subscription.createdAt),
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

  const handleCancelSubscription = async () => {
    if (!activeTeam?.id) return;

    try {
      const response = await subscriptionClient[':teamId'].subscription.cancel.$post({
        param: { teamId: activeTeam.id }
      });

      const data = await response.json();
      setCurrentSubscription(null);
      toast.success('Subscription cancelled successfully');
    } catch (error) {
      toast.error('Failed to cancel subscription');
    }
  };

  const handleUpdateProfile = async () => {
    if (!activeTeam?.id) return;

    try {
      const response = await billingProfileClient[':teamId']['billing-profile'].$put({
        param: { teamId: activeTeam.id },
        json: {
          ...profileForm,
          vatNumber: profileForm.vatNumber || null,
        }
      });
      const data = await response.json();
      if (!data.success) {
        toast.error(stringifyActionFailure(data.errors));
        return;
      }

      setBillingProfile(data.billingProfile);
      setIsEditingProfile(false);
      toast.success('Billing profile updated successfully');

      if (data.checkoutUrl) {
        // Redirect to Mollie checkout URL
        window.location.href = data.checkoutUrl;
      }

    } catch (error) {
      toast.error('Failed to update billing profile');
    }
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

  return <PageTemplate
    breadcrumbs={[
      { label: "Team Settings" },
      { label: "Billing" },
      { label: "Subscription" },
    ]}
  >
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-2">
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
                  <h3 className="font-medium">Plan</h3>
                  <p className="text-muted-foreground">{currentSubscription.planName}</p>
                </div>
                <div>
                  <h3 className="font-medium">Monthly Price</h3>
                  <p className="text-muted-foreground">€{currentSubscription.billingConfig.basePrice.toFixed(2)}</p>
                </div>
                <div>
                  <h3 className="font-medium">Included Documents</h3>
                  <p className="text-muted-foreground">{currentSubscription.billingConfig.includedMonthlyDocuments} documents per month</p>
                </div>
                <div>
                  <h3 className="font-medium">Overage Rate</h3>
                  <p className="text-muted-foreground">€{currentSubscription.billingConfig.documentOveragePrice.toFixed(2)} per document</p>
                </div>
                <div>
                  <h3 className="font-medium">Start Date</h3>
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
                  <h3 className="font-medium">Company Name</h3>
                  <p className="text-muted-foreground">{billingProfile.companyName}</p>
                </div>
                <div>
                  <h3 className="font-medium">Address</h3>
                  <p className="text-muted-foreground">{billingProfile.address}</p>
                </div>
                <div className="flex flex-col md:flex-row items-center gap-2">
                  <div>
                    <h3 className="font-medium">Postal Code</h3>
                    <p className="text-muted-foreground">{billingProfile.postalCode}</p>
                  </div>
                  <div>
                    <h3 className="font-medium">City</h3>
                    <p className="text-muted-foreground">{billingProfile.city}</p>
                  </div>
                </div>
                <div>
                  <h3 className="font-medium">Country</h3>
                  <p className="text-muted-foreground">{billingProfile.country}</p>
                </div>
                {billingProfile.vatNumber && (
                  <div>
                    <h3 className="font-medium">VAT Number</h3>
                    <p className="text-muted-foreground">{billingProfile.vatNumber}</p>
                  </div>
                )}
                <div className="pt-4">
                  <div className="flex items-center space-x-2 mt-2">
                    {billingProfile.isMandateValidated ? (
                      <Check className="h-4 w-4 text-green-600" />
                    ) : (
                      <XCircle className="h-4 w-4 text-red-600" />
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
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label htmlFor="companyName">Company Name</Label>
                    <Input
                      id="companyName"
                      value={profileForm.companyName}
                      onChange={(e) => setProfileForm({ ...profileForm, companyName: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="address">Address</Label>
                    <Input
                      id="address"
                      value={profileForm.address}
                      onChange={(e) => setProfileForm({ ...profileForm, address: e.target.value })}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <Label htmlFor="postalCode">Postal Code</Label>
                      <Input
                        id="postalCode"
                        value={profileForm.postalCode}
                        onChange={(e) => setProfileForm({ ...profileForm, postalCode: e.target.value })}
                      />
                    </div>
                    <div>
                      <Label htmlFor="city">City</Label>
                      <Input
                        id="city"
                        value={profileForm.city}
                        onChange={(e) => setProfileForm({ ...profileForm, city: e.target.value })}
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="country">Country</Label>
                    <Select
                      value={profileForm.country}
                      onValueChange={(value) => setProfileForm({ ...profileForm, country: value as 'BE' })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="BE">Belgium</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="vatNumber">VAT Number (Optional)</Label>
                    <Input
                      id="vatNumber"
                      value={profileForm.vatNumber || ''}
                      onChange={(e) => {
                        const value = e.target.value.trim();
                        if (value === '') {
                          setProfileForm({ ...profileForm, vatNumber: null });
                        } else {
                          setProfileForm({ ...profileForm, vatNumber: value });
                        }
                      }}
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setIsEditingProfile(false)}>
                    Cancel
                  </Button>
                  <Button onClick={handleUpdateProfile}>
                    Save Changes
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </CardFooter>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {allPlans.map((plan) => (
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
    </div>
  </PageTemplate>;
}
