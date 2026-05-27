import { SignIn } from "@clerk/nextjs";

export default function SignInPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-slate-950 px-4 py-12 relative overflow-hidden">
      {/* Decorative background glows */}
      <div className="absolute top-1/4 left-1/4 -translate-x-1/2 -translate-y-1/2 w-80 h-80 rounded-full bg-violet-600/10 blur-3xl" />
      <div className="absolute bottom-1/4 right-1/4 translate-x-1/2 translate-y-1/2 w-80 h-80 rounded-full bg-blue-600/10 blur-3xl" />

      <div className="z-10 w-full max-w-md bg-slate-900/60 border border-slate-800/80 rounded-2xl p-6 backdrop-blur-xl shadow-2xl flex flex-col items-center justify-center">
        <div className="mb-6 text-center">
          <h1 className="text-2xl font-bold bg-gradient-to-r from-violet-400 to-blue-400 bg-clip-text text-transparent">
            Welcome Back to KavShare
          </h1>
          <p className="text-sm text-slate-400 mt-2">
            Sign in to manage and share your secure links
          </p>
        </div>
        <SignIn
          appearance={{
            elements: {
              card: "bg-transparent shadow-none border-none",
              headerTitle: "hidden",
              headerSubtitle: "hidden",
              socialButtonsBlockButton:
                "bg-slate-800/50 hover:bg-slate-800 border border-slate-700/60 text-slate-200",
              formButtonPrimary:
                "bg-gradient-to-r from-violet-600 to-blue-600 hover:from-violet-500 hover:to-blue-500 border-none shadow-lg text-white font-medium",
              formFieldLabel: "text-slate-300",
              formFieldInput:
                "bg-slate-950/80 border border-slate-800 focus:border-violet-500 text-slate-200",
              footerActionLink: "text-violet-400 hover:text-violet-300",
              identityPreviewText: "text-slate-300",
              identityPreviewEditButtonIcon: "text-slate-400",
            },
          }}
          routing="path"
          path="/sign-in"
        />
      </div>
    </div>
  );
}
