import React, { useState, useEffect, useRef, useCallback } from "react"
import { Participant, Prize, Winner } from "../types"

interface LuckyDrawProps {
  participants: Participant[]
  currentPrize?: Prize
  onDrawBulk: (winners: Participant[]) => void | Promise<Winner[]>
  winners: Winner[]
  isExtraMode?: boolean
  onDrawStart?: () => void
  onDrawEnd?: () => void
}

const LuckyDraw: React.FC<LuckyDrawProps> = ({
  participants,
  currentPrize,
  onDrawBulk,
  winners,
  isExtraMode,
  onDrawStart,
  onDrawEnd,
}) => {
  const [isRolling, setIsRolling] = useState(false)
  const [displayText, setDisplayText] = useState<string>("等待开始...")
  const [rollBuffer, setRollBuffer] = useState<Participant[]>([])
  const [revealFinished, setRevealFinished] = useState(false)

  const rollIntervalRef = useRef<number | null>(null)

  const themeColor = "text-amber-400"
  const themeBorder = "border-amber-500/50"
  const themeShadow = "shadow-amber-500/20"
  const themeBtn = "bg-amber-600 shadow-amber-600/50"
  const themeAccent = "amber"

  useEffect(() => {
    if (rollIntervalRef.current) clearInterval(rollIntervalRef.current)
    setIsRolling(false)
    setRevealFinished(false)

    if (participants.length > 0) {
      setDisplayText("准备就绪")
    } else {
      setDisplayText("抽奖池已空")
    }
  }, [currentPrize?.id, participants.length])

  const startRolling = useCallback(() => {
    if (
      isRolling ||
      participants.length === 0 ||
      !currentPrize ||
      currentPrize.remaining <= 0
    )
      return
    onDrawStart?.()
    setIsRolling(true)
    setRevealFinished(false)
    rollIntervalRef.current = window.setInterval(() => {
      const randomIndex = Math.floor(Math.random() * participants.length)
      setDisplayText(participants[randomIndex].name)

      const buffer = []
      for (let i = 0; i < 5; i++) {
        buffer.push(
          participants[Math.floor(Math.random() * participants.length)],
        )
      }
      setRollBuffer(buffer)
    }, 60)
  }, [isRolling, participants, currentPrize, onDrawStart])

  const stopRolling = useCallback(() => {
    if (!isRolling || !currentPrize) return

    if (rollIntervalRef.current) clearInterval(rollIntervalRef.current)
    setIsRolling(false)

    // 立即停止抽奖音乐、恢复背景音量并播放揭晓音效（提前播，不等名单动画结束）
    onDrawEnd?.()

    const countToDraw = Math.min(currentPrize.remaining, participants.length)
    const shuffled = [...participants].sort(() => 0.5 - Math.random())
    const selectedParticipants = shuffled.slice(0, countToDraw)

    onDrawBulk(selectedParticipants)

    // 庆祝全屏撒花
    // @ts-ignore
    confetti({
      particleCount: 150,
      spread: 70,
      origin: { y: 0.6 },
      colors: ["#FCD34D", "#FBBF24", "#D97706", "#FFFFFF"],
    })

    // 按 400ms 每个人的步长计算名单动画结束时间，仅用于“本轮揭晓完毕”提示
    const revealDelay = selectedParticipants.length * 400 + 500
    setTimeout(() => setRevealFinished(true), revealDelay)
  }, [
    isRolling,
    participants,
    currentPrize,
    onDrawBulk,
    isExtraMode,
    onDrawEnd,
  ])

  return (
    <div className="w-full max-w-6xl h-full max-h-full flex flex-col items-center justify-center gap-2 min-h-0">
      <div className="text-center flex-shrink-0">
        <h2
          className={`text-3xl md:text-4xl lg:text-5xl font-bold font-orbitron uppercase tracking-widest ${themeColor} neon-text-gold`}
        >
          {isExtraMode && "✦ "}
          {currentPrize ? currentPrize.name : "请选择奖项"}
          {isExtraMode && " ✦"}
        </h2>
        {/* <p className="text-white/40 uppercase tracking-[0.2em] text-xs mt-1">
          {isExtraMode
            ? "✨ 全体成员再次归队，幸运双倍 ✨"
            : isRolling
              ? `正在为 ${currentPrize?.remaining} 个名额滚动...`
              : "准备开启幸运时刻"}
        </p> */}
      </div>

      <div
        className={`relative w-full flex-1 min-h-0 bg-gradient-to-b from-black/60 to-black/30 backdrop-blur-xl rounded-2xl border overflow-hidden flex flex-col items-center justify-center p-4 transition-all duration-500 border-amber-500/40 shadow-[0_0_30px_rgba(245,158,11,0.15)]`}
      >
        <div
          className={`absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-${themeAccent}-500 to-transparent opacity-50`}
        ></div>
        <div
          className={`absolute bottom-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-${themeAccent}-500 to-transparent opacity-50`}
        ></div>

        {isRolling ? (
          <div className="flex flex-col md:flex-row items-center gap-6 animate-pulse flex-shrink-0">
            {currentPrize && (
              <div className="w-80 h-80 md:w-[26rem] md:h-[26rem] rounded-2xl overflow-hidden border border-white/10 blur-[2px]">
                <img
                  src={
                    currentPrize.image ||
                    "https://picsum.photos/seed/gift/400/400"
                  }
                  className="w-full h-full object-cover grayscale"
                  alt="prize"
                />
              </div>
            )}
            <div className="flex flex-col items-center space-y-2">
              <div className="text-2xl md:text-3xl text-white/20 blur-[1px] font-orbitron">
                {rollBuffer[0]?.name}
              </div>
              <div
                className={`text-5xl md:text-7xl font-bold font-orbitron tracking-tighter text-white drop-shadow-[0_0_15px_rgba(255,255,255,0.5)]`}
              >
                {displayText}
              </div>
              <div className="text-2xl md:text-3xl text-white/20 blur-[1px] font-orbitron">
                {rollBuffer[1]?.name}
              </div>
            </div>
          </div>
        ) : winners.length > 0 ? (
          <div className="w-full h-full min-h-0 relative flex flex-col md:flex-row items-stretch gap-6 md:gap-8 animate-in fade-in duration-500 overflow-hidden p-4">
            {/* 左侧：奖品图 */}
            <div className="flex flex-col items-center justify-center flex-shrink-0 md:w-auto">
              {currentPrize && (
                <img
                  src={
                    currentPrize.image ||
                    "https://picsum.photos/seed/gift/400/400"
                  }
                  className={`w-80 h-80 md:w-[26rem] md:h-[26rem] rounded-2xl object-cover border-2 shadow-2xl ${themeBorder} animate-[prizeMoveToLeft_0.8s_ease-out_forwards]`}
                  alt="prize"
                />
              )}
            </div>

            {/* 右侧：恭喜中奖者标题 + 中奖名单（居中排列） */}
            <div className="flex-1 min-h-0 flex flex-col items-center w-full overflow-hidden">
              <div
                className={`flex-shrink-0 text-center text-2xl md:text-3xl lg:text-4xl font-black font-orbitron ${themeColor} mb-1`}
              >
                恭喜中奖者！
              </div>
              <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden w-full flex justify-center custom-scrollbar">
              <div className="flex flex-wrap justify-center content-center gap-4 md:gap-6 max-w-5xl w-full py-2">
                {winners.map((w, idx) => (
                  <div
                    key={idx}
                    className="flex flex-col items-center space-y-1 group opacity-0 animate-[popIn_0.6s_ease-out_forwards] flex-shrink-0"
                    style={{ animationDelay: `${idx * 400}ms` }}
                  >
                    <div className="relative">
                      <div
                        className={`absolute -inset-2 rounded-full blur-xl opacity-0 group-hover:opacity-100 animate-[glowPulse_2s_infinite] transition-opacity bg-amber-500/25`}
                      />
                      <div
                        className={`relative w-16 h-16 md:w-20 md:h-20 rounded-full border-2 p-1 shadow-xl transition-all duration-500 group-hover:scale-110 group-hover:rotate-3 ${themeBorder} ${themeShadow}`}
                      >
                        <img
                          src={w.participant.avatar}
                          className="w-full h-full rounded-full object-cover bg-black"
                          alt="avatar"
                        />
                        <div
                          className={`absolute -bottom-1 -right-1 w-6 h-6 rounded-full border-2 border-white/20 flex items-center justify-center text-xs font-black shadow-lg ${themeBtn}`}
                        >
                          {idx + 1}
                        </div>
                      </div>
                    </div>
                    <div className="text-center">
                      <div className="text-sm md:text-base font-black font-orbitron text-white tracking-wide group-hover:text-amber-400 transition-colors">
                        {w.participant.name}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              </div>
              {revealFinished && (
                <div className="flex-shrink-0 text-center text-white/20 text-[10px] font-bold uppercase tracking-[0.4em] animate-pulse mt-2">
                  本轮抽奖已全部揭晓
                </div>
              )}
            </div>

          </div>
        ) : (
          <div className="flex flex-col md:flex-row items-center gap-6 flex-shrink-0">
            {currentPrize && (
              <div className="w-80 h-80 md:w-[26rem] md:h-[26rem] rounded-2xl overflow-hidden border-2 border-white/10 shadow-2xl relative group">
                <img
                  src={
                    currentPrize.image ||
                    "https://picsum.photos/seed/gift/400/400"
                  }
                  className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700"
                  alt="prize"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end p-4">
                  <div className="text-xs font-bold uppercase tracking-tighter text-white/80"></div>
                </div>
                {isExtraMode && (
                  <div className="absolute top-2 right-2 bg-amber-600 text-[10px] font-bold px-2 py-0.5 rounded shadow-lg animate-pulse">
                    SECRET
                  </div>
                )}
              </div>
            )}
            <div className="text-center md:text-left">
              <div
                className={`text-4xl md:text-5xl font-bold font-orbitron text-white/20 tracking-widest mb-1`}
              >
                {isExtraMode ? "SECRET" : "READY?"}
              </div>
              <div className="text-sm md:text-base text-white/40 font-orbitron tracking-widest">
                {currentPrize?.remaining === 0
                  ? "该奖项已抽完"
                  : `${participants.length} 位候选人已就绪`}
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="flex items-center gap-4 flex-shrink-0">
        {isRolling ? (
          <button
            onClick={stopRolling}
            className={`group relative px-16 py-5 bg-amber-600 text-black font-bold text-xl md:text-2xl rounded-xl overflow-hidden transition-all hover:scale-105 active:scale-95 shadow-[0_0_30px_rgba(245,158,11,0.4)] border border-amber-400/30`}
          >
            立即开奖 (抽取 {currentPrize?.remaining} 人)
            <div className="absolute inset-0 bg-white/20 translate-x-[-100%] animate-[shimmer_2s_infinite]"></div>
          </button>
        ) : (
          <button
            onClick={startRolling}
            disabled={
              !currentPrize ||
              currentPrize.remaining <= 0 ||
              participants.length === 0
            }
            className={`group relative px-16 py-5 ${themeBtn} text-white font-bold text-xl md:text-2xl rounded-xl overflow-hidden transition-all hover:scale-105 active:scale-95 disabled:opacity-50 disabled:grayscale disabled:hover:scale-100 shadow-[0_15px_50px_-10px_rgba(0,0,0,0.4)] border border-white/10`}
          >
            <div className="absolute inset-0 bg-white/30 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-700 skew-x-[-20deg]"></div>
            <span className="relative z-10 flex items-center gap-3">
              {isExtraMode ? "✨ 开启秘密抽奖 ✨" : "🚀 开启幸运抽奖 🚀"}
            </span>
          </button>
        )}
      </div>

      <style>{`
        @keyframes shimmer {
          100% { transform: translateX(100%); }
        }
        @keyframes popIn {
          0% { 
            opacity: 0; 
            transform: scale(0.5) translateY(30px);
            filter: blur(10px);
          }
          70% {
            transform: scale(1.1) translateY(-5px);
          }
          100% { 
            opacity: 1; 
            transform: scale(1) translateY(0);
            filter: blur(0);
          }
        }
        @keyframes glowPulse {
          0%, 100% { opacity: 0.3; transform: scale(1); }
          50% { opacity: 0.6; transform: scale(1.1); }
        }
        @keyframes prizeMoveToLeft {
          0% { transform: translateX(50%); }
          100% { transform: translateX(0); }
        }
      `}</style>
    </div>
  )
}

export default LuckyDraw
