// Ficheiro: /api/gerar-video-replicate.js (Agora com Adobe OCR e Consistência)

// NOTA: Para este código funcionar, o SDK da Adobe precisa de ser adicionado ao seu projeto.
// No seu ficheiro package.json, adicione: "dependencies": { "@adobe/pdfservices-node-sdk": "..." }

// **CORREÇÃO:** Importa os componentes específicos diretamente do módulo usando 'require'.
// Esta é a forma mais robusta de lidar com a compatibilidade entre módulos CommonJS (Adobe) e ES Modules (Vercel).
const { ServicePrincipalCredentials, ExecutionContext, pdfServices, MimeType, IO } = require("@adobe/pdfservices-node-sdk");
const { Readable } = require("stream");

// Função auxiliar para criar pausas.
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Função principal que é executada no servidor da Vercel.
 * Recebe uma imagem, extrai o texto com a Adobe OCR e gera um vídeo com a Replicate.
 */
export default async function handler(req, res) {
    if (req.method !== 'POST') {
        res.setHeader('Allow', ['POST']);
        return res.status(405).end(`Método ${req.method} não permitido.`);
    }

    const replicateApiKey = process.env.REPLICATE_API_KEY;
    const adobeClientId = process.env.ADOBE_CLIENT_ID;
    const adobeClientSecret = process.env.ADOBE_CLIENT_SECRET;

    if (!replicateApiKey || !adobeClientId || !adobeClientSecret) {
        return res.status(500).json({ error: "Erro de configuração: uma ou mais chaves de API não estão definidas no servidor." });
    }

    const { imageBase64, seed } = req.body;
    if (!imageBase64) {
        return res.status(400).json({ error: "A imagem (em base64) é obrigatória." });
    }

    try {
        console.log("A iniciar extração de texto com a Adobe OCR...");
        const prompt = await extractTextWithAdobe(imageBase64, adobeClientId, adobeClientSecret);
        
        if (!prompt || prompt.trim().length < 5) {
            throw new Error("O OCR da Adobe não conseguiu extrair texto suficiente da imagem.");
        }
        console.log(`Texto extraído pela Adobe: "${prompt}"`);

        console.log("A iniciar geração de vídeo com a Replicate...");
        const { videoURL, usedSeed } = await generateVideoWithReplicate(prompt, replicateApiKey, seed);
        
        console.log(`Vídeo gerado com sucesso: ${videoURL} usando a semente: ${usedSeed}`);
        return res.status(200).json({ videoURL: videoURL, seed: usedSeed });

    } catch (error) {
        console.error("Erro no processo combinado:", error);
        return res.status(500).json({ error: error.message });
    }
}

/**
 * Função para extrair texto de uma imagem usando a Adobe PDF Services API.
 */
async function extractTextWithAdobe(imageBase64, clientId, clientSecret) {
    const imageBuffer = Buffer.from(imageBase64.split(';base64,').pop(), 'base64');
    const inputStream = Readable.from(imageBuffer);

    // **CORREÇÃO:** Agora usamos as variáveis importadas diretamente.
    const credentials = new ServicePrincipalCredentials(clientId, clientSecret);
    const executionContext = ExecutionContext.create(credentials);
    const ocrOperation = pdfServices.OCR.createNew();
    
    const inputAsset = pdfServices.Asset.fromStream(inputStream, MimeType.PNG);
    ocrOperation.setInput(inputAsset);

    const resultAsset = await ocrOperation.execute(executionContext);
    const stream = await IO.getResultStream(resultAsset);
    
    let resultJsonString = '';
    for await (const chunk of stream) {
        resultJsonString += chunk;
    }
    const resultJson = JSON.parse(resultJsonString);

    let extractedText = "";
    if (resultJson && resultJson.elements) {
        resultJson.elements.forEach(element => {
            if (element.Text) {
                extractedText += element.Text + " ";
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
