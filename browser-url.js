// Hash routing helpers used by BrowserUrlRouter (net10.0-browser).
export async function readHash() {
    return location.hash;
}

export async function writeHash(hash, replace) {
    if (replace) {
        // Clear the hash without leaving a history entry (logout / initial normalize).
        history.replaceState(null, "", hash || (location.pathname + location.search));
        return;
    }
    location.hash = hash;
}
