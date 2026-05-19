// ===========================
// POKEMON MEMORY GAME - MAIN JS
// ===========================

class PokemonMemoryGame {
  constructor() {
    // Game state
    this.cards = [];
    this.flippedCards = [];
    this.matchedPairs = 0;
    this.totalPairs = 0;
    this.clicks = 0;
    this.gameActive = false;
    this.gameWon = false;
    this.gameLost = false;
    this.isFlipping = false;
    this.timerInterval = null;
    this.timeLeft = 90;
    this.powerUpUsed = false;
    this.powerUpCooldown = 0;

    this.difficulties = {
      easy: { cards: 6, time: 20 },
      medium: { cards: 12, time: 90 },
      hard: { cards: 16, time: 120 },
    };
    this.currentDifficulty = 'medium';

    this.allPokemon = [];
    this.selectedPokemon = [];

    this.gameGrid = $('#game_grid');
    this.timerDisplay = $('#timer');
    this.clicksDisplay = $('#clicks');
    this.matchedDisplay = $('#matched');
    this.totalPairsDisplay = $('#totalPairs');
    this.pairsLeftDisplay = $('#pairsLeft');
    this.startBtn = $('#startBtn');
    this.resetBtn = $('#resetBtn');
    this.difficultySelect = $('#difficulty');
    this.themeSelect = $('#theme');
    this.powerUpBtn = $('#powerUpBtn');
    this.gameOverModal = $('#gameOverModal');
    this.gameOverTitle = $('#gameOverTitle');
    this.gameOverMessage = $('#gameOverMessage');
    this.modalResetBtn = $('#modalResetBtn');

    this.init();
  }

  init() {
    this.setupEventListeners();
    this.loadTheme();
    this.fetchAllPokemon();
  }

  setupEventListeners() {
    this.startBtn.on('click', () => this.startGame());
    this.resetBtn.on('click', () => this.resetGame());
    this.difficultySelect.on('change', () => this.onDifficultyChange());
    this.themeSelect.on('change', () => this.onThemeChange());
    this.powerUpBtn.on('click', () => this.activatePowerUp());
    this.modalResetBtn.on('click', () => this.startGame());
    $(document).on('click', '.card', (e) => this.onCardClick(e));
  }

  async fetchAllPokemon() {
    try {
      const response = await fetch(
        'https://pokeapi.co/api/v2/pokemon?limit=1500',
      );
      const data = await response.json();
      this.allPokemon = data.results;
      console.log(`Loaded ${this.allPokemon.length} Pokemon from API`);
    } catch (error) {
      console.error('Error fetching Pokemon list:', error);
      this.allPokemon = Array.from({ length: 150 }, (_, i) => ({
        name: `pokemon-${i + 1}`,
        url: `https://pokeapi.co/api/v2/pokemon/${i + 1}/`,
      }));
    }
  }

  getRandomPokemon(count) {
    const shuffled = [...this.allPokemon].sort(() => Math.random() - 0.5);
    return shuffled.slice(0, count);
  }

  async getPokemonImageUrl(pokemonUrl) {
    try {
      const response = await fetch(pokemonUrl);
      const data = await response.json();

      if (data.sprites?.other?.['official-artwork']?.front_default) {
        return data.sprites.other['official-artwork'].front_default;
      }
      if (data.sprites?.front_default) {
        return data.sprites.front_default;
      }
      return null;
    } catch (error) {
      console.error('Error fetching Pokemon details:', error);
      return null;
    }
  }

  async startGame() {
    this.gameOverModal.addClass('hidden');
    this.resetGameState();
    this.currentDifficulty = this.difficultySelect.val();
    const settings = this.difficulties[this.currentDifficulty];

    this.totalPairs = settings.cards / 2;
    this.timeLeft = settings.time;
    this.gameActive = true;

    this.startBtn.prop('disabled', true);
    this.difficultySelect.prop('disabled', true);
    this.powerUpBtn.prop('disabled', false);

    this.updateStatusDisplay();

    const pokemonToUse = this.getRandomPokemon(this.totalPairs);
    this.selectedPokemon = [];

    for (const pokemon of pokemonToUse) {
      const imageUrl = await this.getPokemonImageUrl(pokemon.url);
      if (imageUrl) {
        this.selectedPokemon.push({
          name: pokemon.name,
          image: imageUrl,
          id: pokemon.url
            .split('/')
            .filter((x) => x)
            .pop(),
        });
      }
    }

    if (this.selectedPokemon.length < this.totalPairs) {
      console.warn('Not enough Pokemon with images, retrying...');
      return this.startGame();
    }

    this.createCards();
    this.startTimer();
  }

  createCards() {
    this.gameGrid.empty();
    this.cards = [];

    const cardData = [];
    this.selectedPokemon.forEach((pokemon, index) => {
      cardData.push({ ...pokemon, pairId: index });
      cardData.push({ ...pokemon, pairId: index });
    });

    cardData.sort(() => Math.random() - 0.5);

    cardData.forEach((data, index) => {
      const cardElement = $(`
        <div class="card" data-index="${index}" data-pair-id="${data.pairId}">
          <div class="card-inner">
            <div class="card-face back"></div>
            <div class="card-face front">
              <img class="card-image" src="${data.image}" alt="${data.name}">
            </div>
          </div>
        </div>
      `);

      this.gameGrid.append(cardElement);
      this.cards.push({
        element: cardElement,
        pairId: data.pairId,
        index: index,
        matched: false,
      });
    });

    const totalCards = this.cards.length;
    const gridSize = Math.ceil(Math.sqrt(totalCards));

    this.gameGrid.css({
      'grid-template-columns': `repeat(${gridSize}, 1fr)`,
      'grid-template-rows': `repeat(${gridSize}, 1fr)`,
    });
  }

