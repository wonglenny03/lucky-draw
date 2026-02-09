import React from "react";
import * as XLSX from "xlsx";
import { Winner } from "../types";

interface WinnerListProps {
  winners: Winner[];
  onClose: () => void;
}

function exportToExcel(winners: Winner[]) {
  const rows = winners.map((w, idx) => ({
    序号: idx + 1,
    奖项: w.prize.name,
    中奖者: w.participant.name,
    抽奖时间: w.drawTime,
    类型: w.isExtra ? "额外抽奖" : "常规",
  }));
  const sheet = XLSX.utils.json_to_sheet(rows);
  const book = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(book, sheet, "获奖名单");
  const fileName = `获奖名单_${new Date().toISOString().slice(0, 10)}.xlsx`;
  XLSX.writeFile(book, fileName);
}

const WinnerList: React.FC<WinnerListProps> = ({ winners, onClose }) => {
  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div 
        className="absolute inset-0 bg-black/60 backdrop-blur-sm" 
        onClick={onClose}
      />
      <div className="relative w-full max-w-md h-full bg-[#111] border-l border-white/10 flex flex-col animate-in slide-in-from-right duration-300">
        <div className="p-6 border-b border-white/10 flex items-center justify-between">
          <h2 className="text-2xl font-bold font-orbitron text-amber-400">🏆 获奖记录</h2>
          <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-full">✕</button>
        </div>
        
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {winners.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center opacity-30 italic">
              暂无中奖记录
            </div>
          ) : (
            winners.map((winner, idx) => (
              <div 
                key={idx} 
                className={`bg-white/5 border p-4 rounded-xl flex items-center gap-4 group transition-colors ${winner.isExtra ? 'border-amber-500/30 hover:border-amber-500/60' : 'border-white/10 hover:border-amber-500/40'}`}
              >
                <div className="relative">
                  <img 
                    src={winner.participant.avatar} 
                    className="w-12 h-12 rounded-full border border-white/20" 
                    alt="avatar" 
                  />
                  {winner.isExtra && (
                    <div className="absolute -top-1 -right-1 w-4 h-4 bg-amber-500 rounded-full flex items-center justify-center text-[8px] font-bold">S</div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-bold truncate">{winner.participant.name}</span>
                    <span className="text-[10px] text-white/40">{winner.drawTime}</span>
                  </div>
                  <div className={`text-xs font-bold uppercase tracking-wider ${winner.isExtra ? 'text-amber-400' : 'text-amber-400/90'}`}>
                    {winner.prize.name}
                    {winner.isExtra && <span className="ml-2 text-[8px] px-1 bg-amber-500/20 rounded">EXTRA</span>}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
        
        <div className="p-6 border-t border-white/10 bg-black/40">
          <button
            onClick={() => {
              if (winners.length === 0) {
                alert("暂无中奖记录，无法导出");
                return;
              }
              exportToExcel(winners);
              alert("已导出为 Excel 文件");
            }}
            className="w-full py-3 bg-white/5 hover:bg-white/10 border border-white/20 rounded-xl transition-colors text-sm font-bold"
          >
            导出为 Excel
          </button>
        </div>
      </div>
    </div>
  );
};

export default WinnerList;
