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
 * Handler principal da API que gera uma imagem a partir de um texto.
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

    // --- ETAPA ÚNICA: Gerar imagem a partir do texto ---
    console.log("Gerando imagem com fal-ai/flux-pro/v1.1-ultra...");
    
    const imageInput = {
        prompt: `${prompt}, cinematic, beautiful, book illustration, hyperrealistic, 4k, detailed, best quality`,
        negative_prompt: "distorted face, deformed hands, ugly, blurry, low quality, disfigured, deformed",
        image_size: "portrait_16_9" // Formato vertical 9:16
    };

    if (seed) {
        imageInput.seed = seed;
    }

    const imageResult = await fal.subscribe("fal-ai/flux-pro/v1.1-ultra", {
      input: imageInput,
      logs: true,
    });
    
    const imageUrl = imageResult?.images?.[0]?.url;
    const newSeed = imageResult.seed;

    if (imageUrl) {
      // Retorna a URL da imagem E a semente usada
      res.status(200).json({ imageUrl: imageUrl, seed: newSeed });
    } else {
      throw new Error("Falha ao gerar a imagem.");
    }

  } catch (error) {
    console.error('Erro detalhado do backend:', error);
    res.status(500).json({ error: error.message || 'Ocorreu um erro interno no servidor.' });
  }
}

export default allowCors(handler);
