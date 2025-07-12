// Ficheiro: /pages/index.js (Exemplo em Next.js)
// Este frontend usa componentes do Clerk para gerir o estado de autenticação e UI.

import { useState, useEffect } from 'react';
import { SignedIn, SignedOut, UserButton, useUser, SignInButton } from "@clerk/nextjs";

// Componente principal da página
export default function HomePage() {
  const { user } = useUser();
  const [userCredits, setUserCredits] = useState(0);
  const [status, setStatus] = useState("Bem-vindo!");
  const [videoUrl, setVideoUrl] = useState(null);
  const [isLoading, setIsLoading] = useState(false);

  // Função para buscar o número de créditos do utilizador no nosso backend
  const fetchUserCredits = async () => {
    if (!user) return;
    try {
      const response = await fetch('/api/get-user-credits'); // Precisamos de criar este endpoint
      const data = await response.json();
      if (response.ok) {
        setUserCredits(data.credits);
      }
    } catch (error) {
      console.error("Erro ao buscar créditos:", error);
    }
  };

  // Busca os créditos quando o utilizador carrega a página
  useEffect(() => {
    fetchUserCredits();
  }, [user]);

  // Função para iniciar a compra de um crédito
  const handlePurchaseCredit = async () => {
    setIsLoading(true);
    setStatus("A criar a sua sessão de pagamento...");
    try {
      const response = await fetch('/api/create-payment-session', {
        method: 'POST',
      });
      const { url } = await response.json();
      window.location.href = url; // Redireciona para o checkout do Stripe
    } catch (error) {
      setStatus(`Erro: ${error.message}`);
      setIsLoading(false);
    }
  };

  // Função para gerar o vídeo, que agora consome um crédito
  const handleGenerateVideo = async () => {
    if (userCredits < 1) {
        setStatus("Você não tem créditos suficientes. Por favor, compre um crédito para gerar um vídeo.");
        return;
    }

    setIsLoading(true);
    setVideoUrl(null);
    setStatus("A usar um crédito para gerar o seu vídeo...");

    try {
        const prompt = "Um gato astronauta a flutuar no espaço, arte digital.";
        const response = await fetch('/api/generate-video-with-credit', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ prompt }),
        });

        const data = await response.json();
        if (!response.ok) {
            throw new Error(data.error);
        }
        
        setVideoUrl(data.videoURL);
        setStatus("Vídeo gerado com sucesso! Crédito utilizado.");
        fetchUserCredits(); // Atualiza a contagem de créditos na UI

    } catch (error) {
        setStatus(`❌ Erro: ${error.message}`);
    } finally {
        setIsLoading(false);
    }
  };

  return (
    <div style={styles.container}>
      <header style={styles.header}>
        <h2 style={styles.title}>Gerador de Vídeo (Pagamento por Uso)</h2>
        <SignedIn>
          <div style={{display: 'flex', alignItems: 'center', gap: '15px'}}>
            <span style={styles.credits}>Créditos: {userCredits}</span>
            <UserButton afterSignOutUrl="/" />
          </div>
        </SignedIn>
      </header>
      
      <main style={styles.main}>
        <SignedOut>
          <div style={styles.card}>
            <h3 style={{color: '#333'}}>Faça Login para Começar</h3>
            <SignInButton mode="modal">
                <button style={styles.button}>Fazer Login</button>
            </SignInButton>
          </div>
        </SignedOut>

        <SignedIn>
          <div style={styles.card}>
            {videoUrl ? <video src={videoUrl} controls autoPlay style={{ width: '100%' }} /> : <p>O seu vídeo aparecerá aqui.</p>}
          </div>

          <div style={styles.buttonGroup}>
            <button onClick={handlePurchaseCredit} disabled={isLoading} style={styles.button}>
              Comprar 1 Crédito (R$ 5,00)
            </button>
            <button onClick={handleGenerateVideo} disabled={isLoading || userCredits < 1} style={styles.button}>
              {isLoading ? "A gerar..." : "Gerar Vídeo (Usar 1 Crédito)"}
            </button>
          </div>
          <p style={styles.status}>{status}</p>
        </SignedIn>
      </main>
    </div>
  );
}

// Estilos de exemplo
const styles = {
  container: { width: '100%', maxWidth: '800px', margin: 'auto', fontFamily: 'sans-serif', backgroundColor: '#f0f2f5', minHeight: '100vh' },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '20px', borderBottom: '1px solid #ddd' },
  title: { fontSize: '1.5em', color: '#333', margin: 0 },
  main: { padding: '20px' },
  card: { border: '1px solid #ddd', borderRadius: '8px', padding: '40px', minHeight: '300px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', backgroundColor: 'white', marginBottom: '20px' },
  button: { padding: '15px 20px', fontSize: '1em', cursor: 'pointer', backgroundColor: '#0070f3', color: 'white', border: 'none', borderRadius: '8px', width: '100%' },
  status: { marginTop: '20px', color: '#555', textAlign: 'center' },
  credits: { fontWeight: 'bold', color: '#333' },
  buttonGroup: { display: 'flex', gap: '10px', width: '100%'}
};
