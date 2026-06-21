// Client-side Local Storage Mock Configuration (No Real Firebase Cloud Connections)

export const db = {} as any;
export const auth = {
  currentUser: null
} as any;

export const googleProvider = {
  setCustomParameters: () => {}
} as any;

export const gmailProvider = {
  addScope: () => {},
  setCustomParameters: () => {}
} as any;

export function getCachedAccessToken(): string | null {
  const token = localStorage.getItem('gmail_access_token');
  const savedTimeStr = localStorage.getItem('gmail_access_token_time');
  if (!token || !savedTimeStr) return null;

  const savedTime = parseInt(savedTimeStr, 10);
  const currentTime = Date.now();
  if (currentTime - savedTime > 3000000) {
    localStorage.removeItem('gmail_access_token');
    localStorage.removeItem('gmail_access_token_time');
    return null;
  }
  return token;
}

export function setCachedAccessToken(token: string | null) {
  if (token) {
    localStorage.setItem('gmail_access_token', token);
    localStorage.setItem('gmail_access_token_time', Date.now().toString());
  } else {
    localStorage.removeItem('gmail_access_token');
    localStorage.removeItem('gmail_access_token_time');
  }
}

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  console.error("Local Storage DB Operation Error: ", error, operationType, path);
}

export async function testConnection() {
  return true;
}
