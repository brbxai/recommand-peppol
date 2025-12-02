export function shouldInteractWithPeppolNetwork({
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