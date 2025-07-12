// Ficheiro: /api/gerar-video-replicate.js
// Este script foi modificado para gerar vídeos usando o modelo Kling v2.1 da Replicate.

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

module.exports = async (req, res) => {
    if (req.method !== 'POST') {
        return res.status(405).end("Método não permitido.");
    }

    const { prompt, seed } = req.body;
    const apiKey = process.env.REPLICATE_API_KEY;

    if (!prompt) {
        return res.status(400).json({ error: "O 'prompt' é obrigatório." });
    }
    if (!apiKey) {
        return res.status(500).json({ error: "A chave da API da Replicate não está configurada." });
    }

    try {
        // Usa a seed fornecida ou gera uma aleatória
        const seedToUse = seed || Math.floor(Math.random() * 1000000000);
        
        // Inicia a predição na API da Replicate
        const startResponse = await fetch("https://api.replicate.com/v1/predictions", {
            method: "POST",
            headers: { "Authorization": `Token ${apiKey}`, "Content-Type": "application/json" },
            body: JSON.stringify({
                // ALTERADO: Versão do modelo para uma versão funcional do Kling v2.1
                version: "kwaivgi/kling-v2.1:26f52d3c2390f1882339500b0a4c72863e45924a27315b86a416d2145320a8fb",
                input: { prompt, seed: seedToUse },
            }),
        });

        let prediction = await startResponse.json();
        if (startResponse.status !== 201) {
            // Mensagem de erro para refletir a geração de vídeo
            throw new Error(prediction.detail || "Falha ao iniciar a geração do vídeo.");
        }

        // Aguarda até que a geração do vídeo seja concluída ou falhe
        while (prediction.status !== "succeeded" && prediction.status !== "failed") {
            await sleep(1000); // Pausa de 1 segundo entre as verificações
            const statusResponse = await fetch(prediction.urls.get, {
                headers: { "Authorization": `Token ${apiKey}` },
            });
            prediction = await statusResponse.json();
            if (statusResponse.status !== 200) {
                throw new Error(prediction.detail || "Falha ao verificar o estado da geração.");
            }
        }

        // Verifica o resultado final
        if (prediction.status === "succeeded") {
            // Resposta para retornar `videoURL`
            res.status(200).json({ videoURL: prediction.output, seed: seedToUse });
        } else {
            // Mensagem de erro para refletir a geração de vídeo
            throw new Error(`A geração do vídeo falhou: ${prediction.error}`);
        }

    } catch (error) {
        console.error("Erro na API da Replicate:", error);
        res.status(500).json({ error: error.message });
    }
};
