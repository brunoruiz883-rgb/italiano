/**
 * PAROLE CADENTI - Motor Principal do Jogo
 * Gerencia ciclo de vida, física de queda, digitação, progressão de níveis,
 * repetição espaçada, métricas (WPM, precisão) e interface reativa.
 */

class ParoleCadenti {
  constructor() {
    // Estado do jogo
    this.state = 'START'; // 'START' | 'PLAYING' | 'PAUSED' | 'GAMEOVER' | 'VICTORY'
    this.currentLevel = 'A1';
    this.unlockedLevels = ['A1'];
    this.score = 0;
    this.combo = 0;
    this.maxCombo = 0;
    this.lives = 3;
    this.maxLives = 3;

    // Métricas de aprendizado
    this.totalTypedChars = 0;
    this.correctTypedChars = 0;
    this.wordsCompletedInLevel = 0;
    this.wordsTargetToLevelUp = 15;
    this.minAccuracyToLevelUp = 80;
    this.startTime = null;
    this.totalWordsMastered = 0;

    // Listas de palavras
    this.wordsLearnedSession = new Set();
    this.wordsMissedSession = {}; // { 'parola': count }
    this.reviewQueue = []; // Fila de repetição espaçada
    this.fallingWords = []; // Palavras ativas na tela: [{ id, el, it, pt, nivel, x, y, speed, typedIndex, width, height }]
    this.targetWord = null; // Palavra atualmente focada pela digitação

    // Controle de tempo e spawn
    this.lastFrameTime = 0;
    this.lastSpawnTime = 0;
    this.animationFrameId = null;

    // Configurações do usuário
    this.settings = {
      showTranslations: true,
      soundFX: true,
      pronunciation: true
    };

    // Referências DOM
    this.dom = {
      gameContainer: document.getElementById('game-container'),
      wordsArea: document.getElementById('words-area'),
      laserLine: document.getElementById('laser-line'),
      hudScore: document.getElementById('hud-score'),
      hudCombo: document.getElementById('hud-combo'),
      hudWpm: document.getElementById('hud-wpm'),
      hudAccuracy: document.getElementById('hud-accuracy'),
      hudLevelBadge: document.getElementById('hud-level-badge'),
      hudLives: document.getElementById('hud-lives'),
      stepperContainer: document.getElementById('stepper-container'),
      stepperTrack: document.querySelector('.stepper-track'),
      levelStepperNodes: document.querySelectorAll('.stepper-node'),
      levelProgressFill: document.getElementById('level-progress-fill'),

      // Modais
      modalStart: document.getElementById('modal-start'),
      modalPause: document.getElementById('modal-pause'),
      modalGameOver: document.getElementById('modal-gameover'),
      modalVictory: document.getElementById('modal-victory'),
      modalReview: document.getElementById('modal-review'),

      // Elementos do Teclado Virtual
      virtualKeyboard: document.getElementById('virtual-keyboard'),
      keys: document.querySelectorAll('.keyboard-key')
    };

    // Motor de partículas
    this.particles = new ParticleSystem('effects-canvas');

    // Inicialização
    this.loadProgress();
    this.bindEvents();
    this.renderStepper();
    this.updateHUD();
    this.renderStartScreenStats();
    setTimeout(() => this.renderStepper(), 60);

    // Inicia loop de renderização de partículas de fundo
    this.renderLoop = this.renderLoop.bind(this);
    requestAnimationFrame(this.renderLoop);
  }

  // ==========================================
  // PERSISTÊNCIA (localStorage)
  // ==========================================
  loadProgress() {
    try {
      const saved = localStorage.getItem('parole_cadenti_save');
      if (saved) {
        const data = JSON.parse(saved);
        this.highScore = data.highScore || 0;
        this.unlockedLevels = data.unlockedLevels || ['A1'];
        this.masteredHistory = data.masteredHistory || [];
        this.reviewQueue = data.reviewQueue || [];
        if (data.settings) {
          this.settings = { ...this.settings, ...data.settings };
        }
      } else {
        this.highScore = 0;
        this.masteredHistory = [];
      }
    } catch (e) {
      console.warn("Erro ao carregar localStorage:", e);
      this.highScore = 0;
      this.masteredHistory = [];
    }

    // Aplica configurações nos toggles da interface
    this.syncSettingsToggles();
  }

  saveProgress() {
    try {
      const data = {
        highScore: Math.max(this.highScore || 0, this.score),
        unlockedLevels: this.unlockedLevels,
        masteredHistory: Array.from(new Set([...this.masteredHistory, ...Array.from(this.wordsLearnedSession)])),
        reviewQueue: this.reviewQueue.slice(-50), // Salva até 50 para revisão contínua
        settings: this.settings
      };
      localStorage.setItem('parole_cadenti_save', JSON.stringify(data));
      this.highScore = data.highScore;
    } catch (e) {
      console.warn("Erro ao salvar localStorage:", e);
    }
  }

