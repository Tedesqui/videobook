// Ficheiro: /api/get-user-credits.js
// Endpoint para o frontend verificar de forma segura os créditos do utilizador.

import { getAuth } from '@clerk/nextjs/server';
import { sql } from '@vercel/postgres';

export default async function handler(req, res) {
  // Apenas permite pedidos do tipo GET
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    return res.status(405).end('Método não permitido');
  }

  try {
    // Obtém o ID do utilizador da sessão do Clerk
    const { userId } = getAuth(req);

    // Se não houver userId, o utilizador não está logado
    if (!userId) {
      return res.status(401).json({ error: "Não autenticado." });
    }

    // Procura o utilizador na base de dados pelo seu clerk_id
    const { rows } = await sql`
      SELECT credits FROM users WHERE clerk_id = ${userId};
    `;
    
    // Se o utilizador for encontrado, devolve o número de créditos.
    // Se não for encontrado (por exemplo, um utilizador novo que ainda não comprou créditos),
    // o resultado será uma linha vazia, e nesse caso, devolvemos 0.
    const credits = rows[0]?.credits || 0;
    
    res.status(200).json({ credits });

  } catch (error) {
    console.error("Erro ao obter os créditos do utilizador:", error);
    res.status(500).json({ error: "Erro ao comunicar com a base de dados." });
  }
}
