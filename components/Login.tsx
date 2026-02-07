import React, { useState } from "react"
import { apiLogin } from "../services/api"

interface LoginProps {
  onSuccess: () => void
}

const Login: React.FC<LoginProps> = ({ onSuccess }) => {
  const [username, setUsername] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    setLoading(true)
    try {
      await apiLogin(username.trim(), password.trim())
      onSuccess()
    } catch (err) {
      setError(err instanceof Error ? err.message : "登录失败")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#0f0a0a] relative overflow-hidden">
      <div
        className="absolute inset-0 bg-cover bg-center bg-no-repeat opacity-30"
        style={{
          backgroundImage:
            "url('https://images.unsplash.com/photo-1578662996442-48f60103fc96?w=1920&q=80')",
        }}
      />
      <div className="absolute inset-0 bg-gradient-to-b from-red-950/40 via-transparent to-red-950/40" />
      <div className="relative z-10 w-full max-w-md px-6">
        <div className="bg-black/60 backdrop-blur-xl border border-red-500/30 rounded-3xl p-8 shadow-2xl">
          <div className="text-center mb-8">
            <div className="w-16 h-16 rounded-full bg-gradient-to-tr from-red-500 to-red-700 flex items-center justify-center text-2xl font-bold text-white mx-auto mb-4 shadow-lg shadow-red-500/30">
              L
            </div>
            <h1 className="text-2xl font-orbitron font-bold tracking-widest text-transparent bg-clip-text bg-gradient-to-r from-red-500 via-white to-red-600">
              Annual Gala 抽奖
            </h1>
            <p className="text-white/50 text-sm mt-2 uppercase tracking-widest">
              请登录后进入抽奖
            </p>
          </div>
          <form onSubmit={handleSubmit} className="space-y-5">
            {error && (
              <div className="text-red-400 text-sm bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2">
                {error}
              </div>
            )}
            <div>
              <label className="block text-[10px] text-white/50 uppercase font-bold mb-2">
                用户名
              </label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="用户名"
                className="w-full bg-black/50 border border-white/20 rounded-xl px-4 py-3 text-white placeholder-white/30 focus:border-red-500 focus:outline-none transition-colors"
                autoComplete="username"
                required
              />
            </div>
            <div>
              <label className="block text-[10px] text-white/50 uppercase font-bold mb-2">
                密码
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="密码"
                className="w-full bg-black/50 border border-white/20 rounded-xl px-4 py-3 text-white placeholder-white/30 focus:border-red-500 focus:outline-none transition-colors"
                autoComplete="current-password"
                required
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full py-4 bg-red-500 hover:bg-red-600 disabled:opacity-50 text-white font-bold rounded-xl uppercase tracking-widest transition-all shadow-lg shadow-red-500/30 hover:scale-[1.02] active:scale-[0.98]"
            >
              {loading ? "登录中…" : "登录"}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}

export default Login
