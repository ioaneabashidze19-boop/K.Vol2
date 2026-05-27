"use client";

import { useState } from "react";

import { SignUp } from "@clerk/nextjs";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowLeft, DownloadCloud, UploadCloud } from "lucide-react";

export default function SignUpPage() {
  const [role, setRole] = useState<"provider" | "seeker" | null>(null);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-slate-950 px-4 py-12 relative overflow-hidden">
      {/* Decorative background glows */}
      <div className="absolute top-1/4 left-1/4 -translate-x-1/2 -translate-y-1/2 w-80 h-80 rounded-full bg-violet-600/10 blur-3xl" />
      <div className="absolute bottom-1/4 right-1/4 translate-x-1/2 translate-y-1/2 w-80 h-80 rounded-full bg-blue-600/10 blur-3xl" />

      <div className="z-10 w-full max-w-lg bg-slate-900/60 border border-slate-800/80 rounded-2xl p-6 backdrop-blur-xl shadow-2xl flex flex-col items-center">
        <AnimatePresence mode="wait">
          {!role ? (
            <motion.div
              key="role-selection"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              className="w-full flex flex-col items-center"
            >
              <h1 className="text-2xl font-bold bg-gradient-to-r from-violet-400 to-blue-400 bg-clip-text text-transparent text-center">
                Create Your Account
              </h1>
              <p className="text-sm text-slate-400 mt-2 text-center mb-8">
                Choose your primary role to customize your sharing workspace.
              </p>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 w-full">
                {/* Provider Card */}
                <button
                  onClick={() => setRole("provider")}
                  className="flex flex-col items-center text-center p-6 bg-slate-950/50 hover:bg-slate-800/50 border border-slate-800 hover:border-violet-500/80 rounded-xl transition duration-300 group cursor-pointer"
                >
                  <div className="p-3 bg-violet-500/10 rounded-full text-violet-400 group-hover:bg-violet-500/20 transition mb-4">
                    <UploadCloud className="w-8 h-8" />
                  </div>
                  <h3 className="text-lg font-semibold text-slate-100">File Provider</h3>
                  <p className="text-xs text-slate-400 mt-2">
                    Upload, encrypt, set custom expiration limits, and manage link tracking
                    analytics.
                  </p>
                </button>

                {/* Seeker Card */}
                <button
                  onClick={() => setRole("seeker")}
                  className="flex flex-col items-center text-center p-6 bg-slate-950/50 hover:bg-slate-800/50 border border-slate-800 hover:border-blue-500/80 rounded-xl transition duration-300 group cursor-pointer"
                >
                  <div className="p-3 bg-blue-500/10 rounded-full text-blue-400 group-hover:bg-blue-500/20 transition mb-4">
                    <DownloadCloud className="w-8 h-8" />
                  </div>
                  <h3 className="text-lg font-semibold text-slate-100">File Seeker</h3>
                  <p className="text-xs text-slate-400 mt-2">
                    Access shared vaults, verify cryptographic key layers, and download secure
                    media.
                  </p>
                </button>
              </div>
            </motion.div>
          ) : (
            <motion.div
              key="signup-widget"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              className="w-full flex flex-col items-center"
            >
              <button
                onClick={() => setRole(null)}
                className="self-start flex items-center gap-2 text-xs text-slate-400 hover:text-slate-200 transition mb-6"
              >
                <ArrowLeft className="w-4 h-4" /> Back to Role Selection
              </button>

              <div className="text-center mb-6">
                <h2 className="text-2xl font-bold bg-gradient-to-r from-violet-400 to-blue-400 bg-clip-text text-transparent">
                  Register as {role === "provider" ? "Provider" : "Seeker"}
                </h2>
                <p className="text-xs text-slate-400 mt-1">
                  Almost there! Create your profile credentials.
                </p>
              </div>

              <SignUp
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
                path="/sign-up"
                unsafeMetadata={{
                  userRole: role,
                }}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
