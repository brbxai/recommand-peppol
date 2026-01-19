import z from "zod";

export const companyCustomDomainResponse = z.object({
  id: z.string(),
  companyId: z.string(),
  postmarkDomainId: z.number(),
  domainName: z.string(),
  dkimVerified: z.boolean(),
  dkimPendingHost: z.string().nullable(),
  dkimPendingValue: z.string().nullable(),
  dkimHost: z.string().nullable(),
  dkimValue: z.string().nullable(),
  returnPathDomain: z.string().nullable(),
  returnPathVerified: z.boolean(),
  returnPathCnameValue: z.string().nullable(),
  senderEmail: z.string(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
