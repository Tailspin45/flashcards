// Renderer logic copied from original Zipcatcher flashcards implementation
'use strict';

const state = { session: null, revealed: false };
const els = {};
function $(id) { return document.getElementById(id); }
function setNotice(message) { const notice = els.notice; if (!notice) return; if (!message) { notice.style.display = 'none'; notice.textContent = ''; return; } notice.textContent = message; notice.style.display = 'block'; }
function setStats(session) {
    els.deckPill.textContent = session.deckName;
    els.cardCount.textContent = `${session.totalCards} cards`;
    els.queueCount.textContent = `${session.queueLength} queued`;
    els.reviewCount && (els.reviewCount.textContent = `${session.stats.reviewed} reviewed`);
    els.shuffleCount && (els.shuffleCount.textContent = `${session.stats.shuffles} shuffles`);
    els.correctCount && (els.correctCount.textContent = session.stats.correct);
    els.wrongCount && (els.wrongCount.textContent = session.stats.wrong);
    els.skippedCount && (els.skippedCount.textContent = session.stats.skipped);
    els.streakCount && (els.streakCount.textContent = session.stats.streak);
    const pct = session.totalCards > 0 ? Math.max(0, Math.min(100, Math.round((session.progress.index / session.totalCards) * 100))) : 0;
    if (els.progressFill) els.progressFill.style.width = `${pct}%`;
    if (els.footerNote) els.footerNote.textContent = `Deck: ${session.deckPath}`;
}
function renderSession(session) {
    state.session = session; state.revealed = false; els.response.value = ''; els.answerBox.classList.remove('visible'); els.gradeRow.style.display = 'none'; els.question.textContent = session.currentCard.question; els.answer.textContent = session.currentCard.answer; els.revealBtn.disabled = false; els.skipBtn.disabled = false; els.shuffleBtn.disabled = false; els.rightBtn.disabled = false; els.wrongBtn.disabled = false; setNotice(''); setStats(session);
}
async function refreshFromMain() {
    const session = await window.zipcatcher.flashcardsInit();
    if (!session || !session.ok) { setNotice(session && session.error ? session.error : 'Unable to load flash-card deck.'); els.question.textContent = 'No deck loaded'; els.answer.textContent = ''; els.revealBtn.disabled = true; els.rightBtn.disabled = true; els.wrongBtn.disabled = true; els.skipBtn.disabled = true; els.shuffleBtn.disabled = true; return; }
    renderSession(session);
}
async function shuffleDeck() { const session = await window.zipcatcher.flashcardsShuffle(); if (!session || !session.ok) { setNotice(session && session.error ? session.error : 'Unable to shuffle the deck.'); return; } renderSession(session); }
async function gradeCard(verdict) { if (!state.session) return; const session = await window.zipcatcher.flashcardsReview({ verdict, responseText: els.response.value }); if (!session || !session.ok) { setNotice(session && session.error ? session.error : 'Unable to save the response.'); return; } renderSession(session); }
function revealAnswer() { state.revealed = true; els.answerBox.classList.add('visible'); els.gradeRow.style.display = 'flex'; els.revealBtn.disabled = true; }
async function skipCard() { const session = await window.zipcatcher.flashcardsReview({ verdict: 'skip', responseText: els.response.value }); if (!session || !session.ok) { setNotice(session && session.error ? session.error : 'Unable to skip the card.'); return; } renderSession(session); }
function wireEvents() { els.revealBtn.addEventListener('click', revealAnswer); els.rightBtn.addEventListener('click', () => gradeCard('up')); els.wrongBtn.addEventListener('click', () => gradeCard('down')); els.skipBtn.addEventListener('click', skipCard); els.shuffleBtn.addEventListener('click', shuffleDeck); els.response.addEventListener('keydown', (event) => { if (event.key === 'Escape') els.response.value = ''; if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') revealAnswer(); }); }
function cacheEls() { ['notice','deckPill','cardCount','queueCount','reviewCount','shuffleCount','correctCount','wrongCount','skippedCount','streakCount','progressFill','footerNote','question','response','answerBox','answer','gradeRow','revealBtn','shuffleBtn','skipBtn','rightBtn','wrongBtn'].forEach((id)=>{ els[id] = $(id); }); }
window.addEventListener('DOMContentLoaded', async () => { cacheEls(); wireEvents(); await refreshFromMain(); });
