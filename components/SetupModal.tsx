import React, { useState, useEffect } from "react"
import { AppState, Participant, Prize } from "../types"
import {
  putAudio,
  getBlobURL,
  isIndexedDBMarker,
  type AudioKey,
} from "../services/audioStorage"
import { apiUploadImage } from "../services/api"

const DEFAULT_BACKGROUND_URL =
  "https://images.unsplash.com/photo-1578662996442-48f60103fc96?w=1920&q=80"

interface SetupModalProps {
  currentData: AppState
  onSave: (
    prizes: Prize[],
    extraPrizes: Prize[],
    participants: Participant[],
    isExtraMode: boolean,
    backgroundImage?: string,
    backgroundMusic?: string,
    drawMusic?: string,
    winnerSound?: string,
  ) => void
  onClose: () => void
  onReset?: () => void
  /** 恢复为服务端默认奖项与人员（会保存到数据库并清空中奖记录） */
  onResetToDefault?: () => void | Promise<void>
}

const MAX_IMAGE_SIZE = 5 * 1024 * 1024 // 5MB
const ACCEPT_IMAGE_TYPES = "image/jpeg,image/png"
const DEFAULT_PRIZE_IMAGE = "https://picsum.photos/seed/gift/400/400"

const SetupModal: React.FC<SetupModalProps> = ({
  currentData,
  onSave,
  onClose,
  onReset,
  onResetToDefault,
}) => {
  const [activeTab, setActiveTab] = useState<
    "prizes" | "extra" | "participants" | "background" | "music"
  >("prizes")

  const [prizes, setPrizes] = useState<Prize[]>([...currentData.prizes])
  const [extraPrizes, setExtraPrizes] = useState<Prize[]>([
    ...currentData.extraPrizes,
  ])
  const [isExtraModeEnabled, setIsExtraModeEnabled] = useState(
    currentData.extraModeEnabled,
  )
  const [participantInput, setParticipantInput] = useState(
    currentData.allParticipants.map((p) => p.name).join("\n"),
  )
  const [backgroundImage, setBackgroundImage] = useState<string>(
    currentData.backgroundImage ?? "",
  )
  const [backgroundMusic, setBackgroundMusic] = useState<string>(
    currentData.backgroundMusic ?? "",
  )
  const [drawMusic, setDrawMusic] = useState<string>(
    currentData.drawMusic ?? "",
  )
  const [winnerSound, setWinnerSound] = useState<string>(
    currentData.winnerSound ?? "",
  )
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)

  useEffect(() => {
    if (!isExtraModeEnabled && activeTab === "extra") {
      setActiveTab("prizes")
    }
  }, [isExtraModeEnabled, activeTab])

  // 打开设置时，若当前是 IndexedDB 标记则从 IndexedDB 加载 blob URL，否则同步外链/空
  useEffect(() => {
    if (isIndexedDBMarker(currentData.backgroundMusic)) {
      getBlobURL("backgroundMusic").then(
        (url) => url && setBackgroundMusic(url),
      )
    } else {
      setBackgroundMusic(currentData.backgroundMusic ?? "")
    }
    if (isIndexedDBMarker(currentData.drawMusic)) {
      getBlobURL("drawMusic").then((url) => url && setDrawMusic(url))
    } else {
      setDrawMusic(currentData.drawMusic ?? "")
    }
    if (isIndexedDBMarker(currentData.winnerSound)) {
      getBlobURL("winnerSound").then((url) => url && setWinnerSound(url))
    } else {
      setWinnerSound(currentData.winnerSound ?? "")
    }
  }, [
    currentData.backgroundMusic,
    currentData.drawMusic,
    currentData.winnerSound,
  ])

  const handleToggleExtraMode = (checked: boolean) => {
    setIsExtraModeEnabled(checked)
    if (checked && extraPrizes.length === 0) {
      const defaultExtra: Prize = {
        id: `ep-${Date.now()}`,
        name: "神秘惊喜奖",
        rank: 1,
        count: 1,
        remaining: 1,
        image: "https://picsum.photos/seed/mystery/400/400",
      }
      setExtraPrizes([defaultExtra])
      setActiveTab("extra")
    }
  }

  const handlePrizeChange = (
    id: string,
    field: keyof Prize,
    value: string | number,
    isExtra: boolean,
  ) => {
    const setter = isExtra ? setExtraPrizes : setPrizes
    setter((prev) =>
      prev.map((p) => {
        if (p.id === id) {
          return { ...p, [field]: value }
        }
        return p
      }),
    )
  }

  const movePrize = (
    index: number,
    direction: "up" | "down",
    isExtra: boolean,
  ) => {
    const list = isExtra ? [...extraPrizes] : [...prizes]
    const setter = isExtra ? setExtraPrizes : setPrizes
    const targetIndex = direction === "up" ? index - 1 : index + 1
    if (targetIndex < 0 || targetIndex >= list.length) return
    ;[list[index], list[targetIndex]] = [list[targetIndex], list[index]]
    setter(list.map((p, idx) => ({ ...p, rank: idx + 1 })))
  }

  const addPrize = (isExtra: boolean) => {
    const list = isExtra ? extraPrizes : prizes
    const setter = isExtra ? setExtraPrizes : setPrizes
    const newId = `p-${Date.now()}`
    setter([
      ...list,
      {
        id: newId,
        name: isExtra ? "神秘额外奖" : "新奖项",
        rank: list.length + 1,
        count: 1,
        remaining: 1,
        image: "https://picsum.photos/seed/gift/400/400",
      },
    ])
  }

  const deletePrize = (id: string, isExtra: boolean) => {
    const list = isExtra ? extraPrizes : prizes
    const setter = isExtra ? setExtraPrizes : setPrizes
    if (!isExtra && list.length <= 1) {
      alert("常规奖项至少需要保留一个。")
      return
    }
    setter(list.filter((p) => p.id !== id))
  }

  const handleImageUpload = (
    id: string,
    isExtra: boolean,
    e: React.ChangeEvent<HTMLInputElement>,
  ) => {
    setUploadError(null)
    const file = e.target.files?.[0]
    if (!file) return
    const okTypes = ["image/jpeg", "image/png"]
    if (!okTypes.includes(file.type)) {
      setUploadError("仅支持 JPG 或 PNG 格式")
      e.target.value = ""
      return
    }
    if (file.size > MAX_IMAGE_SIZE) {
      setUploadError("图片大小不能超过 5MB")
      e.target.value = ""
      return
    }
    e.target.value = ""
    setUploading(true)
    apiUploadImage(file)
      .then((url) => {
        handlePrizeChange(id, "image", url, isExtra)
      })
      .catch((err) => {
        setUploadError(err instanceof Error ? err.message : "上传失败")
      })
      .finally(() => setUploading(false))
  }

  const handleBackgroundUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    setUploadError(null)
    const file = e.target.files?.[0]
    if (!file) return
    const okTypes = ["image/jpeg", "image/png", "image/webp", "image/gif"]
    if (!okTypes.includes(file.type)) {
      setUploadError("请上传 JPG、PNG、WebP 或 GIF 图片")
      e.target.value = ""
      return
    }
    e.target.value = ""
    setUploading(true)
    apiUploadImage(file)
      .then((url) => setBackgroundImage(url))
      .catch((err) => {
        setUploadError(err instanceof Error ? err.message : "上传背景图失败")
      })
      .finally(() => setUploading(false))
  }

  const handleMusicUpload = (
    key: AudioKey,
    setter: (v: string) => void,
    e: React.ChangeEvent<HTMLInputElement>,
  ) => {
    setUploadError(null)
    const file = e.target.files?.[0]
    if (!file) return
    if (!file.type.startsWith("audio/")) {
      setUploadError("请上传 MP3 等音频文件")
      e.target.value = ""
      return
    }
    e.target.value = ""
    putAudio(key, file)
      .then((blobUrl) => setter(blobUrl))
      .catch(() => setUploadError("保存音频失败，请重试"))
  }

  const handleSave = () => {
    const lines = participantInput.split("\n").filter((l) => l.trim() !== "")

    // Attempt to preserve old IDs and avatars
    const existingMap = new Map<string, Participant>()
    currentData.allParticipants.forEach((p) => existingMap.set(p.name, p))

    const newParticipants: Participant[] = lines.map((name, idx) => {
      const trimmed = name.trim()
      const existing = existingMap.get(trimmed)
      if (existing) return { ...existing }

      return {
        id: `p-${idx}-${Date.now()}`,
        name: trimmed,
        avatar: `https://picsum.photos/seed/p${idx}-${trimmed}/100/100`,
      }
    })

    onSave(
      prizes,
      extraPrizes,
      newParticipants,
      isExtraModeEnabled,
      backgroundImage.trim(),
      backgroundMusic.trim(),
      drawMusic.trim(),
      winnerSound.trim(),
    )
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-6">
      <div
        className="absolute inset-0 bg-black/80 backdrop-blur-md"
        onClick={onClose}
      />
      <div
        className={`relative w-full max-w-3xl bg-[#111] border rounded-3xl overflow-hidden flex flex-col animate-in zoom-in duration-300 shadow-2xl transition-colors duration-500 ${
          isExtraModeEnabled
            ? "border-amber-500/40 shadow-amber-500/10"
            : "border-red-500/40 shadow-red-500/10"
        }`}
      >
        <div className="p-6 border-b border-white/10 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <h2
              className={`text-2xl font-bold font-orbitron transition-colors ${
                isExtraModeEnabled ? "text-amber-400" : "text-red-500"
              }`}
            >
              {isExtraModeEnabled
                ? "✨ 活动配置 (额外模式)"
                : "⚙️ 活动配置 (常规)"}
            </h2>
            <div className="h-6 w-[1px] bg-white/10"></div>
            {/* <label className="flex items-center gap-3 cursor-pointer group">
              <div
                className={`w-12 h-6 rounded-full relative transition-all duration-300 ${
                  isExtraModeEnabled
                    ? "bg-amber-600 shadow-[0_0_15px_rgba(245,158,11,0.6)]"
                    : "bg-white/10"
                }`}
              >
                <div
                  className={`absolute top-1 w-4 h-4 rounded-full bg-white shadow-sm transition-all duration-300 ${
                    isExtraModeEnabled ? "left-7" : "left-1"
                  }`}
                ></div>
              </div>
              <input
                type="checkbox"
                checked={isExtraModeEnabled}
                onChange={(e) => handleToggleExtraMode(e.target.checked)}
                className="hidden"
              />
              <span
                className={`text-[10px] font-black uppercase tracking-widest transition-colors ${
                  isExtraModeEnabled ? "text-amber-400" : "text-white/30"
                }`}
              >
                额外抽奖模式
              </span>
            </label> */}
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-white/10 rounded-full transition-colors text-white/50 hover:text-white"
          >
            ✕
          </button>
        </div>

        <div className="flex border-b border-white/10 bg-white/5">
          <button
            onClick={() => setActiveTab("prizes")}
            className={`flex-1 py-4 font-bold text-xs tracking-widest uppercase transition-all ${
              activeTab === "prizes"
                ? "text-red-500 border-b-2 border-red-500 bg-white/5"
                : "text-white/40 hover:text-white/60"
            }`}
          >
            常规奖项
          </button>
          {isExtraModeEnabled && (
            <button
              onClick={() => setActiveTab("extra")}
              className={`flex-1 py-4 font-bold text-xs tracking-widest uppercase transition-all animate-in slide-in-from-top-2 duration-500 ${
                activeTab === "extra"
                  ? "text-amber-400 border-b-2 border-amber-400 bg-white/10"
                  : "text-white/40 hover:text-white/60"
              }`}
            >
              额外奖项 (秘密)
            </button>
          )}
          <button
            onClick={() => setActiveTab("participants")}
            className={`flex-1 py-4 font-bold text-xs tracking-widest uppercase transition-all ${
              activeTab === "participants"
                ? "text-red-500 border-b-2 border-red-500 bg-white/5"
                : "text-white/40 hover:text-white/60"
            }`}
          >
            人员管理
          </button>
          <button
            onClick={() => setActiveTab("background")}
            className={`flex-1 py-4 font-bold text-xs tracking-widest uppercase transition-all ${
              activeTab === "background"
                ? "text-red-500 border-b-2 border-red-500 bg-white/5"
                : "text-white/40 hover:text-white/60"
            }`}
          >
            全屏背景
          </button>
          <button
            onClick={() => setActiveTab("music")}
            className={`flex-1 py-4 font-bold text-xs tracking-widest uppercase transition-all ${
              activeTab === "music"
                ? "text-red-500 border-b-2 border-red-500 bg-white/5"
                : "text-white/40 hover:text-white/60"
            }`}
          >
            音乐
          </button>
        </div>
        {(activeTab === "prizes" || activeTab === "extra") && (
          <div className="px-6 py-3 mb-1 flex justify-between items-center flex-wrap gap-2 bg-[#111] border-b border-white/10">
            <p className="text-sm text-white/40 italic flex-1 min-w-0">
              {activeTab === "extra"
                ? "配置秘密额外奖项。启用后，所有参与者将重新归队，不影响常规中奖记录。"
                : "常规流程中的奖项。更改奖项或人员名单将强制重置进度以确保公平。"}
            </p>
            {activeTab === "prizes" && (
              <span className="text-sm font-bold text-red-400/90 whitespace-nowrap">
                奖品总数量：{prizes.reduce((sum, p) => sum + p.count, 0)}
              </span>
            )}
            <button
              onClick={() => addPrize(activeTab === "extra")}
              className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all border shadow-sm ${
                activeTab === "extra"
                  ? "bg-amber-500/10 text-amber-400 border-amber-500/30 hover:bg-amber-500/20"
                  : "bg-red-500/10 text-red-500 border-red-500/30 hover:bg-red-500/20"
              }`}
            >
              + 添加奖项
            </button>
          </div>
        )}

        <div className="flex-1 p-6 overflow-y-auto max-h-[60vh] custom-scrollbar">
          {(activeTab === "prizes" || activeTab === "extra") && (
            <div className="space-y-4">
              {uploading && <p className="text-xs text-amber-400">上传中…</p>}
              {uploadError && (
                <p className="text-xs text-red-400 bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2">
                  {uploadError}
                </p>
              )}
              {(activeTab === "extra" ? extraPrizes : prizes).map(
                (prize, index) => (
                  <div
                    key={prize.id}
                    className={`bg-white/5 p-4 rounded-xl border space-y-3 relative group transition-all duration-300 ${
                      activeTab === "extra"
                        ? "border-amber-500/20 hover:border-amber-500/40"
                        : "border-white/10 hover:border-white/20"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex flex-col gap-1">
                        <button
                          onClick={() =>
                            movePrize(index, "up", activeTab === "extra")
                          }
                          disabled={index === 0}
                          className="text-white/20 hover:text-red-500 disabled:opacity-0 px-2"
                        >
                          ▲
                        </button>
                        <button
                          onClick={() =>
                            movePrize(index, "down", activeTab === "extra")
                          }
                          disabled={
                            index ===
                            (activeTab === "extra" ? extraPrizes : prizes)
                              .length -
                              1
                          }
                          className="text-white/20 hover:text-red-500 disabled:opacity-0 px-2"
                        >
                          ▼
                        </button>
                      </div>
                      <div className="relative w-12 h-12 rounded-lg bg-black border border-white/10 overflow-hidden flex-shrink-0">
                        <img
                          src={prize.image || DEFAULT_PRIZE_IMAGE}
                          className="w-full h-full object-cover"
                          alt="prize"
                        />
                      </div>
                      <div className="flex-1">
                        <input
                          type="text"
                          placeholder="奖项名称"
                          value={prize.name}
                          onChange={(e) =>
                            handlePrizeChange(
                              prize.id,
                              "name",
                              e.target.value,
                              activeTab === "extra",
                            )
                          }
                          className={`w-full bg-black/40 border border-white/10 rounded-lg px-3 py-1.5 text-sm outline-none transition-all ${
                            activeTab === "extra"
                              ? "focus:border-amber-500 focus:bg-amber-500/5"
                              : "focus:border-red-500 focus:bg-red-500/5"
                          }`}
                        />
                      </div>
                      <button
                        onClick={() =>
                          deletePrize(prize.id, activeTab === "extra")
                        }
                        className="p-2 text-white/30 hover:text-red-500 transition-colors"
                      >
                        🗑️
                      </button>
                    </div>
                    <div className="grid grid-cols-2 gap-4 ml-10">
                      <div className="space-y-1">
                        <label className="text-[10px] text-white/40 uppercase font-black px-1">
                          总数量
                        </label>
                        <input
                          type="number"
                          min="1"
                          value={prize.count}
                          onChange={(e) =>
                            handlePrizeChange(
                              prize.id,
                              "count",
                              Math.max(1, parseInt(e.target.value) || 1),
                              activeTab === "extra",
                            )
                          }
                          className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-1.5 text-sm outline-none focus:border-white/30"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] text-white/40 uppercase font-black px-1">
                          奖项图片
                        </label>
                        <div className="flex gap-2 flex-wrap items-center">
                          <input
                            type="file"
                            accept={ACCEPT_IMAGE_TYPES}
                            className="hidden"
                            id={`upload-${prize.id}`}
                            onChange={(e) =>
                              handleImageUpload(
                                prize.id,
                                activeTab === "extra",
                                e,
                              )
                            }
                          />
                          <label
                            htmlFor={`upload-${prize.id}`}
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold cursor-pointer transition-all border ${
                              activeTab === "extra"
                                ? "bg-amber-500/10 text-amber-400 border-amber-500/30 hover:bg-amber-500/20"
                                : "bg-red-500/10 text-red-500 border-red-500/30 hover:bg-red-500/20"
                            }`}
                          >
                            本地上传
                          </label>
                          <span className="text-[10px] text-white/30">
                            ≤5MB，JPG/PNG
                          </span>
                        </div>
                        <input
                          type="text"
                          placeholder="或填写图片链接（留空使用默认随机图）"
                          value={
                            typeof prize.image === "string" &&
                            !prize.image.startsWith("data:")
                              ? prize.image
                              : ""
                          }
                          onChange={(e) =>
                            handlePrizeChange(
                              prize.id,
                              "image",
                              e.target.value,
                              activeTab === "extra",
                            )
                          }
                          className="w-full mt-1.5 bg-black/40 border border-white/10 rounded-lg px-3 py-1.5 text-sm outline-none focus:border-white/30"
                        />
                      </div>
                    </div>
                  </div>
                ),
              )}
            </div>
          )}
          {activeTab === "participants" && (
            <div className="h-full flex flex-col space-y-4">
              <div className="flex items-center justify-between">
                <label className="text-sm font-bold text-white/60 flex items-center gap-2">
                  👥 名单快速录入{" "}
                  <span className="text-[10px] text-white/30 font-normal">
                    (每行填入一个姓名，系统将自动匹配或生成)
                  </span>
                </label>
                <div className="px-4 py-2 bg-white/5 border border-white/10 rounded-lg">
                  <span className="text-sm font-bold text-white/80">
                    当前人数:{" "}
                  </span>
                  <span className="text-lg font-black text-red-500">
                    {
                      participantInput
                        .split("\n")
                        .filter((l) => l.trim() !== "").length
                    }
                  </span>
                </div>
              </div>
              <textarea
                value={participantInput}
                onChange={(e) => setParticipantInput(e.target.value)}
                className="flex-1 min-h-[300px] w-full bg-black/40 border border-white/10 rounded-xl p-4 text-sm font-mono focus:border-red-500 outline-none resize-none transition-all"
                placeholder="张三&#10;李四&#10;王五..."
              />
            </div>
          )}
          {activeTab === "background" && (
            <div className="space-y-4">
              <p className="text-sm text-white/40 italic">
                设置抽奖页全屏背景图，支持本地上传或填写图片链接。留空则使用默认背景。
              </p>
              {uploading && <p className="text-xs text-amber-400">上传中…</p>}
              {uploadError && (
                <p className="text-xs text-red-400 bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2">
                  {uploadError}
                </p>
              )}
              <div className="flex flex-col sm:flex-row gap-6">
                <div className="space-y-2">
                  <label className="text-[10px] text-white/40 uppercase font-black px-1">
                    预览
                  </label>
                  <div className="w-full max-w-[280px] aspect-video rounded-xl border border-white/10 overflow-hidden bg-black/40">
                    <img
                      src={backgroundImage || DEFAULT_BACKGROUND_URL}
                      alt="背景预览"
                      className="w-full h-full object-cover"
                    />
                  </div>
                </div>
                <div className="flex-1 space-y-4">
                  <div className="space-y-1">
                    <label className="text-[10px] text-white/40 uppercase font-black px-1">
                      本地上传
                    </label>
                    <div className="flex items-center gap-2">
                      <input
                        type="file"
                        accept="image/jpeg,image/png,image/webp,image/gif"
                        className="hidden"
                        id="upload-background"
                        onChange={handleBackgroundUpload}
                      />
                      <label
                        htmlFor="upload-background"
                        className="px-4 py-2 rounded-lg text-sm font-bold cursor-pointer transition-all border bg-red-500/10 text-red-500 border-red-500/30 hover:bg-red-500/20"
                      >
                        选择图片
                      </label>
                      <span className="text-[10px] text-white/30">
                        不限制大小，JPG/PNG/WebP/GIF
                      </span>
                    </div>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] text-white/40 uppercase font-black px-1">
                      或填写图片链接
                    </label>
                    <input
                      type="text"
                      placeholder="留空使用默认背景"
                      value={
                        typeof backgroundImage === "string" &&
                        !backgroundImage.startsWith("data:")
                          ? backgroundImage
                          : ""
                      }
                      onChange={(e) => setBackgroundImage(e.target.value)}
                      className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-sm outline-none focus:border-red-500"
                    />
                  </div>
                  {backgroundImage && (
                    <button
                      type="button"
                      onClick={() => setBackgroundImage("")}
                      className="text-xs text-white/50 hover:text-red-400 transition-colors"
                    >
                      清除背景图，恢复默认
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}
          {activeTab === "music" && (
            <div className="space-y-6">
              <p className="text-sm text-white/40 italic">
                上传 MP3
                作为背景音乐（导航栏可播放/暂停）。抽奖时自动降低背景音量并播放抽奖音乐，揭晓时播放音效后恢复。音频文件保存在浏览器
                IndexedDB，不占用 localStorage，支持较大文件。
              </p>
              {uploadError && (
                <p className="text-xs text-red-400 bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2">
                  {uploadError}
                </p>
              )}
              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-[10px] text-white/40 uppercase font-black px-1">
                    背景音乐 (MP3)
                  </label>
                  <div className="flex items-center gap-3 flex-wrap">
                    <input
                      type="file"
                      accept="audio/mpeg,audio/mp3,.mp3"
                      className="hidden"
                      id="upload-bg-music"
                      onChange={(e) =>
                        handleMusicUpload(
                          "backgroundMusic",
                          setBackgroundMusic,
                          e,
                        )
                      }
                    />
                    <label
                      htmlFor="upload-bg-music"
                      className="px-4 py-2 rounded-lg text-sm font-bold cursor-pointer border bg-red-500/10 text-red-500 border-red-500/30 hover:bg-red-500/20"
                    >
                      选择 MP3
                    </label>
                    {backgroundMusic ? (
                      <span className="text-xs text-green-400">已设置</span>
                    ) : (
                      <span className="text-xs text-white/40">未设置</span>
                    )}
                    {backgroundMusic && (
                      <button
                        type="button"
                        onClick={() => setBackgroundMusic("")}
                        className="text-xs text-white/50 hover:text-red-400"
                      >
                        清除
                      </button>
                    )}
                  </div>
                </div>
                {/* <div className="space-y-2">
                  <label className="text-[10px] text-white/40 uppercase font-black px-1">抽奖音乐 (MP3，可选)</label>
                  <p className="text-[10px] text-white/30">滚动抽奖时播放，抽奖时背景音乐会自动降低</p>
                  <div className="flex items-center gap-3 flex-wrap">
                    <input type="file" accept="audio/mpeg,audio/mp3,.mp3" className="hidden" id="upload-draw-music" onChange={(e) => handleMusicUpload('drawMusic', setDrawMusic, e)} />
                    <label htmlFor="upload-draw-music" className="px-4 py-2 rounded-lg text-sm font-bold cursor-pointer border bg-white/10 text-white/80 border-white/20 hover:bg-white/20">选择 MP3</label>
                    {drawMusic ? <span className="text-xs text-green-400">已设置</span> : <span className="text-xs text-amber-400/80">使用默认鼓点</span>}
                    {drawMusic && <button type="button" onClick={() => setDrawMusic('')} className="text-xs text-white/50 hover:text-red-400">清除</button>}
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] text-white/40 uppercase font-black px-1">揭晓音效 (MP3，可选)</label>
                  <p className="text-[10px] text-white/30">开奖揭晓时播放，播放后恢复背景音乐音量</p>
                  <div className="flex items-center gap-3 flex-wrap">
                    <input type="file" accept="audio/mpeg,audio/mp3,.mp3,audio/wav,audio/ogg" className="hidden" id="upload-winner-sound" onChange={(e) => handleMusicUpload('winnerSound', setWinnerSound, e)} />
                    <label htmlFor="upload-winner-sound" className="px-4 py-2 rounded-lg text-sm font-bold cursor-pointer border bg-white/10 text-white/80 border-white/20 hover:bg-white/20">选择音频</label>
                    {winnerSound ? <span className="text-xs text-green-400">已设置</span> : <span className="text-xs text-amber-400/80">使用默认揭晓音效</span>}
                    {winnerSound && <button type="button" onClick={() => setWinnerSound('')} className="text-xs text-white/50 hover:text-red-400">清除</button>}
                  </div>
                </div> */}
              </div>
            </div>
          )}
        </div>

        <div className="p-6 border-t border-white/10 bg-black/40 flex justify-between gap-4 items-center flex-wrap">
          <div className="flex items-center gap-4 flex-wrap">
            <p className="text-[10px] text-white/20 uppercase tracking-widest font-bold">
              {isExtraModeEnabled
                ? "✦ SECRET MODE ACTIVE ✦"
                : "REGULAR MODE ACTIVE"}
            </p>
            <p className="text-[10px] text-white/30">
              奖项配置保存在服务器，不同用户互不影响。
            </p>
            {onReset && (
              <button
                type="button"
                onClick={() => {
                  if (
                    window.confirm(
                      "确定要重置抽奖吗？将清空所有中奖记录，并恢复各奖项剩余数量与人员池。此操作不可撤销。",
                    )
                  ) {
                    onReset()
                  }
                }}
                className="px-4 py-2 rounded-xl text-white/60 hover:text-red-400 hover:bg-red-500/10 border border-white/10 hover:border-red-500/30 transition-colors text-sm font-bold"
              >
                重置抽奖
              </button>
            )}
            {onResetToDefault && (
              <button
                type="button"
                onClick={() => {
                  if (
                    window.confirm(
                      "确定恢复为默认配置吗？奖项与人员将恢复为系统默认，并清空所有中奖记录。此操作不可撤销。",
                    )
                  ) {
                    onResetToDefault()
                  }
                }}
                className="px-4 py-2 rounded-xl text-amber-400/80 hover:text-amber-300 hover:bg-amber-500/10 border border-amber-500/20 hover:border-amber-500/40 transition-colors text-sm font-bold"
              >
                恢复默认配置
              </button>
            )}
          </div>
          <div className="flex gap-4 items-center">
            <button
              onClick={onClose}
              className="px-6 py-2 rounded-xl text-white/60 hover:text-white transition-colors text-sm font-bold"
            >
              取消
            </button>
            <button
              onClick={handleSave}
              className={`px-8 py-3 font-black rounded-xl hover:scale-105 active:scale-95 transition-all shadow-xl text-xs uppercase tracking-[0.2em] ${
                isExtraModeEnabled
                  ? "bg-amber-600 text-white shadow-amber-600/20"
                  : "bg-red-500 text-white shadow-red-500/20"
              }`}
            >
              保存设置并返回
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default SetupModal
