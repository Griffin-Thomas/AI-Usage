/**
 * AI Pulse Icon Generator
 * Generates a custom app icon with a usage gauge/meter design
 */

import { createCanvas } from 'canvas';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const ICONS_DIR = path.join(__dirname, '..', 'src-tauri', 'icons');

// Icon sizes needed for different platforms
const SIZES = {
  // macOS
  '16x16': 16,
  '32x32': 32,
  '128x128': 128,
  '256x256': 256,
  '512x512': 512,
  '128x128@2x': 256, // Retina
  // Windows (Square logos for Store)
  'Square30x30Logo': 30,
  'Square44x44Logo': 44,
  'Square71x71Logo': 71,
  'Square89x89Logo': 89,
  'Square107x107Logo': 107,
  'Square142x142Logo': 142,
  'Square150x150Logo': 150,
  'Square284x284Logo': 284,
  'Square310x310Logo': 310,
  'StoreLogo': 50,
  // Main icon (used as base)
  'icon': 512,
};

/**
 * Draw the AI Pulse icon on a canvas
 * Design: A circular gauge with gradient progress ring and pulse indicator
 */
function drawIcon(ctx, size) {
  const center = size / 2;
  const padding = size * 0.08;
  const radius = center - padding;

  // Clear canvas
  ctx.clearRect(0, 0, size, size);

  // Background circle with gradient
  const bgGradient = ctx.createRadialGradient(center, center, 0, center, center, radius);
  bgGradient.addColorStop(0, '#1e1b4b'); // Deep indigo
  bgGradient.addColorStop(0.7, '#312e81'); // Indigo
  bgGradient.addColorStop(1, '#1e1b4b'); // Deep indigo edge

  ctx.beginPath();
  ctx.arc(center, center, radius, 0, Math.PI * 2);
  ctx.fillStyle = bgGradient;
  ctx.fill();

  // Outer ring (subtle glow effect)
  ctx.beginPath();
  ctx.arc(center, center, radius, 0, Math.PI * 2);
  ctx.strokeStyle = 'rgba(139, 92, 246, 0.3)'; // Violet glow
  ctx.lineWidth = size * 0.02;
  ctx.stroke();

  // Usage gauge ring (background track)
  const gaugeRadius = radius * 0.75;
  const gaugeWidth = size * 0.12;
  const startAngle = -Math.PI * 0.75; // Start at 7 o'clock
  const endAngle = Math.PI * 0.75; // End at 5 o'clock
  const totalArc = endAngle - startAngle;

  // Track background
  ctx.beginPath();
  ctx.arc(center, center, gaugeRadius, startAngle, endAngle);
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
  ctx.lineWidth = gaugeWidth;
  ctx.lineCap = 'round';
  ctx.stroke();

  // Gauge fill (gradient showing ~65% usage - visually appealing)
  const usagePercent = 0.65;
  const usageEndAngle = startAngle + totalArc * usagePercent;

  const gaugeGradient = ctx.createLinearGradient(
    center - gaugeRadius,
    center,
    center + gaugeRadius,
    center
  );
  gaugeGradient.addColorStop(0, '#22c55e'); // Green
  gaugeGradient.addColorStop(0.5, '#eab308'); // Yellow
  gaugeGradient.addColorStop(1, '#f97316'); // Orange

  ctx.beginPath();
  ctx.arc(center, center, gaugeRadius, startAngle, usageEndAngle);
  ctx.strokeStyle = gaugeGradient;
  ctx.lineWidth = gaugeWidth;
  ctx.lineCap = 'round';
  ctx.stroke();

  // Center pulse indicator (stylized AI symbol)
  const pulseRadius = radius * 0.35;

  // Inner circle glow
  const innerGlow = ctx.createRadialGradient(center, center, 0, center, center, pulseRadius);
  innerGlow.addColorStop(0, 'rgba(139, 92, 246, 0.4)');
  innerGlow.addColorStop(1, 'rgba(139, 92, 246, 0)');

  ctx.beginPath();
  ctx.arc(center, center, pulseRadius * 1.2, 0, Math.PI * 2);
  ctx.fillStyle = innerGlow;
  ctx.fill();

  // Draw pulse wave (ECG-like line)
  const waveHeight = pulseRadius * 0.6;
  const waveWidth = pulseRadius * 1.6;
  const waveY = center;
  const waveStartX = center - waveWidth / 2;

  ctx.beginPath();
  ctx.moveTo(waveStartX, waveY);
  // Flat start
  ctx.lineTo(waveStartX + waveWidth * 0.2, waveY);
  // Small dip
  ctx.lineTo(waveStartX + waveWidth * 0.25, waveY + waveHeight * 0.15);
  // Sharp peak up
  ctx.lineTo(waveStartX + waveWidth * 0.35, waveY - waveHeight * 0.8);
  // Sharp valley
  ctx.lineTo(waveStartX + waveWidth * 0.45, waveY + waveHeight * 0.3);
  // Peak
  ctx.lineTo(waveStartX + waveWidth * 0.55, waveY - waveHeight * 0.4);
  // Return to baseline
  ctx.lineTo(waveStartX + waveWidth * 0.65, waveY);
  // Flat end
  ctx.lineTo(waveStartX + waveWidth, waveY);

  // Pulse wave gradient
  const pulseGradient = ctx.createLinearGradient(
    waveStartX,
    waveY,
    waveStartX + waveWidth,
    waveY
  );
  pulseGradient.addColorStop(0, 'rgba(168, 85, 247, 0.5)'); // Purple start
  pulseGradient.addColorStop(0.5, '#a855f7'); // Purple peak
  pulseGradient.addColorStop(1, 'rgba(168, 85, 247, 0.5)'); // Purple end

  ctx.strokeStyle = pulseGradient;
  ctx.lineWidth = size * 0.03;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.stroke();

  // Small highlight dots on gauge ends
  const dotRadius = size * 0.02;

  // Start dot
  const startX = center + gaugeRadius * Math.cos(startAngle);
  const startY = center + gaugeRadius * Math.sin(startAngle);
  ctx.beginPath();
  ctx.arc(startX, startY, dotRadius, 0, Math.PI * 2);
  ctx.fillStyle = '#22c55e';
  ctx.fill();

  // End dot (at usage position)
  const endX = center + gaugeRadius * Math.cos(usageEndAngle);
  const endY = center + gaugeRadius * Math.sin(usageEndAngle);
  ctx.beginPath();
  ctx.arc(endX, endY, dotRadius * 1.5, 0, Math.PI * 2);
  ctx.fillStyle = '#f97316';
  ctx.fill();

  // Add subtle outer shadow/glow
  ctx.beginPath();
  ctx.arc(center, center, radius + padding * 0.3, 0, Math.PI * 2);
  ctx.strokeStyle = 'rgba(139, 92, 246, 0.15)';
  ctx.lineWidth = padding * 0.5;
  ctx.stroke();
}

