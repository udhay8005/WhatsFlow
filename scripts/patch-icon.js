/**
 * afterPack hook for electron-builder.
 * Patches the WhatsFlow.exe icon using rcedit BEFORE electron-builder
 * creates the NSIS installer. This ensures the installed app has the
 * correct icon in the taskbar, Alt-Tab, and Windows Settings > Apps.
 *
 * Also runs standalone (node scripts/patch-icon.js) for manual use.
 */
const rcedit = require('rcedit');
const path = require('path');
const fs = require('fs');
const { productName } = require('../package.json');

const ico = path.join(__dirname, '..', 'frontend', 'public', 'icon.ico');
const name = productName || 'WhatsFlow';

// afterPack hook export — called by electron-builder after packing, before installer build
module.exports = async function afterPack(context) {
    const exePath = path.join(context.appOutDir, `${name}.exe`);
    if (!fs.existsSync(exePath)) {
        console.log(`[patch-icon] ${exePath} not found, skipping`);
        return;
    }
    await rcedit(exePath, { icon: ico });
    console.log(`[patch-icon] Patched icon: ${exePath}`);
};

// Standalone execution: patch win-unpacked directly
if (require.main === module) {
    const dist = path.join(__dirname, '..', 'dist');
    const target = path.join(dist, 'win-unpacked', `${name}.exe`);
    if (fs.existsSync(target)) {
        rcedit(target, { icon: ico })
            .then(() => console.log(`Patched: ${path.basename(target)}`))
            .catch(e => console.error('rcedit failed:', e));
    } else {
        console.log('No unpacked exe found to patch');
    }
}
