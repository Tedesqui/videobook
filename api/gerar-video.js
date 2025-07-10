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

        // **CORREÇÃO:** Lógica de tratamento de erros melhorada e mais específica
        if (!externalApiResponse.ok) {
            const status = externalApiResponse.status;
            let errorMessage;

            // Verifica códigos de erro específicos primeiro
            if (status === 401) {
                errorMessage = "Erro de Autenticação (401). A sua chave de API ('HUNYUAN_API_KEY') é inválida ou foi revogada. Verifique-a nas configurações da Vercel.";
            } else if (status === 406) {
                errorMessage = "Créditos Insuficientes (406). A sua conta da Segmind não tem créditos suficientes para realizar esta operação.";
            } else {
                // Se não for um erro conhecido, verifica o tipo de conteúdo
                const contentType = externalApiResponse.headers.get("content-type");
                if (contentType && contentType.includes("text/html")) {
                    errorMessage = `A API devolveu um erro inesperado (provavelmente HTML). Verifique o status da API da Segmind. Status: ${status}`;
                } else {
                    try {
                        const errorData = await externalApiResponse.json();
                        errorMessage = errorData.message || JSON.stringify(errorData);
                    } catch {
                        errorMessage = `A API externa respondeu com o status ${status}.`;
                    }
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
