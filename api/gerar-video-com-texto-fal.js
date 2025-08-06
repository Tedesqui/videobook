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
 * Handler principal da API que recebe um texto, gera uma imagem e a anima.
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

    // --- ETAPA 1: Gerar uma imagem a partir do texto ---
    console.log("Gerando imagem a partir do texto...");
    const imageInput = {
        prompt: `${prompt}, cinematic, epic, book illustration, beautiful`, // Adiciona termos para melhorar a qualidade
        negative_prompt: "text, watermark, blurry, ugly",
    };

    // Adiciona a semente à requisição da imagem, se ela foi enviada pelo frontend
    if (seed) {
        imageInput.seed = seed;
    }

    // Chama o modelo de geração de imagem (fast-sdxl)
    const imageResult = await fal.subscribe("fal-ai/fast-sdxl", {
      input: imageInput,
      logs: true,
    });

    if (!imageResult?.images?.[0]?.url) {
        throw new Error("Falha ao gerar a imagem base para o vídeo.");
    }
    const imageUrl = imageResult.images[0].url;
    // Captura a semente usada na geração da imagem para retornar ao frontend
    const newSeed = imageResult.seed;
    console.log(`Imagem gerada com a semente: ${newSeed}`);

    // --- ETAPA 2: Animar a imagem gerada ---
    console.log("Animando a imagem gerada com wan-2.2...");
    const videoResult = await fal.subscribe("fal-ai/wan-2.2", {
      input: {
        image_url: imageUrl,
        motion_bucket_id: 127, // Controla a intensidade do movimento
        cond_aug: 0.02,
      },
      logs: true,
    });

    if (videoResult?.video?.url) {
      // Retorna a URL do vídeo E a semente usada para o frontend
      res.status(200).json({ videoUrl: videoResult.video.url, seed: newSeed });
    } else {
      throw new Error("A resposta da IA não continha uma URL de vídeo válida.");
    }

  } catch (error) {
    console.error('Erro detalhado do backend:', error);
    res.status(500).json({ error: error.message || 'Ocorreu um erro interno no servidor.' });
  }
}

export default allowCors(handler);
