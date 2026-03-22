/**
 * electron-builder afterPack hook.
 * Embeds the WhatsFlow icon into the Electron exe BEFORE
 * NSIS/portable builds package it, so the installed app
 * shows the correct icon in the Windows taskbar and Settings > Apps.
 */
const path = require('path');

exports.default = async function afterPack(context) {
    if (context.electronPlatformName !== 'win32') return;

    try {
        const rcedit = require('rcedit');

        // context.packager.appInfo.productFilename is the exe name without .exe
        const exeName = context.packager.appInfo.productFilename;
        const exePath = path.join(context.appOutDir, `${exeName}.exe`);
        const iconPath = path.join(__dirname, '..', 'frontend', 'public', 'icon.ico');

        await rcedit(exePath, { icon: iconPath });
        console.log(`  • icon embedded  file=${exeName}.exe`);
    } catch (err) {
        console.warn(`  ⚠ afterPack icon patch failed: ${err.message}`);
    }
};
