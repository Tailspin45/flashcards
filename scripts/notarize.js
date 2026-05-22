// electron-builder afterSign hook: notarize the signed .app via Apple notarytool.
// Requires env: APPLE_ID, APPLE_APP_SPECIFIC_PASSWORD, APPLE_TEAM_ID.
// Set SKIP_NOTARIZE=1 to bypass (e.g. for local dev builds).

const path = require('path');

exports.default = async function notarizing(context) {
  const { electronPlatformName, appOutDir, packager } = context;
  if (electronPlatformName !== 'darwin') return;
  if (process.env.SKIP_NOTARIZE === '1') {
    console.log('  • notarize  skipped (SKIP_NOTARIZE=1)');
    return;
  }

  const appleId = process.env.APPLE_ID;
  const appleIdPassword = process.env.APPLE_APP_SPECIFIC_PASSWORD;
  const teamId = process.env.APPLE_TEAM_ID;

  if (!appleId || !appleIdPassword || !teamId) {
    throw new Error(
      'Notarization aborted: missing one of APPLE_ID, APPLE_APP_SPECIFIC_PASSWORD, APPLE_TEAM_ID.'
    );
  }

  const appName = packager.appInfo.productFilename;
  const appPath = path.join(appOutDir, `${appName}.app`);

  // @electron/notarize is shipped as a transitive dep of electron-builder.
  let notarize;
  try {
    notarize = require('@electron/notarize').notarize;
  } catch (e) {
    notarize = require(require.resolve('@electron/notarize', {
      paths: [path.join(process.cwd(), 'node_modules', 'electron-builder')],
    })).notarize;
  }

  console.log(`  • notarize  app=${appPath} teamId=${teamId}`);
  await notarize({
    tool: 'notarytool',
    appPath,
    appleId,
    appleIdPassword,
    teamId,
  });
  console.log('  • notarize  done');
};