  syncSettingsToggles() {
    const sfxToggle = document.getElementById('setting-sfx');
    const speechToggle = document.getElementById('setting-speech');
    const transToggle = document.getElementById('setting-trans');

    if (sfxToggle) sfxToggle.checked = this.settings.soundFX;
    if (speechToggle) speechToggle.checked = this.settings.pronunciation;
    if (transToggle) transToggle.checked = this.settings.showTranslations;

    audioManager.muted = !this.settings.soundFX;
    audioManager.speechEnabled = this.settings.pronunciation;
  }

  // ==========================================
  // CONTROLE DE NÍVEL E PROGRESSÃO
  // ==========================================
  setLevel(levelKey) {
    if (!LIVELLI_CONFIG[levelKey]) return;
    this.currentLevel = levelKey;
    this.wordsCompletedInLevel = 0;
    this.updateHUD();
    this.renderStepper();
  }

  checkLevelUp() {
    const accuracy = this.calculateAccuracy();
    if (this.wordsCompletedInLevel >= this.wordsTargetToLevelUp && accuracy >= this.minAccuracyToLevelUp) {
      const currentCfg = LIVELLI_CONFIG[this.currentLevel];
      const nextLevel = currentCfg.prossimo;

      if (nextLevel === 'MAESTRIA' || this.currentLevel === 'C2') {
        // CONQUISTOU A FLUÊNCIA!
        if (!this.unlockedLevels.includes('MAESTRIA')) {
          this.unlockedLevels.push('MAESTRIA');
        }
        this.saveProgress();
        this.triggerVictory();
      } else if (nextLevel && LIVELLI_CONFIG[nextLevel]) {
        // Sobe para o próximo nível
        if (!this.unlockedLevels.includes(nextLevel)) {
          this.unlockedLevels.push(nextLevel);
        }
        audioManager.playLevelUp();
        this.showLevelBanner(`LIVELLO COMPLETO! Benvenuto a ${LIVELLI_CONFIG[nextLevel].nome}`);
        this.setLevel(nextLevel);
        this.saveProgress();
      }
    }
  }

  showLevelBanner(text) {
    const banner = document.createElement('div');
    banner.className = 'level-up-banner';
    banner.innerHTML = `<div class="banner-glow">⭐</div><h2>${text}</h2><p>Velocità e difficoltà aumentate!</p>`;
    this.dom.gameContainer.appendChild(banner);
    setTimeout(() => {
      banner.classList.add('fade-out');
      setTimeout(() => banner.remove(), 600);
    }, 2200);
  }

  // ==========================================
  // SPAWN E FÍSICA DAS PALAVRAS
  // ==========================================
  getWordsPoolForCurrentLevel() {
    if (this.currentLevel === 'MAESTRIA') {
      return DIZIONARIO_ITALIANO;
    }
    return DIZIONARIO_ITALIANO.filter(w => w.nivel === this.currentLevel);
  }

  spawnWord() {
    const cfg = LIVELLI_CONFIG[this.currentLevel];
    if (this.fallingWords.length >= cfg.maxParoleSchermo) return;

    let wordData;
    // Prioridade para a lista de Repetição Espaçada (Revisão)
    if (this.reviewQueue.length > 0 && Math.random() < 0.45) {
      wordData = this.reviewQueue.shift();
    } else {
      const pool = this.getWordsPoolForCurrentLevel();
      // Evita duplicatas ativas na tela
      const activeTexts = this.fallingWords.map(w => w.it.toLowerCase());
      const available = pool.filter(w => !activeTexts.includes(w.it.toLowerCase()));
      const source = available.length > 0 ? available : pool;
      wordData = source[Math.floor(Math.random() * source.length)];
    }

    if (!wordData) return;

    // Calcula velocidade progressiva dentro do nível
    const progressFactor = Math.min(this.wordsCompletedInLevel / this.wordsTargetToLevelUp, 1.0);
    const speed = cfg.velocitaBase + ((cfg.velocitaMax - cfg.velocitaBase) * progressFactor);

    // Criação do elemento DOM com container interno para isolar animações de tremor
    const wordEl = document.createElement('div');
    wordEl.className = 'falling-word-card';
    wordEl.style.borderColor = cfg.colore;
    wordEl.style.boxShadow = `0 0 16px ${cfg.colore}44, inset 0 0 10px ${cfg.colore}22`;

    // Renderiza cada letra em um span separado para iluminação ao digitar
    const itWord = wordData.it.toLowerCase();
    const lettersHtml = itWord.split('').map((char, idx) => {
      if (char === ' ') {
        return `<span class="letter-char letter-space" data-idx="${idx}">&nbsp;</span>`;
      }
      return `<span class="letter-char" data-idx="${idx}">${char}</span>`;
    }).join('');

    const transVisibilityClass = this.settings.showTranslations ? '' : 'hidden-translation';
    wordEl.innerHTML = `
      <div class="word-card-inner">
        <div class="word-text">${lettersHtml}</div>
        <div class="word-translation ${transVisibilityClass}">${wordData.pt}</div>
        <div class="word-badge-level" style="background:${cfg.colore}33; color:${cfg.colore}">${wordData.nivel}</div>
      </div>
    `;

    this.dom.wordsArea.appendChild(wordEl);

    // Mede tamanho real do elemento
    const rect = wordEl.getBoundingClientRect();
    const cardWidth = rect.width || 180;
    const areaWidth = this.dom.wordsArea.clientWidth || window.innerWidth;
    const maxX = Math.max(10, areaWidth - cardWidth - 20);
    const spawnX = Math.floor(Math.random() * maxX) + 10;

    const wordObj = {
      id: 'word_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5),
      el: wordEl,
      it: itWord,
      pt: wordData.pt,
      nivel: wordData.nivel,
      x: spawnX,
      y: -60,
      speed: speed,
      typedIndex: 0,
      width: cardWidth,
      height: rect.height || 60
    };

    wordEl.style.transform = `translate3d(${wordObj.x}px, ${wordObj.y}px, 0)`;
    this.fallingWords.push(wordObj);
  }

