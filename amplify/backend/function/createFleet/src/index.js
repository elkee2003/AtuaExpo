/*
 * Atua Courier Pro — createFleet Lambda
 *
 * Responsibilities:
 * 1. Receive an authenticated AppSync request.
 * 2. Extract the owner's Cognito sub.
 * 3. Validate fleet registration information.
 * 4. Create the Fleet record.
 * 5. Create the owner's FleetMember record.
 * 6. Return the created Fleet.
 *
 * SECURITY:
 * - Never trust ownerUserID supplied by the frontend.
 * - Never trust fleetID supplied by the frontend.
 * - The authenticated Cognito identity determines ownership.
 */

const https = require("https");

const { SignatureV4 } = require("@smithy/signature-v4");
const { HttpRequest } = require("@smithy/protocol-http");
const { Sha256 } = require("@aws-crypto/sha256-js");
const { defaultProvider } = require("@aws-sdk/credential-provider-node");

// -----------------------------------------------------------------------------
// CONFIGURATION
// -----------------------------------------------------------------------------

const GRAPHQL_ENDPOINT = process.env.API_ATUA_GRAPHQLAPIENDPOINTOUTPUT;

const AWS_REGION = process.env.REGION;

const VALID_ORGANISATION_TYPES = [
  "CORPORATE",
  "REGISTERED_BUSINESS",
  "INFORMAL_FLEET",
];

const VALID_LEGAL_STATUSES = [
  "REGISTERED",
  "UNREGISTERED",
  "REGISTRATION_IN_PROGRESS",
];

// -----------------------------------------------------------------------------
// ERROR HELPER
// -----------------------------------------------------------------------------

function throwError(message) {
  throw new Error(message);
}

// -----------------------------------------------------------------------------
// AUTHENTICATED USER
// -----------------------------------------------------------------------------

function getAuthenticatedUserSub(event) {
  const identity = event?.identity;

  const userSub = identity?.sub || identity?.claims?.sub;

  if (!userSub || typeof userSub !== "string") {
    throwError(
      "Unauthenticated request. A valid Cognito user identity is required.",
    );
  }

  return userSub;
}

// -----------------------------------------------------------------------------
// VALIDATE REGISTRATION INPUT
// -----------------------------------------------------------------------------

function validateRegistrationInput(input) {
  if (!input || typeof input !== "object") {
    throwError("Fleet registration information is required.");
  }

  // Fleet name is compulsory.
  const name = typeof input.name === "string" ? input.name.trim() : "";

  if (!name) {
    throwError("Fleet name is required.");
  }

  if (name.length > 150) {
    throwError("Fleet name cannot exceed 150 characters.");
  }

  // Validate organisation type.
  if (!VALID_ORGANISATION_TYPES.includes(input.organisationType)) {
    throwError("Invalid fleet organisation type.");
  }

  // Validate legal status.
  if (!VALID_LEGAL_STATUSES.includes(input.legalStatus)) {
    throwError("Invalid fleet legal status.");
  }

  // Only accept fields explicitly permitted during registration.
  const cleaned = {
    name,
    organisationType: input.organisationType,
    legalStatus: input.legalStatus,
  };

  // Optional string fields.
  const optionalStringFields = [
    "businessName",
    "registrationNumber",
    "registrationCountry",
    "registrationAuthority",
    "phoneNumber",
    "email",
    "address",
    "state",
    "city",
    "landmark",
    "logo",
    "brandWebsite",
  ];

  for (const field of optionalStringFields) {
    if (input[field] !== undefined && input[field] !== null) {
      if (typeof input[field] !== "string") {
        throwError(`${field} must be a string.`);
      }

      const value = input[field].trim();

      if (value !== "") {
        cleaned[field] = value;
      }
    }
  }

  // Validate email.
  if (cleaned.email) {
    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!emailPattern.test(cleaned.email)) {
      throwError("Please provide a valid email address.");
    }
  }

  // Validate website URL.
  if (cleaned.brandWebsite) {
    let website;

    try {
      website = new URL(cleaned.brandWebsite);
    } catch {
      throwError("Please provide a valid brand website URL.");
    }

    if (website.protocol !== "https:" && website.protocol !== "http:") {
      throwError("Brand website must use HTTP or HTTPS.");
    }
  }

  // Validate recognised brand.
  if (
    input.isRecognisedBrand !== undefined &&
    input.isRecognisedBrand !== null
  ) {
    if (typeof input.isRecognisedBrand !== "boolean") {
      throwError("isRecognisedBrand must be true or false.");
    }

    cleaned.isRecognisedBrand = input.isRecognisedBrand;
  }

  // Validate latitude and longitude.
  const hasLat = input.lat !== undefined && input.lat !== null;
  const hasLng = input.lng !== undefined && input.lng !== null;

  if (hasLat !== hasLng) {
    throwError("Latitude and longitude must both be provided together.");
  }

  if (hasLat && hasLng) {
    const lat = Number(input.lat);
    const lng = Number(input.lng);

    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      throwError("Invalid latitude or longitude.");
    }

    if (lat < -90 || lat > 90) {
      throwError("Latitude must be between -90 and 90.");
    }

    if (lng < -180 || lng > 180) {
      throwError("Longitude must be between -180 and 180.");
    }

    cleaned.lat = lat;
    cleaned.lng = lng;
  }

  return cleaned;
}

