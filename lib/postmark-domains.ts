import { AccountClient } from "postmark";

function getPostmarkAccountClient() {
  if (!process.env.POSTMARK_ACCOUNT_TOKEN) {
    throw new Error(
      "POSTMARK_ACCOUNT_TOKEN is not set. This is different from the Server API token - find it in Postmark under Account > API Tokens."
    );
  }
  return new AccountClient(process.env.POSTMARK_ACCOUNT_TOKEN);
}

export interface PostmarkDomainDetails {
  ID: number;
  Name: string;
  SPFVerified: boolean;
  SPFHost: string;
  SPFTextValue: string;
  DKIMVerified: boolean;
  WeakDKIM: boolean;
  DKIMHost: string;
  DKIMTextValue: string;
  DKIMPendingHost: string;
  DKIMPendingTextValue: string;
  DKIMRevokedHost: string;
  DKIMRevokedTextValue: string;
  SafeToRemoveRevokedKeyFromDNS: boolean;
  DKIMUpdateStatus: string;
  ReturnPathDomain: string;
  ReturnPathDomainVerified: boolean;
  ReturnPathDomainCNAMEValue: string;
}

export async function createPostmarkDomain(
  domainName: string
): Promise<PostmarkDomainDetails> {
  const client = getPostmarkAccountClient();
  const response = await client.createDomain({
    Name: domainName,
    ReturnPathDomain: `pm-bounces.${domainName}`,
  });
  return response as unknown as PostmarkDomainDetails;
}

export async function verifyPostmarkDomainDkim(
  domainId: number
): Promise<PostmarkDomainDetails> {
  const client = getPostmarkAccountClient();
  const response = await client.verifyDomainDKIM(domainId);
  return response as unknown as PostmarkDomainDetails;
}

export async function verifyPostmarkDomainReturnPath(
  domainId: number
): Promise<PostmarkDomainDetails> {
  const client = getPostmarkAccountClient();
  const response = await client.verifyDomainReturnPath(domainId);
  return response as unknown as PostmarkDomainDetails;
}

export async function deletePostmarkDomain(domainId: number): Promise<void> {
  const client = getPostmarkAccountClient();
  await client.deleteDomain(domainId);
}
