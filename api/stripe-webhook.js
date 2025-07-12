// Ficheiro: /api/stripe-webhook.js (Atualizado para o modelo de créditos)

import { buffer } from 'micro';
import { sql } from '@vercel/postgres';
const Stripe = require('stripe');

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

export const config = { api: { bodyParser: false } };

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).end('Método não permitido');
  }

  const buf = await buffer(req);
  const sig = req.headers['stripe-signature'];
  let event;

  try {
    event = stripe.webhooks.constructEvent(buf, sig, webhookSecret);
  } catch (err) {
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;
    const clerkId = session.metadata.clerkId;

    if (!clerkId) {
      console.error("Erro: Clerk ID não encontrado nos metadados da sessão do Stripe.");
      return res.status(400).send("Clerk ID em falta.");
    }

    console.log(`Pagamento bem-sucedido para o utilizador do Clerk: ${clerkId}`);
    
    // **LÓGICA REAL DA BASE DE DADOS:**
    // Adiciona 1 crédito à conta do utilizador.
    try {
      await sql`
        INSERT INTO users (clerk_id, email, credits)
        VALUES (${clerkId}, ${session.customer_details.email}, 1)
        ON CONFLICT (clerk_id) 
        DO UPDATE SET 
          credits = users.credits + 1;
      `;
      console.log(`1 crédito adicionado ao utilizador ${clerkId}.`);
    } catch (error) {
      console.error("Erro ao adicionar crédito na base de dados:", error);
    }
  }

  res.status(200).json({ received: true });
}
