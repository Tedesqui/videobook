// Ficheiro: /api/gerar-imagem-replicate.js
// Este script foi modificado para gerar imagens usando a API da Replicate.

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
                // ALTERADO: Versão do modelo para Stable Diffusion (geração de imagem)
                version: "db21e45d3f7023abc2a46ee38a23973f6dce16bb082a930b0c49861e56165135",
                input: { prompt, seed: seedToUse },
            }),
        });

        let prediction = await startResponse.json();
        if (startResponse.status !== 201) {
            // ALTERADO: Mensagem de erro para refletir a geração de imagem
            throw new Error(prediction.detail || "Falha ao iniciar a geração da imagem.");
        }

        // Aguarda até que a geração da imagem seja concluída ou falhe
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
            // ALTERADO: Resposta para retornar `imageURL` em vez de `videoURL`
            res.status(200).json({ imageURL: prediction.output?.[0], seed: seedToUse });
        } else {
            // ALTERADO: Mensagem de erro para refletir a geração de imagem
            throw new Error(`A geração da imagem falhou: ${prediction.error}`);
        }

    } catch (error) {
        console.error("Erro na API da Replicate:", error);
        res.status(500).json({ error: error.message });
    }
};
