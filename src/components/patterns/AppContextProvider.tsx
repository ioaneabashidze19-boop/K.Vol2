"use client";

import { createContext, useContext, useState } from "react";
import type { ReactNode } from "react";
import { AnimatePresence, motion } from "framer-motion";

export type ToastType = "success" | "error" | "info";

interface Toast {
  id: string;
  message: string;
  type: ToastType;
}

interface AppContextProps {
  showToast: (message: string, type?: ToastType) => void;
}

const AppContext = createContext<AppContextProps | undefined>(undefined);

export function AppContextProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const showToast = (message: string, type: ToastType = "info") => {
    const id = Math.random().toString(36).substring(2, 9);
    setToasts((prev) => [...prev, { id, message, type }]);

    // Dismiss after 4 seconds
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4000);
  };

  const typeColorMap = {
    success: "bg-emerald-950 border-emerald-800 text-emerald-400",
    error: "bg-red-950 border-red-800 text-red-400",
    info: "bg-slate-900 border-slate-800 text-text-primary",
  };

  return (
    <AppContext.Provider value={{ showToast }}>
      {children}

      {/* Render active toasts */}
      <div
        className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 max-w-sm w-full"
        role="region"
        aria-label="Notifications"
      >
        <AnimatePresence>
          {toasts.map((toast) => (
            <motion.div
              key={toast.id}
              initial={{ opacity: 0, y: 20, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -10, scale: 0.95 }}
              className={`flex items-center justify-between border px-4 py-3 rounded-xl shadow-xl text-sm font-medium ${
                typeColorMap[toast.type]
              }`}
            >
              <span>{toast.message}</span>
              <button
                type="button"
                onClick={() => setToasts((prev) => prev.filter((t) => t.id !== toast.id))}
                className="text-text-muted hover:text-text-primary ml-4 focus:outline-none"
                aria-label="Dismiss toast notification"
              >
                &times;
              </button>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </AppContext.Provider>
  );
}

export function useApp() {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error("useApp must be used within an AppContextProvider");
  }
  return context;
}
