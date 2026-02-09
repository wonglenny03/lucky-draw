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
import {
  apiGetDrawState,
  apiPutDrawState,
  apiDraw,
  apiDrawReset,
  apiResetToDefaultConfig,
  apiLogout,
} from "./services/api"
import type { MeResponse } from "./services/api"

const DEFAULT_BACKGROUND_URL =
  "https://images.unsplash.com/photo-1578662996442-48f60103fc96?w=1920&q=80"
const DEFAULT_DRAW_MUSIC_URL = "/Ongoing.mp3"
const DEFAULT_WINNER_SOUND_URL = "/result.mp3"

/** 是否为可播放的音频地址（http/https/blob/data），排除 IndexedDB 标记 */
function isPlayableAudioSrc(s: string | undefined): boolean {
  return (
    !!s &&
    (s.startsWith("http") || s.startsWith("blob:") || s.startsWith("data:"))
  )
}

function normalizeState(parsed: AppState): AppState {
  if (!parsed.allParticipants) parsed.allParticipants = [...parsed.participants]
  if (!parsed.extraPrizes) parsed.extraPrizes = []
  if (parsed.isExtraMode === undefined) parsed.isExtraMode = false
  if (parsed.extraModeEnabled === undefined)
    parsed.extraModeEnabled = parsed.isExtraMode
  return parsed
}

interface AppProps {
  currentUser: MeResponse
  onLogout: () => void
}

