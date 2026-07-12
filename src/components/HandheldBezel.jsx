import React from 'react';

/**
 * HandheldBezel renders a retro handheld virtual game console shell.
 * It encapsulates the LCD screen area and gives a premium tactile design aesthetic.
 * 
 * @param {object} props
 * @param {React.ReactNode} props.children - The screen content.
 * @param {boolean} props.isConnected - Whether the websocket connection is active.
 * @param {string} props.statusText - Subtitle or state shown on the bezel header.
 */
export default function HandheldBezel({ children, isConnected = false, statusText = 'READY' }) {
  return (
    <div className="flex flex-col items-center justify-center p-6 min-h-screen bg-gray-900 select-none">
      {/* Outer handheld console frame */}
      <div className="relative w-full max-w-md bg-bezel-dark rounded-3xl p-6 shadow-2xl border-4 border-gray-700 flex flex-col items-center overflow-hidden">
        
        {/* Casing accents / stripe */}
        <div className="absolute top-0 left-0 right-0 h-4 bg-gradient-to-r from-red-600 via-orange-500 to-yellow-500 opacity-60"></div>
        
        {/* Header Console Logo / Brand */}
        <div className="w-full flex items-center justify-between mt-2 mb-3 px-2">
          <span className="font-pressstart text-[10px] text-gray-400 tracking-widest font-bold">MONSTER ARENA</span>
          <div className="flex items-center gap-1.5">
            {/* LED Status Light */}
            <div className={`w-3 h-3 rounded-full border border-black shadow-inner transition-colors duration-300 ${
              isConnected 
                ? 'bg-red-600 animate-pulse shadow-red-500' 
                : 'bg-gray-800'
            }`}></div>
            <span className="font-pressstart text-[6px] text-gray-500">{isConnected ? 'ONLINE' : 'OFFLINE'}</span>
          </div>
        </div>

        {/* Screen bezel frame (dark gray plastic border around LCD screen) */}
        <div className="w-full bg-gray-800 border-4 border-gray-900 rounded-lg p-4 shadow-inner flex flex-col items-center">
          <div className="w-full flex justify-between px-1 mb-1.5 font-pressstart text-[6px] text-gray-500 tracking-wider">
            <span>DOT-MATRIX WITH STERO SOUND</span>
            <span>BATTERY</span>
          </div>

          {/* Actual LCD screen area */}
          <div className="w-full h-80 rounded border-2 border-lcd-border lcd-screen text-lcd-dark relative p-3 text-[10px] leading-relaxed flex flex-col justify-between select-text">
            {children}
          </div>
        </div>

        {/* Brand Text below screen */}
        <div className="my-3 font-pressstart text-gray-300 text-[10px] italic font-semibold">
          Web Version 1.0
        </div>

        {/* Console Controls Area */}
        <div className="w-full mt-2 flex justify-between items-center px-4 relative">
          
          {/* D-Pad (Directional Pad) */}
          <div className="relative w-28 h-28 flex items-center justify-center">
            {/* Horizontal Bar */}
            <div className="absolute w-24 h-8 bg-bezel-button rounded-sm border-b-4 border-gray-900 shadow-md"></div>
            {/* Vertical Bar */}
            <div className="absolute w-8 h-24 bg-bezel-button rounded-sm border-r-4 border-gray-900 shadow-md"></div>
            {/* Center Cap */}
            <div className="absolute w-8 h-8 bg-gray-800 rounded-full shadow-inner flex items-center justify-center">
              <div className="w-3 h-3 bg-gray-700 rounded-full"></div>
            </div>
            {/* Arrows (decorative icons) */}
            <div className="absolute top-1 font-pressstart text-[8px] text-gray-400">▲</div>
            <div className="absolute bottom-1 font-pressstart text-[8px] text-gray-400">▼</div>
            <div className="absolute left-1.5 font-pressstart text-[8px] text-gray-400">◀</div>
            <div className="absolute right-1.5 font-pressstart text-[8px] text-gray-400">▶</div>
          </div>

          {/* Action Buttons A & B (GameBoy style tilted layout) */}
          <div className="flex gap-4 transform rotate-12 mt-4 select-none">
            {/* B Button */}
            <div className="flex flex-col items-center gap-1">
              <button 
                type="button" 
                className="w-12 h-12 bg-bezel-action rounded-full border-b-4 border-red-950 active:border-b-0 active:translate-y-1 shadow-lg flex items-center justify-center font-pressstart text-xs text-white select-none focus:outline-none"
              >
                B
              </button>
            </div>
            {/* A Button */}
            <div className="flex flex-col items-center gap-1">
              <button 
                type="button" 
                className="w-12 h-12 bg-bezel-action rounded-full border-b-4 border-red-950 active:border-b-0 active:translate-y-1 shadow-lg flex items-center justify-center font-pressstart text-xs text-white select-none focus:outline-none"
              >
                A
              </button>
            </div>
          </div>

        </div>

        {/* SELECT & START utility buttons */}
        <div className="flex justify-center gap-6 mt-4 w-full">
          <div className="flex flex-col items-center">
            <div className="w-12 h-3 bg-gray-600 rounded-full transform -rotate-12 border-b-2 border-gray-800 active:translate-y-0.5 shadow cursor-pointer"></div>
            <span className="font-pressstart text-[6px] text-gray-400 mt-1.5">SELECT</span>
          </div>
          <div className="flex flex-col items-center">
            <div className="w-12 h-3 bg-gray-600 rounded-full transform -rotate-12 border-b-2 border-gray-800 active:translate-y-0.5 shadow cursor-pointer"></div>
            <span className="font-pressstart text-[6px] text-gray-400 mt-1.5">START</span>
          </div>
        </div>

        {/* Retro Speaker Grill cuts in bottom right */}
        <div className="absolute bottom-6 right-6 flex flex-col gap-1 transform rotate-45 select-none opacity-40">
          <div className="w-16 h-1 bg-gray-900 rounded-full"></div>
          <div className="w-16 h-1 bg-gray-900 rounded-full"></div>
          <div className="w-16 h-1 bg-gray-900 rounded-full"></div>
          <div className="w-16 h-1 bg-gray-900 rounded-full"></div>
        </div>

      </div>
    </div>
  );
}
