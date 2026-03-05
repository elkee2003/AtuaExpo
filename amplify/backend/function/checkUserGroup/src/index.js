/* eslint-disable */
const {
  CognitoIdentityProviderClient,
  ListGroupsCommand,
  ListUsersInGroupCommand
} = require("@aws-sdk/client-cognito-identity-provider");

const cognito = new CognitoIdentityProviderClient({ region: process.env.AWS_REGION });

exports.handler = async (event) => {
  console.log("Pre Sign-Up Trigger Event:", JSON.stringify(event, null, 2));

  const email = event.request.userAttributes.email;
  const userPoolId = event.userPoolId;

  try {
    // 1️⃣ List all groups in the user pool
    const groupsData = await cognito.send(new ListGroupsCommand({
      UserPoolId: userPoolId
    }));

    // 2️⃣ Loop through each group and check for existing email
    for (const group of groupsData.Groups) {
      const usersInGroup = await cognito.send(new ListUsersInGroupCommand({
        UserPoolId: userPoolId,
        GroupName: group.GroupName
      }));

      const existingUser = usersInGroup.Users?.find(
        (u) =>
          u.Attributes?.find((a) => a.Name === "email" && a.Value === email)
      );

      if (existingUser) {
        throw new Error(
          `This email (${email}) is already registered under the '${group.GroupName}' group. Please use a different email.`
        );
      }
    }

    console.log("✅ Email is unique — signup allowed.");
    // Commented out the bottom code because I don't want to auto confirm user, I might have as well deleted the line of code
    // event.response.autoConfirmUser = true;
    return event;
  } catch (error) {
    console.error("❌ Error checking user groups:", error);
    throw new Error(
      error.message || "Signup restricted. Please use a unique email."
    );
  }
};
