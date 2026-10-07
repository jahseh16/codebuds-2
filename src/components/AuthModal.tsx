import { useState } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { Link } from 'react-router-dom'
import { LogIn, UserPlus, X } from 'lucide-react'

export function AuthModal() {
  const { authModalOpen, closeAuthModal } = useAuth()

  if (!authModalOpen) return null

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 backdrop-blur-sm animate-fade-in p-4"
      onClick={(e) => { if (e.target === e.currentTarget) closeAuthModal() }}
    >
      <div
        className="w-full max-w-sm rounded-2xl bg-bg-card p-8 shadow-[0_0_60px_rgba(124,58,237,0.1)] animate-scale-in"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close button */}
        <div className="flex justify-end">
          <button
            onClick={closeAuthModal}
            className="rounded-lg p-1.5 text-text-muted transition-colors hover:bg-bg-card-hover hover:text-text-primary"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Icon */}
        <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-accent-muted">
          <LogIn className="h-7 w-7 text-accent" />
        </div>

        {/* Text */}
        <h2 className="text-center text-lg font-bold text-text-primary">
          Join the Community
        </h2>
        <p className="mt-2 text-center text-sm text-text-secondary leading-relaxed">
          Sign in or create an account to interact with the CodeBuds community — like posts, comment, add buddies, and more.
        </p>

        {/* Buttons */}
        <div className="mt-6 space-y-3">
          <Link
            to="/login"
            onClick={closeAuthModal}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-accent py-3 text-sm font-semibold text-white transition-all hover:bg-accent-hover hover:shadow-[0_0_24px_rgba(124,58,237,0.35)]"
          >
            <LogIn className="h-4 w-4" />
            Sign In
          </Link>
          <Link
            to="/register"
            onClick={closeAuthModal}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-bg-card-hover py-3 text-sm font-semibold text-text-primary transition-all hover:bg-bg-primary"
          >
            <UserPlus className="h-4 w-4" />
            Sign Up
          </Link>
        </div>

        <button
          onClick={closeAuthModal}
          className="mt-4 w-full text-center text-xs text-text-muted transition-colors hover:text-text-secondary"
        >
          Maybe later
        </button>
      </div>
    </div>
  )
}
