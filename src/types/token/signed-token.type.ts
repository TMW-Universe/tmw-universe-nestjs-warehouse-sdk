export interface SignedToken {
  fileId: string;
  expiresAt: Date;
  salt: string;
}
