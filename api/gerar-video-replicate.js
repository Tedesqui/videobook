// Ficheiro: /api/gerar-video-replicate.js

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
        const seedToUse = seed || Math.floor(Math.random() * 1000000000);
        const startResponse = await fetch("https://api.replicate.com/v1/predictions", {
            method: "POST",
            headers: { "Authorization": `Token ${apiKey}`, "Content-Type": "application/json" },
            body: JSON.stringify({
                version: "9f747673945c62801b13b84701c783929c0ee784e4748ec062204894dda1a351",
                input: { prompt, seed: seedToUse },
            }),
        });

        let prediction = await startResponse.json();
        if (startResponse.status !== 201) {
            throw new Error(prediction.detail || "Falha ao iniciar a geração do vídeo.");
        }

        while (prediction.status !== "succeeded" && prediction.status !== "failed") {
            await sleep(1000);
            const statusResponse = await fetch(prediction.urls.get, {
                headers: { "Authorization": `Token ${apiKey}` },
            });
            prediction = await statusResponse.json();
            if (statusResponse.status !== 200) {
                throw new Error(prediction.detail || "Falha ao verificar o estado.");
            }
        }

        if (prediction.status === "succeeded") {
            res.status(200).json({ videoURL: prediction.output?.[0], seed: seedToUse });
        } else {
            throw new Error(`A geração do vídeo falhou: ${prediction.error}`);
        }

    } catch (error) {
        console.error("Erro na API da Replicate:", error);
        res.status(500).json({ error: error.message });
    }
};
