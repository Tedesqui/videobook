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

        // **CORREÇÃO:** Lógica de tratamento de erros melhorada
        if (!externalApiResponse.ok) {
            const contentType = externalApiResponse.headers.get("content-type");
            let errorMessage;

            // Se a resposta for HTML (como numa página de erro), informa o utilizador.
            if (contentType && contentType.includes("text/html")) {
                errorMessage = `A API devolveu um erro inesperado (provavelmente HTML). Verifique se a sua chave de API ('HUNYUAN_API_KEY') está correta nas configurações da Vercel. Status: ${externalApiResponse.status}`;
            } else {
                // Tenta obter uma mensagem de erro do JSON, se disponível
                try {
                    const errorData = await externalApiResponse.json();
                    errorMessage = errorData.message || JSON.stringify(errorData);
                } catch {
                    errorMessage = `A API externa respondeu com o status ${externalApiResponse.status}.`;
                }
            }
            throw new Error(errorMessage);
        }

        const data = await externalApiResponse.json();
        const videoURL = data?.output?.[0];

        if (!videoURL) {
            throw new Error("A resposta da API não continha um URL de vídeo válido.");
        }

        return res.status(200).json({ videoURL: videoURL, seed: seedToUse });

    } catch (error) {
        console.error("Erro interno do servidor:", error);
        return res.status(500).json({ error: error.message });
    }
}
