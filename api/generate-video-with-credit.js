// Ficheiro: /api/generate-video-with-credit.js
// Endpoint que verifica e consome um crédito antes de gerar o vídeo.

import { getAuth } from '@clerk/nextjs/server';
import { sql } from '@vercel/postgres';

// Função auxiliar para criar pausas.
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).end('Método não permitido');
  }

  const { userId } = getAuth(req);

  if (!userId) {
    return res.status(401).json({ error: "Não autenticado." });
  }

  const { prompt, seed } = req.body;
  const apiKey = process.env.REPLICATE_API_KEY;

  if (!prompt) {
    return res.status(400).json({ error: "O 'prompt' é obrigatório." });
  }
  if (!apiKey) {
    return res.status(500).json({ error: "A chave da API da Replicate não está configurada." });
  }

  // Inicia uma transação com a base de dados
  const client = await sql.connect();

  try {
    await client.query('BEGIN'); // Começa a transação

    // Verifica se o utilizador tem créditos suficientes
    const { rows } = await client.query('SELECT credits FROM users WHERE clerk_id = $1 FOR UPDATE;', [userId]);
    const userCredits = rows[0]?.credits || 0;

    if (userCredits < 1) {
      await client.query('ROLLBACK'); // Desfaz a transação
      client.release();
      return res.status(403).json({ error: "Créditos insuficientes." });
    }

    // Debita um crédito
    await client.query('UPDATE users SET credits = credits - 1 WHERE clerk_id = $1;', [userId]);
    console.log(`1 crédito debitado do utilizador ${userId}.`);

    // Tenta gerar o vídeo
    const { videoURL, usedSeed } = await generateVideoWithReplicate(prompt, apiKey, seed);
    
    // Se tudo correu bem, confirma a transação
    await client.query('COMMIT');
    client.release();
    
    res.status(200).json({ videoURL, seed: usedSeed });

  } catch (error) {
    // Se algo falhar, desfaz a transação para não debitar o crédito
    await client.query('ROLLBACK');
    client.release();
    console.error("Erro no processo de geração, crédito devolvido:", error);
    res.status(500).json({ error: error.message });
  }
}


/**
 * Função para gerar um vídeo a partir de um prompt de texto usando a Replicate API.
 */
async function generateVideoWithReplicate(prompt, apiKey, seed) {
    const seedToUse = seed || Math.floor(Math.random() * 1000000000);

    const startResponse = await fetch("https://api.replicate.com/v1/predictions", {
        method: "POST",
        headers: { "Authorization": `Token ${apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
            version: "9f747673945c62801b13b84701c783929c0ee784e4748ec062204894dda1a351",
            input: { 
                prompt: prompt,
                seed: seedToUse
            },
        }),
    });

    let prediction = await startResponse.json();
    if (startResponse.status !== 201) {
        throw new Error(prediction.detail || "Falha ao iniciar a geração do vídeo na Replicate.");
    }

    while (prediction.status !== "succeeded" && prediction.status !== "failed") {
        await sleep(1000);
        const statusResponse = await fetch(prediction.urls.get, {
            headers: { "Authorization": `Token ${apiKey}`, "Content-Type": "application/json" },
        });
        prediction = await statusResponse.json();
        if (statusResponse.status !== 200) {
            throw new Error(prediction.detail || "Falha ao verificar o estado do vídeo na Replicate.");
        }
    }

    if (prediction.status === "succeeded") {
        const videoURL = prediction.output?.[0];
        if (!videoURL) throw new Error("A resposta da Replicate não continha um URL de vídeo válido.");
        return { videoURL: videoURL, usedSeed: seedToUse };
    } else {
        throw new Error(`A geração do vídeo na Replicate falhou: ${prediction.error}`);
    }
}
