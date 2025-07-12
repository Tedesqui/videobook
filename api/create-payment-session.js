// Ficheiro: /api/create-payment-session.js

import { getAuth } from '@clerk/nextjs/server';
const Stripe = require('stripe');

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).end('Método não permitido');
  }

  const { userId, user } = getAuth(req);

  if (!userId) {
    return res.status(401).json({ error: "Não autenticado." });
  }

  try {
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: 'brl', // ou 'usd'
            product_data: {
              name: '1 Crédito de Geração de Vídeo',
              description: 'Um crédito para gerar um vídeo com a nossa IA.',
            },
            unit_amount: 500, // Valor em cêntimos (ex: 500 = R$ 5,00)
          },
          quantity: 1,
        },
      ],
      mode: 'payment', // MODO DE PAGAMENTO ÚNICO
      success_url: `${req.headers.origin}/?payment_success=true`,
      cancel_url: `${req.headers.origin}/`,
      metadata: {
        clerkId: userId, // Passa o ID do Clerk para o webhook
      },
      customer_email: user.primaryEmailAddress.emailAddress,
    });

    res.status(200).json({ url: session.url });

  } catch (error) {
    console.error("Erro ao criar sessão de checkout do Stripe:", error);
    res.status(500).json({ error: 'Não foi possível iniciar a sessão de pagamento.' });
  }
}
