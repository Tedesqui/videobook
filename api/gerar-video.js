// Ficheiro: /api/gerar-video.js

// A função handler é executada no servidor da Vercel, protegendo a sua chave de API.
export default async function handler(req, res) {
    if (req.method !== 'POST') {
        res.setHeader('Allow', ['POST']);
        return res.status(405).end(`Método ${req.method} não permitido.`);
    }

    // Obter a chave da API das Variáveis de Ambiente da Vercel (SEGURO)
    const apiKey = process.env.HUNYUAN_API_KEY;

    if (!apiKey) {
        return res.status(500).json({ error: "Erro de configuração no servidor: a chave da API não está definida." });
    }

    const { prompt, seed } = req.body;

    if (!prompt) {
        return res.status(400).json({ error: "O 'prompt' de texto é obrigatório." });
    }

    const apiEndpoint = 'https://api.segmind.com/v1/hunyuan-video';
    const seedToUse = seed || Math.floor(Math.random() * 1000000000);

    const requestBody = {
        prompt: prompt,
        negative_prompt: "text, watermark, blurry, low quality",
        motion_strength: 0.5,
        num_inference_steps: 25,
        seed: seedToUse
    };

    try {
        const externalApiResponse = await fetch(apiEndpoint, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-api-key': apiKey
            },
            body: JSON.stringify(requestBody)
        });

        const data = await externalApiResponse.json();

        if (!externalApiResponse.ok) {
            throw new Error(data.message || "Ocorreu um erro ao gerar o vídeo.");
        }

        const videoURL = data?.output?.[0];

        if (!videoURL) {
            throw new Error("A resposta da API não continha um URL de vídeo válido.");
        }

        return res.status(200).json({ videoURL: videoURL, seed: seedToUse });

    } catch (error) {
        return res.status(500).json({ error: error.message });
    }
}
