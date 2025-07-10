// Ficheiro: /api/gerar-video-replicate.js

// Função auxiliar para criar pausas entre as verificações de estado
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// A função handler é executada no servidor da Vercel, protegendo a sua chave de API.
export default async function handler(req, res) {
    if (req.method !== 'POST') {
        res.setHeader('Allow', ['POST']);
        return res.status(405).end(`Método ${req.method} não permitido.`);
    }

    // Obter a chave da API da Replicate das Variáveis de Ambiente (SEGURO)
    const apiKey = process.env.REPLICATE_API_KEY;

    if (!apiKey) {
        return res.status(500).json({ error: "Erro de configuração no servidor: a chave da API da Replicate não está definida." });
    }

    const { prompt } = req.body;

    if (!prompt) {
        return res.status(400).json({ error: "O 'prompt' de texto é obrigatório." });
    }

    try {
        // --- PASSO 1: Iniciar a geração do vídeo ---
        // Enviamos o pedido inicial para a Replicate para começar a processar o vídeo.
        const startResponse = await fetch("https://api.replicate.com/v1/predictions", {
            method: "POST",
            headers: {
                "Authorization": `Token ${apiKey}`,
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                // Usamos a versão específica de um modelo de texto-para-vídeo popular.
                // Exemplo: anotherjesse/zeroscope-v2-xl
                version: "9f747673945c62801b13b84701c783929c0ee784e4748ec062204894dda1a351",
                input: { prompt: prompt },
            }),
        });

        let prediction = await startResponse.json();

        if (startResponse.status !== 201) {
            throw new Error(prediction.detail || "Falha ao iniciar a geração do vídeo.");
        }

        // --- PASSO 2: Verificar o estado da geração ---
        // A Replicate dá-nos um URL para verificarmos o progresso.
        // Continuamos a verificar até que o estado seja 'succeeded' ou 'failed'.
        while (prediction.status !== "succeeded" && prediction.status !== "failed") {
            await sleep(1000); // Espera 1 segundo entre cada verificação
            const statusResponse = await fetch(prediction.urls.get, {
                headers: {
                    "Authorization": `Token ${apiKey}`,
                    "Content-Type": "application/json",
                },
            });
            prediction = await statusResponse.json();
            if (statusResponse.status !== 200) {
                throw new Error(prediction.detail || "Falha ao verificar o estado do vídeo.");
            }
        }

        // --- PASSO 3: Devolver o resultado ---
        if (prediction.status === "succeeded") {
            // A API devolve um array de URLs, pegamos o primeiro.
            const videoURL = prediction.output?.[0];
            if (!videoURL) {
                throw new Error("A resposta da API não continha um URL de vídeo válido.");
            }
            // Envia o URL do vídeo de volta para o frontend
            return res.status(200).json({ videoURL: videoURL });
        } else {
            // Se a geração falhou, devolve o erro.
            throw new Error(`A geração do vídeo falhou: ${prediction.error}`);
        }

    } catch (error) {
        console.error("Erro interno do servidor:", error);
        return res.status(500).json({ error: error.message });
    }
}
