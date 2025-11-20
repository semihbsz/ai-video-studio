
import React, { useState, useRef, useEffect } from 'react';
import LandingHero from './components/LandingHero';
import EditorPanel from './components/EditorPanel';
import PreviewPhone from './components/PreviewPhone';
import TimelineEditor from './components/TimelineEditor';
import { StyleConfig, SubtitleChunk, WorkerMessage, OutputFormat } from './types';
import { createWorker } from './services/aiWorkerService';
import { createRenderWorker } from './services/renderWorker';

// Helper to generate unique IDs
const generateId = () => Math.random().toString(36).substr(2, 9);

const App: React.FC = () => {
  // --- Refs ---
  const videoRef = useRef<HTMLVideoElement>(null);
  const workerRef = useRef<Worker | null>(null);
  const renderWorkerRef = useRef<Worker | null>(null); // Store render worker to terminate it
  
  // --- State ---
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [videoSrc, setVideoSrc] = useState<string | null>(null);
  const [isVideoVertical, setIsVideoVertical] = useState<boolean>(true);
  
  const [subtitles, setSubtitles] = useState<SubtitleChunk[]>([]);
  
  const [aiStatus, setAiStatus] = useState<string>('');
  const [isProcessingAi, setIsProcessingAi] = useState<boolean>(false);
  
  const [isRendering, setIsRendering] = useState<boolean>(false);
  const [renderStatus, setRenderStatus] = useState<string>(''); // New state for granular status
  
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [duration, setDuration] = useState<number>(0);
  const [cropValue, setCropValue] = useState<number>(50);
  const [outputFormat, setOutputFormat] = useState<OutputFormat>('vertical');

  const [showEditor, setShowEditor] = useState<boolean>(false);
  
  // Track the active subtitle based on playback time
  const [activeSubtitleId, setActiveSubtitleId] = useState<string | null>(null);

  const [styleConfig, setStyleConfig] = useState<StyleConfig>({
    fontFamily: 'Montserrat',
    fontSize: 38,
    colorText: '#ffffff',
    colorBg: '#000000',
    bgOpacity: 60,
    positionY: 75
  });

  const readFileAsArrayBuffer = (file: File): Promise<ArrayBuffer> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        if (reader.result instanceof ArrayBuffer) resolve(reader.result);
        else reject(new Error("Buffer conversion failed"));
      };
      reader.onerror = () => reject(new Error("Dosya okuma hatası"));
      reader.readAsArrayBuffer(file);
    });
  };

  const generateSRT = () => {
    const formatTime = (seconds: number) => {
        const date = new Date(0);
        date.setSeconds(seconds);
        const iso = date.toISOString().substr(11, 8);
        const millis = Math.floor((seconds % 1) * 1000).toString().padStart(3, '0');
        return `${iso},${millis}`;
    };

    let srtContent = '';
    subtitles.forEach((sub, index) => {
        srtContent += `${index + 1}\n`;
        srtContent += `${formatTime(sub.start)} --> ${formatTime(sub.end)}\n`;
        srtContent += `${sub.text}\n\n`;
    });
    return srtContent;
  };

  const handleDownloadSRT = () => {
    if (subtitles.length === 0) return;
    const blob = new Blob([generateSRT()], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'altyazilar.srt';
    a.click();
  };

  // --- Effects ---
  useEffect(() => {
    return () => { 
        workerRef.current?.terminate();
        renderWorkerRef.current?.terminate();
    };
  }, []);

  // Update duration
  useEffect(() => {
      if (videoRef.current) {
          const updateDur = () => setDuration(videoRef.current!.duration);
          videoRef.current.addEventListener('loadedmetadata', updateDur);
          return () => videoRef.current?.removeEventListener('loadedmetadata', updateDur);
      }
  }, [videoSrc]);

  // Update Active Subtitle based on Time
  useEffect(() => {
    const active = subtitles.find(s => currentTime >= s.start && currentTime <= s.end);
    if (active) setActiveSubtitleId(active.id);
    else setActiveSubtitleId(null);
  }, [currentTime, subtitles]);

  // Update: Accept File object directly
  const handleFileSelect = (file: File) => {
    if (file) {
      setVideoFile(file);
      const url = URL.createObjectURL(file);
      setVideoSrc(url);
      setSubtitles([]);
      setAiStatus('');
      
      const video = document.createElement('video');
      video.preload = 'metadata';
      video.onloadedmetadata = () => {
        setIsVideoVertical(video.videoHeight > video.videoWidth);
      };
      video.src = url;
    }
  };

  // --- SMART SPLITTER ALGORITHM ---
  const splitIntoSmartChunks = (rawChunks: SubtitleChunk[]): SubtitleChunk[] => {
    const refined: SubtitleChunk[] = [];
    const MAX_WORDS = 4;

    rawChunks.forEach(chunk => {
        const words = chunk.text.trim().split(/\s+/);
        if (words.length <= MAX_WORDS) {
            refined.push(chunk);
            return;
        }

        const groups = [];
        for (let i = 0; i < words.length; i += MAX_WORDS) {
            groups.push(words.slice(i, i + MAX_WORDS).join(" "));
        }

        const totalDuration = chunk.end - chunk.start;
        const totalChars = chunk.text.length;
        let currentStart = chunk.start;

        groups.forEach((groupText, idx) => {
             const groupDuration = (groupText.length / totalChars) * totalDuration;
             const groupEnd = currentStart + groupDuration;
             const finalEnd = idx === groups.length - 1 ? chunk.end : groupEnd;

             refined.push({
                id: generateId(),
                start: currentStart,
                end: finalEnd,
                text: groupText
             });
             
             currentStart = finalEnd;
        });
    });

    return refined;
  };

  // --- AI Logic ---
  const handleAiClick = async () => {
    if (!videoFile) return;
    setIsProcessingAi(true);
    setAiStatus('Hazırlanıyor...');
    
    try {
      const arrayBuffer = await readFileAsArrayBuffer(videoFile);
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      let decodedAudio: AudioBuffer;
      try {
        decodedAudio = await audioCtx.decodeAudioData(arrayBuffer);
      } catch (decodeErr) {
        throw new Error("Ses formatı desteklenmiyor.");
      }

      setAiStatus('Ses 16kHz formatına çevriliyor...');
      const offlineCtx = new OfflineAudioContext(1, decodedAudio.duration * 16000, 16000);
      const source = offlineCtx.createBufferSource();
      source.buffer = decodedAudio;
      source.connect(offlineCtx.destination);
      source.start();
      
      const resampledBuffer = await offlineCtx.startRendering();
      const pcmData = resampledBuffer.getChannelData(0);

      if (workerRef.current) workerRef.current.terminate();
      workerRef.current = createWorker();
      
      workerRef.current.onmessage = (e: MessageEvent<WorkerMessage>) => {
        const { status, msg, percent, output } = e.data;
        if (status === 'downloading') {
          setAiStatus(`Model İndiriliyor: %${percent}`);
        } else if (status === 'processing') {
          setAiStatus(msg || 'Analiz ediliyor...');
        } else if (status === 'complete' && output) {
          setAiStatus('✅ Tamamlandı! (Akıllı Bölümleme Uygulanıyor...)');
          
          let chunks: SubtitleChunk[] = [];
          if (output.chunks && output.chunks.length > 0) {
            const rawChunks = output.chunks.map((c: any) => ({
              id: generateId(), 
              start: c.timestamp[0],
              end: c.timestamp[1] || c.timestamp[0] + 2, 
              text: c.text.trim()
            })).filter((s: SubtitleChunk) => s.text.length > 0);
            chunks = splitIntoSmartChunks(rawChunks);

          } else if (output.text && output.text.trim().length > 0) {
              const raw = [{ id: generateId(), start: 0, end: 5, text: output.text.trim() }];
              chunks = splitIntoSmartChunks(raw);
          } else {
              setAiStatus('⚠️ Ses algılanamadı.');
          }

          setSubtitles(chunks);
          setIsProcessingAi(false);
          setAiStatus('✅ Hazır!');
        } else if (status === 'error') {
          setAiStatus(`Hata: ${msg}`);
          setIsProcessingAi(false);
        }
      };

      setAiStatus('Model çalışıyor...');
      workerRef.current.postMessage({ type: 'run', audioData: pcmData });

    } catch (err: any) {
      console.error(err);
      setAiStatus('Hata!');
      setIsProcessingAi(false);
      alert("Hata: " + err.message);
    }
  };

  const handleUpdateSubtitle = (id: string, newText: string) => {
      setSubtitles(prev => prev.map(s => s.id === id ? { ...s, text: newText } : s));
  };

  const handleTimelineUpdate = (newSubs: SubtitleChunk[]) => {
    setSubtitles(newSubs);
  };

  const handleSeek = (t: number) => {
    if (videoRef.current) {
        videoRef.current.currentTime = t;
        setCurrentTime(t);
    }
  };
  
  const handleCancelRender = () => {
      if (renderWorkerRef.current) {
          renderWorkerRef.current.terminate();
          renderWorkerRef.current = null;
      }
      setIsRendering(false);
      setRenderStatus('');
      if (videoRef.current) videoRef.current.muted = false;
      alert("Render işlemi iptal edildi.");
  };

  // --- Render (Off-Main-Thread via Worker) ---
  const handleRender = async () => {
    if (!videoRef.current || !videoSrc) return;
    setIsRendering(true);
    setRenderStatus('Kayıt başlatılıyor...');

    try {
       // Setup Audio
       videoRef.current.pause();
       videoRef.current.currentTime = 0;
       videoRef.current.loop = false;
       videoRef.current.muted = true; 
       
       const isVerticalOutput = outputFormat === 'vertical';
       
       // Resolution Config
       const canvasW = isVerticalOutput ? 720 : 1280; 
       const canvasH = isVerticalOutput ? 1280 : 720;

       const canvas = document.createElement('canvas');
       canvas.width = canvasW;
       canvas.height = canvasH;
       const ctx = canvas.getContext('2d')!;
       
       // Capture stream
       const stream = canvas.captureStream(30); 
       
       // PRIORITIZE VP8 for Compatibility with ffmpeg-core-st
       const mimeTypes = [
           'video/webm; codecs=vp8',
           'video/webm; codecs=vp9',
           'video/webm'
       ];
       let selectedMime = mimeTypes.find(type => MediaRecorder.isTypeSupported(type));
       
       if (!selectedMime) {
           console.warn("No standard webm support, trying default");
           selectedMime = 'video/webm'; // Fallback
       }
       
       // Use modest bitrate (6Mbps) to reduce memory pressure
       const options = { mimeType: selectedMime, videoBitsPerSecond: 6000000 };

       const mediaRecorder = new MediaRecorder(stream, options);
       const chunks: Blob[] = [];
       
       mediaRecorder.ondataavailable = (e) => { 
           if(e.data.size > 0) chunks.push(e.data); 
       };
       
       mediaRecorder.onstop = async () => {
           try {
             setRenderStatus('WebM oluşturuldu, FFmpeg başlatılıyor...');
             const webmBlob = new Blob(chunks, { type: 'video/webm' });
             const webmBuffer = await webmBlob.arrayBuffer();
             
             // Prepare Original Audio if available (for high quality audio merge)
             let audioBuffer: ArrayBuffer | null = null;
             if (videoFile) {
                try {
                    audioBuffer = await readFileAsArrayBuffer(videoFile);
                } catch (e) {
                    console.warn("Could not read source audio for merge, will use silenced video or recording audio if any.");
                }
             }

             // Spawn Worker
             if (renderWorkerRef.current) renderWorkerRef.current.terminate();
             renderWorkerRef.current = createRenderWorker();
             
             const renderWorker = renderWorkerRef.current;

             renderWorker.onmessage = (e: MessageEvent<WorkerMessage>) => {
                 const { status, buffer, msg } = e.data;
                 
                 if (status === 'progress' && msg) {
                    setRenderStatus(msg);
                 }
                 else if (status === 'complete' || status === 'fallback') {
                    if (status === 'fallback') {
                        alert(msg || "MP4 dönüşümü yapılamadı, WebM indiriliyor.");
                    }

                    const type = status === 'complete' ? 'video/mp4' : 'video/webm';
                    const ext = status === 'complete' ? 'mp4' : 'webm';
                    
                    const blob = new Blob([buffer!], { type });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = `${videoFile ? videoFile.name.split('.')[0] : 'output'}_shorts.${ext}`;
                    document.body.appendChild(a);
                    a.click();
                    document.body.removeChild(a);
                    
                    // Cleanup
                    setIsRendering(false);
                    setRenderStatus('');
                    if (videoRef.current) videoRef.current.muted = false;
                    renderWorker.terminate();
                    renderWorkerRef.current = null;

                 } else if (status === 'error') {
                    alert("Render Hatası: " + msg);
                    setIsRendering(false);
                    setRenderStatus('');
                    if (videoRef.current) videoRef.current.muted = false;
                    renderWorker.terminate();
                    renderWorkerRef.current = null;
                 }
             };
             
             // Catch silent crashes (e.g. OOM)
             renderWorker.onerror = (err) => {
                 console.error("Render Worker Failed:", err);
                 alert("İşlem tarayıcı tarafından durduruldu (Bellek yetersiz olabilir). Lütfen daha kısa bir video deneyin.");
                 setIsRendering(false);
                 setRenderStatus('');
                 if (videoRef.current) videoRef.current.muted = false;
                 renderWorker.terminate();
                 renderWorkerRef.current = null;
             };

             renderWorker.postMessage({
                 type: 'render',
                 webmBuffer,
                 audioBuffer
             }, [webmBuffer, ...(audioBuffer ? [audioBuffer] : [])]);

           } catch (err: any) {
             console.error("Render Prep Error:", err);
             alert("Render başlatılamadı: " + err.message);
             setIsRendering(false);
             setRenderStatus('');
             if (videoRef.current) videoRef.current.muted = false;
           }
       };

       // Start Recording & Playback
       mediaRecorder.start();
       await videoRef.current.play();

       // --- DRAW LOOP ---
       const getWrappedLines = (context: CanvasRenderingContext2D, text: string, maxWidth: number) => {
          const words = text.split(" ");
          const lines = [];
          let currentLine = words[0];
          for (let i = 1; i < words.length; i++) {
             const word = words[i];
             const width = context.measureText(currentLine + " " + word).width;
             if (width < maxWidth) currentLine += " " + word;
             else { lines.push(currentLine); currentLine = word; }
          }
          lines.push(currentLine);
          return lines;
       };

       const drawFrame = () => {
          if (!videoRef.current || videoRef.current.paused || videoRef.current.ended) return;

          // 1. Draw Background
          ctx.fillStyle = '#000';
          ctx.fillRect(0, 0, canvas.width, canvas.height);

          // 2. Draw Video
          if (isVerticalOutput) {
             if (isVideoVertical) {
                ctx.drawImage(videoRef.current, 0, 0, canvasW, canvasH);
             } else {
                const scale = canvasH / videoRef.current.videoHeight;
                const scaledW = videoRef.current.videoWidth * scale;
                // cropValue 0 -> left, 50 -> center, 100 -> right
                const offset = -((scaledW - canvasW) * (cropValue / 100));
                ctx.drawImage(videoRef.current, offset, 0, scaledW, canvasH);
             }
          } else {
             if (isVideoVertical) {
                 // Fit vertical video in horizontal frame
                 const scale = canvasH / videoRef.current.videoHeight;
                 const scaledW = videoRef.current.videoWidth * scale;
                 const offsetX = (canvasW - scaledW) / 2;
                 ctx.drawImage(videoRef.current, offsetX, 0, scaledW, canvasH);
             } else {
                 ctx.drawImage(videoRef.current, 0, 0, canvasW, canvasH);
             }
          }

          // 3. Draw Subtitles
          const time = videoRef.current.currentTime;
          const activeSub = subtitles.find(s => time >= s.start && time <= s.end);
          
          if (activeSub) {
             // Scale fonts relative to resolution
             const baseScale = canvasW / 360; 
             const scale = isVerticalOutput ? baseScale : baseScale * 0.6;
             const fs = styleConfig.fontSize * scale;
             const lineHeight = fs * 1.4;
             const maxWidth = canvasW * 0.85;
             
             ctx.font = `bold ${fs}px "${styleConfig.fontFamily}", sans-serif`;
             ctx.textAlign = 'center';
             ctx.textBaseline = 'middle';
             
             const lines = getWrappedLines(ctx, activeSub.text, maxWidth);
             const totalHeight = lines.length * lineHeight;
             const x = canvasW / 2;
             const startY = (canvasH * (styleConfig.positionY / 100)) - (totalHeight / 2) + (lineHeight / 2);

             lines.forEach((line, index) => {
                const y = startY + (index * lineHeight);

                // Bg Box
                if (styleConfig.bgOpacity > 0) {
                   const r = parseInt(styleConfig.colorBg.slice(1, 3), 16);
                   const g = parseInt(styleConfig.colorBg.slice(3, 5), 16);
                   const b = parseInt(styleConfig.colorBg.slice(5, 7), 16);
                   ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${styleConfig.bgOpacity / 100})`;

                   const metrics = ctx.measureText(line);
                   const padding = 10 * scale;
                   const w = metrics.width + (padding * 2);
                   const h = fs * 1.2;
                   
                   ctx.beginPath();
                   ctx.roundRect(x - w/2, y - h/2, w, h, 16 * (scale/2)); 
                   ctx.fill();
                }

                // Text
                ctx.fillStyle = styleConfig.colorText;
                ctx.shadowColor = "rgba(0,0,0,0.8)";
                ctx.shadowBlur = 4 * scale;
                ctx.shadowOffsetY = 2 * scale;
                ctx.fillText(line, x, y);
                ctx.shadowBlur = 0;
                ctx.shadowOffsetY = 0;
             });
          }

          requestAnimationFrame(drawFrame);
       };
       
       drawFrame();
       
       // Bind cleanup for this specific run
       const stopHandler = () => {
           if(mediaRecorder.state !== 'inactive') mediaRecorder.stop();
           videoRef.current?.removeEventListener('ended', stopHandler);
       };
       videoRef.current.addEventListener('ended', stopHandler);

    } catch (err: any) {
       console.error(err);
       alert("Render hatası: " + err);
       setIsRendering(false);
       setRenderStatus('');
       if (videoRef.current) videoRef.current.muted = false;
    }
  };

  return (
    <div className="h-screen w-full bg-[#020617] text-white overflow-hidden relative">
      {/* Landing Hero Layer */}
      <div 
        className={`absolute inset-0 z-50 bg-[#020617] transition-transform duration-700 ease-in-out ${showEditor ? '-translate-y-full' : 'translate-y-0'}`}
      >
           <LandingHero onStart={() => setShowEditor(true)} />
      </div>

      {/* Main App Grid */}
      <div className={`h-full w-full flex flex-col p-4 md:p-6 transition-opacity duration-1000 ${showEditor ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
         <div className="w-full max-w-[1800px] mx-auto grid grid-cols-1 lg:grid-cols-[380px_minmax(0,1fr)] gap-6 h-full overflow-hidden">
            
            {/* Left Panel */}
            <div className="h-full overflow-hidden shrink-0">
                <EditorPanel 
                   videoFile={videoFile}
                   onFileSelect={handleFileSelect}
                   onAiClick={handleAiClick}
                   aiStatus={aiStatus}
                   isProcessingAi={isProcessingAi}
                   subtitles={subtitles}
                   onUpdateSubtitle={handleUpdateSubtitle}
                   activeSubtitleId={activeSubtitleId}
                   onSubtitleSelect={handleSeek}
                   cropValue={cropValue}
                   onCropChange={setCropValue}
                   showCrop={!isVideoVertical}
                   styleConfig={styleConfig}
                   onStyleChange={(newS) => setStyleConfig(prev => ({ ...prev, ...newS }))}
                   onRender={handleRender}
                   isRendering={isRendering}
                   outputFormat={outputFormat}
                   onOutputFormatChange={setOutputFormat}
                   onDownloadSrt={handleDownloadSRT}
                />
            </div>

            {/* Right Panel */}
            <div className="flex flex-col gap-4 h-full min-w-0 overflow-hidden">
               <div className="flex-1 bg-slate-900/30 rounded-3xl border border-white/5 flex justify-center items-center overflow-hidden p-4 relative">
                  <PreviewPhone 
                     videoSrc={videoSrc}
                     subtitles={subtitles}
                     currentTime={currentTime}
                     styleConfig={styleConfig}
                     cropValue={cropValue} 
                     onTimeUpdate={setCurrentTime}
                     videoRef={videoRef}
                     isRendering={isRendering}
                     renderStatus={renderStatus}
                     onCancelRender={handleCancelRender}
                     outputFormat={outputFormat}
                  />
               </div>

               {videoSrc && (
                 <div className="h-48 shrink-0 rounded-xl overflow-hidden border border-white/10 shadow-2xl bg-slate-950">
                    <TimelineEditor 
                       duration={duration}
                       currentTime={currentTime}
                       onSeek={handleSeek}
                       subtitles={subtitles}
                       onUpdateSubtitles={handleTimelineUpdate}
                    />
                 </div>
               )}
            </div>

         </div>
      </div>
    </div>
  );
};

export default App;
