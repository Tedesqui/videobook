// /api/gerar-video-com-texto-fal.js

export default function handler(req, res) {
  // Apenas responde com uma mensagem de sucesso
  res.status(200).json({ status: 'A função gerar-video está a funcionar!' });
}
