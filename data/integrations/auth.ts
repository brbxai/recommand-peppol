import { addSeconds } from "date-fns";
import { type ActivatedIntegration } from ".";
import { createLocalJWKSet, importPKCS8, jwtVerify, SignJWT, type JWTPayload } from "jose";
import { ulid } from "ulid";

export async function generateIntegrationJwt(integration: ActivatedIntegration) {

    if (!process.env.INTEGRATIONS_JWKS) {
        throw new Error("INTEGRATIONS_JWKS is not set");
    }
    if (!process.env.INTEGRATIONS_PRIVATE_KEY) {
        throw new Error("INTEGRATIONS_PRIVATE_KEY is not set");
    }
    const privateKey = await importPKCS8(process.env.INTEGRATIONS_PRIVATE_KEY, "RS256");

    const jwt = await new SignJWT({
        teamId: integration.teamId,
        companyId: integration.companyId,
        integrationId: integration.id,
    })
        .setProtectedHeader({ alg: "RS256" })
        .setIssuedAt()
        .setExpirationTime(addSeconds(new Date(), 5 * 60)) // 5 minutes
        .setJti("jti_" + ulid())
        .setIssuer("https://app.recommand.eu")
        .setAudience(["https://app.recommand.eu", integration.manifest.url])
        .sign(privateKey);

    return jwt;
}

export async function verifyIntegrationJwt(jwt: string): Promise<JWTPayload | null> {
    // Ensure the JWT is a valid JWT, directed at app.recommand.eu (as audience), is signed by Recommand (verify with JWKS)
    if (!process.env.INTEGRATIONS_JWKS) {
        throw new Error("INTEGRATIONS_JWKS is not set");
    }
    try {
        const jwks = JSON.parse(process.env.INTEGRATIONS_JWKS);
        const jwksSet = createLocalJWKSet(jwks);
        const { payload } = await jwtVerify(jwt, jwksSet, {
            algorithms: ["RS256"],
            audience: "https://app.recommand.eu",
        });

        if (!payload.teamId || !payload.integrationId || !payload.companyId) {
            return null;
        }

        return payload;
    } catch (error) {
        console.error(error);
        return null;
    }
}