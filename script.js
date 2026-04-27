const TURN_LENGTH = 30;
const CARD_COUNT = 12;
const PAIR_COUNT = CARD_COUNT / 2;
const CARD_BACK_IMAGE = "./assets/cards/Back.png";
const CARD_FACE_IMAGES = [
  "./assets/cards/Front 1.png",
  "./assets/cards/Front 2.png",
  "./assets/cards/Front 3.png",
  "./assets/cards/Front 4.png",
  "./assets/cards/Front 5.png",
  "./assets/cards/Front 5.png",
];

const state = {
  timer: TURN_LENGTH,
  timerHandle: null,
  flipBackHandle: null,
  endOverlayHandle: null,
  cards: [],
  flippedIds: [],
  lockBoard: false,
  finished: false,
  started: false,
};

const gameBoard = document.querySelector("#game-board");
const timerLabel = document.querySelector("#timer");
const cardTemplate = document.querySelector("#card-template");
const timerRing = document.querySelector(".timer-ring");
const gameOverlay = document.querySelector("#game-overlay");
const overlayMessage = document.querySelector("#overlay-message");
const overlayButton = document.querySelector("#overlay-button");
let audioContext;

function shuffle(items) {
  const copy = [...items];

  for (let index = copy.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [copy[index], copy[swapIndex]] = [copy[swapIndex], copy[index]];
  }

  return copy;
}

function createDeck(cardCount) {
  const pairCount = cardCount / 2;
  const images = shuffle(CARD_FACE_IMAGES).slice(0, pairCount);
  const deck = images.flatMap((image, pairIndex) => [
    { id: `${pairIndex}-a`, pairId: pairIndex, image, matched: false },
    { id: `${pairIndex}-b`, pairId: pairIndex, image, matched: false },
  ]);

  return shuffle(deck);
}

function getAudioContext() {
  if (!audioContext) {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) {
      return null;
    }
    audioContext = new AudioContextClass();
  }

  if (audioContext.state === "suspended") {
    audioContext.resume().catch(() => {});
  }

  return audioContext;
}

function playTone({
  frequency,
  duration,
  type = "sine",
  volume = 0.04,
  attack = 0.005,
  release = 0.08,
  detune = 0,
  startAt = 0,
}) {
  const context = getAudioContext();

  if (!context) {
    return;
  }

  const start = context.currentTime + startAt;
  const end = start + duration;
  const oscillator = context.createOscillator();
  const gainNode = context.createGain();
  const filterNode = context.createBiquadFilter();

  oscillator.type = type;
  oscillator.frequency.setValueAtTime(frequency, start);
  oscillator.detune.setValueAtTime(detune, start);
  filterNode.type = "lowpass";
  filterNode.frequency.setValueAtTime(2400, start);
  filterNode.Q.setValueAtTime(0.8, start);
  gainNode.gain.setValueAtTime(0.0001, start);
  gainNode.gain.linearRampToValueAtTime(volume, start + attack);
  gainNode.gain.exponentialRampToValueAtTime(0.0001, end + release);

  oscillator.connect(filterNode);
  filterNode.connect(gainNode);
  gainNode.connect(context.destination);
  oscillator.start(start);
  oscillator.stop(end + release);
}

function playFlipSound() {
  playTone({ frequency: 720, duration: 0.04, type: "triangle", volume: 0.02, release: 0.05 });
  playTone({ frequency: 960, duration: 0.03, type: "sine", volume: 0.014, release: 0.04, startAt: 0.015 });
}

function playMatchSound() {
  playTone({ frequency: 660, duration: 0.09, type: "sine", volume: 0.035, release: 0.08 });
  playTone({ frequency: 990, duration: 0.12, type: "triangle", volume: 0.026, release: 0.1, startAt: 0.06 });
  playTone({ frequency: 1320, duration: 0.09, type: "sine", volume: 0.018, release: 0.08, startAt: 0.09 });
}

function playMismatchSound() {
  playTone({ frequency: 320, duration: 0.06, type: "triangle", volume: 0.022, release: 0.06 });
  playTone({ frequency: 240, duration: 0.09, type: "sine", volume: 0.018, release: 0.08, startAt: 0.045 });
}

function playStartSound() {
  playTone({ frequency: 392, duration: 0.1, type: "sine", volume: 0.022, release: 0.08 });
  playTone({ frequency: 523.25, duration: 0.12, type: "triangle", volume: 0.022, release: 0.1, startAt: 0.07 });
  playTone({ frequency: 659.25, duration: 0.14, type: "sine", volume: 0.018, release: 0.12, startAt: 0.13 });
}

function playTimesUpSound() {
  playTone({ frequency: 523.25, duration: 0.08, type: "triangle", volume: 0.02, release: 0.08 });
  playTone({ frequency: 392, duration: 0.1, type: "triangle", volume: 0.024, release: 0.1, startAt: 0.08 });
  playTone({ frequency: 261.63, duration: 0.16, type: "sine", volume: 0.02, release: 0.14, startAt: 0.16 });
}

