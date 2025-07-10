// Ficheiro: /api/gerar-video-deepai.js

// A função handler é executada no servidor da Vercel, protegendo a sua chave de API.
export default async function handler(req, res) {
    if (req.method !== 'POST') {
        res.setHeader('Allow', ['POST']);
        return res.status(405).end(`Método ${req.method} não permitido.`);
    }

    // Obter a chave da API da DeepAI das Variáveis de Ambiente (SEGURO)
    const apiKey = process.env.DEEPAI_API_KEY;

    if (!apiKey) {
        return res.status(500).json({ error: "Erro de configuração no servidor: a chave da API da DeepAI não está definida." });
    }

    const { prompt } = req.body;

    if (!prompt) {
        return res.status(400).json({ error: "O 'prompt' de texto é obrigatório." });
    }

    // Endpoint da API da DeepAI para geração de vídeo a partir de texto
    const apiEndpoint = 'https://api.deepai.org/api/text2video';

    try {
        // A API da DeepAI espera os dados no formato 'application/x-www-form-urlencoded'
        const requestBody = new URLSearchParams({
            text: prompt,
        });

        const externalApiResponse = await fetch(apiEndpoint, {
            method: 'POST',
            headers: {
                // A autenticação da DeepAI usa um cabeçalho 'api-key'
                'api-key': apiKey,
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: requestBody.toString(),
        });

        const data = await externalApiResponse.json();

        if (!externalApiResponse.ok) {
            console.error("Erro da API da DeepAI:", data);
            throw new Error(data.err || `A API da DeepAI respondeu com o status ${externalApiResponse.status}`);
        }

        // A API da DeepAI devolve um URL para o vídeo gerado
        const videoURL = data.output_url;

        if (!videoURL) {
            throw new Error("A resposta da API não continha um URL de vídeo válido.");
        }

        // Envia o URL do vídeo de volta para o frontend
        return res.status(200).json({ videoURL: videoURL });

    } catch (error) {
        console.error("Erro interno do servidor:", error);
        return res.status(500).json({ error: error.message });
    }
}
