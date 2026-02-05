import React, { useState, useEffect, useCallback, useMemo, useRef } from "react"
import { AppState, Participant, Prize, Winner } from "./types"
import LuckyDraw from "./components/LuckyDraw"
import WinnerList from "./components/WinnerList"
import SetupModal from "./components/SetupModal"
import {
  getBlobURL,
  getMarker,
  isIndexedDBMarker,
  type AudioKey,
} from "./services/audioStorage"

const STORAGE_KEY = "ANNUAL_DRAW_DATA_V5"
const DEFAULT_BACKGROUND_URL =
  "https://images.unsplash.com/photo-1578662996442-48f60103fc96?w=1920&q=80"
// 默认抽奖进行时音效（项目内 Ongoing.mp3，可被用户在设置中上传覆盖）
const DEFAULT_DRAW_MUSIC_URL = "/Ongoing.mp3"
// 默认抽奖完成（揭晓）提示音（项目内 result.mp3，可被用户在设置中上传覆盖）
const DEFAULT_WINNER_SOUND_URL = "/result.mp3"

/** 是否为可播放的音频地址（http/https/blob/data），排除 IndexedDB 标记 */
function isPlayableAudioSrc(s: string | undefined): boolean {
  return (
    !!s &&
    (s.startsWith("http") || s.startsWith("blob:") || s.startsWith("data:"))
  )
}

const INITIAL_PRIZES: Prize[] = [
  {
    id: "p1",
    name: "一等奖 (iPhone 16 Pro Max)",
    rank: 1,
    count: 1,
    remaining: 1,
    image: "https://picsum.photos/seed/iphone/400/400",
  },
  {
    id: "p2",
    name: "二等奖 (iPad Air)",
    rank: 2,
    count: 3,
    remaining: 3,
    image: "https://picsum.photos/seed/ipad/400/400",
  },
  {
    id: "p3",
    name: "三等奖 (AirPods Pro)",
    rank: 3,
    count: 5,
    remaining: 5,
    image: "https://picsum.photos/seed/airpods/400/400",
  },
  {
    id: "p4",
    name: "参与奖 (幸运礼盒)",
    rank: 4,
    count: 10,
    remaining: 10,
    image: "https://picsum.photos/seed/box/400/400",
  },
]

const INITIAL_PARTICIPANTS: Participant[] = Array.from(
  { length: 60 },
  (_, i) => ({
    id: `user-${i}`,
    name: `员工 ${i + 1}`,
    avatar: `https://picsum.photos/seed/user${i}/100/100`,
  })
)

