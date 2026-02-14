import { rc } from "@recommand/lib/client";
import type { Companies } from "@peppol/api/companies";
import { useEffect, useState, useMemo } from "react";
import { useParams } from "react-router-dom";
import { useActiveTeam } from "@core/hooks/user";
import { stringifyActionFailure } from "@recommand/lib/utils";
import { Button } from "@core/components/ui/button";
import { Input } from "@core/components/ui/input";
import { Label } from "@core/components/ui/label";
import { Checkbox } from "@core/components/ui/checkbox";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@core/components/ui/card";
import { RadioGroup, RadioGroupItem } from "@core/components/ui/radio-group";
import { Alert, AlertDescription } from "@core/components/ui/alert";
import { Loader2, AlertCircle, ShieldCheck } from "lucide-react";

const client = rc<Companies>("v1");

type Representative = {
    firstName: string;
    lastName: string;
    function: string;
};

type VerificationContext = {
    verificationLog: {
        id: string;
        status: string;
        companyName: string | null;
    };
    company: {
        id: string;
        name: string;
        enterpriseNumber: string | null;
    };
    isRepresentativeSelectionRequired: boolean;
    representatives: Representative[];
};

export default function Page() {
    const { companyVerificationLogId } = useParams<{ companyVerificationLogId: string }>();
    const activeTeam = useActiveTeam();

    const [context, setContext] = useState<VerificationContext | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [loadError, setLoadError] = useState<string | null>(null);

    const [selectedRepresentativeIndex, setSelectedRepresentativeIndex] = useState<string | null>(null);
    const [firstName, setFirstName] = useState("");
    const [lastName, setLastName] = useState("");
    const [acceptTerms, setAcceptTerms] = useState(false);
    const [confirmPermission, setConfirmPermission] = useState(false);

    const [isSubmitting, setIsSubmitting] = useState(false);
    const [submitError, setSubmitError] = useState<string | null>(null);

    const showRepresentativeSelection = context?.isRepresentativeSelectionRequired && context.representatives.length > 0;
    const representativeSelectionError = context?.isRepresentativeSelectionRequired && context.representatives.length === 0;

    const selectedRepresentative = useMemo(() => {
        if (!showRepresentativeSelection || selectedRepresentativeIndex === null) return null;
        return context?.representatives[parseInt(selectedRepresentativeIndex)] ?? null;
    }, [showRepresentativeSelection, selectedRepresentativeIndex, context?.representatives]);

    const effectiveFirstName = showRepresentativeSelection ? (selectedRepresentative?.firstName ?? "") : firstName;
    const effectiveLastName = showRepresentativeSelection ? (selectedRepresentative?.lastName ?? "") : lastName;

    const isFormComplete =
        !representativeSelectionError &&
        effectiveFirstName.trim() !== "" &&
        effectiveLastName.trim() !== "" &&
        acceptTerms &&
        confirmPermission;

    useEffect(() => {
        if (!activeTeam?.id || !companyVerificationLogId) return;

        const fetchContext = async () => {
            try {
                setIsLoading(true);
                setLoadError(null);
                const response = await client[":teamId"]["companies"]["verification"][":companyVerificationLogId"]["context"].$get({
                    param: {
                        teamId: activeTeam.id,
                        companyVerificationLogId,
                    },
                });
                const json = await response.json();
                if (!json.success) {
                    setLoadError(stringifyActionFailure(json.errors));
                    return;
                }
                setContext(json as unknown as VerificationContext & { success: true; errors: undefined });
            } catch (error) {
                setLoadError("Failed to load verification data. Please try again.");
            } finally {
                setIsLoading(false);
            }
        };

        fetchContext();
    }, [activeTeam?.id, companyVerificationLogId]);

    const handleSubmit = async () => {
        if (!activeTeam?.id || !companyVerificationLogId || !isFormComplete) return;

        try {
            setIsSubmitting(true);
            setSubmitError(null);
            const response = await client[":teamId"]["companies"]["verification"][":companyVerificationLogId"]["submit-identity-form"].$post({
                param: {
                    teamId: activeTeam.id,
                    companyVerificationLogId,
                },
                json: {
                    firstName: effectiveFirstName,
                    lastName: effectiveLastName,
                },
            });
            const json = await response.json();
            if (!json.success) {
                setSubmitError(stringifyActionFailure(json.errors));
                return;
            }
            if ("verificationUrl" in json) {
                window.location.href = json.verificationUrl as string;
            }
        } catch (error) {
            setSubmitError("An unexpected error occurred. Please try again.");
        } finally {
            setIsSubmitting(false);
        }
    };

    if (isLoading) {
        return (
            <div className="min-h-svh flex items-center justify-center bg-muted/30">
                <div className="text-center space-y-4">
                    <Loader2 className="h-8 w-8 animate-spin mx-auto text-muted-foreground" />
                    <p className="text-sm text-muted-foreground">Loading verification...</p>
                </div>
            </div>
        );
    }

    if (loadError || !context) {
        return (
            <div className="min-h-svh flex items-center justify-center bg-muted/30 px-4">
                <div className="w-full max-w-md text-center space-y-6">
                    <img src="/logo.svg" alt="Recommand" className="h-7 w-auto mx-auto opacity-40" />
                    <Card>
                        <CardContent className="pt-6">
                            <div className="space-y-4">
                                <AlertCircle className="h-10 w-10 mx-auto text-destructive" />
                                <p className="text-sm text-muted-foreground">
                                    {loadError || "Verification data could not be loaded."}
                                </p>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </div>
        );
    }

    const companyName = context.company.name;

    return (
        <div className="min-h-svh flex items-center justify-center bg-muted/30 px-4 py-12">
            <div className="w-full max-w-lg space-y-8">
                <div className="text-center space-y-2">
                    <img src="/logo.svg" alt="Recommand" className="h-7 w-auto mx-auto opacity-40 mb-12 -mt-12" />
                    <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-primary/10 mb-2">
                        <ShieldCheck className="h-6 w-6 text-primary" />
                    </div>
                    <h1 className="text-2xl font-semibold tracking-tight">Company Verification</h1>
                    <p className="text-sm text-muted-foreground max-w-sm mx-auto text-balance">
                        Verify your identity as a representative of <span className="font-medium text-foreground">{companyName}</span> to activate this company on the Peppol network.
                    </p>
                </div>

                {representativeSelectionError ? (
                    <Alert variant="destructive">
                        <AlertCircle className="h-4 w-4" />
                        <AlertDescription>
                            {context.company.enterpriseNumber ? (
                            <div className="text-pretty">
                                    No registered representatives could be found for your company with enterprise number {context.company.enterpriseNumber}. Please contact <a href={`mailto:support@recommand.eu?subject=Company Verification Assistance for ${context.company.id}`} className="underline underline-offset-4 hover:text-primary/80">support@recommand.eu</a> for assistance.
                                </div>
                            ) : (
                                <div className="text-pretty">
                                    No registered representatives could be found for your company. Please ensure your enterprise number is set correctly and try again.
                                </div>
                            )}
                        </AlertDescription>
                    </Alert>
                ) : (
                    <Card>
                        <CardHeader>
                            <CardTitle className="text-base">Representative Details</CardTitle>
                            <CardDescription>
                                {showRepresentativeSelection
                                    ? "Select your name from the list of registered representatives."
                                    : "Enter the name of the person authorised to represent this company."
                                }
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            {showRepresentativeSelection ? (
                                <RadioGroup
                                    value={selectedRepresentativeIndex ?? ""}
                                    onValueChange={(value) => setSelectedRepresentativeIndex(value)}
                                >
                                    {context.representatives.map((rep, index) => (
                                        <label
                                            key={index}
                                            className="flex items-center gap-3 rounded-lg border p-3 cursor-pointer transition-colors hover:bg-muted/50 has-data-[state=checked]:border-primary has-data-[state=checked]:bg-primary/5"
                                        >
                                            <RadioGroupItem value={String(index)} />
                                            <div className="flex-1 min-w-0">
                                                <p className="text-sm font-medium leading-none">
                                                    {rep.firstName} {rep.lastName}
                                                </p>
                                                {rep.function && (
                                                    <p className="text-xs text-muted-foreground mt-1">{rep.function}</p>
                                                )}
                                            </div>
                                        </label>
                                    ))}
                                </RadioGroup>
                            ) : (
                                <div className="grid gap-4 sm:grid-cols-2">
                                    <div className="space-y-2">
                                        <Label htmlFor="firstName">First name</Label>
                                        <Input
                                            id="firstName"
                                            value={firstName}
                                            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFirstName(e.target.value)}
                                            placeholder="John"
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor="lastName">Last name</Label>
                                        <Input
                                            id="lastName"
                                            value={lastName}
                                            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setLastName(e.target.value)}
                                            placeholder="Doe"
                                        />
                                    </div>
                                </div>
                            )}
                        </CardContent>
                    </Card>
                )}

                <Card>
                    <CardContent className="pt-6 space-y-4">
                        <label className="flex items-start gap-3 cursor-pointer">
                            <Checkbox
                                checked={acceptTerms}
                                onCheckedChange={(checked) => setAcceptTerms(checked === true)}
                                className="mt-0.5"
                            />
                            <span className="text-sm leading-snug text-muted-foreground">
                                I accept the{" "}
                                <a href="https://recommand.eu/en/legal/terms" target="_blank" rel="noopener noreferrer" className="text-primary underline underline-offset-4 hover:text-primary/80">
                                    terms and conditions
                                </a>{" "}
                                of Recommand on behalf of <span className="font-medium text-foreground">{companyName}</span>.
                            </span>
                        </label>

                        <label className="flex items-start gap-3 cursor-pointer">
                            <Checkbox
                                checked={confirmPermission}
                                onCheckedChange={(checked) => setConfirmPermission(checked === true)}
                                className="mt-0.5"
                            />
                            <span className="text-sm leading-snug text-muted-foreground">
                                I confirm that I am authorised to act on behalf of <span className="font-medium text-foreground">{companyName}</span> on the Peppol network.
                            </span>
                        </label>
                    </CardContent>
                </Card>

                {submitError && (
                    <Alert variant="destructive">
                        <AlertCircle className="h-4 w-4" />
                        <AlertDescription>{submitError}</AlertDescription>
                    </Alert>
                )}

                <Button
                    onClick={handleSubmit}
                    disabled={!isFormComplete || isSubmitting}
                    className="w-full"
                    size="lg"
                >
                    {isSubmitting ? (
                        <>
                            <Loader2 className="h-4 w-4 animate-spin" />
                            Verifying...
                        </>
                    ) : (
                        <>
                            <ShieldCheck className="h-4 w-4" />
                            Continue to Identity Verification
                        </>
                    )}
                </Button>

                <p className="text-xs text-center text-muted-foreground">
                    You will be redirected to our verification partner to complete the identity check.
                </p>
            </div>
        </div>
    );
}
