const {
  CognitoIdentityProviderClient,
  AdminAddUserToGroupCommand,
  AdminListGroupsForUserCommand
} = require("@aws-sdk/client-cognito-identity-provider");

const cognito = new CognitoIdentityProviderClient({ region: process.env.AWS_REGION });

exports.handler = async (event) => {
  if (event.triggerSource === "PostConfirmation_ConfirmSignUp") {
    const userPoolId = event.userPoolId;
    const username = event.userName;
    const role = event.request.userAttributes["custom:role"];
    
    try {
      // Check if user is already in another group
      const groupsRes = await cognito.send(new AdminListGroupsForUserCommand({
        UserPoolId: userPoolId,
        Username: username
      }));
      
      if (groupsRes.Groups && groupsRes.Groups.length > 0) {
        // User already has a group, block adding to a new one
        console.log(`❌ User ${username} already belongs to group(s): ${groupsRes.Groups.map(g => g.GroupName).join(", ")}`);
        return event; // Let Cognito sign-up complete but don't change groups
      }

      // Add user to the appropriate group
      await cognito.send(new AdminAddUserToGroupCommand({
        GroupName: role,
        UserPoolId: userPoolId,
        Username: username
      }));

      console.log(`✅ Added ${username} to group ${role}`);
    } catch (err) {
      console.error("❌ Error processing PostConfirmation Lambda:", err);
    }
  }

  // ✅ Don't write to DynamoDB here. Wait for profile completion.
  return event;
};
