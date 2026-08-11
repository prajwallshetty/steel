"use client";

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { RotateCcw, Cpu, Users, Volume2, VolumeX, MousePointer } from "lucide-react";

interface TicTacToeGameProps {
  readonly onUnlock?: () => void;
}

type Player = "X" | "O";
type Board = (Player | null)[];
type GameMode = "ai" | "pvp";

const WINNING_COMBOS = [
  [0, 1, 2],
  [3, 4, 5],
  [6, 7, 8], // Rows
  [0, 3, 6],
  [1, 4, 7],
  [2, 5, 8], // Columns
  [0, 4, 8],
  [2, 4, 6], // Diagonals
];

function checkWinner(board: Board): { winner: Player | "draw" | null; combo: number[] | null } {
  for (const combo of WINNING_COMBOS) {
    const [a, b, c] = combo;
    if (board[a] && board[a] === board[b] && board[a] === board[c]) {
      return { winner: board[a], combo };
    }
  }
  if (board.every((cell) => cell !== null)) {
    return { winner: "draw", combo: null };
  }
  return { winner: null, combo: null };
}

// Minimax algorithm for AI
function minimax(
  board: Board,
  depth: number,
  isMaximizing: boolean
): { score: number; index?: number } {
  const result = checkWinner(board);
  if (result.winner === "O") return { score: 10 - depth };
  if (result.winner === "X") return { score: depth - 10 };
  if (result.winner === "draw") return { score: 0 };

  const emptyIndices = board
    .map((val, idx) => (val === null ? idx : null))
    .filter((v): v is number => v !== null);

  if (isMaximizing) {
    let bestScore = -Infinity;
    let bestMove = emptyIndices[0];
    for (const idx of emptyIndices) {
      board[idx] = "O";
      const res = minimax(board, depth + 1, false);
      board[idx] = null;
      if (res.score > bestScore) {
        bestScore = res.score;
        bestMove = idx;
      }
    }
    return { score: bestScore, index: bestMove };
  } else {
    let bestScore = Infinity;
    let bestMove = emptyIndices[0];
    for (const idx of emptyIndices) {
      board[idx] = "X";
      const res = minimax(board, depth + 1, true);
      board[idx] = null;
      if (res.score < bestScore) {
        bestScore = res.score;
        bestMove = idx;
      }
    }
    return { score: bestScore, index: bestMove };
  }
}

// Web Audio API Synth for retro sound effects
function playSound(type: "move" | "win" | "draw", soundEnabled: boolean) {
  if (!soundEnabled || typeof window === "undefined") return;
  const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
  if (!AudioCtx) return;

  try {
    const ctx = new AudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);

    const now = ctx.currentTime;

    if (type === "move") {
      osc.type = "sine";
      osc.frequency.setValueAtTime(440, now);
      osc.frequency.exponentialRampToValueAtTime(880, now + 0.05);
      gain.gain.setValueAtTime(0.1, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.08);
      osc.start(now);
      osc.stop(now + 0.08);
    } else if (type === "win") {
      osc.type = "triangle";
      osc.frequency.setValueAtTime(523.25, now); // C5
      osc.frequency.setValueAtTime(659.25, now + 0.1); // E5
      osc.frequency.setValueAtTime(783.99, now + 0.2); // G5
      gain.gain.setValueAtTime(0.15, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.35);
      osc.start(now);
      osc.stop(now + 0.35);
    } else if (type === "draw") {
      osc.type = "sawtooth";
      osc.frequency.setValueAtTime(300, now);
      osc.frequency.linearRampToValueAtTime(200, now + 0.2);
      gain.gain.setValueAtTime(0.1, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.2);
      osc.start(now);
      osc.stop(now + 0.2);
    }
  } catch {
    // Ignore audio context autoplay restriction
  }
}

