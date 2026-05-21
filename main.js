'use strict';

const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');

// Paths
const USER_DATA = app.getPath('userData');
const RESOURCES = __dirname;
const FLASHCARDS_CSV_PATH = process.env.FLASHCARDS_CSV_PATH
    ? path.resolve(process.env.FLASHCARDS_CSV_PATH)
    : path.join(RESOURCES, 'flashcards.csv');
const FLASHCARDS_STATE_FILE = path.join(USER_DATA, 'flashcards-state.json');

function parseFlashcardsCsv(text) {
    const rows = [];
    let row = [];
    let cell = '';
    let inQuotes = false;
    const normalized = String(text || '').replace(/\r\n/g, '\n').replace(/\r/g, '\n');

    for (let i = 0; i < normalized.length; i += 1) {
        const ch = normalized[i];
        if (inQuotes) {
            if (ch === '"') {
                if (normalized[i + 1] === '"') {
                    cell += '"';
                    i += 1;
                } else {
                    inQuotes = false;
                }
            } else {
                cell += ch;
            }
            continue;
        }

        if (ch === '"') {
            inQuotes = true;
        } else if (ch === ',') {
            row.push(cell);
            cell = '';
        } else if (ch === '\n') {
            row.push(cell);
            if (row.some(value => String(value).trim() !== '')) rows.push(row);
            row = [];
            cell = '';
        } else {
            cell += ch;
        }
    }

    row.push(cell);
    if (row.some(value => String(value).trim() !== '')) rows.push(row);
    return rows;
}

function shuffleArray(values) {
    const items = values.slice();
    for (let i = items.length - 1; i > 0; i -= 1) {
        const j = Math.floor(Math.random() * (i + 1));
        [items[i], items[j]] = [items[j], items[i]];
    }
    return items;
}

function loadFlashcardsDeck() {
    if (!fs.existsSync(FLASHCARDS_CSV_PATH)) {
        throw new Error(`Flash-card CSV not found: ${FLASHCARDS_CSV_PATH}`);
    }
    const raw = fs.readFileSync(FLASHCARDS_CSV_PATH, 'utf8');
    const rows = parseFlashcardsCsv(raw);
    if (!rows.length) throw new Error('Flash-card CSV is empty.');

    const header = rows[0].map(cell => String(cell).trim().toLowerCase());
    const hasHeader = header.includes('question') && header.includes('answer');
    const questionIndex = hasHeader ? header.indexOf('question') : 0;
    const answerIndex = hasHeader ? header.indexOf('answer') : 1;
    const startRow = hasHeader ? 1 : 0;

    const cards = [];
    rows.slice(startRow).forEach((row, index) => {
        const question = String(row[questionIndex] || '').trim();
        const answer = String(row[answerIndex] || '').trim();
        if (!question || !answer) return;
        cards.push({ id: String(index + 1), question, answer });
    });

    if (!cards.length) throw new Error('Flash-card CSV does not contain any usable question/answer rows.');
    const crypto = require('crypto');
    return { path: FLASHCARDS_CSV_PATH, fingerprint: crypto.createHash('sha1').update(raw).digest('hex'), cards };
}

function defaultFlashcardsState(deck) {
    return {
        deckFingerprint: deck.fingerprint,
        deckPath: deck.path,
        queue: deck.cards.map(card => card.id),
        stats: { correct: 0, wrong: 0, skipped: 0, reviewed: 0, shuffles: 0, streak: 0 },
        cards: {},
        updatedAt: new Date().toISOString(),
    };
}

function normalizeFlashcardsState(state, deck) {
    if (!state || state.deckFingerprint !== deck.fingerprint || !Array.isArray(state.queue)) {
        return defaultFlashcardsState(deck);
    }
    const cardIds = new Set(deck.cards.map(card => card.id));
    const queue = state.queue.filter(id => cardIds.has(id));
    const queueSet = new Set(queue);
    deck.cards.forEach(card => { if (!queueSet.has(card.id)) queue.push(card.id); });

    const cards = {};
    deck.cards.forEach(card => {
        const previous = state.cards && state.cards[card.id] ? state.cards[card.id] : {};
        cards[card.id] = {
            correct: Number(previous.correct || 0),
            wrong: Number(previous.wrong || 0),
            skipped: Number(previous.skipped || 0),
            seen: Number(previous.seen || 0),
            lastVerdict: previous.lastVerdict || null,
            lastResponse: previous.lastResponse || '',
            lastReviewedAt: previous.lastReviewedAt || null,
        };
    });

    return {
        deckFingerprint: deck.fingerprint,
        deckPath: deck.path,
        queue: queue.length ? queue : deck.cards.map(card => card.id),
        stats: {
            correct: Number(state.stats && state.stats.correct || 0),
            wrong: Number(state.stats && state.stats.wrong || 0),
            skipped: Number(state.stats && state.stats.skipped || 0),
            reviewed: Number(state.stats && state.stats.reviewed || 0),
            shuffles: Number(state.stats && state.stats.shuffles || 0),
            streak: Number(state.stats && state.stats.streak || 0),
        },
        cards,
        updatedAt: state.updatedAt || new Date().toISOString(),
    };
}

function loadFlashcardsState(deck) {
    try {
        if (!fs.existsSync(FLASHCARDS_STATE_FILE)) return defaultFlashcardsState(deck);
        const state = JSON.parse(fs.readFileSync(FLASHCARDS_STATE_FILE, 'utf8'));
        return normalizeFlashcardsState(state, deck);
    } catch (error) {
        console.warn(`[flashcards] Resetting state: ${error.message}`);
        return defaultFlashcardsState(deck);
    }
}