  // Normalização de acentos (ex: permite que 'e' case com 'è' ou 'é' se o teclado não tiver a tecla direta)
  normalizeChar(char) {
    if (!char) return '';
    return char.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  }

  isCharMatch(inputChar, expectedChar) {
    if (inputChar === expectedChar) return true;
    return this.normalizeChar(inputChar) === this.normalizeChar(expectedChar);
  }

  // ==========================================
  // DIGITAÇÃO E VALIDAÇÃO DE TECLAS
  // ==========================================
  handleKeyPress(rawChar) {
    if (this.state !== 'PLAYING') return;

    // Normaliza caractere
    const char = rawChar.toLowerCase();

    // Ilumina a tecla no teclado virtual correspondente
    this.lightUpVirtualKey(char);

    // Se não há palavra alvo focada, procura uma palavra cujo próximo caractere bate
    if (!this.targetWord) {
      // Prioriza a palavra mais baixa na tela (mais perto da linha vermelha)
      const candidates = this.fallingWords
        .filter(w => this.isCharMatch(char, w.it[w.typedIndex]))
        .sort((a, b) => b.y - a.y);

      if (candidates.length > 0) {
        this.targetWord = candidates[0];
        this.targetWord.el.classList.add('active-target');
      } else {
        // Erro: nenhuma palavra ativa começa com essa letra
        this.handleTypo(null);
        return;
      }
    }

    // Com uma palavra alvo travada
    const currentWord = this.targetWord;
    const expectedChar = currentWord.it[currentWord.typedIndex];

    this.totalTypedChars++;

    if (this.isCharMatch(char, expectedChar)) {
      // Letra CORRETA!
      this.correctTypedChars++;
      audioManager.playKeyPress();

      // Ilumina a letra correspondente
      const letterSpans = currentWord.el.querySelectorAll('.letter-char');
      if (letterSpans[currentWord.typedIndex]) {
        letterSpans[currentWord.typedIndex].classList.add('letter-typed');
      }

      currentWord.typedIndex++;

      // Verifica se completou a palavra inteira
      if (currentWord.typedIndex >= currentWord.it.length) {
        this.handleWordComplete(currentWord);
      }
    } else {
      // Letra ERRADA para a palavra travada!
      this.handleTypo(currentWord);
    }

    this.updateHUD();
  }

  handleTypo(wordObj) {
    audioManager.playError();
    this.combo = 0; // Quebra o combo

    if (wordObj) {
      // Tremor da palavra (aplicado no container interno para não afetar transform da queda)
      const innerCard = wordObj.el.querySelector('.word-card-inner');
      if (innerCard) {
        innerCard.classList.remove('word-shake');
        void innerCard.offsetWidth; // Força reflow para reiniciar animação
        innerCard.classList.add('word-shake');
      }

      // Registra erro de repetição
      this.wordsMissedSession[wordObj.it] = (this.wordsMissedSession[wordObj.it] || 0) + 1;
    }

    // Flash vermelho rápido na tela
    this.dom.gameContainer.classList.add('screen-typo-flash');
    setTimeout(() => {
      this.dom.gameContainer.classList.remove('screen-typo-flash');
    }, 120);

    this.updateHUD();
  }

  handleBackspace() {
    if (!this.targetWord) return;

    if (this.targetWord.typedIndex > 0) {
      this.targetWord.typedIndex--;
      const letterSpans = this.targetWord.el.querySelectorAll('.letter-char');
      if (letterSpans[this.targetWord.typedIndex]) {
        letterSpans[this.targetWord.typedIndex].classList.remove('letter-typed');
      }
    }

    // Se apagou todas as letras, libera o alvo para permitir mudar de palavra
    if (this.targetWord.typedIndex === 0) {
      this.targetWord.el.classList.remove('active-target');
      this.targetWord = null;
    }
  }

