import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import MonsterScreen from '../components/monster/MonsterScreen';
import { Loader2, Swords, Map, Grid, ShieldAlert } from 'lucide-react';
import toast from 'react-hot-toast';

const Dashboard = () => {
  const { user } = useAuth();
  const [monsters, setMonsters] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedMonster, setSelectedMonster] = useState(null);
  const [activeTab, setActiveTab] = useState('ROSTER'); // ROSTER, TEAM, DISPATCH
  
  // Local state for 3v3 team (in a real app, this might be saved to DB users table or a separate teams table)
  const [relayTeam, setRelayTeam] = useState([null, null, null]);

  useEffect(() => {
    if (user) {
      fetchMonsters();
    }
  }, [user]);

  const fetchMonsters = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('monsters')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: true });

      if (error) throw error;
      setMonsters(data || []);
      if (data && data.length > 0 && !selectedMonster) {
        setSelectedMonster(data[0]);
      }
    } catch (error) {
      console.error('Error fetching monsters:', error);
      toast.error('Failed to load roster');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateEgg = async () => {
    try {
      const toastId = toast.loading('Incubating new entity...');
      // Randomly assign 1-2 traits as per the requirements
      const possibleTraits = ['[大胃王]', '[夜貓子]', '[吸血]', '[厚皮]', '[狂暴]'];
      const traits = [possibleTraits[Math.floor(Math.random() * possibleTraits.length)]];
      if (Math.random() > 0.5) {
        traits.push(possibleTraits[Math.floor(Math.random() * possibleTraits.length)]);
      }

      const { data, error } = await supabase
        .from('monsters')
        .insert([
          {
            user_id: user.id,
            name: 'Digital Egg',
            family: Math.floor(Math.random() * 8) + 1, // Random family 1-8
            life_stage: 1, // Egg
            fullness: 100,
            cleanliness: 100,
            combat_hp: 100 + Math.floor(Math.random()*20),
            combat_atk: 10 + Math.floor(Math.random()*5),
            combat_def: 10 + Math.floor(Math.random()*5),
            combat_spd: 10 + Math.floor(Math.random()*5),
            iv: Math.floor(Math.random() * 30) / 100, // IV between 0% and 30%
            traits: [...new Set(traits)] // Unique traits
          }
        ])
        .select()
        .single();
        
      if (error) throw error;
      
      toast.success('Entity incubated successfully', { id: toastId });
      setMonsters([...monsters, data]);
      setSelectedMonster(data);
    } catch (error) {
      console.error('Error creating egg:', error);
      toast.error('Failed to incubate entity');
    }
  };

  const handleExtractChip = async (monsterId) => {
    if (!window.confirm("WARNING: Extracting a chip will permanently destroy this monster. Proceed?")) return;
    
    try {
      const toastId = toast.loading('Extracting genetic chip...');
      
      // Update monster to dead/extracted state, or delete it entirely
      const { error } = await supabase
        .from('monsters')
        .update({ is_dead: true, death_reason: 'Extracted for Chip' })
        .eq('monster_id', monsterId);

      if (error) throw error;
      
      // Remove from UI
      const updatedMonsters = monsters.filter(m => m.monster_id !== monsterId);
      setMonsters(updatedMonsters);
      if (selectedMonster?.monster_id === monsterId) {
        setSelectedMonster(updatedMonsters.length > 0 ? updatedMonsters[0] : null);
      }
      
      toast.success('Chip extracted successfully!', { id: toastId });
    } catch (err) {
      console.error('Error extracting chip:', err);
      toast.error('Extraction failed.');
    }
  };

  const assignToTeam = (slotIndex) => {
    if (!selectedMonster) return;
    if (relayTeam.some(m => m?.monster_id === selectedMonster.monster_id)) {
      toast.error("Monster is already in the relay team!");
      return;
    }
    const newTeam = [...relayTeam];
    newTeam[slotIndex] = selectedMonster;
    setRelayTeam(newTeam);
    toast.success(`${selectedMonster.name} assigned to Slot ${slotIndex + 1}`);
  };

  const handleDispatch = () => {
    if (!selectedMonster) return;
    toast.success(`${selectedMonster.name} dispatched for a 4-hour idle mission!`);
  };

  return (
    <div className="h-full flex flex-col">
      <div className="mb-6 flex flex-col md:flex-row md:justify-between md:items-end gap-4">
        <div>
          <h2 className="text-2xl font-bold text-white tracking-wide font-mono flex items-center gap-2">
             <span className="w-2 h-6 bg-[#00ffcc] block"></span>
             TAMER DASHBOARD
          </h2>
          <p className="text-slate-400 text-sm mt-1 ml-4">Manage your digital entities and operations</p>
        </div>
        <div className="flex flex-wrap gap-2">
           <button 
             onClick={() => toast('Raid Boss system coming soon!')}
             className="bg-red-900/30 border border-red-500/50 hover:bg-red-900/60 text-red-400 font-mono px-4 py-2 rounded-lg transition-all text-sm flex items-center gap-2"
           >
             <ShieldAlert size={16} /> RAID BOSS
           </button>
           <button 
             onClick={handleCreateEgg}
             disabled={monsters.length >= 50}
             className="bg-slate-800 hover:bg-[#00ffcc]/20 border border-[#00ffcc]/50 text-[#00ffcc] font-mono px-4 py-2 rounded-lg transition-all text-sm shadow-[0_0_10px_rgba(0,255,204,0.1)] hover:shadow-[0_0_15px_rgba(0,255,204,0.3)] flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
           >
             <span>+ INCUBATE NEW EGG</span>
           </button>
        </div>
      </div>
      
      <div className="flex-1 lcd-screen flex flex-col md:flex-row p-2 mb-6 min-h-[350px]">
         <MonsterScreen 
           monster={selectedMonster} 
           onExtractChip={handleExtractChip}
           onDispatch={handleDispatch}
         />
      </div>
      
      <div className="mt-auto">
        <div className="flex gap-4 border-b border-slate-700 mb-4">
          <button 
            onClick={() => setActiveTab('ROSTER')}
            className={`pb-2 font-mono text-sm flex items-center gap-2 ${activeTab === 'ROSTER' ? 'text-[#00ffcc] border-b-2 border-[#00ffcc]' : 'text-slate-400 hover:text-slate-300'}`}
          >
            <Grid size={16}/> ROSTER ({monsters.length}/50)
          </button>
          <button 
            onClick={() => setActiveTab('TEAM')}
            className={`pb-2 font-mono text-sm flex items-center gap-2 ${activeTab === 'TEAM' ? 'text-[#00ffcc] border-b-2 border-[#00ffcc]' : 'text-slate-400 hover:text-slate-300'}`}
          >
            <Swords size={16}/> 3v3 RELAY TEAM
          </button>
        </div>

        {loading ? (
          <div className="flex justify-center p-8">
            <Loader2 className="animate-spin text-[#00ffcc]" />
          </div>
        ) : activeTab === 'ROSTER' ? (
          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-3 max-h-48 overflow-y-auto pr-2 custom-scrollbar">
             {monsters.map((monster) => (
               <div 
                 key={monster.monster_id}
                 onClick={() => setSelectedMonster(monster)}
                 className={`bg-slate-800 border rounded-lg p-2 flex flex-col items-center justify-center h-24 cursor-pointer transition-all ${
                   selectedMonster?.monster_id === monster.monster_id 
                    ? 'border-[#00ffcc] shadow-[0_0_10px_rgba(0,255,204,0.3)] scale-105' 
                    : 'border-slate-700 hover:border-[#00ffcc]/50'
                 }`}
               >
                 <div className={`w-10 h-10 bg-slate-900 rounded mb-2 flex items-center justify-center border ${monster.is_dead ? 'border-red-500/50 grayscale' : 'border-slate-700'}`}>
                    <span className="text-xs text-[#00ffcc]">{monster.family}</span>
                 </div>
                 <span className="text-[10px] text-slate-300 font-mono truncate w-full text-center">
                   {monster.custom_name || monster.name || 'EGG'}
                 </span>
               </div>
             ))}
             {monsters.length < 50 && (
               <div onClick={handleCreateEgg} className="bg-slate-800/30 border border-slate-700 rounded-lg p-2 flex flex-col items-center justify-center h-24 opacity-50 border-dashed cursor-pointer hover:bg-slate-800 hover:opacity-100 transition-all hover:border-[#00ffcc]/50 hover:text-[#00ffcc]">
                 <span className="text-2xl mb-1">+</span>
                 <span className="text-[10px] font-mono">Empty Slot</span>
               </div>
             )}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
             {relayTeam.map((m, idx) => (
               <div key={idx} className="bg-slate-800/50 border border-slate-700 rounded-lg p-4 flex flex-col items-center">
                 <div className="text-[#00ffcc] font-mono text-sm mb-2 border-b border-slate-700 w-full text-center pb-1">SLOT {idx + 1}</div>
                 {m ? (
                   <>
                     <div className="w-16 h-16 bg-slate-900 border border-[#00ffcc]/50 rounded mb-3 flex items-center justify-center text-[#00ffcc] shadow-[0_0_10px_rgba(0,255,204,0.2)]">
                       F{m.family}
                     </div>
                     <span className="text-sm font-bold text-white mb-1">{m.custom_name || m.name}</span>
                     <button onClick={() => {
                        const newTeam = [...relayTeam];
                        newTeam[idx] = null;
                        setRelayTeam(newTeam);
                     }} className="text-xs text-red-400 mt-2 hover:underline">REMOVE</button>
                   </>
                 ) : (
                   <>
                     <div className="w-16 h-16 bg-slate-900/50 border border-slate-700 border-dashed rounded mb-3 flex items-center justify-center opacity-50">
                       ?
                     </div>
                     <button onClick={() => assignToTeam(idx)} className="text-xs bg-slate-700 hover:bg-slate-600 px-3 py-1 rounded text-white transition-colors">
                       ASSIGN SELECTED
                     </button>
                   </>
                 )}
               </div>
             ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default Dashboard;