/**
 * Generate PNG icon at specified size
 */
function generatePNG(name, size) {
  const canvas = createCanvas(size, size);
  const ctx = canvas.getContext('2d');
  drawIcon(ctx, size);

  const buffer = canvas.toBuffer('image/png');
  const filepath = path.join(ICONS_DIR, `${name}.png`);
  fs.writeFileSync(filepath, buffer);
  console.log(`  ✓ Generated ${name}.png (${size}x${size})`);
  return filepath;
}

/**
 * Generate all icon sizes
 */
function generateAllIcons() {
  console.log('\n🎨 AI Pulse Icon Generator\n');
  console.log('Generating PNG icons...');

  // Ensure icons directory exists
  if (!fs.existsSync(ICONS_DIR)) {
    fs.mkdirSync(ICONS_DIR, { recursive: true });
  }

  // Generate all PNG sizes
  const generated = [];
  for (const [name, size] of Object.entries(SIZES)) {
    const filepath = generatePNG(name, size);
    generated.push({ name, size, filepath });
  }

  console.log(`\n✅ Generated ${generated.length} PNG icons`);
  return generated;
}

/**
 * Create macOS .icns file using iconutil (macOS only)
 */
function createIcns() {
  console.log('\nCreating macOS .icns file...');

  const iconsetPath = path.join(ICONS_DIR, 'icon.iconset');

  // Create iconset directory
  if (fs.existsSync(iconsetPath)) {
    fs.rmSync(iconsetPath, { recursive: true });
  }
  fs.mkdirSync(iconsetPath);

  // macOS iconset requires specific filenames
  const iconsetSizes = [
    { size: 16, name: 'icon_16x16.png' },
    { size: 32, name: 'icon_16x16@2x.png' },
    { size: 32, name: 'icon_32x32.png' },
    { size: 64, name: 'icon_32x32@2x.png' },
    { size: 128, name: 'icon_128x128.png' },
    { size: 256, name: 'icon_128x128@2x.png' },
    { size: 256, name: 'icon_256x256.png' },
    { size: 512, name: 'icon_256x256@2x.png' },
    { size: 512, name: 'icon_512x512.png' },
    { size: 1024, name: 'icon_512x512@2x.png' },
  ];

  for (const { size, name } of iconsetSizes) {
    const canvas = createCanvas(size, size);
    const ctx = canvas.getContext('2d');
    drawIcon(ctx, size);
    const buffer = canvas.toBuffer('image/png');
    fs.writeFileSync(path.join(iconsetPath, name), buffer);
  }

  // Use iconutil to create .icns
  try {
    execSync(`iconutil -c icns "${iconsetPath}" -o "${path.join(ICONS_DIR, 'icon.icns')}"`, {
      stdio: 'inherit',
    });
    console.log('  ✓ Created icon.icns');

    // Clean up iconset directory
    fs.rmSync(iconsetPath, { recursive: true });
  } catch {
    console.log('  ⚠ iconutil not available (not on macOS)');
    console.log('    Fallback: Use the 512x512 PNG to create .icns manually');
  }
}