  handleWordComplete(wordObj) {
    // 1. Efeito sonoro e síntese de voz
    this.combo++;
    if (this.combo > this.maxCombo) {
      this.maxCombo = this.combo;
    }

    audioManager.playWordComplete(this.combo);
    audioManager.pronounce(wordObj.it);

    // 2. Pontuação: base do tamanho + bônus de nível + multiplicador de combo
    const levelMultipliers = { A1: 1, A2: 1.2, B1: 1.5, B2: 2.0, C1: 2.5, C2: 3.2, MAESTRIA: 3.5 };
    const mult = levelMultipliers[wordObj.nivel] || 1;
    const points = Math.round(wordObj.it.length * 12 * mult * (1 + (this.combo * 0.15)));
    this.score += points;

    // 3. Explosão de partículas
    const rect = wordObj.el.getBoundingClientRect();
    const centerX = rect.left + (rect.width / 2);
    const centerY = rect.top + (rect.height / 2);
    const levelColor = LIVELLI_CONFIG[wordObj.nivel]?.colore || '#00f0ff';
    this.particles.createWordExplosion(centerX, centerY, levelColor, 40);

    // Mostra indicador flutuante de pontos
    this.showFloatingScore(centerX, centerY, `+${points}`, this.combo > 1 ? `x${this.combo} COMBO!` : '');

    // 4. Métricas e repetição espaçada
    this.wordsCompletedInLevel++;
    this.totalWordsMastered++;
    this.wordsLearnedSession.add(wordObj.it);

    // Se acertou uma que estava na lista de erros, reduz a contagem
    if (this.wordsMissedSession[wordObj.it] && this.wordsMissedSession[wordObj.it] > 0) {
      this.wordsMissedSession[wordObj.it]--;
    }

    // 5. Remove da tela
    wordObj.el.classList.add('word-explode');
    setTimeout(() => {
      wordObj.el.remove();
    }, 200);

    this.fallingWords = this.fallingWords.filter(w => w.id !== wordObj.id);
    this.targetWord = null;

    // 6. Verifica avanço de nível
    this.checkLevelUp();
    this.updateHUD();
    this.renderStepper();
  }

  showFloatingScore(x, y, text, subtext = '') {
    const floatEl = document.createElement('div');
    floatEl.className = 'floating-score';
    floatEl.style.left = `${x}px`;
    floatEl.style.top = `${y}px`;
    floatEl.innerHTML = `<span>${text}</span>${subtext ? `<small>${subtext}</small>` : ''}`;
    document.body.appendChild(floatEl);
    setTimeout(() => floatEl.remove(), 800);
  }

  // ==========================================
  // LINHA VERMELHA E PERDA DE VIDAS
  // ==========================================
  handleWordHitLaser(wordObj) {
    audioManager.playLifeLost();
    this.combo = 0; // Zera o combo

    // Gera faíscas na linha de impacto
    const rect = wordObj.el.getBoundingClientRect();
    const sparkX = rect.left + (rect.width / 2);
    const sparkY = rect.bottom;
    this.particles.createLaserSparks(sparkX, sparkY, 30);

    // Palavra perdida vai para a fila de Repetição Espaçada
    this.reviewQueue.push({
      it: wordObj.it,
      pt: wordObj.pt,
      nivel: wordObj.nivel
    });
    this.wordsMissedSession[wordObj.it] = (this.wordsMissedSession[wordObj.it] || 0) + 1;

    // Remove elemento
    wordObj.el.classList.add('word-burned');
    setTimeout(() => {
      wordObj.el.remove();
    }, 200);

    this.fallingWords = this.fallingWords.filter(w => w.id !== wordObj.id);
    if (this.targetWord && this.targetWord.id === wordObj.id) {
      this.targetWord = null;
    }

    // Reduz vida
    this.lives--;
    this.animateLaserWarning();
    this.updateHUD();

    if (this.lives <= 0) {
      this.triggerGameOver();
    }
  }

  animateLaserWarning() {
    this.dom.laserLine.classList.add('laser-alarm');
    setTimeout(() => {
      this.dom.laserLine.classList.remove('laser-alarm');
    }, 400);
  }

  // ==========================================
  // TECLADO VIRTUAL E FEEDBACK VISUAL
  // ==========================================
  lightUpVirtualKey(keyChar) {
    let keySelector = `[data-key="${keyChar}"]`;
    if (keyChar === ' ') {
      keySelector = `[data-key="space"]`;
    }

    const keyEl = this.dom.virtualKeyboard.querySelector(keySelector);
    if (keyEl) {
      keyEl.classList.add('key-pressed');
      setTimeout(() => {
        keyEl.classList.remove('key-pressed');
      }, 150);
    }
  }

  // ==========================================
  // LOOP PRINCIPAL DO JOGO
  // ==========================================
  gameLoop(timestamp) {
    if (this.state !== 'PLAYING') return;

    if (!this.lastFrameTime) this.lastFrameTime = timestamp;
    const delta = (timestamp - this.lastFrameTime) / 1000;
    this.lastFrameTime = timestamp;

    // Gerenciamento de Spawn de palavras
    const cfg = LIVELLI_CONFIG[this.currentLevel];
    if (timestamp - this.lastSpawnTime > cfg.intervalloSpawnMs) {
      this.spawnWord();
      this.lastSpawnTime = timestamp;
    }

    // Obter altura da linha laser
    const laserTop = this.dom.laserLine.getBoundingClientRect().top;
    const areaRect = this.dom.wordsArea.getBoundingClientRect();
    const dangerThreshold = laserTop - areaRect.top;

    // Movimentação das palavras em queda
    for (let i = this.fallingWords.length - 1; i >= 0; i--) {
      const w = this.fallingWords[i];
      w.y += w.speed * 60 * delta; // Suavização independente de FPS
      w.el.style.transform = `translate3d(${w.x}px, ${w.y}px, 0)`;

      // Teste de colisão com a linha vermelha
      if ((w.y + w.height) >= dangerThreshold) {
        this.handleWordHitLaser(w);
      }
    }

    this.animationFrameId = requestAnimationFrame(this.gameLoop.bind(this));
  }

