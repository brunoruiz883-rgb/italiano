# 🇮🇹 Parole Cadenti — Gioco per Imparare l'Italiano

Um jogo web moderno e futurista (HTML + CSS + JavaScript puro, sem bibliotecas externas) para aprender vocabulário e expressões em italiano enquanto digita palavras que caem na tela no estilo arcade neon cyberpunk.

---

## 🚀 Como Jogar

1. **Abra o arquivo [`index.html`](file:///c:/Users/User/Documents/italiano/index.html) diretamente no seu navegador** (Google Chrome, Microsoft Edge, Firefox, Safari ou navegadores móveis).
2. Não requer instalação, servidores locais nem dependências externas. Tudo roda 100% no navegador!

---

## 🎮 Mecânica do Jogo

- **Palavras em Queda**: Palavras italianas caem do topo em plataformas flutuantes com iluminação neon. Logo abaixo da palavra em italiano, a **tradução em português** é exibida para aprendizado simultâneo.
- **Digitação com Bloqueio de Alvo**: Ao digitar a primeira letra de uma palavra na tela, o jogo foca nela automaticamente.
  - **Letra correta**: acende em verde esmeralda neon brilhante com feedback sonoro.
  - **Letra errada**: faz a plataforma tremer (*shake*), emite um zumbido de erro e quebra o multiplicador de combo.
  - **Acentos e Flexibilidade**: O jogo aceita tanto digitação com acentos diretos (`à`, `è`, `é`, `ì`, `ò`, `ù`), inclusive pelo teclado virtual, quanto a versão não-acentuada correspondente (`e` para `è`), facilitando para teclados internacionais e brasileiros.
- **Palavra Concluída**:
  - Explosão espetacular de partículas neon.
  - **Pronúncia em italiano real** via **Web Speech API (`it-IT`)**.
  - Pontuação dinâmica baseada no tamanho da palavra, nível e multiplicador de combo.
  - Multiplicador de combo aumenta progressivamente (`x1`, `x2`, `x3`...).
- **Zona de Perigo (Linha Laser Vermelha)**:
  - Se uma palavra atingir a linha laser no fundo, o jogador perde 1 vida (representada por 3 corações ❤️❤️❤️).
  - A palavra perdida vai automaticamente para o **Caderno de Revisão (Repetição Espaçada)** para reaparecer com prioridade no jogo.
  - Se as vidas chegarem a 0, ocorre o Game Over.
- **Teclado Virtual Interativo**:
  - Exibido na parte inferior com feedback visual em tempo real (acende ao pressionar tanto teclas físicas quanto ao tocar na tela de celulares e tablets).
  - Inclui barra de espaço para expressões idiomáticas, tecla Backspace (`⌫ CANC`), apóstrofo e teclas dedicadas aos acentos italianos (`À`, `È`, `É`, `Ì`, `Ò`, `Ù`).

---

## 📈 Níveis e Progressão até a Fluência

O jogo contém **255 palavras e expressões** categorizadas segundo o Quadro Europeu Comum de Referência (QECR / CEFR), com mais de 40 itens por nível:

1. **A1 — Principiante (Iniciante)**:
   - 3 a 5 letras (*ciao, casa, pane, vino, mare, acqua, gatto, sole, notte, cielo...*).
   - Velocidade lenta, 1 palavra por vez na tela.
2. **A2 — Elementare (Básico)**:
   - 5 a 7 letras (*famiglia, mangiare, stazione, domani, finestra, giardino, viaggiare...*).
   - 2 palavras simultâneas na tela.
3. **B1 — Intermedio (Intermediário)**:
   - 6 a 9 letras, verbos conjugados e expressões (*imparare, spiegare, decidere, vorrei, grazie mille, a presto...*).
   - 3 palavras simultâneas.
4. **B2 — Intermedio Superiore (Intermediário Superior)**:
   - 8 a 11 letras, vocabulário abstrato (*esperienza, ambiente, sviluppare, sostenibile, responsabilità, opportunità...*).
   - 3 a 4 palavras simultâneas.
5. **C1 — Avanzato (Avançado)**:
   - Palavras cultas e expressões idiomáticas (*in bocca al lupo, rompere il ghiaccio, gettare la spugna, consapevolezza, imprescindibile...*).
   - 4 palavras simultâneas, ritmo acelerado.
6. **C2 — Padronanza / Maestria (Proficiência)**:
   - Expressões raras, subjuntivo refinado, termos literários e sutilezas (*non vedo l'ora, salvo imprevisti, qualora fosse, sesquipedale, ineluttabile, acribia...*).
   - 5 palavras simultâneas na tela em velocidade máxima.

### Critério de Subida de Nível:
- O jogador sobe de nível a cada **15 palavras acertadas** com **precisão ≥ 80%**.
- Ao concluir o nível C2, é exibida a tela comemorativa **"FLUENTE 🇮🇹"**, com troféu dourado, chuva de confetes, resumo de desempenho e desbloqueio do **Modo Maestria (Infinito)**, que mescla todos os 6 níveis.

---

## 🧠 Recursos Didáticos e Aprendizado

- **Pronúncia Nativa (`it-IT`)**: Síntese de voz italiana acionada imediatamente ao acertar cada palavra (com botão de ativação/desativação).
- **Repetição Espaçada**: Palavras erradas ou perdidas na linha de perigo entram na fila de revisão e voltam a cair com maior frequência.
- **Caderno de Revisão**: Acessível pelo menu inicial ou ao pausar, permitindo rever todas as palavras com suas traduções e ouvir a pronúncia clicando no ícone 🔊.
- **Métricas ao Vivo no HUD**:
  - Pontuação total
  - Multiplicador de Combo
  - WPM (Palavras por Minuto)
  - Taxa de Precisão (%)
  - Vidas restantes
  - **Barra de Progresso Dinâmica Contínua (A1 → C2 → 🏆 Fluente)**: A linha cibernética de conexão une o centro dos círculos dos níveis e se preenche gradualmente em tempo real a cada palavra acertada (0 a 15), exibindo o contador dinâmico sob cada nó e um feixe luminoso na ponta condutora até a meta da fluência.
- **Persistência Local (`localStorage`)**:
  - Recorde de pontos salvo
  - Níveis desbloqueados
  - Histórico de palavras dominadas
  - Fila de revisão de termos difíceis
  - Preferências de som, tradução e voz

---

## 🔊 Áudio 100% Procedural (Web Audio API)

- Sem arquivos externos de MP3/WAV: todos os efeitos sonoros são gerados matematicamente com osciladores e curvas de ganho:
  - *Click/Blip* futurista a cada letra digitada.
  - *Buzz* dissonante de erro.
  - *Chime* harmônico com arpejo dinâmico crescente baseado no combo.
  - *Laser thud* de impacto na linha de perigo.
  - Fanfarra eletrônica de subida de nível.
  - Tema triunfal de vitória "Fluente".
  - Tema dramático de Game Over.

