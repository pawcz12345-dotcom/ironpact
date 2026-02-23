#!/usr/bin/env node
/**
 * Generate PWA icons using canvas
 */

const { createCanvas } = require('canvas');
const fs = require('fs');
const path = require('path');

const sizes = [72, 96, 128, 144, 152, 192, 384, 512];
const iconDir = path.join(__dirname, 'icons');

if (!fs.existsSync(iconDir)) {
  fs.mkdirSync(iconDir, { recursive: true });
}

function generateIcon(size) {
  const canvas = createCanvas(size, size);
  const ctx = canvas.getContext('2d');

  // Background
  const gradient = ctx.createLinearGradient(0, 0, size, size);
  gradient.addColorStop(0, '#1a1a2e');
  gradient.addColorStop(1, '#0a0a0f');
  ctx.fillStyle = gradient;
  ctx.beginPath();
  ctx.roundRect(0, 0, size, size, size * 0.2);
  ctx.fill();

  // Orange accent circle
  const accentGrad = ctx.createRadialGradient(size * 0.5, size * 0.45, 0, size * 0.5, size * 0.45, size * 0.38);
  accentGrad.addColorStop(0, '#ff9a5c');
  accentGrad.addColorStop(1, '#ff6b2b');
  ctx.fillStyle = accentGrad;
  ctx.beginPath();
  ctx.arc(size * 0.5, size * 0.45, size * 0.33, 0, Math.PI * 2);
  ctx.fill();

  // Lightning bolt emoji-like shape
  ctx.fillStyle = 'white';
  ctx.font = `bold ${size * 0.38}px sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('⚡', size * 0.5, size * 0.43);

  // App name at bottom
  ctx.fillStyle = '#ff6b2b';
  ctx.font = `bold ${size * 0.09}px -apple-system, sans-serif`;
  ctx.fillText('IRONPACT', size * 0.5, size * 0.85);

  return canvas.toBuffer('image/png');
}

for (const size of sizes) {
  try {
    const buf = generateIcon(size);
    const filePath = path.join(iconDir, `icon-${size}.png`);
    fs.writeFileSync(filePath, buf);
    console.log(`Generated icon-${size}.png`);
  } catch (err) {
    console.error(`Failed to generate icon-${size}.png:`, err.message);
  }
}
