"use client";

import React, { useState, useEffect } from "react";
import { LoginForm } from "./LoginForm";
import { TicTacToeGame } from "../game/TicTacToeGame";
import { Gamepad2 } from "lucide-react";

export function LoginDisguise({ nextPath }: { readonly nextPath: string }) {
  const [showLogin, setShowLogin] = useState(false);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Toggle if they hit Enter key
      if (e.key === "Enter") {
        setShowLogin(true);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  if (!showLogin) {
    return <TicTacToeGame onUnlock={() => setShowLogin(true)} />;
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center bg-gradient-to-br from-background via-muted/30 to-primary/10 px-4 py-12 overflow-hidden animate-fade-in">
      {/* Dynamic background glow spheres */}
      <div className="absolute -left-12 -top-12 size-72 rounded-full bg-primary/5 blur-3xl" />
      <div className="absolute -right-12 -bottom-12 size-72 rounded-full bg-primary/10 blur-3xl" />

      <div className="relative w-full max-w-sm space-y-8 z-10">
        <div className="space-y-3 text-center">
          <div className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-gradient-to-tr from-primary to-indigo-600 text-xl font-bold text-primary-foreground shadow-lg shadow-primary/25 select-none relative group">
            LSC
            
            {/* Extremely subtle back to arcade hover trigger */}
            <button
              onClick={() => setShowLogin(false)}
              className="absolute -top-1 -right-1 size-4 rounded-full bg-zinc-800/10 opacity-0 group-hover:opacity-40 hover:!opacity-100 flex items-center justify-center text-[8px] text-zinc-400 hover:text-white transition-opacity duration-300 cursor-pointer"
              title="Arcade Mode"
            >
              <Gamepad2 className="size-2.5" />
            </button>
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight text-foreground select-none">
            LSC Alloys Quotation ERP
          </h1>
          <p className="text-sm text-muted-foreground select-none">
            Sign in to continue to your dashboard.
          </p>
        </div>

        <LoginForm nextPath={nextPath} />
      </div>
    </div>
  );
}
