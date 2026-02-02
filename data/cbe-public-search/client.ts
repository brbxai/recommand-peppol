import { XMLParser, XMLBuilder } from "fast-xml-parser";
import { createHash, randomBytes, randomUUID } from "crypto";
import { sendSystemAlert } from "@peppol/utils/system-notifications/telegram";

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

export type Representative = {
  firstName: string;
  lastName: string;
  function: string;
  beginDate: string;
  endDate?: string;
};

export type CompanyAddress = {
  street: string;
  number: string;
  postalCode: string;
  city: string;
  country: string;
};

export type CompanyType = {
  juridicalForm: {
    code: string;
    description: string;
    beginDate?: string;
  };
  denomination: {
    code: string;
    description: string;
    beginDate?: string;
  };
};

export type EnterpriseData = {
  enterpriseNumber: string;
  beginDate: string;
  address?: CompanyAddress;
  companyType?: CompanyType;
  representatives: Representative[];
};

export async function getEnterpriseData(enterpriseNumber: string): Promise<EnterpriseData> {
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
  if(accountBalance < 200 && (accountBalance % 5 === 0 || accountBalance < 20)) {
    sendSystemAlert("CBE Account balance is low", `Account balance is low: ${accountBalance}`, "warning");
  }

  const representatives: Representative[] = [];
  let address: CompanyAddress | undefined;
  let companyType: CompanyType | undefined;

  if (!enterprise) {
    return {
      enterpriseNumber,
      beginDate: enterprise.Period?.Begin || "",
      representatives,
      address,
      companyType,
    };
  }

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
      firstName: person.GivenName || "",
      lastName: person.Surname || "",
      function: func.Description?.Value || func.Code || "",
      beginDate,
      endDate,
    });
  }

  if (enterprise.Address) {
    const addr = enterprise.Address;
    const streetDesc = addr.Street?.Description;
    const municipalityDesc = addr.Municipality?.Description;

    address = {
      street: streetDesc?.Value || addr.Street?.Code || "",
      number: addr.HouseNumber || "",
      postalCode: addr.Zipcode || "",
      city: municipalityDesc?.Value || addr.Municipality?.Code || "",
      country: "BE",
    };
  }

  if (enterprise.JuridicalForm || enterprise.Denomination) {
    const juridicalFormDesc = enterprise.JuridicalForm?.Description;
    const denominationDesc = enterprise.Denomination?.Description;

    companyType = {
      juridicalForm: {
        code: enterprise.JuridicalForm?.Code || "",
        description: juridicalFormDesc?.Value || "",
        beginDate: enterprise.JuridicalForm?.ValidityPeriod?.Begin,
      },
      denomination: {
        code: enterprise.Denomination?.Code || "",
        description: denominationDesc?.Value || "",
        beginDate: enterprise.Denomination?.ValidityPeriod?.Begin,
      },
    };
  }

  return {
    enterpriseNumber,
    beginDate: enterprise.Period?.Begin || "",
    representatives,
    address,
    companyType,
  };
}
