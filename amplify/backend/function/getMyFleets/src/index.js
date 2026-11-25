/*
 * Atua Courier Pro — getMyFleets Lambda
 *
 * Responsibilities:
 * 1. Identify the authenticated Cognito user.
 * 2. Retrieve that user's FleetMember records.
 * 3. Retrieve all pages of membership records.
 * 4. Keep only ACTIVE memberships.
 * 5. Retrieve the corresponding Fleet records.
 * 6. Return each Fleet together with the user's membership information.
 *
 * SECURITY:
 * - Never accept userSub from the frontend.
 * - Never accept a fleetID from the frontend to determine access.
 * - The authenticated Cognito identity determines whose memberships
 *   can be retrieved.
 * - FleetMember and Fleet are accessed internally using IAM.
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

const PAGE_SIZE = 100;

const MAX_PAGES = 100;

const MAX_PARALLEL_FLEET_REQUESTS = 5;

// -----------------------------------------------------------------------------
// AUTHENTICATED USER
// -----------------------------------------------------------------------------

function getAuthenticatedUserSub(event) {
  const identity = event?.identity;

  const userSub = identity?.sub || identity?.claims?.sub;

  if (!userSub || typeof userSub !== "string") {
    throw new Error(
      "Unauthenticated request. A valid Cognito user identity is required.",
    );
  }

  return userSub;
}

// -----------------------------------------------------------------------------
// APPSYNC GRAPHQL REQUEST
// -----------------------------------------------------------------------------

async function callGraphQL(query, variables = {}) {
  if (!GRAPHQL_ENDPOINT) {
    throw new Error(
      "Missing API_ATUA_GRAPHQLAPIENDPOINTOUTPUT environment variable.",
    );
  }

  if (!AWS_REGION) {
    throw new Error("Missing REGION environment variable.");
  }

  const endpoint = new URL(GRAPHQL_ENDPOINT);

  const body = JSON.stringify({
    query,
    variables,
  });

  // Use the Lambda execution role's AWS credentials.
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

  // Sign the AppSync request using AWS Signature Version 4.
  const signedRequest = await signer.sign(request);

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
          reject(
            new Error(
              `AppSync HTTP error: ${apiResponse.statusCode}. ${responseText}`,
            ),
          );

          return;
        }

        try {
          resolve(JSON.parse(responseText));
        } catch {
          reject(new Error("AppSync returned an invalid JSON response."));
        }
      });
    });

    apiRequest.setTimeout(10000, () => {
      apiRequest.destroy(new Error("AppSync request timed out."));
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

    throw new Error(errorMessage);
  }

  if (!responseBody.data) {
    throw new Error("AppSync did not return a data object.");
  }

  return responseBody.data;
}

// -----------------------------------------------------------------------------
// GET USER'S FLEET MEMBERSHIPS
// -----------------------------------------------------------------------------

async function getUserFleetMemberships(userSub) {
  const query = `
    query FleetMembersByUserSub(
      $userSub: String!
      $limit: Int
      $nextToken: String
    ) {
      fleetMembersByUserSub(
        userSub: $userSub
        limit: $limit
        nextToken: $nextToken
      ) {
        items {
          id
          fleetID
          userSub
          courierID
          role
          status
          currentVehicleID
          invitedByID
          approvedByID
          joinedAt
          leftAt
          createdAt
          updatedAt
        }
        nextToken
      }
    }
  `;

  const allMemberships = [];

  let nextToken = null;

  let pageCount = 0;

  do {
    pageCount += 1;

    if (pageCount > MAX_PAGES) {
      throw new Error(
        "Too many membership pages. Unable to complete fleet retrieval safely.",
      );
    }

    const data = await callGraphQL(query, {
      userSub,
      limit: PAGE_SIZE,
      nextToken,
    });

    const result = data.fleetMembersByUserSub;

    if (!result) {
      throw new Error("AppSync did not return fleet membership records.");
    }

    const memberships = Array.isArray(result.items) ? result.items : [];

    allMemberships.push(...memberships);

    nextToken = result.nextToken || null;
  } while (nextToken);

  return allMemberships;
}

// -----------------------------------------------------------------------------
// GET A FLEET BY ID
// -----------------------------------------------------------------------------

async function getFleetByID(fleetID) {
  const query = `
    query GetFleet($id: ID!) {
      getFleet(id: $id) {
        id
        name
        businessName
        organisationType
        legalStatus
        verificationStatus

        registrationNumber
        registrationCountry
        registrationAuthority

        isRecognisedBrand
        brandWebsite
        verificationNotes

        logo

        phoneNumber
        email

        address
        state
        city
        landmark

        lat
        lng

        status

        ownerUserID

        subscriptionPlan
        subscriptionStatus
        subscriptionStartedAt
        subscriptionRenewsAt
        trialEndsAt

        walletID

        createdAt
        updatedAt
      }
    }
  `;

  const data = await callGraphQL(query, {
    id: fleetID,
  });

  return data.getFleet || null;
}

// -----------------------------------------------------------------------------
// FETCH FLEETS WITH LIMITED CONCURRENCY
// -----------------------------------------------------------------------------

async function getFleetsForMemberships(memberships) {
  const results = new Array(memberships.length);

  let currentIndex = 0;

  async function worker() {
    while (true) {
      const index = currentIndex++;

      if (index >= memberships.length) {
        return;
      }

      const membership = memberships[index];

      try {
        const fleet = await getFleetByID(membership.fleetID);

        // A deleted or unavailable fleet should not produce
        // an invalid fleet entry in the response.
        if (!fleet) {
          console.warn("Fleet record was not found for an active membership.", {
            membershipID: membership.id,
            fleetID: membership.fleetID,
          });

          results[index] = null;

          continue;
        }

        results[index] = {
          fleet,

          membershipID: membership.id,

          role: membership.role,

          membershipStatus: membership.status,

          joinedAt: membership.joinedAt || null,
        };
      } catch (error) {
        // Do not silently return an incomplete fleet list
        // when AppSync fails to retrieve a fleet.
        console.error("Failed to retrieve a fleet record.", {
          membershipID: membership.id,
          fleetID: membership.fleetID,
          error: error.message,
        });

        throw error;
      }
    }
  }

  const workerCount = Math.min(MAX_PARALLEL_FLEET_REQUESTS, memberships.length);

  await Promise.all(Array.from({ length: workerCount }, () => worker()));

  return results.filter(Boolean);
}

// -----------------------------------------------------------------------------
// MAIN LAMBDA HANDLER
// -----------------------------------------------------------------------------

exports.handler = async (event) => {
  console.log("getMyFleets invoked.");

  try {
    // 1. Identify the authenticated Cognito user.
    const userSub = getAuthenticatedUserSub(event);

    // 2. Retrieve all membership records for this user.
    const memberships = await getUserFleetMemberships(userSub);

    console.log("Fleet membership records retrieved.", {
      totalMemberships: memberships.length,
    });

    // 3. Only ACTIVE memberships grant current fleet access.
    const activeMemberships = memberships.filter(
      (membership) =>
        membership &&
        membership.status === "ACTIVE" &&
        typeof membership.fleetID === "string" &&
        membership.fleetID.length > 0,
    );

    // 4. Remove duplicate fleet IDs defensively.
    const uniqueMemberships = [];

    const seenFleetIDs = new Set();

    for (const membership of activeMemberships) {
      if (seenFleetIDs.has(membership.fleetID)) {
        console.warn("Duplicate active fleet membership detected.", {
          fleetID: membership.fleetID,
        });

        continue;
      }

      seenFleetIDs.add(membership.fleetID);

      uniqueMemberships.push(membership);
    }

    // 5. Retrieve the actual Fleet records.
    const items = await getFleetsForMemberships(uniqueMemberships);

    console.log("User fleets retrieved successfully.", {
      activeMemberships: uniqueMemberships.length,
      fleetsReturned: items.length,
    });

    // 6. Return the fleet records with membership information.
    return {
      items,
    };
  } catch (error) {
    console.error("getMyFleets failed.", {
      message: error.message,
      stack: error.stack,
    });

    throw new Error(error.message || "Unable to retrieve your fleets.");
  }
};
