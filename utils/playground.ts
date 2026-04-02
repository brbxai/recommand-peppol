function shouldInteractWithPeppolNetwork({
    isPlayground,
    useTestNetwork,
}: {
    isPlayground?: boolean;
    useTestNetwork?: boolean;
}): boolean {
    isPlayground = isPlayground ?? false;
    useTestNetwork = useTestNetwork ?? false;
    if(isPlayground){
        if(useTestNetwork){
            return true;
        }else{
            return false;
        }
    }else{
        return true;
    }
}

export function shouldRegisterWithSmp({
    isPlayground,
    useTestNetwork,
    isSmpRecipient,
    isVerified,
    verificationRequirements,
}: {
    isPlayground?: boolean;
    useTestNetwork?: boolean;
    isSmpRecipient: boolean;
    isVerified: boolean;
    verificationRequirements?: string;
}): boolean {
    // Only allow registration with the SMP if the company is an SMP recipient and is verified
    const requiresVerification = verificationRequirements === "strict";
    return shouldInteractWithPeppolNetwork({ isPlayground, useTestNetwork }) && isSmpRecipient && (!requiresVerification || isVerified);
}