const socket = io();
let gameState = null;
let playerAssigned = null;
let selectedPiece = null;

// Add sound effects
const moveSound = new Audio("path/to/move-sound.mp3");
const captureSound = new Audio("path/to/capture-sound.mp3");
const gameOverSound = new Audio("path/to/game-over-sound.mp3");

function initializeGame() {
  document.getElementById("player-selection").style.display = "flex";
  document
    .getElementById("select-player-a")
    .addEventListener("click", () => selectPlayer("A"));
  document
    .getElementById("select-player-b")
    .addEventListener("click", () => selectPlayer("B"));
}

function selectPlayer(player) {
  socket.emit("joinGame", player);
  document.getElementById("player-selection").style.display = "none";
}

function renderBoard() {
  const board = document.getElementById("game-board");
  board.innerHTML = "";
  for (let y = 0; y < 5; y++) {
    for (let x = 0; x < 5; x++) {
      const cell = document.createElement("div");
      cell.className = "cell";
      cell.dataset.x = x;
      cell.dataset.y = y;
      const piece = gameState.board[y][x];
      if (piece) {
        const pieceElement = document.createElement("div");
        pieceElement.className = `piece piece-${piece[0]}`;
        pieceElement.textContent = piece.split("-")[1];
        cell.appendChild(pieceElement);
      }
      cell.onclick = () => selectPiece(x, y);
      board.appendChild(cell);
    }
  }
}

function selectPiece(x, y) {
  if (!gameState || gameState.currentPlayer !== playerAssigned) return;
  const piece = gameState.board[y][x];
  if (piece && piece.startsWith(playerAssigned)) {
    selectedPiece = { x, y, type: piece.split("-")[1] };
    document.getElementById(
      "selected-piece"
    ).textContent = `Selected: ${piece}`;
    showMoveOptions(piece.split("-")[1]);
    highlightSelectedCell(x, y);
  }
}

function highlightSelectedCell(x, y) {
  const cells = document.querySelectorAll(".cell");
  cells.forEach((cell) => cell.classList.remove("selected"));
  cells[y * 5 + x].classList.add("selected");
}

function showMoveOptions(pieceType) {
  const moveButtons = document.getElementById("move-buttons");
  moveButtons.innerHTML = "";
  const moves = ["F", "B", "L", "R", "FL", "FR", "BL", "BR"];

  moves.forEach((move) => {
    const button = document.createElement("button");
    button.textContent = move;
    button.onclick = () => makeMove(move);
    moveButtons.appendChild(button);
  });

  // Highlight possible move cells
  highlightPossibleMoves(pieceType);
}

function highlightPossibleMoves(pieceType) {
  const cells = document.querySelectorAll(".cell");
  cells.forEach((cell) => cell.classList.remove("possible-move"));

  const directions = {
    F: [0, -1],
    B: [0, 1],
    L: [-1, 0],
    R: [1, 0],
    FL: [-1, -1],
    FR: [1, -1],
    BL: [-1, 1],
    BR: [1, 1],
  };

  const maxSteps =
    pieceType === "H3" ? 3 : pieceType === "H1" || pieceType === "H2" ? 2 : 1;

  Object.values(directions).forEach(([dx, dy]) => {
    for (let step = 1; step <= maxSteps; step++) {
      const newX = selectedPiece.x + dx * step;
      const newY = selectedPiece.y + dy * step;
      if (newX >= 0 && newX < 5 && newY >= 0 && newY < 5) {
        const cell = document.querySelector(
          `.cell[data-x="${newX}"][data-y="${newY}"]`
        );
        cell.classList.add("possible-move");
      }
    }
  });
}

function makeMove(move) {
  if (selectedPiece) {
    const directions = {
      F: [0, -1],
      B: [0, 1],
      L: [-1, 0],
      R: [1, 0],
      FL: [-1, -1],
      FR: [1, -1],
      BL: [-1, 1],
      BR: [1, 1],
    };
    const [dx, dy] = directions[move];
    const toX = selectedPiece.x + dx;
    const toY = selectedPiece.y + dy;

    socket.emit("move", {
      player: playerAssigned,
      fromX: selectedPiece.x,
      fromY: selectedPiece.y,
      toX: toX,
      toY: toY,
    });
  }
}

