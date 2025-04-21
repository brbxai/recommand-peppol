import { rc } from "@recommand/lib/client";
import type { BillingProfile } from "@peppol/api/billing-profile";
import type { BillingProfileFormData } from "@peppol/components/billing-profile-form";
import { toast } from "@core/components/ui/sonner";
import { stringifyActionFailure } from "@recommand/lib/utils";
import type { BillingProfileData } from "@peppol/api/billing-profile";

const billingProfileClient = rc<BillingProfile>('peppol');

export async function fetchBillingProfile(teamId: string): Promise<BillingProfileData | null> {
  try {
    const response = await billingProfileClient[':teamId']['billing-profile'].$get({
      param: { teamId }
    });
    const data = await response.json();

    if (data.success && data.billingProfile) {
      return data.billingProfile;
    }
    return null;
  } catch (error) {
    console.error('Error fetching billing profile:', error);
    toast.error('Failed to load billing profile');
    return null;
  }
}

export async function updateBillingProfile(
  teamId: string,
  profileForm: BillingProfileFormData,
  onSuccess?: (billingProfile: any) => void
) {
  try {
    const response = await billingProfileClient[':teamId']['billing-profile'].$put({
      param: { teamId },
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

    if (onSuccess) {
      onSuccess(data.billingProfile);
    }
    toast.success('Billing profile updated successfully');

    if (data.checkoutUrl) {
      // Redirect to Mollie checkout URL
      window.location.href = data.checkoutUrl;
    }

  } catch (error) {
    toast.error('Failed to update billing profile');
  }
} 