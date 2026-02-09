//src\lib\pagination.js
import { Query } from './appwrite';

export const listAllDocuments = async (
  databases,
  databaseId,
  collectionId,
  queries = [],
  options = {}
) => {
  const limit = options.limit || 100;
  let cursor = null;
  const all = [];

  while (true) {
    const pageQueries = [
      ...queries,
      Query.limit(limit),
      ...(cursor ? [Query.cursorAfter(cursor)] : [])
    ];

    const response = await databases.listDocuments(
      databaseId,
      collectionId,
      pageQueries
    );

    all.push(...response.documents);

    if (response.documents.length < limit) {
      break;
    }

    cursor = response.documents[response.documents.length - 1].$id;
  }

  return all;
};
