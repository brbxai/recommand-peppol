import { XMLParser, XMLBuilder } from "fast-xml-parser";
import { createHash, randomBytes, randomUUID } from "crypto";
import { sendSystemAlert } from "@peppol/utils/system-notifications/telegram";
import { enterpriseDataCache } from "@peppol/db/schema";
import { db } from "@recommand/db";
import { and, desc, eq } from "drizzle-orm";
import type { Representative, EnterpriseData, CompanyAddress, CompanyType } from "./types";

export type { Representative };

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
  textNodeName: "#text",
  removeNSPrefix: true,
  isArray: (name, jpath) => {
    return name === "Function";
  },
});

const builder = new XMLBuilder({
  ignoreAttributes: false,
  format: false,
});

export async function getEnterpriseData(enterpriseNumber: string, country: string): Promise<EnterpriseData> {

  try {
    const cache = await getEnterpriseDataFromCache(enterpriseNumber, country);
    // Chache is not older than 1 month
    if (cache && new Date(cache.updatedAt).getTime() > Date.now() - 30 * 24 * 60 * 60 * 1000) {
      return cache.enterpriseData;
    }
  } catch (error) { }

  const username = process.env.CBE_USERNAME;
  const password = process.env.CBE_PASSWORD;
  const endpoint = "https://kbopub.economie.fgov.be/kbopubws180000/services/wsKBOPub";

  if (!username || !password) {
    throw new Error("CBE_USERNAME and CBE_PASSWORD environment variables must be set");
  }

  const nonce = randomBytes(16);
  const nonceBase64 = nonce.toString("base64");
  const created = new Date().toISOString();
  const expires = new Date(Date.now() + 300 * 1000).toISOString();

  const passwordDigest = createHash("sha1")
    .update(nonce)
    .update(created)
    .update(password)
    .digest("base64");

  const requestId = randomUUID();
  const language = "nl";

  const soapEnvelope = {
    "soapenv:Envelope": {
      "@_xmlns:soapenv": "http://schemas.xmlsoap.org/soap/envelope/",
      "@_xmlns:mes": "http://economie.fgov.be/kbopub/webservices/v1/messages",
      "@_xmlns:dat": "http://economie.fgov.be/kbopub/webservices/v1/datamodel",
      "@_xmlns:wsse": "http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-wssecurity-secext-1.0.xsd",
      "@_xmlns:wsu": "http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-wssecurity-utility-1.0.xsd",
      "soapenv:Header": {
        "wsse:Security": {
          "wsu:Timestamp": {
            "wsu:Created": created,
            "wsu:Expires": expires,
          },
          "wsse:UsernameToken": {
            "wsse:Username": username,
            "wsse:Password": {
              "@_Type": "http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-username-token-profile-1.0#PasswordDigest",
              "#text": passwordDigest,
            },
            "wsse:Nonce": {
              "@_EncodingType": "http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-soap-message-security-1.0#Base64Binary",
              "#text": nonceBase64,
            },
            "wsu:Created": created,
          },
        },
        "mes:RequestContext": {
          "mes:Id": requestId,
          "mes:Language": language,
        },
      },
      "soapenv:Body": {
        "mes:ReadEnterpriseRequest": {
          "dat:EnterpriseNumber": enterpriseNumber,
        },
      },
    },
  };

  const soapBody = builder.build(soapEnvelope);

  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "text/xml;charset=UTF-8",
      "SOAPAction": '"http://fgov.economie.be/kbopub/ReadEnterprise"',
    },
    body: soapBody,
  });

  if (!response.ok) {
    throw new Error(`CBE API error: ${response.status} ${response.statusText}: ${await response.text()}`);
  }

  const xml = await response.text();
  const parsed = parser.parse(xml);

  const envelope = parsed.Envelope;
  const header = envelope?.Header;
  const body = envelope?.Body;
  const responseData = body?.ReadEnterpriseReply;
  const enterprise = responseData?.Enterprise;

  const accountBalance = header?.ReplyContext?.AccountBalance
    ? parseInt(header.ReplyContext.AccountBalance, 10)
    : 0;

  console.log("CBE Account balance:", accountBalance);
  // Send alert if account balance is less than 200 and is a multiple of 5 or less than 20
  if (accountBalance < 200 && (accountBalance % 5 === 0 || accountBalance < 20)) {
    sendSystemAlert("CBE Account balance is low", `Account balance is low: ${accountBalance}`, "warning");
  }

  const representatives: Representative[] = [];
  let address: CompanyAddress | null = null;
  let companyType: CompanyType | null = null;

  const functions = enterprise.Function || [];
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  for (const func of functions) {
    const person = func.Person;
    if (!person) {
      continue;
    }

    const period = func.Period;
    const beginDate = period?.Begin;
    const endDate = period?.End;

    if (!beginDate) {
      continue;
    }

    const begin = new Date(beginDate);
    begin.setHours(0, 0, 0, 0);

    if (begin > today) {
      continue;
    }

    if (endDate) {
      const end = new Date(endDate);
      end.setHours(0, 0, 0, 0);
      if (end < today) {
        continue;
      }
    }

    representatives.push({
      firstName: person.GivenName ?? null,
      lastName: person.Surname ?? null,
      function: func.Description?.Value || func.Code || null,
      beginDate,
      endDate: endDate ?? null,
    });
  }

  const addr = enterprise.Address;
  console.log("addr", addr);
  if (addr) {
    const streetDesc = addr.Street?.Description;
    const municipalityDesc = addr.Municipality?.Description;
    address = {
      street: streetDesc?.Value || null,
      number: addr.HouseNumber != null ? String(addr.HouseNumber) : null,
      postalCode: addr.Zipcode != null ? String(addr.Zipcode) : null,
      city: municipalityDesc?.Value || null,
      country: "BE",
    };
  }

  if (enterprise.JuridicalForm || enterprise.Denomination) {
    const juridicalFormDesc = enterprise.JuridicalForm?.Description;
    const denominationDesc = enterprise.Denomination?.Description;
    companyType = {
      juridicalForm: enterprise.JuridicalForm ? {
        code: enterprise.JuridicalForm.Code ?? null,
        description: juridicalFormDesc?.Value ?? null,
        beginDate: enterprise.JuridicalForm.ValidityPeriod?.Begin ?? null,
      } : null,
      denomination: enterprise.Denomination ? {
        code: enterprise.Denomination.Code ?? null,
        description: denominationDesc?.Value ?? null,
        beginDate: enterprise.Denomination.ValidityPeriod?.Begin ?? null,
      } : null,
    };
  }

  const enterpriseData: EnterpriseData = {
    enterpriseNumber,
    beginDate: enterprise.Period?.Begin ?? null,
    representatives,
    address,
    companyType,
  };

  try {
    await upsertEnterpriseDataInCache(enterpriseData);
  } catch (error) {
    console.error(error);
  }
  
  return enterpriseData;
}

