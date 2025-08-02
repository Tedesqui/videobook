// Importa o cliente do AWS Textract do SDK da AWS v3
import { TextractClient, DetectDocumentTextCommand } from "@aws-sdk/client-textract";

/**
 * Converte uma imagem em formato Data URL (base64) para um array de bytes (Buffer).
 * @param {string} base64 - A string da imagem em base64.
 * @returns {Buffer} - Os bytes da imagem.
 */
function base64ToBytes(base64) {
  // Remove o prefixo "data:image/png;base64," da string
  const base64Data = base64.replace(/^data:image\/\w+;base64,/, "");
  return Buffer.from(base64Data, 'base64');
}

/**
 * Wrapper para adicionar cabeçalhos CORS a uma função de servidor.
 * @param {Function} fn - A função de handler a ser envolvida.
 */
const allowCors = fn => async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }
  return await fn(req, res);
};

/**
 * Handler principal da API que recebe uma imagem e retorna o texto extraído.
 */
async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método não permitido.' });
  }

  // Verifica se as credenciais da AWS estão configuradas nas variáveis de ambiente
  if (!process.env.AWS_ACCESS_KEY_ID || !process.env.AWS_SECRET_ACCESS_KEY || !process.env.AWS_REGION) {
    console.error("Credenciais da AWS não configuradas.");
    return res.status(500).json({ error: "Credenciais da AWS não configuradas no servidor." });
  }

  try {
    const { imageBase64 } = req.body;
    if (!imageBase64) {
      return res.status(400).json({ error: "Nenhuma imagem fornecida." });
    }

    // Inicializa o cliente do Textract com as credenciais do ambiente
    const client = new TextractClient({
      region: process.env.AWS_REGION,
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
      },
    });

    const imageBytes = base64ToBytes(imageBase64);
    
    // Cria e envia o comando para detectar o texto no documento
    const command = new DetectDocumentTextCommand({
      Document: { Bytes: imageBytes },
    });
    
    const data = await client.send(command);
    
    // Processa a resposta do Textract para juntar as linhas de texto detectadas
    let extractedText = "";
    if (data.Blocks) {
      data.Blocks.forEach(block => {
        if (block.BlockType === "LINE") {
          extractedText += block.Text + "\n"; // Adiciona uma quebra de linha entre as linhas
        }
      });
    }

    // Retorna o texto extraído com sucesso
    res.status(200).json({ text: extractedText.trim() });

  } catch (error) {
    console.error("Erro no AWS Textract:", error);
    res.status(500).json({ error: `Falha ao processar a imagem: ${error.message}` });
  }
}

export default allowCors(handler);
