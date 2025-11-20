
const workerCode = `
importScripts('https://unpkg.com/@ffmpeg/ffmpeg@0.11.6/dist/ffmpeg.min.js');

self.onmessage = async (e) => {
  const { type, webmBuffer, audioBuffer } = e.data;

  if (type === 'render') {
    let ffmpeg = null;
    try {
      const { createFFmpeg } = self.FFmpeg;

      self.postMessage({ status: 'progress', msg: 'FFmpeg Yükleniyor...', percent: 0 });

      // Initialize FFmpeg with single-threaded core (core-st) to prevent browser crashes
      ffmpeg = createFFmpeg({
        log: true,
        corePath: 'https://unpkg.com/@ffmpeg/core-st@0.11.1/dist/ffmpeg-core.js',
        mainName: 'main', // Fix for proxy_main assertion error
        progress: ({ ratio }) => {
            const percent = Math.round(ratio * 100);
            self.postMessage({ status: 'progress', msg: 'Video İşleniyor: %' + percent, percent });
        }
      });

      if (!ffmpeg.isLoaded()) {
        await ffmpeg.load();
      }

      self.postMessage({ status: 'progress', msg: 'Dosyalar Hazırlanıyor...', percent: 0 });

      // 1. Write Input Video
      ffmpeg.FS('writeFile', 'input.webm', new Uint8Array(webmBuffer));

      let command = [];

      if (audioBuffer) {
        // 2. Write Input Audio (if exists)
        ffmpeg.FS('writeFile', 'input_audio', new Uint8Array(audioBuffer));
        
        // Merge Command: Re-encode to MP4 (H.264/AAC)
        command = [
          '-i', 'input.webm',
          '-i', 'input_audio',
          '-c:v', 'libx264',
          '-preset', 'ultrafast',
          '-crf', '28', // Slightly higher CRF for speed/lower memory
          '-c:a', 'aac',
          '-b:a', '128k',
          '-map', '0:v:0',
          '-map', '1:a:0',
          '-shortest', 
          '-pix_fmt', 'yuv420p', 
          'output.mp4'
        ];
      } else {
        // Convert Only Command
        command = [
           '-i', 'input.webm',
           '-c:v', 'libx264',
           '-preset', 'ultrafast',
           '-crf', '28',
           '-pix_fmt', 'yuv420p',
           'output.mp4'
        ];
      }

      self.postMessage({ status: 'progress', msg: 'Dönüştürme Başlıyor (Bu işlem zaman alabilir)...', percent: 0 });

      // Run FFmpeg
      await ffmpeg.run(...command);

      self.postMessage({ status: 'progress', msg: 'Dosya Oluşturuluyor...', percent: 99 });

      // Read the result
      const data = ffmpeg.FS('readFile', 'output.mp4');
      
      // Send back success
      self.postMessage({ status: 'complete', buffer: data.buffer }, [data.buffer]);

    } catch (err) {
      console.error("Worker FFmpeg Error:", err);
      
      // Fallback logic: If MP4 conversion fails, return the original WebM
      try {
          self.postMessage({ 
              status: 'fallback', 
              buffer: webmBuffer, 
              msg: 'MP4 çevirisi sırasında hata oluştu (' + err.message + '). WebM formatında indiriliyor.' 
          }); 
      } catch (fallbackErr) {
          self.postMessage({ status: 'error', msg: err.message });
      }
    } finally {
        // Cleanup
        try {
            if (ffmpeg) ffmpeg.exit();
        } catch(e) {}
    }
  }
};
`;

export const createRenderWorker = (): Worker => {
  const blob = new Blob([workerCode], { type: 'application/javascript' });
  return new Worker(URL.createObjectURL(blob));
};
