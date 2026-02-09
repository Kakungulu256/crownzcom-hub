const sdk = require('node-appwrite');

module.exports = async ({ req, res, log, error }) => {
  const client = new sdk.Client();
  const users = new sdk.Users(client);
  const databases = new sdk.Databases(client);

  client
    .setEndpoint(process.env.APPWRITE_FUNCTION_ENDPOINT)
    .setProject(process.env.APPWRITE_FUNCTION_PROJECT_ID)
    .setKey(process.env.APPWRITE_API_KEY);

  let userId = null;

  try {
    const { name, email, password, phone, membershipNumber, joinDate } = JSON.parse(req.body);

    // Log environment variables (without sensitive data)
    log('DATABASE_ID: ' + process.env.DATABASE_ID);
    log('MEMBERS_COLLECTION_ID: ' + process.env.MEMBERS_COLLECTION_ID);

    log('Creating user in Auth...');
    const user = await users.create(
      sdk.ID.unique(),
      email,
      phone,
      password,
      name
    );
    userId = user.$id;
    log('User created with ID: ' + userId);

    const memberData = {
      name,
      email,
      phone,
      membershipNumber,
      authUserId: user.$id,
      joinDate: joinDate ? new Date(joinDate).toISOString() : new Date().toISOString(),
      status: 'active'
    };

    log('Attempting to create document with data: ' + JSON.stringify(memberData));
    
    const documentId = sdk.ID.unique();
    log('Generated document ID: ' + documentId);
    
    const memberDoc = await databases.createDocument(
      process.env.DATABASE_ID,
      process.env.MEMBERS_COLLECTION_ID,
      documentId,
      memberData
    );
    
    log('Document created successfully!');
    log('Document ID from response: ' + memberDoc.$id);
    log('Full document: ' + JSON.stringify(memberDoc));

    // Verify the document was actually created by reading it back
    try {
      const verifyDoc = await databases.getDocument(
        process.env.DATABASE_ID,
        process.env.MEMBERS_COLLECTION_ID,
        memberDoc.$id
      );
      log('Document verified! ID: ' + verifyDoc.$id);
    } catch (verifyError) {
      error('Document verification failed: ' + verifyError.message);
    }

    return res.json({
      success: true,
      userId: user.$id,
      memberId: memberDoc.$id,
      member: memberDoc,
      message: 'Member created successfully'
    });

  } catch (err) {
    error('Error creating member: ' + err.message);
    error('Error stack: ' + err.stack);
    
    if (userId) {
      try {
        await users.delete(userId);
        log('Cleaned up orphaned user: ' + userId);
      } catch (deleteErr) {
        error('Failed to delete orphaned user: ' + deleteErr.message);
      }
    }

    return res.json({
      success: false,
      error: err.message
    }, 400);
  }
};
