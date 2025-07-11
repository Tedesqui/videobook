// Ficheiro: /api/ocr-aws.js

const { TextractClient, DetectDocumentTextCommand } = require("@aws-sdk/client-textract");

module.exports = async (req, res) => {
    if (req.method !== 'POST') {
        return res.status(405).end("Método não permitido.");
    }

    const { imageBase64 } = req.body;
    if (!imageBase64) {
        return res.status(400).json({ error: "A imagem é obrigatória." });
    }

    try {
        const textractClient = new TextractClient({
            region: process.env.AWS_REGION,
            credentials: {
                accessKeyId: process.env.AWS_ACCESS_KEY_ID,
                secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
            },
        });
        
        const imageBuffer = Buffer.from(imageBase64.split(';base64,').pop(), 'base64');
        const command = new DetectDocumentTextCommand({ Document: { Bytes: imageBuffer } });
        const data = await textractClient.send(command);
        
        let extractedText = "";
        if (data.Blocks) {
            data.Blocks.forEach(block => {
                if (block.BlockType === 'LINE') {
                    extractedText += block.Text + " ";
                }
            });
        }
        
        res.status(200).json({ text: extractedText.trim() });

    } catch (error) {
        console.error("Erro na API do AWS Textract:", error);
        res.status(500).json({ error: "Falha ao extrair texto da imagem." });
    }
};
