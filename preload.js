'use strict';

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('zipcatcher', {
    flashcardsInit:   ()      => ipcRenderer.invoke('flashcards-init'),
    flashcardsReview: (payload) => ipcRenderer.invoke('flashcards-review', payload),
    flashcardsShuffle: ()     => ipcRenderer.invoke('flashcards-shuffle'),
    flashcardsReset:  ()      => ipcRenderer.invoke('flashcards-reset'),
});