const App: React.FC<AppProps> = ({ currentUser, onLogout }) => {
  const [state, setState] = useState<AppState | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)

  const [showSetup, setShowSetup] = useState(false)
  const [isSidebarOpen, setIsSidebarOpen] = useState(false)
  const [lastDrawWinners, setLastDrawWinners] = useState<Winner[]>([])
  const [isBackgroundMusicPlaying, setIsBackgroundMusicPlaying] =
    useState(false)

  const backgroundAudioRef = useRef<HTMLAudioElement>(null)
  const drawAudioRef = useRef<HTMLAudioElement>(null)
  const winnerAudioRef = useRef<HTMLAudioElement>(null)
  const bgFadeRef = useRef<{ timeout?: number; interval?: number }>({})
  const footerScrollRef = useRef<HTMLDivElement>(null)

  const handleFooterWheel = useCallback(
    (e: React.WheelEvent<HTMLDivElement>) => {
      const el = footerScrollRef.current
      if (!el || !e.shiftKey) return
      e.preventDefault()
      el.scrollLeft += e.deltaY
    },
    [],
  )

  const prizeList = state
    ? state.isExtraMode
      ? state.extraPrizes
      : state.prizes
    : []
  const currentPrizeIndex =
    state?.currentPrizeId != null
      ? prizeList.findIndex((p) => p.id === state.currentPrizeId)
      : -1
  const canGoPrev = currentPrizeIndex > 0
  const canGoNext =
    currentPrizeIndex >= 0 && currentPrizeIndex < prizeList.length - 1

  const switchPrize = useCallback(
    (direction: "prev" | "next") => {
      if (!state || prizeList.length === 0) return
      const idx = currentPrizeIndex
      if (direction === "prev" && idx <= 0) return
      if (direction === "next" && idx >= prizeList.length - 1) return
      const nextIdx = direction === "prev" ? idx - 1 : idx + 1
      const nextId = prizeList[nextIdx].id
      setState((prev) => (prev ? { ...prev, currentPrizeId: nextId } : prev))
      setLastDrawWinners([])
    },
    [state, prizeList, currentPrizeIndex],
  )

  // 选中项变更时滚动到可见
  const currentPrizeId = state?.currentPrizeId
  useEffect(() => {
    const el = footerScrollRef.current
    if (!el || !currentPrizeId) return
    const target = el.querySelector(
      `[data-prize-id="${currentPrizeId}"]`,
    ) as HTMLElement | null
    if (target) {
      target.scrollIntoView({
        behavior: "smooth",
        block: "nearest",
        inline: "center",
      })
    }
  }, [currentPrizeId])

  // 从服务端加载当前用户的抽奖状态
  useEffect(() => {
    let cancelled = false
    setLoadError(null)
    apiGetDrawState()
      .then((data) => {
        if (!cancelled) setState(normalizeState(data))
      })
      .catch((err) => {
        if (!cancelled)
          setLoadError(err instanceof Error ? err.message : "加载失败")
      })
    return () => {
      cancelled = true
    }
  }, [currentUser.userId])

  useEffect(() => {
    return () => {
      const prev = bgFadeRef.current
      if (prev.timeout) clearTimeout(prev.timeout)
      if (prev.interval) clearInterval(prev.interval)
    }
  }, [])

  // 当 state 从服务端加载后，从 IndexedDB 恢复音频 blob URL（若有）
  useEffect(() => {
    if (!state) return
    const keys: AudioKey[] = ["backgroundMusic", "drawMusic", "winnerSound"]
    const markers = [state.backgroundMusic, state.drawMusic, state.winnerSound]
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
          setState((prev) => (prev ? { ...prev, ...updates } : prev))
      })
      .catch(console.error)
  }, [state?.participants?.length, state?.prizes?.length])

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
    async (selectedParticipants: Participant[]) => {
      if (!state) return []
      const activePrizes = state.isExtraMode ? state.extraPrizes : state.prizes
      const currentPrize = activePrizes.find(
        (p) => p.id === state.currentPrizeId,
      )
      if (!currentPrize || selectedParticipants.length === 0) return []
      try {
        const currentId = state.currentPrizeId
        const { winners: newWinners, state: nextState } = await apiDraw({
          currentPrizeId: state.currentPrizeId!,
          isExtraMode: state.isExtraMode,
          participantIds: selectedParticipants.map((p) => p.id),
          prizeSnapshot: { ...currentPrize },
        })
        const normalized = normalizeState(nextState)
        setState({
          ...normalized,
          currentPrizeId: currentId ?? normalized.currentPrizeId,
        })
        setLastDrawWinners(newWinners)
        return newWinners
      } catch (e) {
        console.error(e)
        alert(e instanceof Error ? e.message : "抽奖请求失败")
        return []
      }
    },
    [state],
  )

  const updateSettings = (
    newPrizes: Prize[],
    newExtraPrizes: Prize[],
    newParticipants: Participant[],
    extraEnabled: boolean,
    backgroundImage?: string,
    backgroundMusic?: string,
    drawMusic?: string,
    winnerSound?: string,
  ) => {
    if (!state) return
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
          "奖项配置或人员名单已更改。这将清空当前所有中奖记录并重置抽奖进度。确定保存并继续吗？",
        )
      )
        return

      const updatedPrizes = newPrizes.map((p) => ({ ...p, remaining: p.count }))
      const updatedExtraPrizes = newExtraPrizes.map((p) => ({
        ...p,
        remaining: p.count,
      }))

      const nextState: AppState = {
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
      }
      const toMarker = (v: string | undefined, key: AudioKey) =>
        v?.startsWith("blob:")
          ? getMarker(key)
          : v?.startsWith("data:")
            ? undefined
            : v
      const toSave: AppState = {
        ...nextState,
        backgroundMusic: toMarker(nextState.backgroundMusic, "backgroundMusic"),
        drawMusic: toMarker(nextState.drawMusic, "drawMusic"),
        winnerSound: toMarker(nextState.winnerSound, "winnerSound"),
      }
      apiPutDrawState(toSave)
        .then(() => {
          setState(nextState)
          setLastDrawWinners([])
          setShowSetup(false)
        })
        .catch((e) => {
          alert(e instanceof Error ? e.message : "保存失败")
        })
      return
    }

    const nextIsExtraMode = extraEnabled
    const targetPrizes = nextIsExtraMode ? newExtraPrizes : newPrizes
    let nextPrizeId = state.currentPrizeId
    if (!targetPrizes.some((p) => p.id === nextPrizeId)) {
      nextPrizeId = targetPrizes[0]?.id || null
    }

    const nextState: AppState = {
      ...state,
      prizes: newPrizes,
      extraPrizes: newExtraPrizes,
      allParticipants: newParticipants,
      isExtraMode: nextIsExtraMode,
      extraModeEnabled: extraEnabled,
      currentPrizeId: nextPrizeId,
      backgroundImage: backgroundImage ?? state.backgroundImage,
      backgroundMusic:
        backgroundMusic !== undefined ? backgroundMusic : state.backgroundMusic,
      drawMusic: drawMusic !== undefined ? drawMusic : state.drawMusic,
      winnerSound: winnerSound !== undefined ? winnerSound : state.winnerSound,
    }
    const toMarker = (v: string | undefined, key: AudioKey) =>
      v?.startsWith("blob:")
        ? getMarker(key)
        : v?.startsWith("data:")
          ? undefined
          : v
    const toSave: AppState = {
      ...nextState,
      backgroundMusic: toMarker(nextState.backgroundMusic, "backgroundMusic"),
      drawMusic: toMarker(nextState.drawMusic, "drawMusic"),
      winnerSound: toMarker(nextState.winnerSound, "winnerSound"),
    }
    apiPutDrawState(toSave)
      .then(() => {
        setState(nextState)
        setLastDrawWinners([])
        setShowSetup(false)
      })
      .catch((e) => {
        alert(e instanceof Error ? e.message : "保存失败")
      })
  }

  const handleResetDraw = useCallback(async () => {
    try {
      const nextState = await apiDrawReset()
      setState(normalizeState(nextState))
      setLastDrawWinners([])
      setShowSetup(false)
    } catch (e) {
      alert(e instanceof Error ? e.message : "重置失败")
    }
  }, [])

  const handleResetToDefault = useCallback(async () => {
    try {
      const nextState = await apiResetToDefaultConfig()
      setState(normalizeState(nextState))
      setLastDrawWinners([])
      setShowSetup(false)
    } catch (e) {
      alert(e instanceof Error ? e.message : "恢复默认失败")
    }
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
      draw.src = state?.drawMusic || DEFAULT_DRAW_MUSIC_URL
      draw.loop = true
      draw.volume = 0.6
      draw.play().catch(() => {})
    }
  }, [state?.drawMusic])

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
      winner.src = state?.winnerSound || DEFAULT_WINNER_SOUND_URL
      winner.loop = false
      winner.volume = 0.6
      winner.play().catch(() => {})
    }
  }, [state?.winnerSound])

  const currentPrize = useMemo(() => {
    if (!state) return undefined
    const list = state.isExtraMode ? state.extraPrizes : state.prizes
    return list.find((p) => p.id === state.currentPrizeId)
  }, [
    state?.prizes,
    state?.extraPrizes,
    state?.currentPrizeId,
    state?.isExtraMode,
  ])

  const activePool = useMemo(() => {
    if (!state) return []
    if (!state.isExtraMode) return state.participants
    const extraWinnersIds = new Set(
      state.winners.filter((w) => w.isExtra).map((w) => w.participant.id),
    )
    return state.allParticipants.filter((p) => !extraWinnersIds.has(p.id))
  }, [
    state?.isExtraMode,
    state?.participants,
    state?.allParticipants,
    state?.winners,
  ])

  const handleLogout = useCallback(async () => {
    await apiLogout()
    onLogout()
  }, [onLogout])

  if (loadError) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-[#0f0a0a] gap-4">
        <p className="text-amber-400">{loadError}</p>
        <button
          onClick={() => window.location.reload()}
          className="px-4 py-2 rounded-lg border border-amber-500/50 text-amber-400 hover:bg-amber-500/10"
        >
          重试
        </button>
      </div>
    )
  }

  if (!state) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0f0a0a]">
        <div className="text-white/50 font-orbitron uppercase tracking-widest">
          加载抽奖数据…
        </div>
      </div>
    )
  }

  return (
    <div className="h-screen relative flex flex-col overflow-hidden transition-colors duration-1000 bg-[#0a0a0a]">
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
        <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-black/20 to-black/50"></div>
        {/* 金色光晕 */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[80%] h-[80%] bg-gradient-radial from-amber-500/15 via-transparent to-transparent"></div>
        <div className="absolute top-1/4 left-0 w-[50%] h-[50%] bg-gradient-radial from-amber-600/10 via-transparent to-transparent"></div>
        <div className="absolute bottom-1/4 right-0 w-[50%] h-[50%] bg-gradient-radial from-amber-600/10 via-transparent to-transparent"></div>
      </div>

      {state.isExtraMode && (
        <div className="absolute inset-0 pointer-events-none overflow-hidden z-0">
          <div className="absolute top-[-20%] left-[-10%] w-[60%] h-[60%] bg-amber-900/30 blur-[120px] rounded-full animate-pulse"></div>
          <div className="absolute bottom-[-20%] right-[-10%] w-[60%] h-[60%] bg-yellow-900/30 blur-[120px] rounded-full animate-pulse delay-700"></div>
          <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-10"></div>
        </div>
      )}

      <header
        className={`h-20 flex-shrink-0 flex items-center justify-between px-8 z-20 backdrop-blur-md border-b transition-colors relative ${
          state.isExtraMode
            ? "border-amber-500/30 bg-black/30"
            : "border-amber-500/30 bg-black/30"
        }`}
      >
        <div className="flex items-center gap-4">
          <div
            className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-xl shadow-lg transition-all duration-500 ${
              state.isExtraMode
                ? "bg-gradient-to-tr from-amber-500 to-yellow-400 scale-110 shadow-amber-500/50"
                : "bg-gradient-to-tr from-amber-500 to-yellow-600 shadow-amber-500/40"
            }`}
          >
            {state.isExtraMode ? "S" : "F"}
          </div>
          <div className="flex flex-col">
            <h1
              className={`text-2xl font-orbitron font-bold tracking-widest text-transparent bg-clip-text uppercase transition-all duration-500 ${
                state.isExtraMode
                  ? "bg-gradient-to-r from-amber-400 via-white to-yellow-400"
                  : "bg-gradient-to-r from-amber-400 via-white to-yellow-500"
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
                  : "border-amber-500/40 hover:bg-amber-500/20 text-amber-100"
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
                  ? "border-amber-500/50 text-amber-400 hover:bg-amber-500/10"
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
                : "border-amber-500/40 hover:bg-amber-500/20 text-amber-100"
            }`}
          >
            🏆 名单 ({state.winners.length})
          </button>
          <button
            onClick={() => setShowSetup(true)}
            className={`w-10 h-10 rounded-full flex items-center justify-center border transition-all active:scale-95 ${
              state.isExtraMode
                ? "border-amber-500/40 hover:bg-amber-500/20"
                : "border-amber-500/40 hover:bg-amber-500/20"
            }`}
          >
            ⚙️
          </button>
          <span className="text-white/60 text-sm font-mono">
            {currentUser.username}
          </span>
          <button
            onClick={handleLogout}
            className="px-3 py-2 rounded-full border border-white/20 text-white/60 hover:text-white hover:bg-white/10 text-xs"
          >
            退出
          </button>
        </div>
      </header>

      <main className="flex-1 min-h-0 flex flex-col items-center justify-center p-3 relative z-10 overflow-hidden">
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

      <footer className="flex-shrink-0 min-h-[6rem] flex items-center justify-center z-20 transition-all duration-500 relative bg-black/30 border-t border-amber-500/20">
        <button
          type="button"
          onClick={() => switchPrize("prev")}
          disabled={!canGoPrev}
          aria-label="上一项"
          className="absolute left-6 z-10 w-16 h-16 rounded-full flex items-center justify-center border-2 border-amber-500/40 bg-amber-500/10 hover:bg-amber-500/20 text-amber-200 text-3xl font-bold transition-all shrink-0 disabled:opacity-40 disabled:pointer-events-none"
        >
          ‹
        </button>
        <div
          ref={footerScrollRef}
          className="footer-prizes-scroll w-full max-w-[1200px] mx-auto px-12 py-6 overflow-x-auto overflow-y-hidden"
          onWheel={handleFooterWheel}
        >
          <div className="flex items-center justify-start gap-4 min-h-[6rem] min-w-fit">
            {(state.isExtraMode ? state.extraPrizes : state.prizes).map(
              (prize) => (
                <button
                  key={prize.id}
                  data-prize-id={prize.id}
                  onClick={() => {
                    setState((prev) => ({ ...prev, currentPrizeId: prize.id }))
                    setLastDrawWinners([])
                  }}
                  className={`flex flex-col items-center justify-center p-3 rounded-xl border transition-all min-w-[160px] h-[6rem] flex-shrink-0 group ${
                    state.currentPrizeId === prize.id
                      ? "bg-amber-500/20 border-amber-500 scale-110 shadow-[0_0_20px_rgba(245,158,11,0.4)]"
                      : "bg-black/40 border-white/10 hover:border-amber-500/30"
                  }`}
                >
                  <span
                    className={`text-base uppercase font-bold mb-1 transition-colors ${
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
                  <div className="mt-2 h-1 w-full rounded-full bg-white/10 overflow-hidden">
                    <div
                      className="h-full transition-all duration-700 bg-amber-500"
                      style={{
                        width: `${(prize.remaining / prize.count) * 100}%`,
                      }}
                    />
                  </div>
                </button>
              ),
            )}
          </div>
        </div>
        <button
          type="button"
          onClick={() => switchPrize("next")}
          disabled={!canGoNext}
          aria-label="下一项"
          className="absolute right-6 z-10 w-16 h-16 rounded-full flex items-center justify-center border-2 border-amber-500/40 bg-amber-500/10 hover:bg-amber-500/20 text-amber-200 text-3xl font-bold transition-all shrink-0 disabled:opacity-40 disabled:pointer-events-none"
        >
          ›
        </button>
      </footer>

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
          onResetToDefault={handleResetToDefault}
        />
      )}
    </div>
  )
}

export default App