const App: React.FC = () => {
  const [state, setState] = useState<AppState>(() => {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved) {
      try {
        const parsed = JSON.parse(saved)
        if (!parsed.allParticipants)
          parsed.allParticipants = [...parsed.participants]
        if (!parsed.extraPrizes) parsed.extraPrizes = []
        if (parsed.isExtraMode === undefined) parsed.isExtraMode = false
        if (parsed.extraModeEnabled === undefined)
          parsed.extraModeEnabled = parsed.isExtraMode
        return parsed
      } catch (e) {
        console.error("Failed to parse stored state", e)
      }
    }
    return {
      participants: INITIAL_PARTICIPANTS,
      allParticipants: INITIAL_PARTICIPANTS,
      prizes: INITIAL_PRIZES,
      extraPrizes: [],
      winners: [],
      currentPrizeId: INITIAL_PRIZES[0].id,
      isExtraMode: false,
      extraModeEnabled: false,
      backgroundImage: undefined,
      backgroundMusic: undefined,
      drawMusic: undefined,
      winnerSound: undefined,
    }
  })

  const [showSetup, setShowSetup] = useState(false)
  const [isSidebarOpen, setIsSidebarOpen] = useState(false)
  const [lastDrawWinners, setLastDrawWinners] = useState<Winner[]>([])
  const [isBackgroundMusicPlaying, setIsBackgroundMusicPlaying] =
    useState(false)

  const backgroundAudioRef = useRef<HTMLAudioElement>(null)
  const drawAudioRef = useRef<HTMLAudioElement>(null)
  const winnerAudioRef = useRef<HTMLAudioElement>(null)
  const bgFadeRef = useRef<{ timeout?: number; interval?: number }>({})

  useEffect(() => {
    return () => {
      const prev = bgFadeRef.current
      if (prev.timeout) clearTimeout(prev.timeout)
      if (prev.interval) clearInterval(prev.interval)
    }
  }, [])

  // 持久化到 localStorage：音频不存 blob/data URL，只存“标记”或外链，实际文件在 IndexedDB
  useEffect(() => {
    const toSave: AppState = { ...state }
    const toMarker = (v: string | undefined, key: AudioKey) =>
      v?.startsWith("blob:")
        ? getMarker(key)
        : v?.startsWith("data:")
        ? undefined
        : v
    toSave.backgroundMusic = toMarker(state.backgroundMusic, "backgroundMusic")
    toSave.drawMusic = toMarker(state.drawMusic, "drawMusic")
    toSave.winnerSound = toMarker(state.winnerSound, "winnerSound")
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(toSave))
    } catch (e) {
      if (e instanceof DOMException && e.name === "QuotaExceededError") {
        setTimeout(() => alert("本地存储空间不足，请清理后重试。"), 0)
      } else {
        throw e
      }
    }
  }, [state])

  // 启动时从 IndexedDB 加载已保存的音频，将标记替换为可播放的 blob URL
  useEffect(() => {
    const keys: AudioKey[] = ["backgroundMusic", "drawMusic", "winnerSound"]
    const saved = localStorage.getItem(STORAGE_KEY)
    if (!saved) return
    let parsed: AppState
    try {
      parsed = JSON.parse(saved)
    } catch {
      return
    }
    const markers = [
      parsed.backgroundMusic,
      parsed.drawMusic,
      parsed.winnerSound,
    ]
    const loads: Promise<{ key: AudioKey; url: string } | null>[] = []
    keys.forEach((key, i) => {
      if (isIndexedDBMarker(markers[i])) {
        loads.push(getBlobURL(key).then((url) => (url ? { key, url } : null)))
      }
    })
    if (loads.length === 0) return
    Promise.all(loads)
      .then((results) => {
        const updates: Partial<AppState> = {}
        results.forEach((r) => {
          if (r) updates[r.key] = r.url
        })
        if (Object.keys(updates).length)
          setState((prev) => ({ ...prev, ...updates }))
      })
      .catch(console.error)
  }, [])

  const toggleMode = useCallback(() => {
    setState((prev) => {
      const nextMode = !prev.isExtraMode
      const targetPrizes = nextMode ? prev.extraPrizes : prev.prizes
      const nextPrizeId = targetPrizes.length > 0 ? targetPrizes[0].id : null

      return {
        ...prev,
        isExtraMode: nextMode,
        currentPrizeId: nextPrizeId,
      }
    })
    setLastDrawWinners([])
  }, [])

  const handleDrawBulk = useCallback(
    (selectedParticipants: Participant[]) => {
      const activePrizes = state.isExtraMode ? state.extraPrizes : state.prizes
      const currentPrize = activePrizes.find(
        (p) => p.id === state.currentPrizeId
      )

      if (!currentPrize || selectedParticipants.length === 0) return []

      const drawTime = new Date().toLocaleTimeString()

      const newWinners: Winner[] = selectedParticipants.map((p) => ({
        participant: p,
        prize: { ...currentPrize },
        drawTime,
        isExtra: state.isExtraMode,
      }))

      setState((prev) => {
        const updatePrizeList = (list: Prize[]) =>
          list.map((p) =>
            p.id === prev.currentPrizeId
              ? { ...p, remaining: p.remaining - selectedParticipants.length }
              : p
          )

        return {
          ...prev,
          winners: [...newWinners, ...prev.winners],
          prizes: prev.isExtraMode ? prev.prizes : updatePrizeList(prev.prizes),
          extraPrizes: prev.isExtraMode
            ? updatePrizeList(prev.extraPrizes)
            : prev.extraPrizes,
          participants: prev.isExtraMode
            ? prev.participants
            : prev.participants.filter(
                (p) => !selectedParticipants.find((sp) => sp.id === p.id)
              ),
        }
      })

      setLastDrawWinners(newWinners)
      return newWinners
    },
    [state.currentPrizeId, state.prizes, state.extraPrizes, state.isExtraMode]
  )

  const updateSettings = (
    newPrizes: Prize[],
    newExtraPrizes: Prize[],
    newParticipants: Participant[],
    extraEnabled: boolean,
    backgroundImage?: string,
    backgroundMusic?: string,
    drawMusic?: string,
    winnerSound?: string
  ) => {
    // 1. Check for structural changes that MANDATE a reset
    const participantsNames = (list: Participant[]) =>
      list
        .map((p) => p.name)
        .sort()
        .join("|")
    const prizesMeta = (list: Prize[]) =>
      list
        .map((p) => `${p.id}-${p.name}-${p.count}`)
        .sort()
        .join("|")

    const participantsChanged =
      participantsNames(newParticipants) !==
      participantsNames(state.allParticipants)
    const regularPrizesChanged =
      prizesMeta(newPrizes) !== prizesMeta(state.prizes)
    const extraPrizesChanged =
      prizesMeta(newExtraPrizes) !== prizesMeta(state.extraPrizes)

    const needsReset =
      participantsChanged || regularPrizesChanged || extraPrizesChanged

    if (needsReset) {
      if (
        !window.confirm(
          "奖项配置或人员名单已更改。这将清空当前所有中奖记录并重置抽奖进度。确定保存并继续吗？"
        )
      )
        return

      const updatedPrizes = newPrizes.map((p) => ({ ...p, remaining: p.count }))
      const updatedExtraPrizes = newExtraPrizes.map((p) => ({
        ...p,
        remaining: p.count,
      }))

      setState({
        participants: newParticipants,
        allParticipants: newParticipants,
        prizes: updatedPrizes,
        extraPrizes: updatedExtraPrizes,
        winners: [],
        currentPrizeId: extraEnabled
          ? updatedExtraPrizes[0]?.id || updatedPrizes[0]?.id || null
          : updatedPrizes[0]?.id || null,
        isExtraMode: extraEnabled,
        extraModeEnabled: extraEnabled,
        backgroundImage: backgroundImage ?? state.backgroundImage,
        backgroundMusic:
          backgroundMusic !== undefined
            ? backgroundMusic
            : state.backgroundMusic,
        drawMusic: drawMusic !== undefined ? drawMusic : state.drawMusic,
        winnerSound:
          winnerSound !== undefined ? winnerSound : state.winnerSound,
      })
    } else {
      // 2. Minor changes: mode switch or enabling/disabling features without data reset
      setState((prev) => {
        const nextIsExtraMode = extraEnabled
        const targetPrizes = nextIsExtraMode ? newExtraPrizes : newPrizes

        let nextPrizeId = prev.currentPrizeId
        // If the current prize doesn't exist in the active set anymore, select first available
        if (!targetPrizes.some((p) => p.id === nextPrizeId)) {
          nextPrizeId = targetPrizes[0]?.id || null
        }

        return {
          ...prev,
          prizes: newPrizes,
          extraPrizes: newExtraPrizes,
          allParticipants: newParticipants,
          isExtraMode: nextIsExtraMode,
          extraModeEnabled: extraEnabled,
          currentPrizeId: nextPrizeId,
          backgroundImage: backgroundImage ?? prev.backgroundImage,
          backgroundMusic:
            backgroundMusic !== undefined
              ? backgroundMusic
              : prev.backgroundMusic,
          drawMusic: drawMusic !== undefined ? drawMusic : prev.drawMusic,
          winnerSound:
            winnerSound !== undefined ? winnerSound : prev.winnerSound,
        }
      })
    }

    // Always clear the visual state and close modal
    setLastDrawWinners([])
    setShowSetup(false)
  }

  const handleResetDraw = useCallback(() => {
    setState((prev) => {
      const resetPrizes = prev.prizes.map((p) => ({ ...p, remaining: p.count }))
      const resetExtraPrizes = prev.extraPrizes.map((p) => ({
        ...p,
        remaining: p.count,
      }))
      const targetPrizes = prev.isExtraMode ? resetExtraPrizes : resetPrizes
      return {
        ...prev,
        winners: [],
        prizes: resetPrizes,
        extraPrizes: resetExtraPrizes,
        participants: [...prev.allParticipants],
        currentPrizeId: targetPrizes[0]?.id ?? null,
      }
    })
    setLastDrawWinners([])
    setShowSetup(false)
  }, [])

  const toggleBackgroundMusic = useCallback(() => {
    const el = backgroundAudioRef.current
    if (!el) return
    if (isBackgroundMusicPlaying) {
      el.pause()
      setIsBackgroundMusicPlaying(false)
    } else {
      el.play().catch(() => {})
      setIsBackgroundMusicPlaying(true)
    }
  }, [isBackgroundMusicPlaying])

  const onDrawStart = useCallback(() => {
    const bg = backgroundAudioRef.current
    if (bg) {
      bg.volume = 0.2
    }
    const draw = drawAudioRef.current
    if (draw) {
      draw.src = state.drawMusic || DEFAULT_DRAW_MUSIC_URL
      draw.loop = true
      draw.volume = 1
      draw.play().catch(() => {})
    }
  }, [state.drawMusic])

  const onDrawEnd = useCallback(() => {
    const draw = drawAudioRef.current
    if (draw) {
      draw.pause()
      draw.currentTime = 0
    }
    const bg = backgroundAudioRef.current
    if (bg) {
      const prev = bgFadeRef.current
      if (prev.timeout) clearTimeout(prev.timeout)
      if (prev.interval) clearInterval(prev.interval)
      const DELAY_MS = 3000
      const FADE_MS = 1500
      const STEP_MS = 80
      const startVol = 0.2
      const endVol = 1
      prev.timeout = window.setTimeout(() => {
        prev.timeout = undefined
        let step = 0
        const steps = Math.max(1, Math.floor(FADE_MS / STEP_MS))
        prev.interval = window.setInterval(() => {
          step += 1
          const t = step / steps
          const v = startVol + (endVol - startVol) * Math.min(1, t)
          bg.volume = v
          if (step >= steps) {
            if (prev.interval) clearInterval(prev.interval)
            prev.interval = undefined
          }
        }, STEP_MS)
      }, DELAY_MS)
    }
    const winner = winnerAudioRef.current
    if (winner) {
      winner.src = state.winnerSound || DEFAULT_WINNER_SOUND_URL
      winner.loop = false
      winner.volume = 1
      winner.play().catch(() => {})
    }
  }, [state.winnerSound])

  const currentPrize = useMemo(() => {
    const list = state.isExtraMode ? state.extraPrizes : state.prizes
    return list.find((p) => p.id === state.currentPrizeId)
  }, [state.prizes, state.extraPrizes, state.currentPrizeId, state.isExtraMode])

  const activePool = useMemo(() => {
    if (!state.isExtraMode) return state.participants
    const extraWinnersIds = new Set(
      state.winners.filter((w) => w.isExtra).map((w) => w.participant.id)
    )
    return state.allParticipants.filter((p) => !extraWinnersIds.has(p.id))
  }, [
    state.isExtraMode,
    state.participants,
    state.allParticipants,
    state.winners,
  ])

  return (
    <div
      className={`min-h-screen relative flex flex-col overflow-hidden transition-colors duration-1000 ${
        state.isExtraMode ? "bg-[#1a0f0a]" : "bg-[#0f0a0a]"
      }`}
    >
      {/* 全屏背景图片 */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden z-0">
        {/* 背景图：提高不透明度和亮度，让图片清晰可见 */}
        <div
          className="absolute inset-0 bg-cover bg-center bg-no-repeat opacity-55"
          style={{
            backgroundImage: `url('${
              state.backgroundImage || DEFAULT_BACKGROUND_URL
            }')`,
            backgroundSize: "cover",
            backgroundPosition: "center",
            filter: "brightness(0.95) saturate(1.05)",
          }}
        ></div>
        {/* 轻量渐变遮罩，保留氛围不压住背景 */}
        <div className="absolute inset-0 bg-gradient-to-b from-red-950/25 via-red-900/15 to-red-950/30"></div>
        {/* 金色光晕 */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[80%] h-[80%] bg-gradient-radial from-amber-500/10 via-transparent to-transparent"></div>
        {/* 红色光晕 */}
        <div className="absolute top-1/4 left-0 w-[50%] h-[50%] bg-gradient-radial from-red-600/12 via-transparent to-transparent"></div>
        <div className="absolute bottom-1/4 right-0 w-[50%] h-[50%] bg-gradient-radial from-red-600/12 via-transparent to-transparent"></div>
      </div>

      {state.isExtraMode && (
        <div className="absolute inset-0 pointer-events-none overflow-hidden z-0">
          <div className="absolute top-[-20%] left-[-10%] w-[60%] h-[60%] bg-amber-900/30 blur-[120px] rounded-full animate-pulse"></div>
          <div className="absolute bottom-[-20%] right-[-10%] w-[60%] h-[60%] bg-yellow-900/30 blur-[120px] rounded-full animate-pulse delay-700"></div>
          <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-10"></div>
        </div>
      )}

      <header
        className={`h-20 flex items-center justify-between px-8 z-20 backdrop-blur-md border-b transition-colors relative ${
          state.isExtraMode
            ? "border-amber-500/30 bg-amber-900/10"
            : "border-red-500/30 bg-red-950/20"
        }`}
      >
        <div className="flex items-center gap-4">
          <div
            className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-xl shadow-lg transition-all duration-500 ${
              state.isExtraMode
                ? "bg-gradient-to-tr from-amber-500 to-yellow-400 scale-110 shadow-amber-500/50"
                : "bg-gradient-to-tr from-red-500 to-red-700 shadow-red-500/30"
            }`}
          >
            {state.isExtraMode ? "S" : "L"}
          </div>
          <div className="flex flex-col">
            <h1
              className={`text-2xl font-orbitron font-bold tracking-widest text-transparent bg-clip-text uppercase transition-all duration-500 ${
                state.isExtraMode
                  ? "bg-gradient-to-r from-amber-400 via-white to-yellow-400"
                  : "bg-gradient-to-r from-red-500 via-white to-red-600"
              }`}
            >
              {state.isExtraMode ? "Secret Extra Draw" : "Annual Gala 2026"}
            </h1>
            {state.isExtraMode && (
              <span className="text-[10px] text-amber-400 font-bold tracking-[0.2em] animate-pulse">
                ALL PARTICIPANTS REJOINED
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-4">
          {isPlayableAudioSrc(state.backgroundMusic) && (
            <button
              type="button"
              onClick={toggleBackgroundMusic}
              className={`px-3 py-2 rounded-full border text-xs font-bold uppercase transition-all flex items-center gap-2 ${
                state.isExtraMode
                  ? "border-amber-500/40 hover:bg-amber-500/20 text-amber-100"
                  : "border-red-500/40 hover:bg-red-500/20 text-white"
              }`}
              title={isBackgroundMusicPlaying ? "暂停背景音乐" : "播放背景音乐"}
            >
              {isBackgroundMusicPlaying ? "🔊 音乐" : "🔇 音乐"}
            </button>
          )}
          {state.extraModeEnabled && (
            <button
              onClick={toggleMode}
              className={`px-4 py-2 rounded-full border text-xs font-bold tracking-widest uppercase transition-all flex items-center gap-2 group ${
                state.isExtraMode
                  ? "border-red-500/50 text-red-400 hover:bg-red-500/10"
                  : "border-amber-500/50 text-amber-400 hover:bg-amber-500/10"
              }`}
            >
              <span className="group-hover:scale-110 transition-transform">
                {state.isExtraMode ? "🔄 切回常规抽奖" : "✨ 开启秘密抽奖"}
              </span>
            </button>
          )}
          <button
            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
            className={`px-4 py-2 rounded-full border transition-all flex items-center gap-2 ${
              state.isExtraMode
                ? "border-amber-500/40 hover:bg-amber-500/20 text-amber-100"
                : "border-red-500/40 hover:bg-red-500/20 text-white"
            }`}
          >
            🏆 名单 ({state.winners.length})
          </button>
          <button
            onClick={() => setShowSetup(true)}
            className={`w-10 h-10 rounded-full flex items-center justify-center border transition-all active:scale-95 ${
              state.isExtraMode
                ? "border-amber-500/40 hover:bg-amber-500/20"
                : "border-red-500/40 hover:bg-red-500/20"
            }`}
          >
            ⚙️
          </button>
        </div>
      </header>

      <main className="flex-1 flex flex-col items-center justify-center p-4 relative z-10">
        <LuckyDraw
          participants={activePool}
          currentPrize={currentPrize}
          onDrawBulk={handleDrawBulk}
          winners={lastDrawWinners}
          isExtraMode={state.isExtraMode}
          onDrawStart={onDrawStart}
          onDrawEnd={onDrawEnd}
        />
      </main>

      {/* 背景音乐：循环播放；抽奖/揭晓音效（blob URL 来自 IndexedDB） */}
      {isPlayableAudioSrc(state.backgroundMusic) && (
        <audio
          ref={backgroundAudioRef}
          src={state.backgroundMusic}
          loop
          playsInline
          onEnded={() => {
            const el = backgroundAudioRef.current
            if (el && isBackgroundMusicPlaying) el.play().catch(() => {})
          }}
          className="hidden"
        />
      )}
      <audio ref={drawAudioRef} className="hidden" />
      <audio ref={winnerAudioRef} className="hidden" />

      <footer
        className={`h-32 flex items-center justify-center z-20 transition-all duration-500 relative ${
          state.isExtraMode
            ? "bg-amber-950/20 border-t border-amber-500/20"
            : "bg-red-950/20 border-t border-red-500/20"
        }`}
      >
        <div className="w-full max-w-[1200px] mx-auto px-8 overflow-x-auto scrollbar-hide">
          <div className="flex items-center justify-start gap-4 h-full min-w-fit">
            {(state.isExtraMode ? state.extraPrizes : state.prizes).map(
              (prize) => (
                <button
                  key={prize.id}
                  onClick={() => {
                    setState((prev) => ({ ...prev, currentPrizeId: prize.id }))
                    setLastDrawWinners([])
                  }}
                  className={`flex flex-col items-center p-3 rounded-xl border transition-all min-w-[140px] flex-shrink-0 group ${
                    state.currentPrizeId === prize.id
                      ? state.isExtraMode
                        ? "bg-amber-500/20 border-amber-500 scale-110 shadow-[0_0_20px_rgba(245,158,11,0.4)]"
                        : "bg-red-500/20 border-red-500 scale-110 shadow-[0_0_20px_rgba(239,68,68,0.3)]"
                      : "bg-black/40 border-white/10 hover:border-white/30"
                  }`}
                >
                  <span
                    className={`text-[10px] uppercase font-bold mb-1 transition-colors ${
                      state.currentPrizeId === prize.id
                        ? "text-white"
                        : "text-white/40 group-hover:text-white/60"
                    }`}
                  >
                    {prize.name}
                  </span>
                  <span className="font-bold text-sm truncate w-full text-center">
                    {prize.remaining > 0 ? `剩 ${prize.remaining}` : "已完成"}
                  </span>
                  <div
                    className={`mt-2 h-1 w-full rounded-full bg-white/10 overflow-hidden`}
                  >
                    <div
                      className={`h-full transition-all duration-700 ${
                        state.isExtraMode ? "bg-amber-500" : "bg-red-500"
                      }`}
                      style={{
                        width: `${(prize.remaining / prize.count) * 100}%`,
                      }}
                    />
                  </div>
                </button>
              )
            )}
          </div>
        </div>
      </footer>

      {isSidebarOpen && (
        <WinnerList
          winners={state.winners}
          onClose={() => setIsSidebarOpen(false)}
        />
      )}

      {showSetup && (
        <SetupModal
          currentData={state}
          onSave={updateSettings}
          onClose={() => setShowSetup(false)}
          onReset={handleResetDraw}
        />
      )}
    </div>
  )
}

export default App