function saveFlashcardsState(state) {
    fs.mkdirSync(USER_DATA, { recursive: true });
    fs.writeFileSync(FLASHCARDS_STATE_FILE, JSON.stringify(state, null, 2));
}

function getFlashcardsSession() {
    const deck = loadFlashcardsDeck();
    const state = loadFlashcardsState(deck);
    const currentId = state.queue[0] || deck.cards[0].id;
    const currentCard = deck.cards.find(card => card.id === currentId) || deck.cards[0];
    const currentCardState = state.cards[currentCard.id] || {};
    return { deck, state, currentCard, currentCardState };
}

function deckSummary(session) {
    const { deck, state, currentCard, currentCardState } = session;
    const totalCorrect = Object.values(state.cards).reduce((sum, card) => sum + Number(card.correct || 0), 0);
    const totalWrong = Object.values(state.cards).reduce((sum, card) => sum + Number(card.wrong || 0), 0);
    const totalSkipped = Object.values(state.cards).reduce((sum, card) => sum + Number(card.skipped || 0), 0);
    const currentIndex = deck.cards.findIndex(card => card.id === currentCard.id);
    return {
        ok: true,
        deckPath: deck.path,
        deckName: path.basename(deck.path),
        totalCards: deck.cards.length,
        queueLength: state.queue.length,
        currentCard,
        currentCardState,
        stats: { correct: totalCorrect, wrong: totalWrong, skipped: totalSkipped, reviewed: totalCorrect + totalWrong, shuffles: Number(state.stats.shuffles || 0) },
        progress: { index: currentIndex < 0 ? 0 : currentIndex + 1, percentage: Math.round(((currentIndex < 0 ? 0 : currentIndex + 1) / deck.cards.length) * 100) },
        sampleAnswer: currentCard.answer,
    };
}

function rotateQueueAfterReview(queue, verdict) {
    if (!queue.length) return queue;
    const [current, ...rest] = queue;
    if (verdict === 'down') {
        if (!rest.length) return [current];
        return [rest[0], current, ...rest.slice(1)];
    }
    return [...rest, current];
}

function shuffleQueue(queue) {
    if (queue.length <= 1) return queue.slice();
    const [current, ...rest] = queue;
    return [current, ...shuffleArray(rest)];
}

function updateFlashcardsReview(verdict, responseText = '') {
    const session = getFlashcardsSession();
    const { deck, state, currentCard, currentCardState } = session;

    state.cards[currentCard.id] = {
        ...currentCardState,
        seen: Number(currentCardState.seen || 0) + (verdict === 'skip' ? 0 : 1),
        correct: Number(currentCardState.correct || 0) + (verdict === 'up' ? 1 : 0),
        wrong: Number(currentCardState.wrong || 0) + (verdict === 'down' ? 1 : 0),
        skipped: Number(currentCardState.skipped || 0) + (verdict === 'skip' ? 1 : 0),
        lastVerdict: verdict,
        lastResponse: String(responseText || ''),
        lastReviewedAt: new Date().toISOString(),
    };

    if (verdict === 'up' || verdict === 'down') state.stats.reviewed = Number(state.stats.reviewed || 0) + 1;
    if (verdict === 'up') state.stats.correct = Number(state.stats.correct || 0) + 1;
    if (verdict === 'down') state.stats.wrong = Number(state.stats.wrong || 0) + 1;
    if (verdict === 'skip') state.stats.skipped = Number(state.stats.skipped || 0) + 1;
    if (verdict === 'up') state.stats.streak = Number(state.stats.streak || 0) + 1;
    else if (verdict === 'down') state.stats.streak = 0;

    state.queue = rotateQueueAfterReview(state.queue, verdict);
    state.updatedAt = new Date().toISOString();
    saveFlashcardsState(state);

    return deckSummary({ deck, state, currentCard: deck.cards.find(card => card.id === state.queue[0]) || deck.cards[0], currentCardState: state.cards[state.queue[0]] || {} });
}

function shuffleFlashcardsSession() {
    const session = getFlashcardsSession();
    session.state.queue = shuffleQueue(session.state.queue);
    session.state.stats.shuffles = Number(session.state.stats.shuffles || 0) + 1;
    session.state.updatedAt = new Date().toISOString();
    saveFlashcardsState(session.state);
    return deckSummary(getFlashcardsSession());
}

function resetFlashcardsSession() {
    const deck = loadFlashcardsDeck();
    const state = defaultFlashcardsState(deck);
    saveFlashcardsState(state);
    return deckSummary({ deck, state, currentCard: deck.cards[0], currentCardState: state.cards[deck.cards[0].id] || {} });
}

// IPC handlers exposed to renderer
ipcMain.handle('flashcards-init', () => {
    try { return deckSummary(getFlashcardsSession()); } catch (e) { return { ok: false, error: e.message }; }
});

ipcMain.handle('flashcards-review', (_e, payload = {}) => {
    try { return updateFlashcardsReview(payload.verdict, payload.responseText || ''); } catch (e) { return { ok: false, error: e.message }; }
});

ipcMain.handle('flashcards-shuffle', () => {
    try { return shuffleFlashcardsSession(); } catch (e) { return { ok: false, error: e.message }; }
});

ipcMain.handle('flashcards-reset', () => {
    try { return resetFlashcardsSession(); } catch (e) { return { ok: false, error: e.message }; }
});

function createMainWindow() {
    const win = new BrowserWindow({
        width: 1200,
        height: 800,
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            contextIsolation: true,
            nodeIntegration: false,
        },
    });
    win.loadFile(path.join(__dirname, 'flashcards.html'));
}

app.whenReady().then(() => {
    createMainWindow();
    app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createMainWindow(); });
});

app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
