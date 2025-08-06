/// Importa a biblioteca oficial da fal.ai para facilitar a comunicação
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
 * Handler principal da API que gera um vídeo com áudio em três etapas.
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

    // --- ETAPA 1: Gerar imagem a partir do texto ---
    console.log("Etapa 1: Gerando imagem com fal-ai/wan/v2.2-a14b/text-to-image/lora...");
    
    const imageInput = {
        prompt: `${prompt}, cinematic, beautiful, book illustration, hyperrealistic, 4k, detailed, best quality`,
        negative_prompt: "distorted face, deformed hands, ugly, blurry, low quality, disfigured, deformed",
    };

    if (seed) {
        imageInput.seed = seed;
    }

    const imageResult = await fal.subscribe("fal-ai/wan/v2.2-a14b/text-to-image/lora", {
      input: imageInput,
      logs: true,
    });
    
    const imageUrl = imageResult?.images?.[0]?.url;
    const newSeed = imageResult.seed;

    if (!imageUrl) {
      throw new Error("Falha ao gerar a imagem base.");
    }
    console.log(`Imagem gerada com a semente: ${newSeed}`);

    // --- ETAPA 2: Gerar vídeo a partir da imagem ---
    console.log("Etapa 2: Gerando vídeo silencioso com fal-ai/wan/v2.2-a14b/image-to-video...");

    const silentVideoResult = await fal.subscribe("fal-ai/wan/v2.2-a14b/image-to-video", {
        input: {
            image_url: imageUrl,
            seed: newSeed, // Usa a mesma semente para consistência
            num_frames: 121,
            frames_per_second: 24,
            resolution: "720p",
            aspect_ratio: "9:16",
            num_inference_steps: 50, // Mais passos para melhor qualidade
            motion_bucket_id: 127,
            cond_aug: 0.02,
        },
        logs: true,
    });

    const silentVideoUrl = silentVideoResult?.video?.url;
    if (!silentVideoUrl) {
        throw new Error("Falha ao gerar o vídeo base (silencioso).");
    }
    console.log("Vídeo silencioso gerado com sucesso.");

    // --- ETAPA 3: Adicionar áudio ao vídeo gerado ---
    console.log("Etapa 3: Adicionando áudio com fal-ai/mmaudio-v2...");

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
