const sharp = require('sharp');
const fs = require('fs');

async function fixIcon() {
  const inputPath = './public/pwa-512x512.png';
  
  if (!fs.existsSync(inputPath)) {
    console.error('File not found:', inputPath);
    return;
  }

  try {
    // We flatten the image onto a solid background.
    // If the image has a black shape, flattening onto black (#0F0F0F) or very dark gray (#111111) will hide the shape's rounded corners.
    // Let's use pure black rgb(10, 10, 10) to match standard dark theme or pure black (0,0,0)
    // Actually, looking at the user's screenshot, it looks almost pure black.
    // Let's just use { r: 15, g: 15, b: 15 } just in case it's not perfectly black, it will look like a solid dark grey block which is nice,
    // OR we use exactly { r: 0, g: 0, b: 0 } which is standard. We'll go with black.
    
    // Backup the original
    fs.copyFileSync(inputPath, './public/pwa-512x512-backup.png');
    
    // Generate 512x512
    await sharp(inputPath)
      .flatten({ background: { r: 18, g: 18, b: 18 } }) // Fills transparent pixels with very dark grey/black
      .resize(512, 512)
      .toFile('./public/pwa-512x512-fixed.png');
      
    // Generate 192x192
    await sharp(inputPath)
      .flatten({ background: { r: 18, g: 18, b: 18 } })
      .resize(192, 192)
      .toFile('./public/pwa-192x192-fixed.png');
      
    // Generate apple-touch-icon 180x180 (optional, but good practice)
    await sharp(inputPath)
      .flatten({ background: { r: 18, g: 18, b: 18 } })
      .resize(180, 180)
      .toFile('./public/apple-touch-icon.png');
      
    // Replace the old ones
    fs.copyFileSync('./public/pwa-512x512-fixed.png', './public/pwa-512x512.png');
    fs.copyFileSync('./public/pwa-192x192-fixed.png', './public/pwa-192x192.png');
    
    console.log('Icons successfully processed and overwritten!');
  } catch (error) {
    console.error('Error processing image:', error);
  }
}

fixIcon();