/**
 * Create Windows .ico file
 * Uses a simple ICO file format with multiple sizes embedded
 */
function createIco() {
  console.log('\nCreating Windows .ico file...');

  // ICO file format sizes (from largest to smallest for best quality selection)
  const icoSizes = [256, 128, 64, 48, 32, 16];

  // Generate PNG buffers for each size
  const images = icoSizes.map((size) => {
    const canvas = createCanvas(size, size);
    const ctx = canvas.getContext('2d');
    drawIcon(ctx, size);
    return {
      size,
      buffer: canvas.toBuffer('image/png'),
    };
  });

  // ICO file header
  const headerSize = 6;
  const entrySize = 16;
  let offset = headerSize + entrySize * images.length;

  // Calculate total file size
  let totalSize = offset;
  for (const img of images) {
    totalSize += img.buffer.length;
  }

  const icoBuffer = Buffer.alloc(totalSize);

  // Write ICO header
  icoBuffer.writeUInt16LE(0, 0); // Reserved (must be 0)
  icoBuffer.writeUInt16LE(1, 2); // Image type (1 = ICO)
  icoBuffer.writeUInt16LE(images.length, 4); // Number of images

  // Write directory entries
  let entryOffset = headerSize;
  for (const img of images) {
    icoBuffer.writeUInt8(img.size === 256 ? 0 : img.size, entryOffset); // Width (0 means 256)
    icoBuffer.writeUInt8(img.size === 256 ? 0 : img.size, entryOffset + 1); // Height
    icoBuffer.writeUInt8(0, entryOffset + 2); // Color palette (0 for no palette)
    icoBuffer.writeUInt8(0, entryOffset + 3); // Reserved
    icoBuffer.writeUInt16LE(1, entryOffset + 4); // Color planes
    icoBuffer.writeUInt16LE(32, entryOffset + 6); // Bits per pixel
    icoBuffer.writeUInt32LE(img.buffer.length, entryOffset + 8); // Image size
    icoBuffer.writeUInt32LE(offset, entryOffset + 12); // Image offset

    entryOffset += entrySize;
    offset += img.buffer.length;
  }

  // Write image data
  offset = headerSize + entrySize * images.length;
  for (const img of images) {
    img.buffer.copy(icoBuffer, offset);
    offset += img.buffer.length;
  }

  fs.writeFileSync(path.join(ICONS_DIR, 'icon.ico'), icoBuffer);
  console.log('  ✓ Created icon.ico');
}

// Main execution
generateAllIcons();
createIcns();
createIco();

console.log('\n🎉 Icon generation complete!\n');
