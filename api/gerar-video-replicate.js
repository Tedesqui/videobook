// Ficheiro: /api/gerar-video-replicate.js

// NOTA: Para este código funcionar, o SDK da AWS precisa de ser adicionado ao seu projeto.
// No seu ficheiro package.json, adicione: "dependencies": { "@aws-sdk/client-textract": "..." }

const { TextractClient, DetectDocumentTextCommand } = require("@aws-sdk/client-textract");
const { Readable } = require("stream");

// Função auxiliar para criar pausas.
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Função principal que é executada no servidor da Vercel.
 * Recebe uma imagem, extrai o texto com o Amazon Textract e gera um vídeo com a Replicate.
 */
module.exports = async (req, res) => {
    if (req.method !== 'POST') {
        res.setHeader('Allow', ['POST']);
        return res.status(405).end(`Método ${req.method} não permitido.`);
    }

    // --- Obtenção das Chaves de API (Seguro) ---
    const replicateApiKey = process.env.REPLICATE_API_KEY;
    const awsAccessKeyId = process.env.AWS_ACCESS_KEY_ID;
    const awsSecretAccessKey = process.env.AWS_SECRET_ACCESS_KEY;
    const awsRegion = process.env.AWS_REGION;

    if (!replicateApiKey || !awsAccessKeyId || !awsSecretAccessKey || !awsRegion) {
        return res.status(500).json({ error: "Erro de configuração: uma ou mais chaves de API (Replicate ou AWS) não estão definidas no servidor." });
    }

    const { imageBase64, seed } = req.body;
    if (!imageBase64) {
        return res.status(400).json({ error: "A imagem (em base64) é obrigatória." });
    }

    try {
        console.log("A iniciar extração de texto com o Amazon Textract...");
        const prompt = await extractTextWithAmazonTextract(imageBase64, {
            region: awsRegion,
            credentials: {
                accessKeyId: awsAccessKeyId,
                secretAccessKey: awsSecretAccessKey,
            },
        });
        
        if (!prompt || prompt.trim().length < 5) {
            throw new Error("O OCR do Amazon Textract não conseguiu extrair texto suficiente da imagem.");
        }
        console.log(`Texto extraído pela AWS: "${prompt}"`);

        console.log("A iniciar geração de vídeo com a Replicate...");
        const { videoURL, usedSeed } = await generateVideoWithReplicate(prompt, replicateApiKey, seed);
        
        console.log(`Vídeo gerado com sucesso: ${videoURL} usando a semente: ${usedSeed}`);
        return res.status(200).json({ videoURL: videoURL, seed: usedSeed });

    } catch (error) {
        console.error("Erro no processo combinado:", error);
        return res.status(500).json({ error: error.message });
    }
};

/**
 * Função para extrair texto de uma imagem usando a Amazon Textract API.
 */
async function extractTextWithAmazonTextract(imageBase64, awsConfig) {
    // Configura o cliente do Textract com as credenciais e região.
    const textractClient = new TextractClient(awsConfig);
    
    // Converte a imagem base64 para um buffer.
    const imageBuffer = Buffer.from(imageBase64.split(';base64,').pop(), 'base64');

    // Prepara o comando para enviar ao Textract.
    const command = new DetectDocumentTextCommand({
        Document: {
            Bytes: imageBuffer,
        },
    });

    // Envia o comando e aguarda a resposta.
    const data = await textractClient.send(command);
    
    let extractedText = "";
    if (data.Blocks) {
        // Filtra apenas os blocos que são linhas de texto e junta-os.
        data.Blocks.forEach(block => {
            if (block.BlockType === 'LINE') {
                extractedText += block.Text + " ";
            }
        });
    }

    return extractedText.trim();
}


/**
 * Função para gerar um vídeo a partir de um prompt de texto usando a Replicate API.
 */
async function generateVideoWithReplicate(prompt, apiKey, seed) {
    const seedToUse = seed || Math.floor(Math.random() * 1000000000);

    const startResponse = await fetch("https://api.replicate.com/v1/predictions", {
        method: "POST",
        headers: { "Authorization": `Token ${apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
            version: "9f747673945c62801b13b84701c783929c0ee784e4748ec062204894dda1a351",
            input: { 
                prompt: prompt,
                seed: seedToUse
            },
        }),
    });

    let prediction = await startResponse.json();
    if (startResponse.status !== 201) {
        throw new Error(prediction.detail || "Falha ao iniciar a geração do vídeo na Replicate.");
    }

    while (prediction.status !== "succeeded" && prediction.status !== "failed") {
        await sleep(1000);
        const statusResponse = await fetch(prediction.urls.get, {
            headers: { "Authorization": `Token ${apiKey}`, "Content-Type": "application/json" },
        });
        prediction = await statusResponse.json();
        if (statusResponse.status !== 200) {
            throw new Error(prediction.detail || "Falha ao verificar o estado do vídeo na Replicate.");
        }
    }

    if (prediction.status === "succeeded") {
        const videoURL = prediction.output?.[0];
        if (!videoURL) throw new Error("A resposta da Replicate não continha um URL de vídeo válido.");
        return { videoURL: videoURL, usedSeed: seedToUse };
    } else {
        throw new Error(`A geração do vídeo na Replicate falhou: ${prediction.error}`);
    }
}
