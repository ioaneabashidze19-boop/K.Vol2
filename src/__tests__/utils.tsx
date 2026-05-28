import React, { ReactElement } from "react";
import { render, RenderOptions } from "@testing-library/react";
jest.mock("next-intl", () => ({
  useTranslations: () => (key: string) => key,
  useLocale: () => "en",
  NextIntlClientProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

const AllProviders = ({ children }: { children: React.ReactNode }) => {
  return <>{children}</>;
};

const customRender = (
  ui: ReactElement,
  options?: Omit<RenderOptions, "wrapper">
) => render(ui, { wrapper: AllProviders, ...options });

// Re-export everything from testing-library
export * from "@testing-library/react";
export { default as userEvent } from "@testing-library/user-event";
export { customRender as render };

// 1. Mock Supabase Client
export const mockSupabaseData: any = {
  from: jest.fn().mockReturnThis(),
  select: jest.fn().mockReturnThis(),
  insert: jest.fn().mockImplementation(() => Promise.resolve({ data: null, error: null })),
  update: jest.fn().mockImplementation(() => Promise.resolve({ data: null, error: null })),
  delete: jest.fn().mockImplementation(() => Promise.resolve({ data: null, error: null })),
  eq: jest.fn().mockReturnThis(),
  neq: jest.fn().mockReturnThis(),
  limit: jest.fn().mockImplementation(() => Promise.resolve({ data: [], error: null })),
  order: jest.fn().mockReturnThis(),
  single: jest.fn().mockImplementation(() => Promise.resolve({ data: null, error: null })),
};

jest.mock("@/lib/supabaseClient", () => ({
  supabase: mockSupabaseData,
}));
jest.mock("../lib/supabaseClient", () => ({
  supabase: mockSupabaseData,
}));

// 2. Mock Clerk auth and components
jest.mock("@clerk/nextjs", () => ({
  useUser: () => ({
    isLoaded: true,
    isSignedIn: true,
    user: {
      id: "user_mock_clerk_id_123",
      fullName: "Test User",
      emailAddresses: [{ emailAddress: "test@kavshare.com" }],
    },
  }),
  useAuth: () => ({
    isLoaded: true,
    isSignedIn: true,
    userId: "user_mock_clerk_id_123",
  }),
  UserButton: () => <div data-testid="clerk-user-button" />,
  SignInButton: () => <button data-testid="clerk-signin-button">Sign In</button>,
}));

test("utils dummy test to satisfy jest runner", () => {
  expect(true).toBe(true);
});
