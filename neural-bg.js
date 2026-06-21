/* NeuroTwin — Neural Network Canvas Background */

(function () {
  const canvas = document.getElementById('neural-canvas');
  const ctx = canvas.getContext('2d');

  let W, H, nodes = [], edges = [], animFrame;
  const NODE_COUNT = 55;

  function resize() {
    W = canvas.width = window.innerWidth;
    H = canvas.height = window.innerHeight;
  }

  function randomNode() {
    return {
      x: Math.random() * W,
      y: Math.random() * H,
      vx: (Math.random() - 0.5) * 0.35,
      vy: (Math.random() - 0.5) * 0.35,
      r: Math.random() * 2.5 + 1,
      opacity: Math.random() * 0.6 + 0.2,
      pulse: Math.random() * Math.PI * 2,
      pulseSpeed: 0.01 + Math.random() * 0.02,
      color: Math.random() < 0.5 ? '#6C63FF' : '#00D4FF',
    };
  }

  function init() {
    nodes = Array.from({ length: NODE_COUNT }, randomNode);
  }

  function drawEdge(a, b, dist) {
    const maxDist = 160;
    if (dist > maxDist) return;
    const alpha = (1 - dist / maxDist) * 0.18;
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    const grad = ctx.createLinearGradient(a.x, a.y, b.x, b.y);
    grad.addColorStop(0, `${a.color}${Math.floor(alpha * 255).toString(16).padStart(2, '0')}`);
    grad.addColorStop(1, `${b.color}${Math.floor(alpha * 255).toString(16).padStart(2, '0')}`);
    ctx.strokeStyle = grad;
    ctx.lineWidth = 0.7;
    ctx.stroke();
  }

  function drawNode(n) {
    n.pulse += n.pulseSpeed;
    const glow = Math.sin(n.pulse) * 0.3 + 0.7;
    const r = n.r * glow;
    const alpha = n.opacity * glow;

    const g = ctx.createRadialGradient(n.x, n.y, 0, n.x, n.y, r * 4);
    g.addColorStop(0, `${n.color}${Math.floor(alpha * 255).toString(16).padStart(2, '0')}`);
    g.addColorStop(1, `${n.color}00`);

    ctx.beginPath();
    ctx.arc(n.x, n.y, r * 4, 0, Math.PI * 2);
    ctx.fillStyle = g;
    ctx.fill();

    ctx.beginPath();
    ctx.arc(n.x, n.y, r, 0, Math.PI * 2);
    ctx.fillStyle = `${n.color}${Math.floor(alpha * 255).toString(16).padStart(2, '0')}`;
    ctx.fill();
  }

  function animate() {
    ctx.clearRect(0, 0, W, H);

    for (let i = 0; i < nodes.length; i++) {
      const n = nodes[i];
      n.x += n.vx;
      n.y += n.vy;
      if (n.x < -20) n.x = W + 20;
      if (n.x > W + 20) n.x = -20;
      if (n.y < -20) n.y = H + 20;
      if (n.y > H + 20) n.y = -20;

      for (let j = i + 1; j < nodes.length; j++) {
        const m = nodes[j];
        const dx = n.x - m.x;
        const dy = n.y - m.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        drawEdge(n, m, dist);
      }
    }

    nodes.forEach(drawNode);
    animFrame = requestAnimationFrame(animate);
  }

  window.addEventListener('resize', () => {
    resize();
    init();
  });

  resize();
  init();
  animate();
})();