  renderLoop() {
    this.particles.updateAndDraw();
    requestAnimationFrame(this.renderLoop);
  }

  // ==========================================
  // CÁLCULOS E HUD
  // ==========================================
  calculateAccuracy() {
    if (this.totalTypedChars === 0) return 100;
    return Math.max(0, Math.min(100, Math.round((this.correctTypedChars / this.totalTypedChars) * 100)));
  }

  calculateWPM() {
    if (!this.startTime) return 0;
    const minutes = (Date.now() - this.startTime) / 60000;
    if (minutes <= 0.05) return 0;
    const words = this.totalWordsMastered;
    return Math.round(words / minutes);
  }

  updateHUD() {
    this.dom.hudScore.textContent = this.score.toLocaleString();
    this.dom.hudCombo.textContent = `x${this.combo}`;
    if (this.combo >= 5) {
      this.dom.hudCombo.classList.add('combo-fire');
    } else {
      this.dom.hudCombo.classList.remove('combo-fire');
    }

    const accuracy = this.calculateAccuracy();
    this.dom.hudAccuracy.textContent = `${accuracy}%`;
    this.dom.hudWpm.textContent = this.calculateWPM();

    // Nome e cor do Nível
    const cfg = LIVELLI_CONFIG[this.currentLevel];
    this.dom.hudLevelBadge.textContent = cfg.nome;
    this.dom.hudLevelBadge.style.color = cfg.colore;
    this.dom.hudLevelBadge.style.borderColor = `${cfg.colore}88`;

    // Renderização dos Corações (Vidas)
    let heartsHtml = '';
    for (let i = 0; i < this.maxLives; i++) {
      if (i < this.lives) {
        heartsHtml += `<span class="heart-icon active-heart">❤️</span>`;
      } else {
        heartsHtml += `<span class="heart-icon empty-heart">🖤</span>`;
      }
    }
    this.dom.hudLives.innerHTML = heartsHtml;
  }

  // ==========================================
  // PROGRESSÃO DINÂMICA DA LINHA DOS NÍVEIS
  // ==========================================
  updateStepperGeometry() {
    if (!this.dom.stepperContainer || !this.dom.stepperTrack || this.dom.levelStepperNodes.length < 2) return;

    const firstNode = this.dom.levelStepperNodes[0];
    const lastNode = this.dom.levelStepperNodes[this.dom.levelStepperNodes.length - 1];
    const firstCircle = firstNode.querySelector('.node-circle');
    const lastCircle = lastNode.querySelector('.node-circle');

    if (!firstCircle || !lastCircle) return;

    const containerRect = this.dom.stepperContainer.getBoundingClientRect();
    const firstRect = firstCircle.getBoundingClientRect();
    const lastRect = lastCircle.getBoundingClientRect();

    if (containerRect.width <= 0) return;

    // Conecta exatamente o centro do círculo A1 ao centro do círculo C2
    const startX = (firstRect.left + (firstRect.width / 2)) - containerRect.left;
    const endX = (lastRect.left + (lastRect.width / 2)) - containerRect.left;
    const centerY = (firstRect.top + (firstRect.height / 2)) - containerRect.top;

    this.dom.stepperTrack.style.left = `${startX}px`;
    this.dom.stepperTrack.style.width = `${Math.max(10, endX - startX)}px`;
    this.dom.stepperTrack.style.top = `${centerY}px`;
  }

  renderStepper() {
    this.updateStepperGeometry();

    const levelsOrder = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];
    const currentIdx = levelsOrder.indexOf(this.currentLevel);
    const totalLevels = 6; // 6 etapas (A1 -> A2 -> B1 -> B2 -> C1 -> C2 -> Fluente)

    let progressPercent = 0;

    if (this.currentLevel === 'MAESTRIA') {
      progressPercent = 100;
    } else if (currentIdx >= 0) {
      // 1. Progresso base das etapas já concluídas (cada etapa = 16.67%)
      const baseFraction = currentIdx / totalLevels;

      // 2. Progresso dinâmico contínuo dentro da etapa atual conforme acerta palavras (0 a 15)
      const stageWords = Math.min(this.wordsCompletedInLevel, this.wordsTargetToLevelUp);
      const stageFraction = (stageWords / this.wordsTargetToLevelUp) * (1 / totalLevels);

      const totalFraction = Math.min(1, Math.max(0, baseFraction + stageFraction));
      progressPercent = totalFraction * 100;
    }

