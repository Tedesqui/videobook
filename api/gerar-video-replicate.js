// Ficheiro: /api/gerar-video-replicate.js (Agora com Adobe OCR)

// NOTA: Para este código funcionar, o SDK da Adobe precisa de ser adicionado ao seu projeto.
// No seu ficheiro package.json, adicione: "dependencies": { "@adobe/pdfservices-node-sdk": "..." }
import {
    ServicePrincipalCredentials,
    ExecutionContext,
    pdfServices,
    MimeType,
} from "@adobe/pdfservices-node-sdk";
import { Readable } from "stream";

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

    // --- Obtenção das Chaves de API (Seguro) ---
    const replicateApiKey = process.env.REPLICATE_API_KEY;
    const adobeClientId = process.env.ADOBE_CLIENT_ID;
    const adobeClientSecret = process.env.ADOBE_CLIENT_SECRET;

    if (!replicateApiKey || !adobeClientId || !adobeClientSecret) {
        return res.status(500).json({ error: "Erro de configuração: uma ou mais chaves de API não estão definidas no servidor." });
    }

    // A entrada agora é uma imagem em formato base64.
    const { imageBase64 } = req.body;
    if (!imageBase64) {
        return res.status(400).json({ error: "A imagem (em base64) é obrigatória." });
    }

    try {
        // --- PASSO 1: Extrair texto com a Adobe OCR API ---
        console.log("A iniciar extração de texto com a Adobe OCR...");
        const prompt = await extractTextWithAdobe(imageBase64, adobeClientId, adobeClientSecret);
        
        if (!prompt || prompt.trim().length < 5) {
            throw new Error("O OCR da Adobe não conseguiu extrair texto suficiente da imagem.");
        }
        console.log(`Texto extraído pela Adobe: "${prompt}"`);

        // --- PASSO 2: Gerar vídeo com a Replicate usando o texto extraído ---
        console.log("A iniciar geração de vídeo com a Replicate...");
        const videoURL = await generateVideoWithReplicate(prompt, replicateApiKey);
        
        console.log(`Vídeo gerado com sucesso: ${videoURL}`);
        return res.status(200).json({ videoURL: videoURL });

    } catch (error) {
        console.error("Erro no processo combinado:", error);
        return res.status(500).json({ error: error.message });
    }
}

/**
 * Função para extrair texto de uma imagem usando a Adobe PDF Services API.
 */
async function extractTextWithAdobe(imageBase64, clientId, clientSecret) {
    // Converte a string base64 de volta para um buffer que o SDK da Adobe consegue ler.
    const imageBuffer = Buffer.from(imageBase64.split(';base64,').pop(), 'base64');
    const inputStream = Readable.from(imageBuffer);

    // Configura as credenciais e o contexto de execução da Adobe.
    const credentials = new ServicePrincipalCredentials(clientId, clientSecret);
    const executionContext = ExecutionContext.create(credentials);
    const ocrOperation = pdfServices.OCR.createNew();
    
    // Define a imagem de entrada para a operação de OCR.
    const inputAsset = pdfServices.Asset.fromStream(inputStream, MimeType.PNG);
    ocrOperation.setInput(inputAsset);

    // Executa a operação de OCR.
    const resultAsset = await ocrOperation.execute(executionContext);

    // O resultado da Adobe é um ficheiro JSON estruturado.
    // Esta é uma representação conceptual de como o texto seria extraído.
    const stream = await pdfServices.IO.getResultStream(resultAsset);
    
    let resultJsonString = '';
    for await (const chunk of stream) {
        resultJsonString += chunk;
    }
    const resultJson = JSON.parse(resultJsonString);

    // Concatena o texto de todos os elementos encontrados no JSON.
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
async function generateVideoWithReplicate(prompt, apiKey) {
    // Inicia a previsão
    const startResponse = await fetch("https://api.replicate.com/v1/predictions", {
        method: "POST",
        headers: { "Authorization": `Token ${apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
            version: "9f747673945c62801b13b84701c783929c0ee784e4748ec062204894dda1a351",
            input: { prompt: prompt },
        }),
    });

    let prediction = await startResponse.json();
    if (startResponse.status !== 201) {
        throw new Error(prediction.detail || "Falha ao iniciar a geração do vídeo na Replicate.");
    }

    // Verifica o estado até estar concluído
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
        return videoURL;
    } else {
        throw new Error(`A geração do vídeo na Replicate falhou: ${prediction.error}`);
    }
}
