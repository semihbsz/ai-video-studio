
// We define the worker code as a string to avoid complex bundler configurations for this specific output format.
// This ensures the worker runs correctly in the browser.

const workerCode = `
import { pipeline, env } from 'https://cdn.jsdelivr.net/npm/@xenova/transformers@2.17.2';

// Configuration to load models from CDN
env.allowLocalModels = false;
env.useBrowserCache = true;

self.onmessage = async (e) => {
    const { type, audioData } = e.data;

    if (type === 'run') {
        try {
            self.postMessage({ status: 'loading', msg: 'AI Modeli Başlatılıyor (Bu işlem bir kez yapılır)...' });

            // Use 'wasm' device for maximum stability across all browsers/GPUs
            const transcriber = await pipeline('automatic-speech-recognition', 'Xenova/whisper-small', {
                device: 'wasm',
                progress_callback: (data) => {
                    if (data.status === 'progress') {
                        const p = data.loaded && data.total ? Math.round((data.loaded / data.total) * 100) : 0;
                        self.postMessage({ status: 'downloading', percent: p, msg: 'Model İndiriliyor (%' + p + ')...' });
                    }
                }
            });

            self.postMessage({ status: 'processing', msg: 'Ses Analiz Ediliyor (Türkçe karakterler taranıyor)...' });

            const result = await transcriber(audioData, {
                language: 'turkish', 
                task: 'transcribe',
                chunk_length_s: 30,
                stride_length_s: 5,
                return_timestamps: true,
                
                // Compatibility & Safety
                revision: 'main',
                quantized: true,
                
                // Anti-hallucination params
                temperature: 0,
                repetition_penalty: 1.2,
                no_speech_threshold: 0.6,
                top_k: 0,
                do_sample: false
            });

            // Normalize output
            let finalOutput = result;
            
            if (!result.chunks || result.chunks.length === 0) {
                if (result.text && result.text.trim().length > 0) {
                     finalOutput = {
                        text: result.text,
                        chunks: [{ timestamp: [0, null], text: result.text }]
                    };
                } else {
                    finalOutput = { text: "", chunks: [] };
                }
            }

            self.postMessage({ status: 'complete', output: finalOutput });

        } catch (err) {
            console.error("Worker Error:", err);
            self.postMessage({ status: 'error', msg: err.message });
        }
    }
};
`;

export const createWorker = (): Worker => {
  const blob = new Blob([workerCode], { type: 'text/javascript' });
  return new Worker(URL.createObjectURL(blob), { type: 'module' });
};