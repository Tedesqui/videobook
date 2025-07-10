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

    // **CORREÇÃO:** Alterado para um novo modelo de vídeo para maior fiabilidade.
    // O modelo 'strangeman3107/animov-512x' é outra alternativa robusta.
    const apiEndpoint = 'https://api-inference.huggingface.co/models/strangeman3107/animov-512x';

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

        // Lógica de tratamento de erros melhorada
        if (!externalApiResponse.ok) {
            let errorMessage;
            const status = externalApiResponse.status;
            const contentType = externalApiResponse.headers.get("content-type");

            if (status === 404) {
                errorMessage = `Modelo não encontrado (Erro 404). O modelo '${apiEndpoint}' pode estar offline ou indisponível. Por favor, tente outro modelo.`;
            } else if (status === 503) {
                 errorMessage = `O modelo está a carregar (Erro 503). Por favor, tente novamente dentro de 1 minuto.`;
            } else if (contentType && contentType.includes("application/json")) {
                const errorData = await externalApiResponse.json();
                console.error("Erro da API da Hugging Face (JSON):", errorData);
                errorMessage = errorData.error || `A API respondeu com o status ${status}`;
            } else {
                const errorText = await externalApiResponse.text();
                console.error("Erro da API da Hugging Face (Texto/HTML):", errorText);
                errorMessage = `A API devolveu um erro inesperado: "${errorText}" (Status: ${status}).`;
            }
            throw new Error(errorMessage);
        }

        // A API da Hugging Face para vídeo devolve os dados binários do ficheiro MP4 diretamente.
        const videoBuffer = await externalApiResponse.arrayBuffer();

        // Envia os dados binários do vídeo de volta para o frontend.
        res.setHeader('Content-Type', 'video/mp4');
        return res.status(200).send(Buffer.from(videoBuffer));

    } catch (error) {
        console.error("Erro interno do servidor:", error);
        return res.status(500).json({ error: error.message });
    }
}
