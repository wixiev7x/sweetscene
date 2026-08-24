"use client"

import { useState, useEffect } from "react"
import { createClient } from "@/lib/supabase/client"
import { signInWithEmail } from "@/lib/actions/auth"
import { useRouter } from "next/navigation"

const supabase = createClient()

type Step = "credentials" | "enroll" | "challenge"

const inputClass =
  "bg-surface-raised border border-line rounded-md px-3 py-2 text-sm text-foreground focus:border-brand focus:outline-none w-full"
const buttonClass =
  "bg-brand text-white rounded-md px-4 py-2 text-sm font-medium hover:bg-brand-dark transition-colors w-full disabled:opacity-50 disabled:cursor-not-allowed"

export default function LoginPage() {
  const router = useRouter()
  const [step, setStep] = useState<Step>("credentials")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [code, setCode] = useState("")
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)
  const [factorId, setFactorId] = useState("")
  const [challengeId, setChallengeId] = useState("")
  const [enrollment, setEnrollment] = useState<{
    qrCode: string
    secret: string
    factorId: string
  } | null>(null)

  async function handleCredentialsSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError("")
    setLoading(true)
    const res = await signInWithEmail(email, password)
    if (res.error) {
      setError(res.error)
      setLoading(false)
      return
    }
    if (res.needsMFA) {
      const { data } = await supabase.auth.mfa.listFactors()
      const verified = data?.all?.find(
        (f) => f.factor_type === "totp" && f.status === "verified",
      )
      if (verified) {
        const {
          data: challengeData,
          error: challengeError,
        } = await supabase.auth.mfa.challenge({ factorId: verified.id })
        if (challengeError) {
          setError(challengeError.message)
          setLoading(false)
          return
        }
        setFactorId(verified.id)
        setChallengeId(challengeData!.id)
        setCode("")
        setLoading(false)
        setStep("challenge")
      } else {
        setCode("")
        setLoading(false)
        setStep("enroll")
      }
      return
    }
    setLoading(false)
  }

  useEffect(() => {
    if (step !== "enroll") return
    let active = true
    async function enroll() {
      setLoading(true)
      const {
        data,
        error: enrollError,
      } = await supabase.auth.mfa.enroll({ factorType: "totp" })
      if (!active) return
      setLoading(false)
      if (enrollError) {
        setError(enrollError.message)
        return
      }
      setEnrollment({
        qrCode: data!.totp.qr_code,
        secret: data!.totp.secret,
        factorId: data!.id,
      })
    }
    enroll()
    return () => {
      active = false
    }
  }, [step])

  async function handleEnrollVerify(e: React.FormEvent) {
    e.preventDefault()
    if (!enrollment) return
    setError("")
    setLoading(true)
    const {
      data: challengeData,
      error: challengeError,
    } = await supabase.auth.mfa.challenge({ factorId: enrollment.factorId })
    if (challengeError) {
      setError(challengeError.message)
      setLoading(false)
      return
    }
    const { error: verifyError } = await supabase.auth.mfa.verify({
      factorId: enrollment.factorId,
      challengeId: challengeData!.id,
      code,
    })
    setLoading(false)
    if (verifyError) {
      setError(verifyError.message)
      return
    }
    router.push("/dashboard")
  }

  async function handleChallengeVerify(e: React.FormEvent) {
    e.preventDefault()
    setError("")
    setLoading(true)
    const { error: verifyError } = await supabase.auth.mfa.verify({
      factorId,
      challengeId,
      code,
    })
    setLoading(false)
    if (verifyError) {
      setError(verifyError.message)
      return
    }
    router.push("/dashboard")
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="bg-surface border border-line rounded-lg p-8 max-w-md w-full">
        <h1 className="text-brand font-bold text-xl">SweetScene Admin</h1>
        <p className="text-muted text-sm mt-1 mb-6">Restricted access</p>

        {step === "credentials" && (
          <form onSubmit={handleCredentialsSubmit} className="space-y-4">
            <div className="space-y-1">
              <label className="text-foreground-dim text-sm">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className={inputClass}
                autoComplete="email"
                required
              />
            </div>
            <div className="space-y-1">
              <label className="text-foreground-dim text-sm">Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className={inputClass}
                autoComplete="current-password"
                required
              />
            </div>
            {error && <p className="text-danger text-sm">{error}</p>}
            <button type="submit" disabled={loading} className={buttonClass}>
              {loading ? "Signing in..." : "Sign In"}
            </button>
          </form>
        )}

        {step === "enroll" && (
          <form onSubmit={handleEnrollVerify} className="space-y-4">
            <div className="space-y-2">
              <p className="text-foreground text-sm">
                Scan this QR code with your authenticator app.
              </p>
              {enrollment?.qrCode && (
                <img
                  src={enrollment.qrCode}
                  alt="TOTP QR code"
                  className="bg-white border border-line rounded-md p-2 mx-auto"
                />
              )}
              {enrollment?.secret && (
                <p className="text-muted text-sm break-all">
                  Secret: {enrollment.secret}
                </p>
              )}
            </div>
            <div className="space-y-1">
              <label className="text-foreground-dim text-sm">
                Verification code
              </label>
              <input
                type="text"
                inputMode="numeric"
                maxLength={6}
                value={code}
                onChange={(e) => setCode(e.target.value)}
                className={inputClass}
                placeholder="123456"
                required
              />
            </div>
            {error && <p className="text-danger text-sm">{error}</p>}
            <button type="submit" disabled={loading} className={buttonClass}>
              {loading ? "Verifying..." : "Verify"}
            </button>
          </form>
        )}

        {step === "challenge" && (
          <form onSubmit={handleChallengeVerify} className="space-y-4">
            <p className="text-foreground text-sm">
              Enter the 6-digit code from your authenticator app.
            </p>
            <div className="space-y-1">
              <label className="text-foreground-dim text-sm">
                Verification code
              </label>
              <input
                type="text"
                inputMode="numeric"
                maxLength={6}
                value={code}
                onChange={(e) => setCode(e.target.value)}
                className={inputClass}
                placeholder="123456"
                required
              />
            </div>
            {error && <p className="text-danger text-sm">{error}</p>}
            <button type="submit" disabled={loading} className={buttonClass}>
              {loading ? "Verifying..." : "Verify"}
            </button>
          </form>
        )}
      </div>
    </div>
  )
}
