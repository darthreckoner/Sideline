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
