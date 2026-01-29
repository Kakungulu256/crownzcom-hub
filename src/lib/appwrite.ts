import { Client, Account, Databases } from 'appwrite';

export const client = new Client();

client
  .setEndpoint(import.meta.env.VITE_APPWRITE_ENDPOINT || 'https://cloud.appwrite.io/v1')
  .setProject(import.meta.env.VITE_APPWRITE_PROJECT_ID || '');

export const account = new Account(client);
export const databases = new Databases(client);

export const DATABASE_ID = import.meta.env.VITE_APPWRITE_DATABASE_ID || '';
export const ALLOWED_EMAILS_COLLECTION_ID = import.meta.env.VITE_APPWRITE_ALLOWED_EMAILS_COLLECTION_ID || '';