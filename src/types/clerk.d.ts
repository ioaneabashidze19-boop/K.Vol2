import { UserRole } from "@/lib/types/roles";

declare global {
  interface CustomJwtSessionClaims {
    metadata: {
      userRole?: UserRole;
      companyId?: string;
    };
  }
}
export {};
