import React, { useEffect, useRef, useState } from 'react';
import { StyleConfig, OutputFormat, SubtitleChunk } from '../types';

interface EditorPanelProps {
  videoFile: File | null;
  onFileSelect: (file: File) => void; // Changed to direct File object
  onAiClick: () => void;
  aiStatus: string;
  isProcessingAi: boolean;
  subtitles: SubtitleChunk[];
  onUpdateSubtitle: (id: string, newText: string) => void;
  activeSubtitleId: string | null;
  onSubtitleSelect: (time: number) => void;
  cropValue: number;
  onCropChange: (val: number) => void;
  showCrop: boolean;
  styleConfig: StyleConfig;
  onStyleChange: (newStyle: Partial<StyleConfig>) => void;
  onRender: () => void;
  isRendering: boolean;
  outputFormat: OutputFormat;
  onOutputFormatChange: (fmt: OutputFormat) => void;
  onDownloadSrt: () => void;
}

const EditorPanel: React.FC<EditorPanelProps> = React.memo(({
  videoFile,
  onFileSelect,
  onAiClick,
  aiStatus,
  isProcessingAi,
  subtitles,
  onUpdateSubtitle,
  activeSubtitleId,
  onSubtitleSelect,
  cropValue,
  onCropChange,
  showCrop,
  styleConfig,
  onStyleChange,
  onRender,
  isRendering,
  outputFormat,
  onOutputFormatChange,
  onDownloadSrt
}) => {
  const itemRefs = useRef<{ [key: string]: HTMLDivElement | null }>({});
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  // Auto-scroll to active subtitle
  useEffect(() => {
    if (activeSubtitleId && itemRefs.current[activeSubtitleId]) {
      itemRefs.current[activeSubtitleId]?.scrollIntoView({
        behavior: 'smooth',
        block: 'center'
      });
    }
  }, [activeSubtitleId]);

  // --- Drag & Drop Handlers ---
  const handleDragOver = (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(true);
  };
  
  const handleDragLeave = (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
  };
  
  const handleDrop = (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
          const file = e.dataTransfer.files[0];
          if (file.type.startsWith('video/')) {
              onFileSelect(file);
          } else {
              alert("Lütfen bir video dosyası yükleyin.");
          }
      }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files && e.target.files[0]) {
          onFileSelect(e.target.files[0]);
      }
  };

  return (
    <div className="h-full flex flex-col gap-3 p-4 bg-slate-900/80 backdrop-blur-xl border border-white/10 rounded-3xl shadow-2xl overflow-hidden relative">
      
      {/* 1. Upload & Format (Fixed Top) */}
      <div className="space-y-3 shrink-0">
        <div className="space-y-1">
            <label className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">1. Video Kaynağı</label>
            
            {/* DRAG & DROP AREA */}
            <div 
                onClick={() => fileInputRef.current?.click()}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                className={`relative group w-full h-16 rounded-xl border-2 border-dashed transition-all cursor-pointer flex flex-col items-center justify-center gap-1
                ${isDragging 
                    ? 'border-indigo-500 bg-indigo-500/10' 
                    : 'border-slate-700 bg-slate-800/30 hover:border-indigo-400 hover:bg-slate-800/50'}`}
            >
                <input 
                    ref={fileInputRef}
                    type="file" 
                    accept="video/*" 
                    onChange={handleFileInputChange}
                    className="hidden"
                />
                {videoFile ? (
                     <div className="flex items-center gap-2 text-emerald-400 px-2">
                        <i className="fa-solid fa-circle-check text-sm"></i>
                        <span className="text-[10px] font-medium truncate max-w-[200px]">{videoFile.name}</span>
                     </div>
                ) : (
                    <>
                        <i className={`fa-solid fa-cloud-arrow-up text-lg ${isDragging ? 'text-indigo-400' : 'text-slate-500 group-hover:text-indigo-400'}`}></i>
                        <span className="text-[9px] text-slate-400 font-medium">Video Seç veya Sürükle</span>
                    </>
                )}
            </div>
        </div>

        <div className="space-y-1">
            <label className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Çıktı Formatı</label>
            <div className="grid grid-cols-2 gap-2">
                <button
                    onClick={() => onOutputFormatChange('vertical')}
                    className={`flex items-center justify-center gap-2 py-2 rounded-lg text-[10px] font-bold transition-all ${outputFormat === 'vertical' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/30' : 'bg-slate-800 text-slate-400 hover:bg-slate-700'}`}
                >
                    <i className="fa-solid fa-mobile-screen"></i> Dikey (9:16)
                </button>
                <button
                    onClick={() => onOutputFormatChange('horizontal')}
                    className={`flex items-center justify-center gap-2 py-2 rounded-lg text-[10px] font-bold transition-all ${outputFormat === 'horizontal' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/30' : 'bg-slate-800 text-slate-400 hover:bg-slate-700'}`}
                >
                    <i className="fa-solid fa-desktop"></i> Yatay (16:9)
                </button>
            </div>
        </div>
      </div>

      {/* 2. Crop (Conditional) (Fixed Top) */}
      {showCrop && outputFormat === 'vertical' && (
        <div className="space-y-1 shrink-0 bg-slate-800/30 p-2 rounded-lg border border-white/5">
          <div className="flex justify-between items-center mb-1">
            <label className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">2. Kadraj Ayarı</label>
            <span className="text-[9px] text-indigo-400">{cropValue}%</span>
          </div>
          <input 
            type="range" 
            min="0" 
            max="100" 
            value={cropValue} 
            onChange={(e) => onCropChange(Number(e.target.value))}
            className="w-full h-1.5 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-indigo-500"
          />
        </div>
      )}

      {/* 3. AI Subtitles (FLEXIBLE MIDDLE AREA) */}
      <div className="flex-1 flex flex-col min-h-0 border-t border-b border-white/5 py-3 gap-2 overflow-hidden relative">
        
        {/* Subtitle Header (Static) */}
        <div className="flex justify-between items-center shrink-0">
            <label className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">3. AI Altyazı</label>
            {subtitles.length > 0 && (
                <button 
                    onClick={onDownloadSrt}
                    className="text-[9px] bg-slate-800 hover:bg-emerald-600 text-emerald-400 hover:text-white px-2.5 py-1 rounded transition-colors flex items-center gap-1.5 font-medium"
                >
                    <i className="fa-solid fa-download"></i> SRT İndir
                </button>
            )}
        </div>
        
        <button 
          onClick={onAiClick}
          disabled={!videoFile || isProcessingAi}
          className={`w-full py-2.5 px-3 rounded-xl font-bold text-xs text-white flex items-center justify-center gap-2 transition-all shrink-0
            ${!videoFile ? 'bg-slate-700 cursor-not-allowed opacity-50' : 
              isProcessingAi ? 'bg-slate-700 cursor-wait' : 'bg-gradient-to-r from-indigo-600 to-purple-600 hover:shadow-lg hover:shadow-indigo-500/30 active:scale-95'}`}
        >
          {isProcessingAi ? (
             <><i className="fas fa-circle-notch fa-spin"></i> İşleniyor...</>
          ) : (
             <><i className="fa-solid fa-wand-magic-sparkles"></i> Sesi Analiz Et</>
          )}
        </button>
        
        {aiStatus && (
          <div className={`text-[9px] font-mono p-2 rounded-lg bg-slate-800/50 border border-white/5 shrink-0 ${aiStatus.includes('Hata') ? 'text-red-400' : 'text-emerald-400'}`}>
            {aiStatus}
          </div>
        )}

        {/* SCROLLABLE AREA CONTAINER */}
        <div className="relative flex-1 w-full min-h-0 bg-slate-950/30 border border-white/5 rounded-xl overflow-hidden">
            <div className="absolute inset-0 overflow-y-auto custom-scroll p-2 space-y-2">
                {subtitles.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-slate-600 text-[10px] text-center p-4">
                        <i className="fa-regular fa-comment-dots text-2xl mb-3 opacity-30"></i>
                        <p>Henüz altyazı yok.<br/>Videoyu seçip sesi analiz edin.</p>
                    </div>
                ) : (
                    subtitles.map((sub) => (
                        <div 
                            key={sub.id} 
                            ref={(el) => { if(el) itemRefs.current[sub.id] = el; }}
                            onClick={() => onSubtitleSelect(sub.start)}
                            className={`p-3 rounded-lg border transition-all cursor-pointer group relative
                                ${activeSubtitleId === sub.id 
                                    ? 'bg-indigo-900/30 border-indigo-500/50 ring-1 ring-indigo-500/30' 
                                    : 'bg-slate-900/40 border-slate-800 hover:border-slate-600'}`}
                        >
                            <div className="flex justify-between text-[9px] text-slate-500 mb-1.5 font-mono">
                                <span className="bg-slate-950 px-1.5 py-0.5 rounded text-slate-400">{sub.start.toFixed(1)}s</span>
                                <span className="opacity-0 group-hover:opacity-100 transition-opacity text-indigo-400">
                                    <i className="fa-solid fa-pen"></i> Düzenle
                                </span>
                            </div>
                            <textarea 
                                value={sub.text}
                                onChange={(e) => onUpdateSubtitle(sub.id, e.target.value)}
                                className="w-full bg-transparent text-xs text-slate-200 focus:outline-none resize-none font-medium leading-relaxed"
                                rows={Math.max(1, Math.ceil(sub.text.length / 25))}
                            />
                        </div>
                    ))
                )}
            </div>
        </div>
      </div>

      {/* 4. Styles & Render (Fixed Bottom) */}
      <div className="space-y-3 shrink-0">
        <label className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">4. Görünüm & Stil</label>
        
        {/* Font & Size */}
        <div className="grid grid-cols-2 gap-3">
           <div>
             <label className="text-[9px] text-slate-500 block mb-1">Font Ailesi</label>
             <select 
                value={styleConfig.fontFamily}
                onChange={(e) => onStyleChange({ fontFamily: e.target.value })}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-2 py-1.5 text-[10px] text-white focus:outline-none focus:border-indigo-500"
             >
               <option value="Montserrat">Montserrat</option>
               <option value="Inter">Inter</option>
               <option value="Oswald">Oswald</option>
               <option value="Arial">Arial</option>
             </select>
           </div>
           <div>
             <label className="text-[9px] text-slate-500 block mb-1">Yazı Boyutu</label>
             <input 
               type="range" min="20" max="120" 
               value={styleConfig.fontSize}
               onChange={(e) => onStyleChange({ fontSize: Number(e.target.value) })}
               className="w-full h-1.5 bg-slate-700 rounded-lg accent-indigo-500 mt-2"
             />
           </div>
        </div>

        {/* Colors */}
        <div className="grid grid-cols-2 gap-3">
          <div>
             <label className="text-[9px] text-slate-500 block mb-1">Metin Rengi</label>
             <div className="flex items-center bg-slate-800 rounded-lg px-2 py-1.5 border border-slate-700">
                 <input 
                     type="color" 
                     value={styleConfig.colorText}
                     onChange={(e) => onStyleChange({ colorText: e.target.value })}
                     className="w-5 h-5 bg-transparent border-none cursor-pointer rounded"
                 />
                 <span className="text-[10px] ml-2 text-slate-300 uppercase">{styleConfig.colorText}</span>
             </div>
          </div>
          <div>
             <label className="text-[9px] text-slate-500 block mb-1">Arka Renk</label>
             <div className="flex items-center bg-slate-800 rounded-lg px-2 py-1.5 border border-slate-700">
                 <input 
                     type="color" 
                     value={styleConfig.colorBg}
                     onChange={(e) => onStyleChange({ colorBg: e.target.value })}
                     className="w-5 h-5 bg-transparent border-none cursor-pointer rounded"
                 />
                 <span className="text-[10px] ml-2 text-slate-300 uppercase">{styleConfig.colorBg}</span>
             </div>
          </div>
        </div>

        {/* Position & Opacity (Separated & Cleaned) */}
        <div className="bg-slate-800/30 p-2.5 rounded-xl border border-white/5 space-y-3">
            {/* Position */}
            <div>
                <div className="flex justify-between items-center mb-1">
                    <span className="text-[9px] text-slate-400 font-semibold">Dikey Konum (Y)</span>
                    <span className="text-[9px] text-rose-400">{styleConfig.positionY}%</span>
                </div>
                <input 
                    type="range" min="10" max="90" 
                    value={styleConfig.positionY}
                    onChange={(e) => onStyleChange({ positionY: Number(e.target.value) })}
                    className="w-full h-1.5 bg-slate-700 rounded-lg accent-rose-500 appearance-none cursor-pointer"
                />
            </div>
            {/* Opacity */}
            <div>
                <div className="flex justify-between items-center mb-1">
                    <span className="text-[9px] text-slate-400 font-semibold">Arkaplan Opaklığı</span>
                    <span className="text-[9px] text-indigo-400">{styleConfig.bgOpacity}%</span>
                </div>
                <input 
                    type="range" min="0" max="100" 
                    value={styleConfig.bgOpacity}
                    onChange={(e) => onStyleChange({ bgOpacity: Number(e.target.value) })}
                    className="w-full h-1.5 bg-slate-700 rounded-lg accent-slate-400 appearance-none cursor-pointer"
                />
            </div>
        </div>
        
        {/* Render Button */}
        <button 
            onClick={onRender}
            disabled={!videoFile || isRendering}
            className={`w-full py-3 rounded-xl font-black text-sm transition-all shadow-xl shrink-0 mt-1 border
            ${!videoFile || isRendering 
                ? 'bg-slate-800 text-slate-500 border-slate-700 cursor-not-allowed' 
                : 'bg-white text-black border-white hover:scale-[1.02] hover:bg-indigo-50 hover:shadow-white/10'}`}
        >
            {isRendering ? (
                 <span className="flex items-center justify-center gap-2">
                    <i className="fas fa-circle-notch fa-spin"></i> Hazırlanıyor...
                 </span>
            ) : (
                 <span>🎬 Videoyu İndir</span>
            )}
        </button>
      </div>

    </div>
  );
});

export default EditorPanel;