
import React, { useRef, useState, useEffect } from 'react';
import { SubtitleChunk } from '../types';

interface TimelineEditorProps {
  duration: number;
  currentTime: number;
  onSeek: (time: number) => void;
  subtitles: SubtitleChunk[];
  onUpdateSubtitles: (newSubs: SubtitleChunk[]) => void;
}

const TimelineEditor: React.FC<TimelineEditorProps> = React.memo(({
  duration,
  currentTime,
  onSeek,
  subtitles,
  onUpdateSubtitles
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [zoom, setZoom] = useState<number>(50); // Pixels per second
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dragMode, setDragMode] = useState<'move' | 'resize-left' | 'resize-right' | null>(null);
  const [dragStartX, setDragStartX] = useState<number>(0);
  const [dragOriginalSub, setDragOriginalSub] = useState<SubtitleChunk | null>(null);
  
  // Scrubbing State
  const [isScrubbing, setIsScrubbing] = useState<boolean>(false);

  // Calculate total width
  const totalWidth = Math.max(duration * zoom, 600);

  // --- SUBTITLE DRAGGING LOGIC ---
  const handleMouseDown = (e: React.MouseEvent, sub: SubtitleChunk, mode: 'move' | 'resize-left' | 'resize-right') => {
    e.stopPropagation(); // Prevent scrubbing from starting
    setDraggingId(sub.id);
    setDragMode(mode);
    setDragStartX(e.clientX);
    setDragOriginalSub({ ...sub });
  };

  // New: Handle clicking a block to jump to it
  const handleBlockClick = (e: React.MouseEvent, sub: SubtitleChunk) => {
      e.stopPropagation();
      // Only seek if we didn't just drag it
      if (!draggingId) {
          onSeek(sub.start);
      }
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!draggingId || !dragMode || !dragOriginalSub) return;

      const deltaPixels = e.clientX - dragStartX;
      const deltaTime = deltaPixels / zoom;

      const updatedSubs = subtitles.map(s => {
        if (s.id !== draggingId) return s;

        let newStart = dragOriginalSub.start;
        let newEnd = dragOriginalSub.end;

        if (dragMode === 'move') {
          newStart = Math.max(0, dragOriginalSub.start + deltaTime);
          newEnd = Math.max(newStart + 0.5, dragOriginalSub.end + deltaTime);
        } else if (dragMode === 'resize-left') {
          newStart = Math.max(0, Math.min(dragOriginalSub.end - 0.2, dragOriginalSub.start + deltaTime));
        } else if (dragMode === 'resize-right') {
          newEnd = Math.max(dragOriginalSub.start + 0.2, dragOriginalSub.end + deltaTime);
        }

        return { ...s, start: newStart, end: newEnd };
      });

      onUpdateSubtitles(updatedSubs);
    };

    const handleMouseUp = () => {
      setDraggingId(null);
      setDragMode(null);
      setDragOriginalSub(null);
    };

    if (draggingId) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    }

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [draggingId, dragMode, dragStartX, dragOriginalSub, subtitles, zoom, onUpdateSubtitles]);


  // --- SCRUBBING LOGIC ---
  const calculateTimeFromEvent = (clientX: number) => {
      if (!containerRef.current) return 0;
      const rect = containerRef.current.getBoundingClientRect();
      const offsetX = clientX - rect.left + containerRef.current.scrollLeft;
      return Math.max(0, Math.min(duration, offsetX / zoom));
  };

  const handleScrubStart = (e: React.MouseEvent) => {
     setIsScrubbing(true);
     const time = calculateTimeFromEvent(e.clientX);
     onSeek(time);
  };

  useEffect(() => {
      const handleScrubMove = (e: MouseEvent) => {
          if (!isScrubbing) return;
          const time = calculateTimeFromEvent(e.clientX);
          onSeek(time);
      };
      
      const handleScrubEnd = () => {
          setIsScrubbing(false);
      };

      if (isScrubbing) {
          window.addEventListener('mousemove', handleScrubMove);
          window.addEventListener('mouseup', handleScrubEnd);
      }
      return () => {
          window.removeEventListener('mousemove', handleScrubMove);
          window.removeEventListener('mouseup', handleScrubEnd);
      };
  }, [isScrubbing, zoom, duration]);

  return (
    <div className="w-full h-48 bg-slate-950 border-t border-white/10 flex flex-col select-none">
      {/* Toolbar */}
      <div className="h-10 bg-slate-900 flex items-center justify-between px-4 border-b border-white/5">
        <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
          <i className="fa-solid fa-timeline mr-2"></i>Timeline
        </span>
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-slate-500">ZOOM</span>
          <input 
            type="range" min="10" max="200" 
            value={zoom} 
            onChange={(e) => setZoom(Number(e.target.value))}
            className="w-24 h-1 bg-slate-700 rounded-lg accent-indigo-500"
          />
        </div>
      </div>

      {/* Timeline Area */}
      <div 
        ref={containerRef}
        className="flex-1 overflow-x-auto custom-scroll relative bg-[#0f172a] cursor-text" 
        onMouseDown={handleScrubStart} // Start scrubbing on background click
      >
        <div style={{ width: `${totalWidth}px`, height: '100%' }} className="relative">
          
          {/* Time Markers (Grid) */}
          <div className="absolute top-0 left-0 h-full w-full pointer-events-none opacity-20">
            {Array.from({ length: Math.ceil(duration) }).map((_, sec) => (
              <div 
                key={sec} 
                className="absolute top-0 h-full border-l border-slate-400 text-[9px] text-slate-400 pl-1 pt-1"
                style={{ left: sec * zoom }}
              >
                {sec}s
              </div>
            ))}
          </div>

          {/* Subtitle Track */}
          <div className="absolute top-8 left-0 w-full h-12">
             {subtitles.map(sub => {
               const isActive = currentTime >= sub.start && currentTime <= sub.end;
               return (
                 <div
                   key={sub.id}
                   className={`absolute top-1 h-10 rounded-md overflow-hidden border transition-colors shadow-lg
                     ${draggingId === sub.id ? 'bg-indigo-500 z-20 cursor-grabbing border-indigo-200' : 
                       isActive ? 'bg-emerald-600/90 border-emerald-300 z-10' : 'bg-indigo-600/80 border-indigo-400/50 hover:bg-indigo-600 z-10 cursor-grab'}`}
                   style={{
                     left: sub.start * zoom,
                     width: (sub.end - sub.start) * zoom
                   }}
                   onMouseDown={(e) => handleMouseDown(e, sub, 'move')}
                   onClick={(e) => handleBlockClick(e, sub)}
                 >
                   {/* Text Preview */}
                   <div className="w-full h-full flex items-center px-2 text-[10px] font-mono text-white whitespace-nowrap overflow-hidden pointer-events-none">
                     {sub.text}
                   </div>

                   {/* Resize Handles */}
                   <div 
                     className="absolute left-0 top-0 w-3 h-full bg-white/0 hover:bg-white/20 cursor-w-resize"
                     onMouseDown={(e) => handleMouseDown(e, sub, 'resize-left')}
                   />
                   <div 
                     className="absolute right-0 top-0 w-3 h-full bg-white/0 hover:bg-white/20 cursor-e-resize"
                     onMouseDown={(e) => handleMouseDown(e, sub, 'resize-right')}
                   />
                 </div>
               );
             })}
          </div>

          {/* Playhead */}
          <div 
            className="absolute top-0 h-full w-0.5 bg-rose-500 z-30 pointer-events-none shadow-[0_0_10px_rgba(244,63,94,0.8)]"
            style={{ left: currentTime * zoom }}
          >
            <div className="absolute -top-0 -left-1.5 w-3 h-3 bg-rose-500 transform rotate-45"></div>
          </div>

        </div>
      </div>
    </div>
  );
});

export default TimelineEditor;