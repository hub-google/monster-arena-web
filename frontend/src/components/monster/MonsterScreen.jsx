import React from 'react';
import { Activity, Droplet, Heart, Drumstick, Shield, Zap, Skull, Map, Cpu } from 'lucide-react';

const MonsterScreen = ({ monster, onExtractChip, onDispatch }) => {
  if (!monster) {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center animate-pulse">
         <div className="text-4xl mb-4 text-[#00ffcc] font-mono text-shadow-neon">[ NO SIGNAL ]</div>
         <p className="text-[#00ffcc]/70 font-mono text-sm">Awaiting digital entity connection...</p>
      </div>
    );
  }

  // Calculate percentages for bars
  const fullnessPercent = Math.min(100, Math.max(0, monster.fullness || 0));
  const cleanlinessPercent = Math.min(100, Math.max(0, monster.cleanliness || 0));

  return (
    <div className="w-full h-full flex flex-col md:flex-row relative">
      {/* LEFT PANEL: Visuals & Core Status */}
      <div className="flex-1 flex flex-col p-4 border-b md:border-b-0 md:border-r border-[#00ffcc]/20 relative">
        <div className="flex justify-between items-start mb-2">
          <div>
            <h3 className="text-xl text-[#00ffcc] font-bold font-mono tracking-widest text-shadow-neon">
              {monster.custom_name || monster.name || 'UNKNOWN'}
            </h3>
            <p className="text-[#00ffcc]/80 text-xs font-mono mt-1">ID: {monster.monster_id?.substring(0, 8)} | GEN: {monster.generation || 1}</p>
          </div>
          <span className={`px-2 py-0.5 rounded text-[10px] font-bold font-mono border border-current ${
            monster.family === 1 ? 'bg-red-900/50 text-red-400' :
            monster.family === 2 ? 'bg-orange-900/50 text-orange-400' :
            monster.family === 3 ? 'bg-purple-900/50 text-purple-400' :
            monster.family === 4 ? 'bg-slate-700/50 text-slate-300' :
            monster.family === 5 ? 'bg-green-900/50 text-green-400' :
            monster.family === 6 ? 'bg-blue-900/50 text-blue-400' :
            monster.family === 7 ? 'bg-yellow-900/50 text-yellow-400' :
            'bg-fuchsia-900/50 text-fuchsia-400'
          }`}>
            FAMILY {monster.family}
          </span>
        </div>

        {/* Center Sprite Area */}
        <div className="flex-1 flex items-center justify-center my-2 relative">
          <div className="absolute inset-0 bg-[#00ffcc]/5 rounded-lg border border-[#00ffcc]/10" />
          
          <div className={`relative z-10 p-8 ${monster.is_dead ? 'opacity-30 grayscale' : 'animate-bounce'}`} style={{ animationDuration: '2s' }}>
            <div className={`w-24 h-24 ${monster.is_dead ? 'bg-slate-700' : 'bg-[#00ffcc] shadow-[0_0_30px_rgba(0,255,204,0.4)]'} rounded-lg relative flex items-center justify-center`}>
               {monster.is_dead ? (
                 <Skull size={48} className="text-slate-900" />
               ) : (
                 <div className="flex gap-4">
                   <div className="w-4 h-4 bg-[#0a192f] rounded-full animate-blink" />
                   <div className="w-4 h-4 bg-[#0a192f] rounded-full animate-blink" />
                 </div>
               )}
               {monster.is_sick && !monster.is_dead && (
                 <div className="absolute -top-4 -right-4 w-8 h-8 bg-red-500/80 rounded-full animate-ping flex items-center justify-center font-bold text-white text-xs">!</div>
               )}
            </div>
          </div>
        </div>

        {/* Vitals */}
        <div className="space-y-3 mt-auto">
          <div>
            <div className="flex justify-between text-xs font-mono text-[#00ffcc] mb-1">
              <span className="flex items-center gap-1"><Drumstick size={12}/> FULLNESS</span>
              <span>{Math.round(fullnessPercent)}%</span>
            </div>
            <div className="h-2 bg-[#00ffcc]/20 rounded-full overflow-hidden border border-[#00ffcc]/30">
              <div className={`h-full ${fullnessPercent < 30 ? 'bg-red-500' : 'bg-[#00ffcc]'}`} style={{ width: `${fullnessPercent}%` }} />
            </div>
          </div>
          <div>
            <div className="flex justify-between text-xs font-mono text-[#00ffcc] mb-1">
              <span className="flex items-center gap-1"><Droplet size={12}/> CLEANLINESS</span>
              <span>{Math.round(cleanlinessPercent)}%</span>
            </div>
            <div className="h-2 bg-[#00ffcc]/20 rounded-full overflow-hidden border border-[#00ffcc]/30">
              <div className={`h-full ${cleanlinessPercent < 30 ? 'bg-yellow-500' : 'bg-blue-400'}`} style={{ width: `${cleanlinessPercent}%` }} />
            </div>
          </div>
        </div>
      </div>

      {/* RIGHT PANEL: Stats, Traits, and Actions */}
      <div className="w-full md:w-64 flex flex-col p-4 bg-[#0a192f]/50">
        <h4 className="text-[#00ffcc] font-mono text-xs mb-2 border-b border-[#00ffcc]/20 pb-1">COMBAT ATTRIBUTES</h4>
        <div className="grid grid-cols-2 gap-2 text-[#00ffcc] font-mono text-xs mb-4">
          <div className="flex justify-between bg-[#00ffcc]/5 p-1 rounded">
            <span className="opacity-60 flex items-center gap-1"><Heart size={10}/> HP</span>
            <span className="font-bold">{Math.round(monster.combat_hp || 0)}</span>
          </div>
          <div className="flex justify-between bg-[#00ffcc]/5 p-1 rounded">
            <span className="opacity-60 flex items-center gap-1"><Zap size={10}/> ATK</span>
            <span className="font-bold">{Math.round(monster.combat_atk || 0)}</span>
          </div>
          <div className="flex justify-between bg-[#00ffcc]/5 p-1 rounded">
            <span className="opacity-60 flex items-center gap-1"><Shield size={10}/> DEF</span>
            <span className="font-bold">{Math.round(monster.combat_def || 0)}</span>
          </div>
          <div className="flex justify-between bg-[#00ffcc]/5 p-1 rounded">
            <span className="opacity-60 flex items-center gap-1"><Activity size={10}/> SPD</span>
            <span className="font-bold">{Math.round(monster.combat_spd || 0)}</span>
          </div>
          <div className="col-span-2 flex justify-between bg-purple-900/30 p-1 rounded text-purple-300">
            <span className="opacity-80">GENETIC IV</span>
            <span className="font-bold">+{((monster.iv || 0) * 100).toFixed(1)}%</span>
          </div>
        </div>

        <h4 className="text-[#00ffcc] font-mono text-xs mb-2 border-b border-[#00ffcc]/20 pb-1">PASSIVE TRAITS</h4>
        <div className="flex flex-wrap gap-1 mb-6">
          {monster.traits && monster.traits.length > 0 ? (
            monster.traits.map((trait, idx) => (
              <span key={idx} className="text-[10px] bg-indigo-900/50 text-indigo-300 border border-indigo-500/50 px-1.5 py-0.5 rounded font-mono">
                {trait}
              </span>
            ))
          ) : (
            <span className="text-xs text-slate-500 font-mono italic">None</span>
          )}
        </div>

        {/* Action Buttons */}
        <div className="mt-auto flex flex-col gap-2">
           <button 
             onClick={() => onDispatch(monster.monster_id)}
             disabled={monster.is_dead}
             className="w-full flex items-center justify-center gap-2 bg-slate-800 hover:bg-slate-700 text-blue-400 font-mono text-xs py-2 rounded border border-blue-900 transition-colors disabled:opacity-50"
           >
             <Map size={14} /> IDLE DISPATCH
           </button>
           <button 
             onClick={() => onExtractChip(monster.monster_id)}
             disabled={monster.is_dead || monster.is_locked}
             className="w-full flex items-center justify-center gap-2 bg-red-900/30 hover:bg-red-900/60 text-red-400 font-mono text-xs py-2 rounded border border-red-900 transition-colors disabled:opacity-50"
           >
             <Cpu size={14} /> EXTRACT CHIP
           </button>
        </div>
      </div>
    </div>
  );
};

export default MonsterScreen;
