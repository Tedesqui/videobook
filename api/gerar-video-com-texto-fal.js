// Importa a biblioteca oficial da fal.ai para facilitar a comunicação
import * as fal from '@fal-ai/serverless-client';

/**
 * Wrapper para adicionar cabeçalhos CORS a uma função de servidor.
 * @param {Function} fn - A função de handler a ser envolvida.
 */
const allowCors = fn => async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }
  return await fn(req, res);
};

/**
 * Handler principal da API que gera um vídeo com áudio em duas etapas.
 */
async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método não permitido.' });
  }

  try {
    // Verifica se a chave de API da fal.ai está configurada
    if (!process.env.FAL_API_KEY) {
      console.error("Chave de API da fal.ai não configurada.");
      return res.status(500).json({ error: 'Chave de API da fal.ai não configurada no servidor.' });
    }
    
    // Inicializa o cliente da fal.ai com a chave do ambiente
    fal.config({
        credentials: process.env.FAL_API_KEY,
    });

    // Recebe o prompt (texto) e a semente opcional do frontend
    const { prompt, seed } = req.body;
    if (!prompt) {
      return res.status(400).json({ error: 'Nenhum texto (prompt) fornecido.' });
    }

    // --- ETAPA 1: Gerar vídeo silencioso a partir do texto ---
    console.log("Etapa 1: Gerando vídeo silencioso com fal-ai/wan/v2.2-5b/text-to-video...");
    
    const videoInput = {
        prompt: `${prompt}, cinematic, beautiful, book illustration, hyperrealistic, 4k, detailed`,
        aspect_ratio: "16:9",
        num_frames: 121, // Define a duração para 5 segundos (120 frames / 24 fps)
        frames_per_second: 24,
        resolution: "720p",        
        negative_prompt: "distorted face, deformed hands, ugly, blurry, low quality, disfigured, deformed", // Evita distorções
        num_inference_steps: 50 // Aumenta os passos para maior qualidade
    };

    if (seed) {
        videoInput.seed = seed;
    }

    const silentVideoResult = await fal.subscribe("fal-ai/wan/v2.2-5b/text-to-video", {
      input: videoInput,
      logs: true,
    });
    
    const silentVideoUrl = silentVideoResult?.video?.url;
    const newSeed = silentVideoResult.seed;

    if (!silentVideoUrl) {
      throw new Error("Falha ao gerar o vídeo base (silencioso).");
    }
    console.log(`Vídeo silencioso gerado com a semente: ${newSeed}`);

    // --- ETAPA 2: Adicionar áudio ao vídeo gerado ---
    console.log("Etapa 2: Adicionando áudio com fal-ai/mmaudio-v2...");

    const audioResult = await fal.subscribe("fal-ai/mmaudio-v2", {
        input: {
            video_url: silentVideoUrl,
            prompt: "gentle ambient music, cinematic score" // Descreve o tipo de áudio desejado
        },
        logs: true,
    });

    const finalVideoUrl = audioResult?.video?.url;

    if (finalVideoUrl) {
      // Retorna a URL do vídeo final (com áudio) E a semente original
      res.status(200).json({ videoUrl: finalVideoUrl, seed: newSeed });
    } else {
      throw new Error("A resposta da IA de áudio não continha uma URL de vídeo válida.");
    }

  } catch (error) {
    console.error('Erro detalhado do backend:', error);
    res.status(500).json({ error: error.message || 'Ocorreu um erro interno no servidor.' });
  }
}

export default allowCors(handler);
