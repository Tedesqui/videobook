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
 * Handler principal da API que recebe um texto e gera um vídeo diretamente.
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

    // --- ETAPA ÚNICA: Gerar vídeo diretamente do texto ---
    console.log("Gerando vídeo diretamente do texto com fal-ai/wan/v2.2-5b/text-to-video...");
    
    const videoInput = {
        prompt: `${prompt}, cinematic, beautiful, book illustration, hyperrealistic, 4k, detailed`, // Prompt ajustado para o modelo Wan 2.2 5B
        aspect_ratio: "16:9"
    };

    // Adiciona a semente à requisição, se ela foi enviada pelo frontend
    if (seed) {
        videoInput.seed = seed;
    }

    // CORREÇÃO: Chama a versão mais realista do Wan.
    const videoResult = await fal.subscribe("fal-ai/wan/v2.2-5b/text-to-video", {
      input: videoInput,
      logs: true,
    });
    
    // Captura a semente usada na geração do vídeo para retornar ao frontend
    const newSeed = videoResult.seed;
    console.log(`Vídeo gerado com a semente: ${newSeed}`);

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