export function TicTacToeGame({ onUnlock }: TicTacToeGameProps) {
  const [board, setBoard] = useState<Board>(Array(9).fill(null));
  const [turn, setTurn] = useState<Player>("X");
  const [mode, setMode] = useState<GameMode>("ai");
  const [winnerInfo, setWinnerInfo] = useState<{ winner: Player | "draw" | null; combo: number[] | null }>({
    winner: null,
    combo: null,
  });
  const [scores, setScores] = useState({ x: 0, o: 0, ties: 0 });
  const [soundEnabled, setSoundEnabled] = useState<boolean>(true);
  const [isAiThinking, setIsAiThinking] = useState<boolean>(false);

  // Handle cell click
  const handleClick = useCallback(
    (index: number) => {
      if (board[index] || winnerInfo.winner || isAiThinking) return;

      const newBoard = [...board];
      newBoard[index] = turn;
      setBoard(newBoard);
      playSound("move", soundEnabled);

      const result = checkWinner(newBoard);
      if (result.winner) {
        setWinnerInfo(result);
        if (result.winner === "X") setScores((prev) => ({ ...prev, x: prev.x + 1 }));
        else if (result.winner === "O") setScores((prev) => ({ ...prev, o: prev.o + 1 }));
        else setScores((prev) => ({ ...prev, ties: prev.ties + 1 }));
        playSound(result.winner === "draw" ? "draw" : "win", soundEnabled);
      } else {
        setTurn((prev) => (prev === "X" ? "O" : "X"));
      }
    },
    [board, winnerInfo.winner, isAiThinking, turn, soundEnabled]
  );

  // AI move triggering
  useEffect(() => {
    if (mode === "ai" && turn === "O" && !winnerInfo.winner) {
      setIsAiThinking(true);
      const timer = setTimeout(() => {
        const bestMove = minimax(board, 0, true).index;
        if (bestMove !== undefined && bestMove !== null) {
          const newBoard = [...board];
          newBoard[bestMove] = "O";
          setBoard(newBoard);
          playSound("move", soundEnabled);

          const result = checkWinner(newBoard);
          if (result.winner) {
            setWinnerInfo(result);
            if (result.winner === "O") setScores((prev) => ({ ...prev, o: prev.o + 1 }));
            else if (result.winner === "X") setScores((prev) => ({ ...prev, x: prev.x + 1 }));
            else setScores((prev) => ({ ...prev, ties: prev.ties + 1 }));
            playSound(result.winner === "draw" ? "draw" : "win", soundEnabled);
          } else {
            setTurn("X");
          }
        }
        setIsAiThinking(false);
      }, 400);

      return () => clearTimeout(timer);
    }
  }, [board, turn, mode, winnerInfo.winner, soundEnabled]);

  const resetGame = () => {
    setBoard(Array(9).fill(null));
    setTurn("X");
    setWinnerInfo({ winner: null, combo: null });
    setIsAiThinking(false);
  };

  const switchMode = (newMode: GameMode) => {
    setMode(newMode);
    setBoard(Array(9).fill(null));
    setTurn("X");
    setWinnerInfo({ winner: null, combo: null });
    setScores({ x: 0, o: 0, ties: 0 });
    setIsAiThinking(false);
  };

  return (
    <div className="relative flex flex-col items-center justify-center min-h-screen w-full bg-zinc-950 text-zinc-100 px-4 py-8 select-none">
      
      {/* 
        VERY HIDDEN SECRET ENTRY POINT TO ACCESS LOGIN PAGE
        Blended subtly into the bottom-right corner as a low-opacity element.
      */}
      <div className="fixed bottom-3 right-3 z-50">
        {onUnlock ? (
          <button
            onClick={onUnlock}
            aria-label="Discreet login entry point"
            className="inline-block text-zinc-800 dark:text-zinc-650 opacity-15 hover:opacity-100 transition-opacity duration-300 cursor-pointer p-1.5 select-none hover:scale-105 active:scale-95"
          >
            <MousePointer className="size-3.5 rotate-[15deg]" />
          </button>
        ) : (
          <Link
            href="/login"
            aria-label="Discreet login entry point"
            tabIndex={-1}
            className="inline-block opacity-50 hover:opacity-100 transition-opacity duration-300 cursor-pointer p-1 text-sm select-none"
          >
            🗝️
          </Link>
        )}
      </div>

      {/* Casual Arcade Header */}
      <div className="w-full max-w-sm text-center space-y-4 mb-6">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-zinc-900 border border-zinc-800 text-zinc-400 text-xs font-mono tracking-wider">
          <span className="inline-block size-2 rounded-full bg-indigo-500 animate-pulse" />
          Casual Arcade • Tic Tac Toe
        </div>

        <h1 className="text-3xl font-extrabold tracking-widest text-zinc-100 font-mono">
          TIC TAC TOE
        </h1>

        {/* Mode Selector */}
        <div className="flex justify-center gap-2 bg-zinc-900/80 p-1 rounded-xl border border-zinc-800/80 max-w-xs mx-auto">
          <button
            onClick={() => switchMode("ai")}
            className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-lg text-xs font-semibold font-mono transition-all ${
              mode === "ai"
                ? "bg-indigo-600 text-white shadow-sm"
                : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50"
            }`}
          >
            <Cpu className="size-3.5" /> Vs AI
          </button>
          <button
            onClick={() => switchMode("pvp")}
            className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-lg text-xs font-semibold font-mono transition-all ${
              mode === "pvp"
                ? "bg-indigo-600 text-white shadow-sm"
                : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50"
            }`}
          >
            <Users className="size-3.5" /> 2 Players
          </button>
        </div>
      </div>

      {/* Main Game Container */}
      <div className="w-full max-w-sm space-y-4">
        {/* Score Board */}
        <div className="grid grid-cols-3 gap-2 text-center font-mono">
          <div className="bg-zinc-900/90 border border-zinc-800/80 rounded-xl p-2.5">
            <span className="block text-[11px] text-indigo-400 font-bold uppercase tracking-wider">
              {mode === "ai" ? "Player (X)" : "Player X"}
            </span>
            <span className="text-xl font-extrabold text-indigo-300">{scores.x}</span>
          </div>

          <div className="bg-zinc-900/90 border border-zinc-800/80 rounded-xl p-2.5">
            <span className="block text-[11px] text-zinc-400 font-bold uppercase tracking-wider">
              Ties
            </span>
            <span className="text-xl font-extrabold text-zinc-300">{scores.ties}</span>
          </div>

          <div className="bg-zinc-900/90 border border-zinc-800/80 rounded-xl p-2.5">
            <span className="block text-[11px] text-rose-400 font-bold uppercase tracking-wider">
              {mode === "ai" ? "AI (O)" : "Player O"}
            </span>
            <span className="text-xl font-extrabold text-rose-300">{scores.o}</span>
          </div>
        </div>

        {/* Status Indicator */}
        <div className="flex justify-between items-center px-2 font-mono text-xs text-zinc-400">
          <div>
            {winnerInfo.winner ? (
              <span className="font-bold text-emerald-400">
                {winnerInfo.winner === "draw" ? "ITS A DRAW!" : `${winnerInfo.winner} WINS! 🎉`}
              </span>
            ) : (
              <span>
                TURN:{" "}
                <strong className={turn === "X" ? "text-indigo-400" : "text-rose-400"}>
                  {turn === "O" && mode === "ai" ? "AI IS THINKING..." : `PLAYER ${turn}`}
                </strong>
              </span>
            )}
          </div>

          <button
            onClick={() => setSoundEnabled(!soundEnabled)}
            className="flex items-center gap-1 hover:text-zinc-200 transition-colors"
          >
            {soundEnabled ? <Volume2 className="size-3.5" /> : <VolumeX className="size-3.5" />}
            {soundEnabled ? "Sound" : "Muted"}
          </button>
        </div>

        {/* Grid Board */}
        <div className="relative aspect-square grid grid-cols-3 gap-3 p-3 bg-zinc-900/60 border border-zinc-800/90 rounded-2xl shadow-2xl backdrop-blur-md">
          {board.map((cell, idx) => {
            const isWinningCell = winnerInfo.combo?.includes(idx);

            return (
              <button
                key={idx}
                onClick={() => handleClick(idx)}
                disabled={cell !== null || winnerInfo.winner !== null || isAiThinking}
                className={`flex items-center justify-center rounded-xl font-mono text-4xl sm:text-5xl font-black transition-all duration-200 shadow-inner ${
                  cell === null
                    ? "bg-zinc-950/70 hover:bg-zinc-800/60 border border-zinc-800/40 cursor-pointer"
                    : isWinningCell
                    ? cell === "X"
                      ? "bg-indigo-600/30 text-indigo-300 border-2 border-indigo-500 scale-105"
                      : "bg-rose-600/30 text-rose-300 border-2 border-rose-500 scale-105"
                    : cell === "X"
                    ? "bg-zinc-950 text-indigo-400 border border-zinc-800/60"
                    : "bg-zinc-950 text-rose-400 border border-zinc-800/60"
                }`}
              >
                {cell}
              </button>
            );
          })}
        </div>

        {/* Action Controls */}
        <div className="flex justify-center">
          <button
            onClick={resetGame}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-zinc-200 font-mono text-xs font-semibold border border-zinc-800 transition-all shadow-md active:scale-95"
          >
            <RotateCcw className="size-3.5" /> RESTART GAME
          </button>
        </div>
      </div>

      {/* Footer metadata */}
      <footer className="mt-12 text-center text-[11px] text-zinc-600 font-mono">
        © 2026 Retro Arcade Mini-Games • Offline Mode
      </footer>
    </div>
  );
}
