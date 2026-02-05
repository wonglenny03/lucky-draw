
import React, { useState, useEffect } from 'react';
import { AppState, Participant, Prize } from '../types';

interface SetupModalProps {
  currentData: AppState;
  onSave: (prizes: Prize[], extraPrizes: Prize[], participants: Participant[], isExtraMode: boolean) => void;
  onClose: () => void;
}

const SetupModal: React.FC<SetupModalProps> = ({ currentData, onSave, onClose }) => {
  const [activeTab, setActiveTab] = useState<'prizes' | 'extra' | 'participants'>('prizes');
  
  const [prizes, setPrizes] = useState<Prize[]>([...currentData.prizes]);
  const [extraPrizes, setExtraPrizes] = useState<Prize[]>([...currentData.extraPrizes]);
  const [isExtraMode, setIsExtraMode] = useState(currentData.extraModeEnabled); // Map to enabled status for the toggle
  const [participantInput, setParticipantInput] = useState(
    currentData.allParticipants.map(p => p.name).join('\n')
  );

  useEffect(() => {
    if (!isExtraMode && activeTab === 'extra') {
      setActiveTab('prizes');
    }
  }, [isExtraMode, activeTab]);

  const handleToggleExtraMode = (checked: boolean) => {
    setIsExtraMode(checked);
    if (checked && extraPrizes.length === 0) {
      const defaultExtra: Prize = {
        id: `ep-${Date.now()}`,
        name: '神秘惊喜奖',
        rank: 1,
        count: 1,
        remaining: 1,
        image: 'https://picsum.photos/seed/mystery/400/400'
      };
      setExtraPrizes([defaultExtra]);
      setActiveTab('extra');
    }
  };

  const handlePrizeChange = (id: string, field: keyof Prize, value: string | number, isExtra: boolean) => {
    const setter = isExtra ? setExtraPrizes : setPrizes;
    setter(prev => prev.map(p => {
      if (p.id === id) {
        return { ...p, [field]: value };
      }
      return p;
    }));
  };

  const movePrize = (index: number, direction: 'up' | 'down', isExtra: boolean) => {
    const list = isExtra ? [...extraPrizes] : [...prizes];
    const setter = isExtra ? setExtraPrizes : setPrizes;
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= list.length) return;
    [list[index], list[targetIndex]] = [list[targetIndex], list[index]];
    setter(list.map((p, idx) => ({ ...p, rank: idx + 1 })));
  };

  const addPrize = (isExtra: boolean) => {
    const list = isExtra ? extraPrizes : prizes;
    const setter = isExtra ? setExtraPrizes : setPrizes;
    const newId = `p-${Date.now()}`;
    setter([...list, {
      id: newId,
      name: isExtra ? '神秘额外奖' : '新奖项',
      rank: list.length + 1,
      count: 1,
      remaining: 1,
      image: 'https://picsum.photos/seed/gift/400/400'
    }]);
  };

  const deletePrize = (id: string, isExtra: boolean) => {
    const list = isExtra ? extraPrizes : prizes;
    const setter = isExtra ? setExtraPrizes : setPrizes;
    if (!isExtra && list.length <= 1) {
      alert("常规奖项至少需要保留一个。");
      return;
    }
    setter(list.filter(p => p.id !== id));
  };

  const handleSave = () => {
    const lines = participantInput.split('\n').filter(l => l.trim() !== '');
    
    // Attempt to preserve old IDs and avatars to avoid triggering 'Reset' prompt in App.tsx
    const existingMap = new Map<string, Participant>();
    currentData.allParticipants.forEach(p => existingMap.set(p.name, p));

    const newParticipants: Participant[] = lines.map((name, idx) => {
      const trimmed = name.trim();
      const existing = existingMap.get(trimmed);
      if (existing) return existing;
      
      return {
        id: `p-${idx}-${Date.now()}`,
        name: trimmed,
        avatar: `https://picsum.photos/seed/p${idx}/100/100`
      };
    });

    onSave(prizes, extraPrizes, newParticipants, isExtraMode);
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-6">
      <div className="absolute inset-0 bg-black/80 backdrop-blur-md" onClick={onClose} />
      <div className={`relative w-full max-w-3xl bg-[#111] border rounded-3xl overflow-hidden flex flex-col animate-in zoom-in duration-300 shadow-2xl transition-colors duration-500 ${isExtraMode ? 'border-purple-500/40 shadow-purple-500/10' : 'border-white/10'}`}>
        <div className="p-6 border-b border-white/10 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <h2 className={`text-2xl font-bold font-orbitron transition-colors ${isExtraMode ? 'text-purple-400' : 'text-yellow-500'}`}>
              {isExtraMode ? '✨ 秘密设置' : '⚙️ 活动设置'}
            </h2>
            <div className="h-6 w-[1px] bg-white/10"></div>
            <label className="flex items-center gap-3 cursor-pointer group">
               <div className={`w-12 h-6 rounded-full relative transition-all duration-300 ${isExtraMode ? 'bg-purple-600 shadow-[0_0_15px_rgba(168,85,247,0.6)]' : 'bg-white/10'}`}>
                 <div className={`absolute top-1 w-4 h-4 rounded-full bg-white shadow-sm transition-all duration-300 ${isExtraMode ? 'left-7' : 'left-1'}`}></div>
               </div>
               <input type="checkbox" checked={isExtraMode} onChange={e => handleToggleExtraMode(e.target.checked)} className="hidden" />
               <span className={`text-[10px] font-black uppercase tracking-widest transition-colors ${isExtraMode ? 'text-purple-400' : 'text-white/30'}`}>
                 额外抽奖模式
               </span>
            </label>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-full transition-colors text-white/50 hover:text-white">✕</button>
        </div>

        <div className="flex border-b border-white/10 bg-white/5">
          <button onClick={() => setActiveTab('prizes')} className={`flex-1 py-4 font-bold text-xs tracking-widest uppercase transition-all ${activeTab === 'prizes' ? 'text-yellow-500 border-b-2 border-yellow-500 bg-white/5' : 'text-white/40 hover:text-white/60'}`}>常规奖项</button>
          {isExtraMode && <button onClick={() => setActiveTab('extra')} className={`flex-1 py-4 font-bold text-xs tracking-widest uppercase transition-all animate-in slide-in-from-top-2 duration-500 ${activeTab === 'extra' ? 'text-purple-400 border-b-2 border-purple-400 bg-white/10' : 'text-white/40 hover:text-white/60'}`}>额外奖项 (秘密)</button>}
          <button onClick={() => setActiveTab('participants')} className={`flex-1 py-4 font-bold text-xs tracking-widest uppercase transition-all ${activeTab === 'participants' ? 'text-yellow-500 border-b-2 border-yellow-500 bg-white/5' : 'text-white/40 hover:text-white/60'}`}>人员管理</button>
        </div>

        <div className="flex-1 p-6 overflow-y-auto max-h-[60vh] custom-scrollbar">
          {(activeTab === 'prizes' || activeTab === 'extra') && (
            <div className="space-y-4">
              <div className="flex justify-between items-center mb-2">
                <p className="text-sm text-white/40 italic">{activeTab === 'extra' ? '配置秘密额外奖项。启用后，所有参与者将重新归队，不影响常规中奖记录。' : '常规流程中的奖项。更改主奖项或人员名单将重置进度。'}</p>
                <button onClick={() => addPrize(activeTab === 'extra')} className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all border shadow-sm ${activeTab === 'extra' ? 'bg-purple-500/10 text-purple-400 border-purple-500/30 hover:bg-purple-500/20' : 'bg-yellow-500/10 text-yellow-500 border-yellow-500/30 hover:bg-yellow-500/20'}`}>+ 添加奖项</button>
              </div>
              {(activeTab === 'extra' ? extraPrizes : prizes).map((prize, index) => (
                <div key={prize.id} className={`bg-white/5 p-4 rounded-xl border space-y-3 relative group transition-all duration-300 ${activeTab === 'extra' ? 'border-purple-500/20 hover:border-purple-500/40' : 'border-white/10 hover:border-white/20'}`}>
                  <div className="flex items-center gap-3">
                    <div className="flex flex-col gap-1">
                      <button onClick={() => movePrize(index, 'up', activeTab === 'extra')} disabled={index === 0} className="text-white/20 hover:text-yellow-500 disabled:opacity-0">▲</button>
                      <button onClick={() => movePrize(index, 'down', activeTab === 'extra')} disabled={index === (activeTab === 'extra' ? extraPrizes : prizes).length - 1} className="text-white/20 hover:text-yellow-500 disabled:opacity-0">▼</button>
                    </div>
                    <div className="relative w-12 h-12 rounded-lg bg-black border border-white/10 overflow-hidden flex-shrink-0">
                      <img src={prize.image || 'https://picsum.photos/seed/gift/100/100'} className="w-full h-full object-cover" alt="prize" />
                    </div>
                    <div className="flex-1">
                      <input type="text" placeholder="奖项名称" value={prize.name} onChange={(e) => handlePrizeChange(prize.id, 'name', e.target.value, activeTab === 'extra')} className={`w-full bg-black/40 border border-white/10 rounded-lg px-3 py-1.5 text-sm outline-none transition-all ${activeTab === 'extra' ? 'focus:border-purple-500 focus:bg-purple-500/5' : 'focus:border-yellow-500 focus:bg-yellow-500/5'}`} />
                    </div>
                    <button onClick={() => deletePrize(prize.id, activeTab === 'extra')} className="p-2 text-white/30 hover:text-red-500 transition-colors">🗑️</button>
                  </div>
                  <div className="grid grid-cols-2 gap-4 ml-8">
                    <div className="space-y-1">
                      <label className="text-[10px] text-white/40 uppercase font-black px-1">数量</label>
                      <input type="number" min="1" value={prize.count} onChange={(e) => handlePrizeChange(prize.id, 'count', Math.max(1, parseInt(e.target.value) || 1), activeTab === 'extra')} className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-1.5 text-sm outline-none focus:border-white/30" />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] text-white/40 uppercase font-black px-1">图片 URL</label>
                      <input type="text" placeholder="https://..." value={prize.image || ''} onChange={(e) => handlePrizeChange(prize.id, 'image', e.target.value, activeTab === 'extra')} className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-1.5 text-sm outline-none focus:border-white/30" />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
          {activeTab === 'participants' && (
            <div className="h-full flex flex-col space-y-4">
              <label className="text-sm font-bold text-white/60 flex items-center gap-2">👥 导入名单 <span className="text-[10px] text-white/30 font-normal">(每行一个员工姓名)</span></label>
              <textarea value={participantInput} onChange={(e) => setParticipantInput(e.target.value)} className="flex-1 min-h-[300px] w-full bg-black/40 border border-white/10 rounded-xl p-4 text-sm font-mono focus:border-yellow-500 outline-none resize-none transition-all" placeholder="张三&#10;李四&#10;王五..." />
            </div>
          )}
        </div>

        <div className="p-6 border-t border-white/10 bg-black/40 flex justify-end gap-4 items-center">
           <p className="flex-1 text-[10px] text-white/20 uppercase tracking-widest font-bold">{isExtraMode ? '✦ SECRET MODE ACTIVE ✦' : 'REGULAR MODE ACTIVE'}</p>
           <button onClick={onClose} className="px-6 py-2 rounded-xl text-white/60 hover:text-white transition-colors text-sm font-bold">取消</button>
           <button onClick={handleSave} className={`px-8 py-3 font-black rounded-xl hover:scale-105 active:scale-95 transition-all shadow-xl text-xs uppercase tracking-[0.2em] ${isExtraMode ? 'bg-purple-600 text-white shadow-purple-600/20' : 'bg-yellow-500 text-black shadow-yellow-500/20'}`}>确认并开启{isExtraMode ? '神秘环节' : '常规环节'}</button>
        </div>
      </div>
    </div>
  );
};

export default SetupModal;
