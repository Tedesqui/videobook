// Ficheiro: /api/gerar-video-hf.js

// A função handler é executada no servidor da Vercel, protegendo a sua chave de API.
export default async function handler(req, res) {
    if (req.method !== 'POST') {
        res.setHeader('Allow', ['POST']);
        return res.status(405).end(`Método ${req.method} não permitido.`);
    }

    // Obter a chave da API da Hugging Face das Variáveis de Ambiente (SEGURO)
    const apiKey = process.env.HUGGINGFACE_API_KEY;

    if (!apiKey) {
        return res.status(500).json({ error: "Erro de configuração no servidor: a chave da API da Hugging Face não está definida." });
    }

    const { prompt } = req.body;

    if (!prompt) {
        return res.status(400).json({ error: "O 'prompt' de texto é obrigatório." });
    }

    // Endpoint da API de Inferência da Hugging Face para um modelo de texto-para-vídeo
    // Modelo escolhido: zeroscope-v2-576w (um modelo popular e de boa qualidade)
    const apiEndpoint = 'https://api-inference.huggingface.co/models/cerspense/zeroscope-v2-576w';

    try {
        const externalApiResponse = await fetch(apiEndpoint, {
            method: 'POST',
            headers: {
                // A autenticação da Hugging Face usa um "Bearer Token"
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                inputs: prompt,
            })
        });

        // **CORREÇÃO:** Lógica de tratamento de erros melhorada para evitar falhas de JSON.
        if (!externalApiResponse.ok) {
            let errorMessage;
            const contentType = externalApiResponse.headers.get("content-type");

            // Se a resposta for JSON, processa-a como tal.
            if (contentType && contentType.includes("application/json")) {
                const errorData = await externalApiResponse.json();
                console.error("Erro da API da Hugging Face (JSON):", errorData);
                errorMessage = errorData.error || `A API respondeu com o status ${externalApiResponse.status}`;
            } else {
                // Se for texto ou HTML, lê como texto para evitar o erro de parsing.
                const errorText = await externalApiResponse.text();
                console.error("Erro da API da Hugging Face (Texto/HTML):", errorText);
                errorMessage = `A API devolveu um erro inesperado: "${errorText}" (Status: ${externalApiResponse.status}). Isto pode acontecer se o modelo estiver a carregar.`;
            }
            throw new Error(errorMessage);
        }

        // A API da Hugging Face para vídeo devolve os dados binários do ficheiro MP4 diretamente.
        // Obtemos esses dados como um ArrayBuffer.
        const videoBuffer = await externalApiResponse.arrayBuffer();

        // Envia os dados binários do vídeo de volta para o frontend.
        // O navegador irá interpretar isto como um ficheiro de vídeo.
        res.setHeader('Content-Type', 'video/mp4');
        return res.status(200).send(Buffer.from(videoBuffer));

    } catch (error) {
        console.error("Erro interno do servidor:", error);
        return res.status(500).json({ error: error.message });
    }
}