function updateStatus() {
  const statusElement = document.getElementById("game-status");
  if (gameState) {
    statusElement.innerHTML = `Current Player: <span class="player-${gameState.currentPlayer}">${gameState.currentPlayer}</span>`;
  } else {
    statusElement.textContent = "Waiting for players...";
  }
}

function updateMoveHistory() {
  const historyList = document.getElementById("history-list");
  historyList.innerHTML = gameState.moveHistory
    .map((move) => `<li>${move}</li>`)
    .join("");
  historyList.scrollTop = historyList.scrollHeight;
}

function animateMove(fromX, fromY, toX, toY) {
  const fromCell = document.querySelector(
    `.cell[data-x="${fromX}"][data-y="${fromY}"]`
  );
  const toCell = document.querySelector(
    `.cell[data-x="${toX}"][data-y="${toY}"]`
  );
  const piece = fromCell.querySelector(".piece");

  if (piece) {
    const clone = piece.cloneNode(true);
    document.body.appendChild(clone);
    const fromRect = fromCell.getBoundingClientRect();
    const toRect = toCell.getBoundingClientRect();

    clone.style.position = "absolute";
    clone.style.left = `${fromRect.left}px`;
    clone.style.top = `${fromRect.top}px`;
    clone.style.transition = "all 0.5s ease-in-out";

    setTimeout(() => {
      clone.style.left = `${toRect.left}px`;
      clone.style.top = `${toRect.top}px`;
    }, 50);

    setTimeout(() => {
      document.body.removeChild(clone);
      renderBoard();
    }, 550);

    if (toCell.querySelector(".piece")) {
      captureSound.play();
    } else {
      moveSound.play();
    }
  }
}

socket.on("playerAssigned", (player) => {
  playerAssigned = player;
  console.log("Assigned as player:", player);
});

socket.on("gameStart", (state) => {
  gameState = state;
  renderBoard();
  updateStatus();
  updateMoveHistory();
});

socket.on("gameUpdate", (state) => {
  const oldState = gameState;
  gameState = state;

  if (oldState) {
    // Find the move
    for (let y = 0; y < 5; y++) {
      for (let x = 0; x < 5; x++) {
        if (oldState.board[y][x] !== state.board[y][x]) {
          if (oldState.board[y][x] && !state.board[y][x]) {
            // This was the 'from' cell
            for (let toY = 0; toY < 5; toY++) {
              for (let toX = 0; toX < 5; toX++) {
                if (state.board[toY][toX] === oldState.board[y][x]) {
                  animateMove(x, y, toX, toY);
                  break;
                }
              }
            }
          }
        }
      }
    }
  } else {
    renderBoard();
  }

  updateStatus();
  updateMoveHistory();
  selectedPiece = null;
  document.getElementById("selected-piece").textContent = "";
  document.getElementById("move-buttons").innerHTML = "";
});

socket.on("invalidMove", () => {
  alert("Invalid move! Try again.");
});

socket.on("gameOver", ({ result }) => {
  let message;
  if (result === "draw") {
    message = "Game Over! It's a draw!";
  } else {
    message = `Game Over! Player ${result} wins!`;
  }

  const modal = document.getElementById("game-over-modal");
  const messageElement = document.getElementById("game-over-message");
  const newGameButton = document.getElementById("new-game-button");

  messageElement.textContent = message;
  modal.style.display = "flex";
  gameOverSound.play();

  newGameButton.onclick = () => {
    modal.style.display = "none";
    gameState = null;
    selectedPiece = null;
    renderBoard();
    updateStatus();
    document.getElementById("player-selection").style.display = "flex";
  };
});

socket.on("gameReset", () => {
  gameState = null;
  selectedPiece = null;
  renderBoard();
  updateStatus();
  document.getElementById("move-history").innerHTML =
    '<h3>Move History</h3><ul id="history-list"></ul>';
  document.getElementById("player-selection").style.display = "flex";
});

// Initialize the game
initializeGame();
