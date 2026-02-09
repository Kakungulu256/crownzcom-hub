import { Query } from 'appwrite';

export const fetchMemberRecord = async ({ databases, DATABASE_ID, COLLECTIONS, user }) => {
  if (!user) return null;

  // Prefer stable auth user ID mapping
  const byAuth = await databases.listDocuments(
    DATABASE_ID,
    COLLECTIONS.MEMBERS,
    [Query.equal('authUserId', user.$id)]
  );

  if (byAuth.documents.length > 0) {
    return byAuth.documents[0];
  }

  // Fallback for legacy data: match by email and backfill authUserId
  if (user.email) {
    const byEmail = await databases.listDocuments(
      DATABASE_ID,
      COLLECTIONS.MEMBERS,
      [Query.equal('email', user.email)]
    );

    if (byEmail.documents.length > 0) {
      const member = byEmail.documents[0];
      if (!member.authUserId || member.authUserId !== user.$id) {
        try {
          await databases.updateDocument(
            DATABASE_ID,
            COLLECTIONS.MEMBERS,
            member.$id,
            { authUserId: user.$id }
          );
        } catch {
          // Non-fatal: permissions may prevent backfill
        }
      }
      return member;
    }
  }

  return null;
};