export async function getEnterpriseDataFromCache(enterpriseNumber: string, country: string): Promise<{ enterpriseData: EnterpriseData, updatedAt: Date } | null> {
  const cache = await db.select()
    .from(enterpriseDataCache)
    .where(and(eq(enterpriseDataCache.enterpriseNumber, enterpriseNumber), eq(enterpriseDataCache.country, country)))
    .orderBy(desc(enterpriseDataCache.createdAt))
    .limit(1)
    .then((rows) => rows[0]);
  if (!cache) {
    return null;
  }
  const hasAddress = cache.street || cache.number || cache.postalCode || cache.city;
  const hasCompanyType = cache.juridicalFormCode || cache.denominationCode;

  return {
    enterpriseData: {
      enterpriseNumber: cache.enterpriseNumber,
      beginDate: cache.beginDate,
      address: hasAddress ? {
        street: cache.street,
        number: cache.number,
        postalCode: cache.postalCode,
        city: cache.city,
        country: cache.country,
      } : null,
      companyType: hasCompanyType ? {
        juridicalForm: cache.juridicalFormCode ? {
          code: cache.juridicalFormCode,
          description: cache.juridicalFormDescription,
          beginDate: cache.juridicalFormBeginDate,
        } : null,
        denomination: cache.denominationCode ? {
          code: cache.denominationCode,
          description: cache.denominationDescription,
          beginDate: cache.denominationBeginDate,
        } : null,
      } : null,
      representatives: cache.representatives || [],
    },
    updatedAt: cache.updatedAt,
  };
}

export async function upsertEnterpriseDataInCache(data: EnterpriseData) {
  const country = (data.address?.country || "BE") as typeof enterpriseDataCache.$inferInsert.country;
  await db.transaction(async (tx) => {
    await tx.delete(enterpriseDataCache).where(and(eq(enterpriseDataCache.enterpriseNumber, data.enterpriseNumber), eq(enterpriseDataCache.country, country)));
    await tx.insert(enterpriseDataCache).values({
      enterpriseNumber: data.enterpriseNumber,
      country,
      beginDate: data.beginDate,
      name: data.companyType?.denomination?.description,
      street: data.address?.street,
      number: data.address?.number,
      postalCode: data.address?.postalCode,
      city: data.address?.city,
      juridicalFormCode: data.companyType?.juridicalForm?.code,
      juridicalFormDescription: data.companyType?.juridicalForm?.description,
      juridicalFormBeginDate: data.companyType?.juridicalForm?.beginDate,
      denominationCode: data.companyType?.denomination?.code,
      denominationDescription: data.companyType?.denomination?.description,
      denominationBeginDate: data.companyType?.denomination?.beginDate,
      representatives: data.representatives,
    });
  });
}