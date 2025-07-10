// Ficheiro: /api/gerar-video.js

// A função handler é executada no servidor da Vercel, protegendo a sua chave de API.
export default async function handler(req, res) {
    // Apenas permitir pedidos do tipo POST
    if (req.method !== 'POST') {
        res.setHeader('Allow', ['POST']);
        return res.status(405).end(`Método ${req.method} não permitido.`);
    }

    // Obter a chave da API das Variáveis de Ambiente da Vercel (SEGURO)
    const apiKey = process.env.HUNYUAN_API_KEY;

    if (!apiKey) {
        console.error("A chave da API não foi encontrada nas variáveis de ambiente.");
        return res.status(500).json({ error: "Erro de configuração no servidor: a chave da API não está definida." });
    }

    // Obter o prompt e a semente opcional do corpo do pedido
    const { prompt, seed } = req.body;

    if (!prompt) {
        return res.status(400).json({ error: "O 'prompt' de texto é obrigatório." });
    }

    const apiEndpoint = 'https://api.segmind.com/v1/hunyuan-video';

    // **LÓGICA DA SEMENTE**
    // Se uma semente for fornecida pelo frontend, usa-a.
    // Senão, gera um número aleatório para garantir um vídeo novo e único.
    const seedToUse = seed || Math.floor(Math.random() * 1000000000);

    // Prepara o corpo do pedido para a API externa da Segmind
    const requestBody = {
        prompt: prompt,
        negative_prompt: "text, watermark, blurry, low quality",
        motion_strength: 0.5,
        num_inference_steps: 25,
        seed: seedToUse // Adiciona a semente ao pedido
    };

    try {
        // Faz a chamada para a API externa a partir do servidor
        const externalApiResponse = await fetch(apiEndpoint, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-api-key': apiKey // A chave secreta é usada aqui, no servidor
            },
            body: JSON.stringify(requestBody)
        });

        const data = await externalApiResponse.json();

        // Se a API externa devolver um erro, reencaminha-o para o nosso frontend
        if (!externalApiResponse.ok) {
            throw new Error(data.message || "Ocorreu um erro ao gerar o vídeo.");
        }

        const videoURL = data?.output?.[0];

        if (!videoURL) {
            throw new Error("A resposta da API não continha um URL de vídeo válido.");
        }

        // **MUDANÇA IMPORTANTE:** Envia de volta o URL do vídeo E a semente que foi usada.
        // O frontend irá guardar esta semente para poder reutilizá-la se a consistência for solicitada.
        return res.status(200).json({ videoURL: videoURL, seed: seedToUse });

    } catch (error) {
        console.error("Erro interno do servidor:", error);
        return res.status(500).json({ error: error.message });
    }
}
