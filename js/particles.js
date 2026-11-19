/**
 * PAROLE CADENTI - Motor de Partículas e Fundo Estelar Neon
 * Controla o starfield cibernético, explosões de acerto, fagulhas da linha de laser e confetes de vitória.
 */

class ParticleSystem {
  constructor(canvasId) {
    this.canvas = document.getElementById(canvasId);
    this.ctx = this.canvas.getContext('2d');
    this.stars = [];
    this.particles = [];
    this.width = window.innerWidth;
    this.height = window.innerHeight;

    this.resize();
    window.addEventListener('resize', () => this.resize());
    this.initStars(120);
  }

  resize() {
    this.width = window.innerWidth;
    this.height = window.innerHeight;
    this.canvas.width = this.width;
    this.canvas.height = this.height;
  }

  initStars(count) {
    this.stars = [];
    for (let i = 0; i < count; i++) {
      this.stars.push({
        x: Math.random() * this.width,
        y: Math.random() * this.height,
        size: Math.random() * 2 + 0.5,
        speed: Math.random() * 0.4 + 0.1,
        color: Math.random() > 0.7 ? '#00f0ff' : (Math.random() > 0.5 ? '#ff007f' : '#ffffff'),
        alpha: Math.random() * 0.8 + 0.2
      });
    }
  }

  // Cria explosão de partículas neon ao acertar uma palavra
  createWordExplosion(x, y, color = '#00f0ff', count = 35) {
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = Math.random() * 6 + 2;
      this.particles.push({
        x: x,
        y: y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        size: Math.random() * 4 + 2,
        color: color,
        alpha: 1,
        decay: Math.random() * 0.025 + 0.015,
        type: 'spark'
      });
    }
  }

  // Cria faíscas avermelhadas de perigo na linha laser
  createLaserSparks(x, y, count = 25) {
    for (let i = 0; i < count; i++) {
      const angle = (Math.random() * Math.PI) + Math.PI; // Para cima
      const speed = Math.random() * 5 + 1;
      this.particles.push({
        x: x,
        y: y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        size: Math.random() * 3 + 2,
        color: '#ff003c',
        alpha: 1,
        decay: Math.random() * 0.03 + 0.02,
        type: 'spark'
      });
    }
  }

  // Explosão de confetes e estrelas para a tela de Vitória / Fluente
  createVictoryCelebration(count = 150) {
    const colors = ['#00f0ff', '#00ff88', '#ffe600', '#ff007f', '#ffffff', '#009246', '#ce2b37']; // Cores da Itália + Neon
    for (let i = 0; i < count; i++) {
      this.particles.push({
        x: Math.random() * this.width,
        y: -10 - Math.random() * 50,
        vx: (Math.random() - 0.5) * 4,
        vy: Math.random() * 4 + 2.5,
        size: Math.random() * 7 + 4,
        color: colors[Math.floor(Math.random() * colors.length)],
        alpha: 1,
        decay: 0.003,
        rotation: Math.random() * 360,
        rotSpeed: (Math.random() - 0.5) * 8,
        type: 'confetti'
      });
    }
  }

  // Loop de atualização e renderização
  updateAndDraw() {
    this.ctx.clearRect(0, 0, this.width, this.height);

    // 1. Renderiza estrelas em movimento sutil no fundo
    for (let i = 0; i < this.stars.length; i++) {
      const star = this.stars[i];
      star.y += star.speed;
      if (star.y > this.height) {
        star.y = 0;
        star.x = Math.random() * this.width;
      }

      this.ctx.save();
      this.ctx.globalAlpha = star.alpha;
      this.ctx.fillStyle = star.color;
      this.ctx.shadowBlur = star.size * 2;
      this.ctx.shadowColor = star.color;
      this.ctx.beginPath();
      this.ctx.arc(star.x, star.y, star.size, 0, Math.PI * 2);
      this.ctx.fill();
      this.ctx.restore();
    }

    // 2. Renderiza partículas dinâmicas (faíscas e confetes)
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.x += p.vx;
      p.y += p.vy;
      p.alpha -= p.decay;

      if (p.alpha <= 0) {
        this.particles.splice(i, 1);
        continue;
      }

      this.ctx.save();
      this.ctx.globalAlpha = Math.max(0, p.alpha);

      if (p.type === 'confetti') {
        p.rotation += p.rotSpeed;
        p.vy += 0.04; // Gravidade
        this.ctx.translate(p.x, p.y);
        this.ctx.rotate((p.rotation * Math.PI) / 180);
        this.ctx.fillStyle = p.color;
        this.ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 1.5);
      } else {
        // Faísca com brilho neon
        this.ctx.fillStyle = p.color;
        this.ctx.shadowBlur = 10;
        this.ctx.shadowColor = p.color;
        this.ctx.beginPath();
        this.ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        this.ctx.fill();
      }

      this.ctx.restore();
    }
  }
}