  resetGameState() {
    this.flippedCards = [];
    this.matchedPairs = 0;
    this.clicks = 0;
    this.gameActive = false;
    this.gameWon = false;
    this.gameLost = false;
    this.isFlipping = false;
    this.powerUpUsed = false;
    this.timeLeft = this.difficulties[this.currentDifficulty].time;

    clearInterval(this.timerInterval);
    this.startBtn.prop('disabled', false);
    this.difficultySelect.prop('disabled', false);
    this.powerUpBtn.prop('disabled', true);
    this.powerUpBtn.removeClass('used');

    this.gameGrid.empty();
    this.updateStatusDisplay();
  }

  resetGame() {
    this.resetGameState();
    this.gameOverModal.addClass('hidden');
  }

  onCardClick(e) {
    if (!this.gameActive || this.gameWon || this.gameLost) return;

    const card = $(e.currentTarget);
    const index = card.data('index');
    const pairId = card.data('pair-id');

    if (card.hasClass('flipped') || card.hasClass('matched')) {
      return;
    }

    if (this.flippedCards.length >= 2) {
      return;
    }

    if (card.hasClass('flipping')) {
      return;
    }

    card.addClass('flipped');
    this.flippedCards.push({ card, pairId, index });
    this.clicks++;
    this.updateStatusDisplay();

    if (this.flippedCards.length === 2) {
      this.checkMatch();
    }
  }

  checkMatch() {
    const card1 = this.flippedCards[0];
    const card2 = this.flippedCards[1];

    const isMatch = card1.pairId === card2.pairId;

    if (isMatch) {
      this.handleMatch();
    } else {
      this.handleNoMatch();
    }
  }

  handleMatch() {
    const card1 = this.flippedCards[0].card;
    const card2 = this.flippedCards[1].card;

    card1.addClass('matched');
    card2.addClass('matched');

    card1.addClass('flipping');
    card2.addClass('flipping');

    setTimeout(() => {
      this.flippedCards = [];
      this.matchedPairs++;
      this.updateStatusDisplay();

      card1.removeClass('flipping');
      card2.removeClass('flipping');

      if (this.matchedPairs === this.totalPairs) {
        this.winGame();
      }
    }, 50);
  }

  handleNoMatch() {
    const card1 = this.flippedCards[0].card;
    const card2 = this.flippedCards[1].card;

    setTimeout(() => {
      card1.removeClass('flipped');
      card2.removeClass('flipped');
      this.flippedCards = [];
    }, 1000);
  }

  startTimer() {
    clearInterval(this.timerInterval);
    this.timerInterval = setInterval(() => {
      this.timeLeft--;
      this.updateStatusDisplay();

      if (this.timeLeft <= 10) {
        this.timerDisplay.addClass('danger');
      } else {
        this.timerDisplay.removeClass('danger');
      }

      if (this.timeLeft <= 0) {
        this.loseGame();
      }
    }, 1000);
  }

  winGame() {
    this.gameActive = false;
    this.gameWon = true;
    clearInterval(this.timerInterval);

    $('.card').addClass('matched');

    setTimeout(() => {
      this.showGameOverModal(true);
    }, 500);
  }

  loseGame() {
    this.gameActive = false;
    this.gameLost = true;
    clearInterval(this.timerInterval);

    $('.card:not(.matched)').removeClass('flipped');

    setTimeout(() => {
      this.showGameOverModal(false);
    }, 500);
  }

  showGameOverModal(isWin) {
    if (isWin) {
      this.gameOverTitle.text('🎉 You Won! 🎉');
      this.gameOverMessage.text(
        `Congratulations! You matched all ${this.totalPairs} pairs in ${this.clicks} clicks!`,
      );
    } else {
      this.gameOverTitle.text('⏰ Game Over! ⏰');
      this.gameOverMessage.text(
        `You matched ${this.matchedPairs} out of ${this.totalPairs} pairs. Keep trying!`,
      );
    }
    this.gameOverModal.removeClass('hidden');
  }

  activatePowerUp() {
    if (!this.gameActive || this.powerUpUsed || this.powerUpCooldown > 0) {
      return;
    }

    this.powerUpUsed = true;
    this.powerUpBtn.prop('disabled', true).addClass('used');

    $('.card:not(.matched)').addClass('flipped');

    setTimeout(() => {
      $('.card:not(.matched)').removeClass('flipped');
    }, 3000);
  }

  // ===========================
  // UI UPDATES
  // ===========================

  updateStatusDisplay() {
    this.timerDisplay.text(this.timeLeft);
    this.clicksDisplay.text(this.clicks);
    this.matchedDisplay.text(this.matchedPairs);
    this.totalPairsDisplay.text(this.totalPairs);
    this.pairsLeftDisplay.text(
      Math.max(0, this.totalPairs - this.matchedPairs),
    );
  }

  onDifficultyChange() {
    if (!this.gameActive && !this.gameWon && !this.gameLost) {
      this.resetGame();
    }
  }

  onThemeChange() {
    const theme = this.themeSelect.val();
    this.setTheme(theme);
  }

  setTheme(theme) {
    $('body').removeClass('light-theme dark-theme');
    if (theme === 'dark') {
      $('body').addClass('dark-theme');
      localStorage.setItem('theme', 'dark');
    } else {
      $('body').addClass('light-theme');
      localStorage.setItem('theme', 'light');
    }
  }

  loadTheme() {
    const savedTheme = localStorage.getItem('theme') || 'light';
    this.themeSelect.val(savedTheme);
    this.setTheme(savedTheme);
  }
}

$(document).ready(function () {
  window.game = new PokemonMemoryGame();
  console.log('Pokemon Memory Game initialized!');
});