// -----------------------------------------------------------------------------
// APPSYNC GRAPHQL REQUEST
// -----------------------------------------------------------------------------

async function callGraphQL(query, variables) {
  if (!GRAPHQL_ENDPOINT) {
    throwError(
      "Missing API_ATUA_GRAPHQLAPIENDPOINTOUTPUT environment variable.",
    );
  }

  if (!AWS_REGION) {
    throwError("Missing REGION environment variable.");
  }

  const endpoint = new URL(GRAPHQL_ENDPOINT);

  const body = JSON.stringify({
    query,
    variables,
  });

  // Sign the request using the Lambda execution role's IAM credentials.
  const signer = new SignatureV4({
    credentials: defaultProvider(),
    region: AWS_REGION,
    service: "appsync",
    sha256: Sha256,
  });

  const request = new HttpRequest({
    protocol: endpoint.protocol,
    hostname: endpoint.hostname,
    port: endpoint.port ? Number(endpoint.port) : undefined,
    method: "POST",
    path: endpoint.pathname,
    headers: {
      "Content-Type": "application/json",
      host: endpoint.host,
    },
    body,
  });

  const signedRequest = await signer.sign(request);

  // Send the signed request to AppSync.
  const responseBody = await new Promise((resolve, reject) => {
    const requestOptions = {
      hostname: endpoint.hostname,
      port: endpoint.port ? Number(endpoint.port) : 443,
      path: endpoint.pathname,
      method: "POST",
      headers: signedRequest.headers,
    };

    const apiRequest = https.request(requestOptions, (apiResponse) => {
      let responseText = "";

      apiResponse.on("data", (chunk) => {
        responseText += chunk;
      });

      apiResponse.on("end", () => {
        if (apiResponse.statusCode < 200 || apiResponse.statusCode >= 300) {
          const error = new Error(
            `AppSync HTTP error: ${apiResponse.statusCode}. ${responseText}`,
          );

          error.isGraphQLResponse = false;
          reject(error);
          return;
        }

        try {
          resolve(JSON.parse(responseText));
        } catch {
          reject(new Error("AppSync returned an invalid JSON response."));
        }
      });
    });

    apiRequest.on("error", reject);

    apiRequest.write(body);
    apiRequest.end();
  });

  // AppSync can return HTTP 200 with GraphQL errors.
  if (responseBody.errors && responseBody.errors.length > 0) {
    const errorMessage = responseBody.errors
      .map((error) => error.message)
      .join("; ");

    const error = new Error(errorMessage);

    error.isGraphQLResponse = true;

    throw error;
  }

  return responseBody.data;
}

// -----------------------------------------------------------------------------
// CREATE FLEET RECORD
// -----------------------------------------------------------------------------

