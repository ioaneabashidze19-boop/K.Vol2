export type UserRole = "seeker" | "provider" | "admin";

export interface CustomSessionClaims {
  metadata?: {
    userRole?: UserRole;
    companyId?: string;
  };
}
