// Soccer-only field markings. The board engine owns input, history and demonstrations.
// Another sport registers a renderer here and points to it with preset.field.type.
(window.SIDELINE_FIELDS ||= {}).soccer = (c, f) => {
  const w = f.width, h = f.height;
  c.fillStyle = "#1c6749";
  c.fillRect(0, 0, w, h);
  for (let i = 0; i < 10; i++) {
    c.fillStyle = i % 2 ? "#ffffff08" : "#0000000c";
    c.fillRect(i * w / 10, 0, w / 10, h);
  }
  c.strokeStyle = "#f0f5e9";
  c.fillStyle = "#f0f5e9";
  c.lineWidth = 4;
  c.strokeRect(14, 14, w - 28, h - 28);
  c.beginPath(); c.moveTo(w / 2, 14); c.lineTo(w / 2, h - 14); c.stroke();
  c.beginPath(); c.arc(w / 2, h / 2, f.centerCircleRadius, 0, Math.PI * 2); c.stroke();
  c.beginPath(); c.arc(w / 2, h / 2, 5, 0, Math.PI * 2); c.fill();
  for (const left of [true, false]) {
    const x = left ? 14 : w - 14 - f.penaltyDepth;
    const gx = left ? 14 : w - 14 - f.goalAreaDepth;
    c.strokeRect(x, (h - f.penaltyWidth) / 2, f.penaltyDepth, f.penaltyWidth);
    c.strokeRect(gx, (h - f.goalAreaWidth) / 2, f.goalAreaDepth, f.goalAreaWidth);
    c.beginPath(); c.arc(left ? 115 : w - 115, h / 2, 5, 0, Math.PI * 2); c.fill();
    c.strokeRect(left ? 2 : w - 14, (h - 110) / 2, 12, 110);
  }
};

// A small, high-contrast black-and-white ball stays legible on phone screens.
// The shared board supplies the position and touch target; this only paints it.
(window.SIDELINE_BALLS ||= {}).soccer = (c, point, radius) => {
  c.save();
  c.translate(point.x, point.y);
  c.scale(radius, radius);
  c.beginPath(); c.arc(0, 0, 1, 0, Math.PI * 2);
  c.fillStyle = "#ffffff"; c.fill();
  c.save(); c.clip();
  c.strokeStyle = "#16222b"; c.lineWidth = 0.07;
  c.fillStyle = "#16222b";
  const angles = Array.from({ length: 5 }, (_, i) => -Math.PI / 2 + i * Math.PI * 2 / 5);
  c.beginPath();
  for (const angle of angles) {
    c.moveTo(Math.cos(angle) * 0.33, Math.sin(angle) * 0.33);
    c.lineTo(Math.cos(angle) * 0.78, Math.sin(angle) * 0.78);
  }
  c.stroke();
  c.beginPath();
  angles.forEach((angle, i) => {
    const x = Math.cos(angle) * 0.34, y = Math.sin(angle) * 0.34;
    if (i) c.lineTo(x, y); else c.moveTo(x, y);
  });
  c.closePath(); c.fill();
  for (const angle of angles) {
    c.beginPath();
    for (const [r, a] of [[0.7, angle], [0.84, angle - 0.25], [1.1, angle - 0.23], [1.1, angle + 0.23], [0.84, angle + 0.25]]) {
      if (r === 0.7) c.moveTo(Math.cos(a) * r, Math.sin(a) * r);
      else c.lineTo(Math.cos(a) * r, Math.sin(a) * r);
    }
    c.closePath(); c.fill();
  }
  c.restore();
  c.beginPath(); c.arc(0, 0, 1, 0, Math.PI * 2);
  c.lineWidth = 0.17; c.strokeStyle = "#16222b"; c.stroke();
  c.restore();
};
