const ICONS = ["☀", "☕", "✿", "♫", "⚑", "✦", "☘", "☾", "♣", "✸"];
const TURN_LENGTH = 30;
const CARD_COUNT = 16;

const state = {
  timer: TURN_LENGTH,
  timerHandle: null,
  flipBackHandle: null,
  cards: [],
  flippedIds: [],
  moves: 0,
  lockBoard: false,
  finished: false,
  started: false,
};

const gameBoard = document.querySelector("#game-board");
const timerLabel = document.querySelector("#timer");
const pairsLeftLabel = document.querySelector("#pairs-left");
const messageText = document.querySelector("#message-text");
const cardTemplate = document.querySelector("#card-template");
const timerRing = document.querySelector(".timer-ring");
const gameOverlay = document.querySelector("#game-overlay");
const overlayText = document.querySelector("#overlay-text");
const overlayButton = document.querySelector("#overlay-button");

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
  const symbols = shuffle(ICONS).slice(0, pairCount);
  const deck = symbols.flatMap((symbol, pairIndex) => [
    { id: `${pairIndex}-a`, pairId: pairIndex, symbol, matched: false },
    { id: `${pairIndex}-b`, pairId: pairIndex, symbol, matched: false },
  ]);

  return shuffle(deck);
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
      finishGame("Time's up.");
    }
  }, 1000);
}

function updateTimer() {
  timerLabel.textContent = String(state.timer);
  const progress = (state.timer / TURN_LENGTH) * 360;
  timerRing.style.background =
    `radial-gradient(circle at center, var(--navy-soft) 0 42%, transparent 43%), ` +
    `conic-gradient(var(--cyan) ${progress}deg, rgba(95, 182, 198, 0.18) ${progress}deg)`;
}

function renderBoard() {
  gameBoard.innerHTML = "";
  gameBoard.style.gridTemplateColumns = "repeat(4, minmax(0, 1fr))";

  state.cards.forEach((card) => {
    const fragment = cardTemplate.content.cloneNode(true);
    const button = fragment.querySelector(".memory-card");
    const backFace = fragment.querySelector(".card-back");

    button.dataset.id = card.id;
    backFace.textContent = card.symbol;

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
  const pairsLeft = state.cards.filter((card) => !card.matched).length / 2;

  pairsLeftLabel.textContent = String(pairsLeft);
  renderBoard();
}

function setMessage(message) {
  messageText.textContent = message;
}

function showOverlay(message, buttonLabel) {
  overlayText.textContent = message;
  overlayButton.textContent = buttonLabel;
  gameOverlay.classList.remove("hidden");
}

function hideOverlay() {
  gameOverlay.classList.add("hidden");
}

function resetBoard() {
  state.cards = createDeck(CARD_COUNT);
  state.flippedIds = [];
  state.moves = 0;
  state.lockBoard = false;
  state.finished = false;
  state.started = false;
  state.timer = TURN_LENGTH;
  window.clearInterval(state.timerHandle);
  window.clearTimeout(state.flipBackHandle);
  updateTimer();
  updateStatus();
}

function finishGame(reason = "Nice run.") {
  state.finished = true;
  state.started = false;
  window.clearInterval(state.timerHandle);
  window.clearTimeout(state.flipBackHandle);
  const matchedPairs = state.cards.filter((card) => card.matched).length / 2;
  setMessage(`${reason} You found ${matchedPairs} of 8 pairs. Tap restart to play again.`);
  showOverlay(`${reason} You found ${matchedPairs} of 8 pairs. Ready for another round?`, "Play Again");
}

function checkForMatch() {
  const [firstId, secondId] = state.flippedIds;
  const firstCard = state.cards.find((card) => card.id === firstId);
  const secondCard = state.cards.find((card) => card.id === secondId);

  state.moves += 1;

  if (firstCard.pairId === secondCard.pairId) {
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

    setMessage("Match found. Keep going.");
    return;
  }

  setMessage("No match. Cards will flip back.");
  state.lockBoard = true;

  window.clearTimeout(state.flipBackHandle);
  state.flipBackHandle = window.setTimeout(() => {
    state.flippedIds = [];
    state.lockBoard = false;
    updateStatus();
  }, 700);
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
  updateStatus();

  if (state.flippedIds.length === 2) {
    checkForMatch();
  }
}

function startGame(event) {
  if (event) {
    event.preventDefault();
  }

  resetBoard();
  state.started = true;
  hideOverlay();
  setMessage("The round starts now. Match all 8 pairs before the timer ends.");
  startTimer();
}

overlayButton.addEventListener("click", startGame);
gameBoard.addEventListener("click", handleCardClick);

resetBoard();
setMessage("Tap start to begin the round.");
showOverlay("16 cards. 30 seconds. Match all 8 pairs before the timer ends.", "Start Round");