function startTimer() {
  window.clearInterval(state.timerHandle);
  state.timer = TURN_LENGTH;
  updateTimer();

  state.timerHandle = window.setInterval(() => {
    if (state.finished) {
      return;
    }

    state.timer -= 1;
    updateTimer();

    if (state.timer <= 0) {
      playTimesUpSound();
      finishGame("Time's up.");
    }
  }, 1000);
}

function updateTimer() {
  timerLabel.textContent = String(state.timer);
  const progress = `${(state.timer / TURN_LENGTH) * 100}%`;
  timerRing.style.setProperty("--timer-progress", progress);
}

function renderBoard() {
  gameBoard.innerHTML = "";
  gameBoard.style.gridTemplateColumns = "repeat(4, minmax(0, 1fr))";

  state.cards.forEach((card) => {
    const fragment = cardTemplate.content.cloneNode(true);
    const button = fragment.querySelector(".memory-card");
    const frontFace = fragment.querySelector(".card-front");
    const backFace = fragment.querySelector(".card-back");

    button.dataset.id = card.id;
    frontFace.style.backgroundImage = `url("${CARD_BACK_IMAGE}")`;
    backFace.style.backgroundImage = `url("${card.image}")`;

    if (card.matched) {
      button.classList.add("flipped", "matched");
      button.disabled = true;
    }

    if (state.flippedIds.includes(card.id)) {
      button.classList.add("flipped");
    }

    gameBoard.appendChild(fragment);
  });
}

function updateStatus() {
  renderBoard();
}

function showOverlay(buttonLabel, message = "") {
  window.clearTimeout(state.endOverlayHandle);
  overlayMessage.textContent = message;
  overlayMessage.hidden = !message;
  overlayButton.textContent = buttonLabel;
  gameOverlay.classList.remove("hidden");
}

function hideOverlay() {
  gameOverlay.classList.add("hidden");
}

function resetBoard() {
  state.cards = createDeck(CARD_COUNT);
  state.flippedIds = [];
  state.lockBoard = false;
  state.finished = false;
  state.started = false;
  state.timer = TURN_LENGTH;
  window.clearInterval(state.timerHandle);
  window.clearTimeout(state.flipBackHandle);
  window.clearTimeout(state.endOverlayHandle);
  updateTimer();
  updateStatus();
}

function finishGame(reason = "Nice run.") {
  state.finished = true;
  state.started = false;
  window.clearInterval(state.timerHandle);
  window.clearTimeout(state.flipBackHandle);
  const matchedCards = state.cards.filter((card) => card.matched).length;
  showOverlay("Play Again", `Congratulations! You matched ${matchedCards} / ${CARD_COUNT} cards`);
  state.endOverlayHandle = window.setTimeout(() => {
    resetBoard();
    showOverlay("Start Round");
  }, 5000);
}

function checkForMatch() {
  const [firstId, secondId] = state.flippedIds;
  const firstCard = state.cards.find((card) => card.id === firstId);
  const secondCard = state.cards.find((card) => card.id === secondId);

  if (firstCard.pairId === secondCard.pairId) {
    playMatchSound();
    firstCard.matched = true;
    secondCard.matched = true;
    state.flippedIds = [];
    state.lockBoard = false;

    updateStatus();

    const pairsLeft = state.cards.filter((card) => !card.matched).length / 2;

    if (pairsLeft === 0) {
      finishGame("Board cleared.");
      return;
    }
    return;
  }

  playMismatchSound();
  state.lockBoard = true;
  const mismatchedButtons = state.flippedIds
    .map((id) => gameBoard.querySelector(`[data-id="${id}"]`))
    .filter(Boolean);

  window.clearTimeout(state.flipBackHandle);
  state.flipBackHandle = window.setTimeout(() => {
    mismatchedButtons.forEach((button) => {
      button.classList.remove("flipped");
    });
    state.flipBackHandle = window.setTimeout(() => {
      state.flippedIds = [];
      state.lockBoard = false;
      updateStatus();
    }, 340);
  }, 120);
}

function handleCardClick(event) {
  const button = event.target.closest(".memory-card");

  if (!button || state.lockBoard || state.finished || !state.started) {
    return;
  }

  const { id } = button.dataset;
  const card = state.cards.find((item) => item.id === id);

  if (!card || card.matched || state.flippedIds.includes(id)) {
    return;
  }

  state.flippedIds.push(id);
  button.classList.add("flipped");
  playFlipSound();

  if (state.flippedIds.length === 2) {
    state.lockBoard = true;
    window.setTimeout(() => {
      checkForMatch();
    }, 320);
  } else {
    state.lockBoard = false;
  }
}

function startGame(event) {
  if (event) {
    event.preventDefault();
  }

  resetBoard();
  state.started = true;
  hideOverlay();
  playStartSound();
  startTimer();
}

overlayButton.addEventListener("click", startGame);
gameBoard.addEventListener("click", handleCardClick);

resetBoard();
showOverlay("Start Round");
