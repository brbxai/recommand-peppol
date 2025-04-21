import { Button } from "@core/components/ui/button";
import { BillingProfileForm, DEFAULT_BILLING_PROFILE_FORM_DATA, type BillingProfileFormData } from "../billing-profile-form";
import { useState, useEffect } from "react";
import { Loader2 } from "lucide-react";
import { updateBillingProfile, fetchBillingProfile } from "@peppol/lib/billing";
import { useActiveTeam } from "@core/hooks/user";
import type { BillingProfileData } from "@peppol/api/billing-profile";

export default function BillingOnboarding({ onComplete }: { onComplete: () => Promise<void> }) {
    const [profileForm, setProfileForm] = useState<BillingProfileFormData>(DEFAULT_BILLING_PROFILE_FORM_DATA);
    const [billingProfile, setBillingProfile] = useState<BillingProfileData | null>(null);
    const activeTeam = useActiveTeam();

    useEffect(() => {
        const checkPaymentMandate = async () => {
            if (!activeTeam?.id) return;

            const billingProfile = await fetchBillingProfile(activeTeam.id);

            setBillingProfile(billingProfile);

            if (billingProfile) {
                setProfileForm({
                    companyName: billingProfile?.companyName || '',
                    address: billingProfile?.address || '',
                    postalCode: billingProfile?.postalCode || '',
                    city: billingProfile?.city || '',
                    country: billingProfile?.country || 'BE',
                    vatNumber: billingProfile?.vatNumber || '',
                });
            }

            if (billingProfile?.isMandateValidated) {
                await onComplete();
            }
        };

        checkPaymentMandate();

        const interval = setInterval(checkPaymentMandate, 5000);
        return () => clearInterval(interval);
    }, [activeTeam?.id]);

    if (!activeTeam?.id) {
        return <p>
            You must be in a team to complete this step
        </p>;
    }

    return <div>
        <BillingProfileForm
            profileForm={profileForm}
            onChange={setProfileForm}
        />
        {billingProfile && !billingProfile.isMandateValidated && (
            <div className="flex items-center gap-2 pb-4">
                <Loader2 className="w-4 h-4 animate-spin" />
                Validating payment mandate...
            </div>
        )}
        <div className="flex justify-end">
            <Button onClick={async () => {
                await updateBillingProfile(activeTeam.id, profileForm);
                // Don't call onComplete here, it should only be called when payment has been set up
            }}>
                Setup Payment Method
            </Button>
        </div>
    </div>;
}