    // Atualiza a barra de preenchimento dinâmica que conecta os círculos
    if (this.dom.levelProgressFill) {
      this.dom.levelProgressFill.style.width = `${progressPercent.toFixed(2)}%`;
    }

    // Atualiza estados, ícones e contadores de cada círculo de nível
    this.dom.levelStepperNodes.forEach(node => {
      const lvl = node.getAttribute('data-level');
      const circleEl = node.querySelector('.node-circle');
      const counterEl = node.querySelector('.node-counter');

      node.classList.remove('node-active', 'node-completed', 'node-locked');

      if (lvl === 'FLUENTE') {
        if (this.currentLevel === 'MAESTRIA') {
          node.classList.add('node-completed');
          if (counterEl) counterEl.textContent = 'CONQUISTADO';
        } else {
          node.classList.add('node-locked');
          if (counterEl) counterEl.textContent = 'Meta';
        }
        return;
      }

      const idx = levelsOrder.indexOf(lvl);

      if (this.currentLevel === 'MAESTRIA' || idx < currentIdx) {
        node.classList.add('node-completed');
        if (circleEl) circleEl.textContent = '✓';
        if (counterEl) counterEl.textContent = '15/15';
      } else if (idx === currentIdx) {
        node.classList.add('node-active');
        if (circleEl) circleEl.textContent = lvl;
        if (counterEl) counterEl.textContent = `${this.wordsCompletedInLevel}/15`;
      } else {
        node.classList.add('node-locked');
        if (circleEl) circleEl.textContent = lvl;
        if (counterEl) counterEl.textContent = '0/15';
      }
    });
  }

  // ==========================================
  // CONTROLE DE TELAS E MODAIS
  // ==========================================
  startGame(chosenLevel = 'A1') {
    this.state = 'PLAYING';
    this.currentLevel = chosenLevel;
    this.score = 0;
    this.combo = 0;
    this.maxCombo = 0;
    this.lives = 3;
    this.totalTypedChars = 0;
    this.correctTypedChars = 0;
    this.wordsCompletedInLevel = 0;
    this.totalWordsMastered = 0;
    this.startTime = Date.now();
    this.wordsLearnedSession.clear();
    this.wordsMissedSession = {};
    this.targetWord = null;

    // Limpa palavras ativas da tela anterior
    this.fallingWords.forEach(w => w.el.remove());
    this.fallingWords = [];

    // Esconde todos os modais
    this.hideAllModals();

    // Sincroniza áudio
    audioManager.ensureContext();

    this.renderStepper();
    this.updateHUD();

    this.lastFrameTime = performance.now();
    this.lastSpawnTime = performance.now();
    this.spawnWord();

    cancelAnimationFrame(this.animationFrameId);
    this.animationFrameId = requestAnimationFrame(this.gameLoop.bind(this));
  }

  pauseGame() {
    if (this.state !== 'PLAYING') return;
    this.state = 'PAUSED';
    cancelAnimationFrame(this.animationFrameId);
    this.dom.modalPause.classList.remove('hidden');
  }

  resumeGame() {
    if (this.state !== 'PAUSED') return;
    this.state = 'PLAYING';
    this.dom.modalPause.classList.add('hidden');
    this.lastFrameTime = performance.now();
    this.lastSpawnTime = performance.now();
    this.animationFrameId = requestAnimationFrame(this.gameLoop.bind(this));
  }

  triggerGameOver() {
    this.state = 'GAMEOVER';
    cancelAnimationFrame(this.animationFrameId);
    audioManager.playGameOver();
    this.saveProgress();

    // Preenche estatísticas da tela de Game Over
    document.getElementById('go-score').textContent = this.score.toLocaleString();
    document.getElementById('go-level').textContent = LIVELLI_CONFIG[this.currentLevel].nome;
    document.getElementById('go-wpm').textContent = this.calculateWPM();
    document.getElementById('go-accuracy').textContent = `${this.calculateAccuracy()}%`;
    document.getElementById('go-words-count').textContent = this.wordsLearnedSession.size;

    this.renderWordsMissedList('go-missed-list');
    this.dom.modalGameOver.classList.remove('hidden');
  }

  triggerVictory() {
    this.state = 'VICTORY';
    cancelAnimationFrame(this.animationFrameId);
    audioManager.playVictory();
    this.particles.createVictoryCelebration(200);
    this.saveProgress();

    // Preenche estatísticas da celebração de FLUENTE
    document.getElementById('vic-score').textContent = this.score.toLocaleString();
    document.getElementById('vic-wpm').textContent = this.calculateWPM();
    document.getElementById('vic-accuracy').textContent = `${this.calculateAccuracy()}%`;
    document.getElementById('vic-words-count').textContent = this.wordsLearnedSession.size;
    document.getElementById('vic-max-combo').textContent = `x${this.maxCombo}`;

    this.renderWordsLearnedList('vic-learned-list');
    this.dom.modalVictory.classList.remove('hidden');
  }

  renderWordsMissedList(containerId) {
    const listEl = document.getElementById(containerId);
    if (!listEl) return;
    listEl.innerHTML = '';

    const missedKeys = Object.keys(this.wordsMissedSession);
    if (missedKeys.length === 0) {
      listEl.innerHTML = '<li class="empty-list">Nessun errore grave! Congratulazioni! (Nenhum erro grave!)</li>';
      return;
    }

    missedKeys.sort((a, b) => this.wordsMissedSession[b] - this.wordsMissedSession[a]);
    missedKeys.slice(0, 8).forEach(itWord => {
      const fullWord = DIZIONARIO_ITALIANO.find(w => w.it.toLowerCase() === itWord.toLowerCase());
      const li = document.createElement('li');
      li.className = 'word-stat-item';
      li.innerHTML = `
        <div class="stat-word-pair">
          <strong class="stat-it">${itWord}</strong>
          <span class="stat-pt">${fullWord ? fullWord.pt : ''}</span>
        </div>
        <button class="btn-sound-mini" title="Ascolta pronuncia" data-pronounce="${itWord}">🔊</button>
      `;
      listEl.appendChild(li);
    });

    this.bindPronounceButtons(listEl);
  }

  renderWordsLearnedList(containerId) {
    const listEl = document.getElementById(containerId);
    if (!listEl) return;
    listEl.innerHTML = '';

    const wordsArray = Array.from(this.wordsLearnedSession);
    if (wordsArray.length === 0) {
      listEl.innerHTML = '<li class="empty-list">Nessuna parola registrata.</li>';
      return;
    }

    wordsArray.slice(0, 16).forEach(itWord => {
      const fullWord = DIZIONARIO_ITALIANO.find(w => w.it.toLowerCase() === itWord.toLowerCase());
      const li = document.createElement('li');
      li.className = 'word-stat-item';
      li.innerHTML = `
        <div class="stat-word-pair">
          <strong class="stat-it">${itWord}</strong>
          <span class="stat-pt">${fullWord ? fullWord.pt : ''}</span>
        </div>
        <button class="btn-sound-mini" title="Ascolta pronuncia" data-pronounce="${itWord}">🔊</button>
      `;
      listEl.appendChild(li);
    });

    this.bindPronounceButtons(listEl);
  }

  bindPronounceButtons(parentEl) {
    parentEl.querySelectorAll('.btn-sound-mini').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const word = btn.getAttribute('data-pronounce');
        if (word) {
          audioManager.pronounce(word);
        }
      });
    });
  }

  renderStartScreenStats() {
    const hsEl = document.getElementById('start-highscore');
    const masteredEl = document.getElementById('start-mastered-count');
    const reviewBtn = document.getElementById('btn-open-review');

    if (hsEl) hsEl.textContent = (this.highScore || 0).toLocaleString();
    if (masteredEl) masteredEl.textContent = (this.masteredHistory ? this.masteredHistory.length : 0);

    // Habilita seletor de níveis liberados
    const levelSelect = document.getElementById('start-level-select');
    if (levelSelect) {
      levelSelect.innerHTML = '';
      const order = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2', 'MAESTRIA'];
      order.forEach(lvl => {
        const isUnlocked = this.unlockedLevels.includes(lvl);
        const opt = document.createElement('option');
        opt.value = lvl;
        opt.textContent = `${LIVELLI_CONFIG[lvl].nome}${!isUnlocked && lvl !== 'A1' ? ' 🔒' : ''}`;
        if (!isUnlocked && lvl !== 'A1') {
          opt.disabled = true;
        }
        levelSelect.appendChild(opt);
      });
    }

    if (reviewBtn) {
      reviewBtn.textContent = `Caderno de Revisão (${this.reviewQueue.length})`;
    }
  }

  hideAllModals() {
    this.dom.modalStart.classList.add('hidden');
    this.dom.modalPause.classList.add('hidden');
    this.dom.modalGameOver.classList.add('hidden');
    this.dom.modalVictory.classList.add('hidden');
    this.dom.modalReview.classList.add('hidden');
  }

  // ==========================================
  // BINDING DE EVENTOS (TECLADO, TOUCH, CLIQUES)
  // ==========================================
  bindEvents() {
    // Redimensionamento de tela recalcula geometria da linha dos níveis
    window.addEventListener('resize', () => {
      this.updateStepperGeometry();
    });

    // 1. Digitação via Teclado Físico
    window.addEventListener('keydown', (e) => {
      // Ignora atalhos de controle como F12, Ctrl+R, etc.
      if (e.ctrlKey || e.altKey || e.metaKey) return;

      // Pausa com tecla ESC
      if (e.key === 'Escape') {
        if (this.state === 'PLAYING') {
          this.pauseGame();
        } else if (this.state === 'PAUSED') {
          this.resumeGame();
        }
        return;
      }

      if (this.state !== 'PLAYING') return;

      if (e.key === 'Backspace') {
        e.preventDefault();
        this.handleBackspace();
        this.lightUpVirtualKey('backspace');
        return;
      }

      if (e.key === ' ' || e.code === 'Space') {
        e.preventDefault();
        this.handleKeyPress(' ');
        return;
      }

      // Permite letras normais e acentuadas italianas (à, è, é, ì, ò, ù, apostrofo ')
      if (/^[a-zA-ZàèéìòùÀÈÉÌÒÙ']$/.test(e.key)) {
        e.preventDefault();
        this.handleKeyPress(e.key);
      }
    });

    // 2. Teclado Virtual (Clicks e Touch)
    this.dom.keys.forEach(keyBtn => {
      keyBtn.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        const keyVal = keyBtn.getAttribute('data-key');
        if (!keyVal) return;

        if (keyVal === 'backspace') {
          this.handleBackspace();
          this.lightUpVirtualKey('backspace');
        } else if (keyVal === 'space') {
          this.handleKeyPress(' ');
        } else {
          this.handleKeyPress(keyVal);
        }
      });
    });

    // 3. Botões de Modais e Menus
    document.getElementById('btn-start-play').addEventListener('click', () => {
      const selected = document.getElementById('start-level-select').value || 'A1';
      this.startGame(selected);
    });

    document.getElementById('btn-resume').addEventListener('click', () => {
      this.resumeGame();
    });

    document.getElementById('btn-pause-menu').addEventListener('click', () => {
      this.state = 'START';
      this.hideAllModals();
      this.renderStartScreenStats();
      this.dom.modalStart.classList.remove('hidden');
    });

    document.getElementById('btn-go-retry').addEventListener('click', () => {
      this.startGame(this.currentLevel);
    });

    document.getElementById('btn-go-menu').addEventListener('click', () => {
      this.state = 'START';
      this.hideAllModals();
      this.renderStartScreenStats();
      this.dom.modalStart.classList.remove('hidden');
    });

    document.getElementById('btn-vic-maestria').addEventListener('click', () => {
      this.startGame('MAESTRIA');
    });

    document.getElementById('btn-vic-menu').addEventListener('click', () => {
      this.state = 'START';
      this.hideAllModals();
      this.renderStartScreenStats();
      this.dom.modalStart.classList.remove('hidden');
    });

    document.getElementById('btn-open-review').addEventListener('click', () => {
      this.renderReviewNotebook();
      this.dom.modalReview.classList.remove('hidden');
    });

    document.getElementById('btn-close-review').addEventListener('click', () => {
      this.dom.modalReview.classList.add('hidden');
      this.renderStartScreenStats();
    });

    document.getElementById('btn-pause-hud').addEventListener('click', () => {
      if (this.state === 'PLAYING') {
        this.pauseGame();
      }
    });

    // 4. Configurações (Toggles)
    document.getElementById('setting-sfx').addEventListener('change', (e) => {
      this.settings.soundFX = e.target.checked;
      audioManager.muted = !e.target.checked;
      this.saveProgress();
    });

    document.getElementById('setting-speech').addEventListener('change', (e) => {
      this.settings.pronunciation = e.target.checked;
      audioManager.speechEnabled = e.target.checked;
      this.saveProgress();
    });

    document.getElementById('setting-trans').addEventListener('change', (e) => {
      this.settings.showTranslations = e.target.checked;
      this.saveProgress();
      // Aplica dinamicamente às palavras já na tela
      document.querySelectorAll('.word-translation').forEach(el => {
        if (this.settings.showTranslations) {
          el.classList.remove('hidden-translation');
        } else {
          el.classList.add('hidden-translation');
        }
      });
    });
  }

  // Renderiza o "Caderno de Revisão" com palavras que precisam de prática
  renderReviewNotebook() {
    const listEl = document.getElementById('review-notebook-list');
    if (!listEl) return;
    listEl.innerHTML = '';

    if (this.reviewQueue.length === 0) {
      listEl.innerHTML = '<div class="empty-notebook">Otimo! Seu caderno de revisão está vazio. Erre palavras ou deixe-as cair para adicioná-las aqui e praticar com repetição espaçada!</div>';
      return;
    }

    // Agrupa e remove duplicatas para exibição
    const uniqueReview = [];
    const seen = new Set();
    this.reviewQueue.forEach(item => {
      if (!seen.has(item.it)) {
        seen.add(item.it);
        uniqueReview.push(item);
      }
    });

    uniqueReview.forEach(item => {
      const itemEl = document.createElement('div');
      itemEl.className = 'review-card-item';
      itemEl.innerHTML = `
        <div class="review-item-header">
          <span class="badge-mini" style="color: ${LIVELLI_CONFIG[item.nivel]?.colore || '#fff'}">${item.nivel}</span>
          <button class="btn-sound-mini" title="Ascolta pronuncia" data-pronounce="${item.it}">🔊</button>
        </div>
        <div class="review-it">${item.it}</div>
        <div class="review-pt">${item.pt}</div>
      `;
      listEl.appendChild(itemEl);
    });

    this.bindPronounceButtons(listEl);
  }
}

// Inicializa a aplicação quando o DOM estiver pronto
window.addEventListener('DOMContentLoaded', () => {
  window.game = new ParoleCadenti();
});
