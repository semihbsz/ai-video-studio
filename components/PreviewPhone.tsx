
import React, { useRef, useEffect } from 'react';
import { SubtitleChunk, StyleConfig, OutputFormat } from '../types';

interface PreviewPhoneProps {
  videoSrc: string | null;
  subtitles: SubtitleChunk[];
  currentTime: number;
  styleConfig: StyleConfig;
  cropValue: number;
  onTimeUpdate: (time: number) => void;
  videoRef: React.RefObject<HTMLVideoElement>;
  isRendering: boolean;
  renderStatus?: string; // New prop for detailed status
  onCancelRender?: () => void; // New prop for cancellation
  outputFormat: OutputFormat;
}

const PreviewPhone: React.FC<PreviewPhoneProps> = React.memo(({
  videoSrc,
  subtitles,
  currentTime,
  styleConfig,
  cropValue,
  onTimeUpdate,
  videoRef,
  isRendering,
  renderStatus,
  onCancelRender,
  outputFormat
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  
  // Dimensions based on format
  const isVertical = outputFormat === 'vertical';
  // Layout dimensions
  const width = isVertical ? 320 : 560; 
  const height = isVertical ? 568 : 315;

  // --- Helpers ---
  const hexToRgba = (hex: string, alpha: number) => {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha / 100})`;
  };

  const getWrappedLines = (ctx: CanvasRenderingContext2D, text: string, maxWidth: number) => {
    const words = text.split(" ");
    const lines = [];
    let currentLine = words[0];

    for (let i = 1; i < words.length; i++) {
      const word = words[i];
      const width = ctx.measureText(currentLine + " " + word).width;
      if (width < maxWidth) {
        currentLine += " " + word;
      } else {
        lines.push(currentLine);
        currentLine = word;
      }
    }
    lines.push(currentLine);
    return lines;
  };

  // --- Canvas Drawing Loop ---
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Clear frame immediately to show video behind
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Active Subtitle
    const activeSub = subtitles.find(s => currentTime >= s.start && currentTime <= s.end);

    if (activeSub) {
      // Scale reference: Base is 350px width for fonts to look consistent
      const scale = canvas.width / 350; 
      const fontSize = styleConfig.fontSize * (isVertical ? scale : scale * 0.6); 
      const lineHeight = fontSize * 1.4;
      const maxWidth = canvas.width * 0.85;

      ctx.font = `bold ${fontSize}px "${styleConfig.fontFamily}", sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';

      // WRAP TEXT LOGIC
      const lines = getWrappedLines(ctx, activeSub.text, maxWidth);
      
      const x = canvas.width / 2;
      const totalHeight = lines.length * lineHeight;
      const startY = (canvas.height * (styleConfig.positionY / 100)) - (totalHeight / 2) + (lineHeight / 2);

      lines.forEach((line, index) => {
        const y = startY + (index * lineHeight);

        // Background Box
        if (styleConfig.bgOpacity > 0) {
            const metrics = ctx.measureText(line);
            const padding = 10 * (isVertical ? scale : scale * 0.6);
            const boxWidth = metrics.width + (padding * 2);
            const boxHeight = fontSize * 1.2; 

            ctx.fillStyle = hexToRgba(styleConfig.colorBg, styleConfig.bgOpacity);
            
            // Draw rounded rect
            const r = 8 * scale;
            const bx = x - boxWidth / 2;
            const by = y - boxHeight / 2;
            
            ctx.beginPath();
            ctx.roundRect(bx, by, boxWidth, boxHeight, r);
            ctx.fill();
        }

        // Text Shadow & Fill
        ctx.fillStyle = styleConfig.colorText;
        ctx.shadowColor = "rgba(0,0,0,0.8)";
        ctx.shadowBlur = 4 * scale;
        ctx.shadowOffsetY = 2 * scale;
        ctx.fillText(line, x, y);
        
        // Reset shadow
        ctx.shadowBlur = 0;
        ctx.shadowOffsetY = 0;
      });
    }

  }, [currentTime, subtitles, styleConfig, width, height, isVertical]);

  return (
    <div className="flex flex-col items-center justify-center h-full w-full p-4">
      {/* Device Frame Container */}
      <div 
        className={`relative shadow-2xl overflow-hidden ring-1 ring-white/20 shrink-0 transition-all duration-500 flex items-center justify-center bg-black
          ${isVertical ? 'rounded-[30px] border-[6px] border-slate-800' : 'rounded-xl border-4 border-slate-800'}`}
        style={{ width: width, height: height }}
      >
        {/* 1. Video Layer (Bottom) - z-10 */}
        {videoSrc ? (
          <video
            // KEY IS CRITICAL HERE: Forces React to recreate the video element when source changes.
            // This fixes the issue where the video frame is not rendered after a file swap.
            key={videoSrc} 
            ref={videoRef}
            src={videoSrc}
            className="absolute top-0 left-0 w-full h-full object-cover z-10"
            style={{ 
                objectFit: isVertical ? 'cover' : 'contain',
                objectPosition: isVertical ? `${cropValue}% 50%` : 'center' 
            }}
            preload="auto"
            loop={!isRendering}
            playsInline
            muted={isRendering} // Mute during render to save CPU
            onTimeUpdate={(e) => onTimeUpdate(e.currentTarget.currentTime)}
            onLoadedData={(e) => {
                // Force a repaint of the first frame
                e.currentTarget.currentTime = 0;
            }}
          />
        ) : (
          <div className="absolute top-0 left-0 w-full h-full flex flex-col items-center justify-center text-slate-500 bg-slate-900 z-10">
            <i className="fa-solid fa-clapperboard text-4xl mb-4 opacity-30"></i>
            <span className="text-xs opacity-50">Önizleme</span>
          </div>
        )}

        {/* 2. Canvas Overlay Layer (Middle) - z-20 */}
        <canvas 
          ref={canvasRef}
          width={width}
          height={height}
          className="absolute top-0 left-0 w-full h-full pointer-events-none z-20"
        />

        {/* 3. UI Overlay Layer (Top) - z-30 */}
        
        {/* Notch for Vertical */}
        {isVertical && (
            <div className="absolute top-0 left-1/2 transform -translate-x-1/2 w-24 h-5 bg-slate-800 rounded-b-lg z-30 flex justify-center items-center"></div>
        )}

        {/* Loading Spinner */}
        {isRendering && (
           <div className="absolute inset-0 z-50 bg-black/90 flex flex-col items-center justify-center text-center p-4 backdrop-blur-sm">
              <div className="w-10 h-10 border-2 border-white/20 border-t-indigo-500 rounded-full animate-spin mb-4"></div>
              <span className="text-white text-sm font-bold animate-pulse mb-2">Render Alınıyor...</span>
              <span className="text-[10px] text-slate-400 max-w-[200px] leading-relaxed mb-6 block">
                 {renderStatus || 'MP4 formatına dönüştürülüyor...'}
              </span>
              
              {onCancelRender && (
                  <button 
                    onClick={onCancelRender}
                    className="px-4 py-2 rounded-full bg-white/10 hover:bg-white/20 text-white text-[10px] font-bold transition-colors border border-white/10"
                  >
                    İptal Et
                  </button>
              )}
           </div>
        )}
        
        {/* Click to Play/Pause */}
        {videoSrc && !isRendering && (
             <button 
                className="absolute inset-0 w-full h-full flex items-center justify-center z-40 opacity-0 hover:opacity-100 transition-opacity bg-black/10 group"
                onClick={() => {
                    if(videoRef.current?.paused) videoRef.current.play();
                    else videoRef.current?.pause();
                }}
             >
                 <i className="fa-solid fa-play text-5xl text-white drop-shadow-lg scale-75 group-active:scale-90 transition-transform"></i>
             </button>
        )}
      </div>
    </div>
  );
});

export default PreviewPhone;