async function createFleetRecord(input, ownerUserSub, now) {
  const mutation = `
    mutation CreateFleet($input: CreateFleetInput!) {
      createFleet(input: $input) {
        id
        name
        businessName
        organisationType
        legalStatus
        verificationStatus
        status
        ownerUserID
        subscriptionPlan
        subscriptionStatus
        subscriptionStartedAt
        registrationNumber
        registrationCountry
        registrationAuthority
        isRecognisedBrand
        brandWebsite
        logo
        phoneNumber
        email
        address
        state
        city
        landmark
        lat
        lng
        createdAt
        updatedAt
      }
    }
  `;

  const fleetInput = {
    ...input,

    // Ownership comes from the authenticated Cognito user.
    ownerUserID: ownerUserSub,

    // Initial fleet status.
    status: "PENDING",
    verificationStatus: "UNVERIFIED",

    // All new fleets start on the Free plan.
    subscriptionPlan: "FREE",
    subscriptionStatus: "ACTIVE",
    subscriptionStartedAt: now,
  };

  const data = await callGraphQL(mutation, {
    input: fleetInput,
  });

  if (!data?.createFleet?.id) {
    throwError("The Fleet record could not be created.");
  }

  return data.createFleet;
}

// -----------------------------------------------------------------------------
// CREATE OWNER MEMBERSHIP
// -----------------------------------------------------------------------------

async function createOwnerMembership(fleetID, ownerUserSub, now) {
  const mutation = `
    mutation CreateFleetMember($input: CreateFleetMemberInput!) {
      createFleetMember(input: $input) {
        id
        fleetID
        userSub
        role
        status
        joinedAt
        createdAt
        updatedAt
      }
    }
  `;

  const membershipInput = {
    fleetID,
    userSub: ownerUserSub,

    // The fleet owner does not need to be an Atua Courier.
    // courierID is intentionally omitted.

    role: "OWNER",
    status: "ACTIVE",
    joinedAt: now,
  };

  const data = await callGraphQL(mutation, {
    input: membershipInput,
  });

  if (!data?.createFleetMember?.id) {
    throwError("The owner's fleet membership could not be created.");
  }

  return data.createFleetMember;
}

// -----------------------------------------------------------------------------
// COMPENSATING CLEANUP
// -----------------------------------------------------------------------------

/*
 * If AppSync definitively rejects the owner-membership mutation,
 * attempt to remove the Fleet record created earlier.
 *
 * We do not run this cleanup after a network/HTTP failure because
 * the membership request may have succeeded even if its response
 * was not received.
 */

async function deleteFleetAfterMembershipFailure(fleetID) {
  const mutation = `
    mutation DeleteFleet($input: DeleteFleetInput!) {
      deleteFleet(input: $input) {
        id
      }
    }
  `;

  try {
    await callGraphQL(mutation, {
      input: {
        id: fleetID,
      },
    });

    console.log("Fleet cleanup completed after membership creation failed.", {
      fleetID,
    });
  } catch (error) {
    console.error(
      "IMPORTANT: Fleet cleanup failed. Manual reconciliation may be required.",
      {
        fleetID,
        error: error.message,
      },
    );
  }
}

// -----------------------------------------------------------------------------
// MAIN LAMBDA HANDLER
// -----------------------------------------------------------------------------

exports.handler = async (event) => {
  console.log("createFleet invoked.");

  try {
    // 1. Identify the authenticated Cognito user.
    const ownerUserSub = getAuthenticatedUserSub(event);

    // 2. Read registration information from the custom AppSync mutation.
    const registrationInput = event?.arguments?.input;

    // 3. Validate and whitelist submitted information.
    const cleanedInput = validateRegistrationInput(registrationInput);

    const now = new Date().toISOString();

    // 4. Create the Fleet record.
    const fleet = await createFleetRecord(cleanedInput, ownerUserSub, now);

    console.log("Fleet created successfully.", {
      fleetID: fleet.id,
      ownerUserSub,
    });

    // 5. Create the owner's OWNER membership.
    try {
      await createOwnerMembership(fleet.id, ownerUserSub, now);
    } catch (membershipError) {
      console.error("Owner membership creation failed.", {
        fleetID: fleet.id,
        error: membershipError.message,
      });

      // Only compensate after a definitive GraphQL rejection.
      if (membershipError.isGraphQLResponse === true) {
        await deleteFleetAfterMembershipFailure(fleet.id);
      }

      throw membershipError;
    }

    console.log("Owner membership created successfully.", {
      fleetID: fleet.id,
      ownerUserSub,
      role: "OWNER",
    });

    // 6. Return the created Fleet to AppSync.
    return fleet;
  } catch (error) {
    console.error("createFleet failed:", {
      name: error.name,
      message: error.message,
    });

    throw new Error(error.message || "Unable to register fleet.");
  }
};
