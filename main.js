import { dotnet } from './_framework/dotnet.js'

const is_browser = typeof window != "undefined";
if (!is_browser) throw new Error(`Expected to be running in a browser`);

const statusEl = document.getElementById('admin-splash-status');
const errorEl = document.getElementById('admin-splash-error');
const errorTextEl = document.getElementById('admin-splash-error-text');

// Production-only service worker: caches the hashed WASM runtime so second
// loads start much faster. Never enabled on localhost, so dev cannot serve
// stale hashed assets.
if ('serviceWorker' in navigator
    && location.protocol === 'https:'
    && !['localhost', '127.0.0.1'].includes(location.hostname))
{
    window.addEventListener('load', () =>
    {
        navigator.serviceWorker.register('./sw.js').catch((error) =>
        {
            console.warn('Admin web shell: service worker registration failed:', error);
        });
    });
}

function setStatus(text) {
    if (statusEl) statusEl.textContent = text;
}

function showError(error) {
    console.error('Admin web shell failed to start:', error);
    if (!errorEl) return;
    if (errorTextEl) errorTextEl.textContent = (error && error.message) ? error.message : String(error);
    errorEl.hidden = false;
    if (statusEl) statusEl.hidden = true;
}

// Avalonia mounts its canvas with prepend() and never removes the splash, so
// the full-screen splash would otherwise cover the app forever once it boots.
(() => {
    const out = document.getElementById('out');
    if (!out) return;
    const hideSplash = () => document.querySelector('.admin-splash')?.remove();
    if (out.querySelector('canvas.avalonia-canvas')) {
        hideSplash();
        return;
    }
    const observer = new MutationObserver(() => {
        if (out.querySelector('canvas.avalonia-canvas')) {
            hideSplash();
            observer.disconnect();
        }
    });
    observer.observe(out, { childList: true });
})();

try {
    setStatus('正在下载运行时…');
    const dotnetRuntime = await dotnet
        .withDiagnosticTracing(false)
        .withApplicationArgumentsFromQuery()
        .create();

    setStatus('正在启动应用…');
    const config = dotnetRuntime.getConfig();

    await dotnetRuntime.runMain(config.mainAssemblyName, [globalThis.location.href]);
} catch (error) {
    showError(error);
}
