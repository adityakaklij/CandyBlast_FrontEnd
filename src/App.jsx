import { useState, useEffect, useRef, useCallback } from 'react'
import './App.css'
import { ConnectButton, useCurrentAccount, useSuiClientQuery, useSignAndExecuteTransaction } from '@mysten/dapp-kit'
import confetti from 'canvas-confetti'
import { SuiClient } from '@mysten/sui/client'
import { Transaction } from "@mysten/sui/transactions";

const ROWS = 5;
const COLS = 6;
const INITIAL_BALANCE = 1000;
const BET_AMOUNT = 20;

const symbols = [
  { emoji: "🍭", name: "Lollipop", colorClass: "candy-0" },
  { emoji: "🍉", name: "Watermelon", colorClass: "candy-1" },
  { emoji: "🍇", name: "Grapes", colorClass: "candy-2" },
  { emoji: "🍓", name: "Strawberry", colorClass: "candy-3" },
  { emoji: "🍬", name: "Candy", colorClass: "candy-4" },
  { emoji: "⭐", name: "Star", colorClass: "candy-5" }
];

const payTable = [
  { minCount: 12, multiplier: 10 },
  { minCount: 10, multiplier: 5 },
  { minCount: 8, multiplier: 2 }
];

function App() {
  const currentAccount = useCurrentAccount();
  const suiClient = new SuiClient({ url: "https://rpc-testnet.onelabs.cc:443" });

  const account = useCurrentAccount();  

  const { ownedObjects, isLoading } = useSuiClientQuery(
    'getOwnedObjects',
    account ? { owner: account.address } : undefined,
    { enabled: !!account } // optional: only run when account exists
  );

  const { data, isLoading2 } = useSuiClientQuery(
    'getAllCoins',
    account ? { owner: account.address } : undefined,
    { enabled: !!account } // optional: only run when account exists
  );


  const { mutate: signAndExecute, isPending, isSuccess, reset } = useSignAndExecuteTransaction();
  
  // Load balance from localStorage or start with 0
  const [balance, setBalance] = useState(() => {
    const saved = localStorage.getItem('gameBalance');
    return saved ? parseInt(saved, 10) : 0;
  });
  const [lastWin, setLastWin] = useState(0);
  const [spinning, setSpinning] = useState(false);
  const [message, setMessage] = useState('');
  const [messageVisible, setMessageVisible] = useState(false);
  const [messageBigWin, setMessageBigWin] = useState(false);
  const [grid, setGrid] = useState([]);
  const [winCells, setWinCells] = useState(new Set());
  const [animateIn, setAnimateIn] = useState(false);
  const [shineButton, setShineButton] = useState(false);
  const [musicEnabled, setMusicEnabled] = useState(true);
  const [lastWinHighlight, setLastWinHighlight] = useState(false);
  const [currentMultiplier, setCurrentMultiplier] = useState(0);
  const [showMultiplier, setShowMultiplier] = useState(false);
  const [reelSpinning, setReelSpinning] = useState(Array(COLS).fill(false));
  const [octBalance, setOctBalance] = useState(null);
  const [showRewardPopup, setShowRewardPopup] = useState(false);
  const [rewardClaimed, setRewardClaimed] = useState(() => {
    return localStorage.getItem('rewardClaimed') === 'true';
  });

  const audioCtxRef = useRef(null);
  const welcomeMusicArmedRef = useRef(true);
  const messageTimeoutRef = useRef(null);

  // Save balance to localStorage whenever it changes
  useEffect(() => {
    localStorage.setItem('gameBalance', balance.toString());
  }, [balance]);

  // Check for reward eligibility and show popup when wallet is connected
  useEffect(() => {
    if (balance >= 1500 && !rewardClaimed && currentAccount && !showRewardPopup) {
      // Wallet connected and eligible - show reward popup
      setShowRewardPopup(true);
    }
  }, [balance, rewardClaimed, showRewardPopup, currentAccount]);


  // Fetch OCT balance from getAllCoins
  useEffect(() => {
    if (data?.data) {
      const targetType = "0x2::oct::OCT";
      const octCoins = data.data.filter((coin) => coin.coinType === targetType);
      
      if (octCoins.length > 0) {
        const totalOct = octCoins.reduce((sum, coin) => {
          return sum + parseInt(coin.balance || 0);
        }, 0);
        setOctBalance(totalOct);
      } else {
        setOctBalance(0);
      }
    } else if (currentAccount) {
      // If wallet connected but no data yet, set to 0
      setOctBalance(0);
    }
  }, [data, currentAccount]);

  // Initialize audio context
  const ensureAudioContext = useCallback(() => {
    if (!audioCtxRef.current) {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (!AudioContext) return;
      audioCtxRef.current = new AudioContext();
    }
  }, []);

  // Audio functions
  const playChord = useCallback((baseFreq = 220) => {
    if (!audioCtxRef.current || !musicEnabled) return;
    const now = audioCtxRef.current.currentTime;
    const intervals = [0, 4, 7]; // major triad

    intervals.forEach((interval, i) => {
      const osc = audioCtxRef.current.createOscillator();
      const gain = audioCtxRef.current.createGain();
      osc.type = "sine";
      osc.frequency.value = baseFreq * Math.pow(2, interval / 12);

      gain.gain.setValueAtTime(0.0001, now + i * 0.02);
      gain.gain.linearRampToValueAtTime(0.05, now + 0.08 + i * 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.8 + i * 0.02);

      osc.connect(gain);
      gain.connect(audioCtxRef.current.destination);
      osc.start(now + i * 0.02);
      osc.stop(now + 0.9 + i * 0.02);
    });
  }, [musicEnabled]);

  const playClick = useCallback(() => {
    if (!audioCtxRef.current) return;
    const now = audioCtxRef.current.currentTime;
    const osc = audioCtxRef.current.createOscillator();
    const gain = audioCtxRef.current.createGain();
    osc.type = "square";
    osc.frequency.setValueAtTime(600, now);
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.linearRampToValueAtTime(0.08, now + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.15);
    osc.connect(gain);
    gain.connect(audioCtxRef.current.destination);
    osc.start(now);
    osc.stop(now + 0.18);
  }, []);

  const playWinJingle = useCallback((multiplier) => {
    if (!audioCtxRef.current || !musicEnabled) return;
    const now = audioCtxRef.current.currentTime;
    const notes = [523, 659, 784]; // C5, E5, G5
    const gainLevel = multiplier >= 10 ? 0.16 : multiplier >= 5 ? 0.11 : 0.08;

    notes.forEach((freq, i) => {
      const osc = audioCtxRef.current.createOscillator();
      const gain = audioCtxRef.current.createGain();
      osc.type = "triangle";
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.0001, now + i * 0.09);
      gain.gain.linearRampToValueAtTime(gainLevel, now + 0.03 + i * 0.09);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.28 + i * 0.09);

      osc.connect(gain);
      gain.connect(audioCtxRef.current.destination);
      osc.start(now + i * 0.09);
      osc.stop(now + 0.4 + i * 0.09);
    });
  }, [musicEnabled]);

  // Initialize grid
  useEffect(() => {
    const initialGrid = [];
    for (let i = 0; i < ROWS * COLS; i++) {
      const randomIndex = Math.floor(Math.random() * symbols.length);
      initialGrid.push({
        id: i,
        symbolIndex: randomIndex,
        row: Math.floor(i / COLS),
        col: i % COLS
      });
    }
    setGrid(initialGrid);
  }, []);

  // Welcome music on first click
  useEffect(() => {
    const handleFirstClick = () => {
      if (!welcomeMusicArmedRef.current) return;
      welcomeMusicArmedRef.current = false;
      ensureAudioContext();
      if (audioCtxRef.current && audioCtxRef.current.state === "suspended") {
        audioCtxRef.current.resume();
      }
      setTimeout(() => playChord(196), 150);
    };

    document.addEventListener("click", handleFirstClick, { once: true });
    return () => document.removeEventListener("click", handleFirstClick);
  }, [ensureAudioContext, playChord]);

  const showMessage = useCallback((text, isBigWin = false) => {
    setMessage(text);
    setMessageVisible(true);
    setMessageBigWin(isBigWin);

    if (messageTimeoutRef.current) {
      clearTimeout(messageTimeoutRef.current);
    }

    if (!isBigWin) {
      messageTimeoutRef.current = setTimeout(() => {
        setMessageVisible(false);
      }, 1800);
    }
  }, []);

  // Show message when user reaches 1500 without wallet
  useEffect(() => {
    if (balance >= 1500 && !rewardClaimed && !currentAccount && !showRewardPopup) {
      showMessage("🎉 You reached 1500 points! Connect your wallet to claim your NFT reward!", true);
    }
  }, [balance, rewardClaimed, currentAccount, showRewardPopup, showMessage]);

  const randomSymbolIndex = () => Math.floor(Math.random() * symbols.length);

  const getHighestPay = (count) => {
    for (const rule of payTable) {
      if (count >= rule.minCount) return rule.multiplier;
    }
    return 0;
  };

  // Confetti effects
  const fireConfetti = useCallback((multiplier) => {
    const duration = multiplier >= 10 ? 3000 : multiplier >= 5 ? 2000 : 1500;
    const particleCount = multiplier >= 10 ? 200 : multiplier >= 5 ? 100 : 50;
    
    if (multiplier >= 10) {
      // Epic win - multiple bursts
      const end = Date.now() + duration;
      const colors = ['#FFD700', '#FF69B4', '#00CED1', '#FF6347', '#32CD32'];
      
      (function frame() {
        confetti({
          particleCount: 7,
          angle: 60,
          spread: 55,
          origin: { x: 0 },
          colors: colors
        });
        confetti({
          particleCount: 7,
          angle: 120,
          spread: 55,
          origin: { x: 1 },
          colors: colors
        });

        if (Date.now() < end) {
          requestAnimationFrame(frame);
        }
      }());
    } else if (multiplier >= 5) {
      // Big win - fireworks
      confetti({
        particleCount: particleCount,
        spread: 100,
        origin: { y: 0.6 },
        colors: ['#FFD700', '#FF69B4', '#00CED1']
      });
      setTimeout(() => {
        confetti({
          particleCount: 50,
          angle: 60,
          spread: 55,
          origin: { x: 0 },
        });
        confetti({
          particleCount: 50,
          angle: 120,
          spread: 55,
          origin: { x: 1 },
        });
      }, 200);
    } else {
      // Small win - simple burst
      confetti({
        particleCount: particleCount,
        spread: 70,
        origin: { y: 0.6 }
      });
    }
  }, []);

  const evaluateWin = useCallback((chosenSymbols, counts) => {
    let totalMultiplier = 0;
    let bestMultiplier = 0;
    let bestSymbolIndex = -1;

    counts.forEach((count, idx) => {
      const mult = getHighestPay(count);
      if (mult > 0) {
        totalMultiplier += mult;
        if (mult > bestMultiplier) {
          bestMultiplier = mult;
          bestSymbolIndex = idx;
        }
      }
    });

    let winAmount = 0;
    if (totalMultiplier > 0) {
      winAmount = BET_AMOUNT * totalMultiplier;
      
      // Show multiplier animation
      setCurrentMultiplier(totalMultiplier);
      setShowMultiplier(true);
      setTimeout(() => setShowMultiplier(false), 3000);
      
      // Update balance and wins
      setBalance(prev => prev + winAmount);
      setLastWin(winAmount);
      setLastWinHighlight(true);
      setTimeout(() => setLastWinHighlight(false), 1500);

      // Highlight winning symbols
      const winningCells = new Set();
      chosenSymbols.forEach((symbolIndex, index) => {
        if (getHighestPay(counts[symbolIndex]) > 0) {
          winningCells.add(index);
        }
      });
      setWinCells(winningCells);

      // Fire confetti based on win size
      setTimeout(() => fireConfetti(totalMultiplier), 300);

      const isBig = bestMultiplier >= 10 || winAmount >= BET_AMOUNT * 8;
      const msg = isBig
        ? `🎰 MEGA WIN! +${winAmount} coins!`
        : `🎉 WIN! +${winAmount} coins!`;
      showMessage(msg, isBig);
      playWinJingle(bestMultiplier);
    } else {
      setLastWin(0);
      setCurrentMultiplier(0);
      setMessageBigWin(false);
      showMessage("❌ NO WIN - Better luck next time!");
      
      // Visual feedback for loss
      setTimeout(() => {
        if (audioCtxRef.current && musicEnabled) {
          const osc = audioCtxRef.current.createOscillator();
          const gain = audioCtxRef.current.createGain();
          osc.type = "sawtooth";
          osc.frequency.value = 100;
          gain.gain.setValueAtTime(0.05, audioCtxRef.current.currentTime);
          gain.gain.exponentialRampToValueAtTime(0.01, audioCtxRef.current.currentTime + 0.3);
          osc.connect(gain);
          gain.connect(audioCtxRef.current.destination);
          osc.start();
          osc.stop(audioCtxRef.current.currentTime + 0.3);
        }
      }, 200);
    }

    setSpinning(false);
    setReelSpinning(Array(COLS).fill(false));
    setTimeout(() => setShineButton(false), 600);
  }, [playWinJingle, showMessage, fireConfetti, musicEnabled]);

  const spin = useCallback(() => {
    if (spinning) return;
    if (balance < BET_AMOUNT) {
      showMessage("💰 Insufficient balance! Add more coins to play.");
      return;
    }

    setSpinning(true);
    setShineButton(true);
    setShowMultiplier(false);
    playClick();
    ensureAudioContext();
    
    if (audioCtxRef.current && audioCtxRef.current.state === "suspended") {
      audioCtxRef.current.resume();
    }
    playChord(246);

    setWinCells(new Set());
    setMessageVisible(false);
    setMessageBigWin(false);

    // Deduct bet
    setBalance(prev => prev - BET_AMOUNT);

    // Start reel spinning animation - staggered arcade style
    setAnimateIn(false);
    
    // Spin each column with a stagger
    for (let col = 0; col < COLS; col++) {
      setTimeout(() => {
        setReelSpinning(prev => {
          const newSpinning = [...prev];
          newSpinning[col] = true;
          return newSpinning;
        });
      }, col * 100); // Stagger start by 100ms per column
    }

    // Generate final results
    const chosenSymbols = [];
    const counts = new Array(symbols.length).fill(0);
    const newGrid = [];

    for (let i = 0; i < ROWS * COLS; i++) {
      const idx = randomSymbolIndex();
      chosenSymbols.push(idx);
      counts[idx]++;
      newGrid.push({
        id: i,
        symbolIndex: idx,
        row: Math.floor(i / COLS),
        col: i % COLS
      });
    }

    // Stop reels with staggered timing (arcade style)
    const baseDelay = 800; // Base spinning duration
    
    for (let col = 0; col < COLS; col++) {
      const stopDelay = baseDelay + (col * 150); // Each column stops 150ms after the previous
      
      setTimeout(() => {
        // Play click sound when each reel stops
        playClick();
        
        // Update grid for this column
        setGrid(prevGrid => {
          const updatedGrid = [...prevGrid];
          for (let row = 0; row < ROWS; row++) {
            const cellIndex = row * COLS + col;
            updatedGrid[cellIndex] = newGrid[cellIndex];
          }
          return updatedGrid;
        });

        setReelSpinning(prev => {
          const newSpinning = [...prev];
          newSpinning[col] = false;
          return newSpinning;
        });
        
        // If last column, trigger animation and evaluation
        if (col === COLS - 1) {
          setTimeout(() => {
            setAnimateIn(true);
            setTimeout(() => {
              evaluateWin(chosenSymbols, counts);
            }, 200);
          }, 100);
        }
      }, stopDelay);
    }
  }, [spinning, balance, playClick, playChord, ensureAudioContext, evaluateWin, showMessage]);

  const toggleMusic = () => {
    const newMusicEnabled = !musicEnabled;
    setMusicEnabled(newMusicEnabled);
    
    if (!newMusicEnabled && audioCtxRef.current) {
      audioCtxRef.current.suspend && audioCtxRef.current.suspend();
    } else if (newMusicEnabled && audioCtxRef.current) {
      audioCtxRef.current.resume && audioCtxRef.current.resume();
    }
  };

  const splitOctCoin = async () => {
    if (!account) {
      console.log("No account connected");
      return;
    }

    const mistAmount = 1_00_000_000; // 0.1 OCT

    const tx = new Transaction();
    tx.setSender(account.address);
    tx.setGasPrice(1_000);
    tx.setGasBudget(10_000_000);

    const [coin] = tx.splitCoins(tx.gas, [mistAmount]);
    tx.transferObjects([coin], account.address);

    signAndExecute({
      transaction: tx
    }, {
      onError: (e) => {
        console.log("Tx Failed! from here");
        console.log(e);
      },
      onSuccess: async ({ digest }) => {
        let p = await suiClient.waitForTransaction({
          digest,
          options: {
            showEffects: true
          }
        });
        reset();
        console.log("Tx Succesful!");
      }
    });
  };


  const mintNFT = () => {
    if (!account) {
      showMessage("❌ Please connect your wallet first!");
      return;
    }
    
    console.log("Minting NFT Reward");
    
    const tx = new Transaction();
    const packageId = "0x5290ad595be940a32744c8005ec0150caccad082038271b1d5394fce5fac6962";
    const NFT_URL = "https://purple-sheer-shrimp-152.mypinata.cloud/ipfs/bafybeics5bzpxw2soairtacjxdblusbtvtj7ia4nnjaywbfxf76ia63jaq"
    
    tx.moveCall({
      package: packageId,
      module: "sweetbonanza",
      function: "mint_nft",
      arguments: [
        tx.pure.string(NFT_URL),
        tx.pure.u256(13)
      ],
    });

    console.log("Processing NFT Mint Transaction");
    signAndExecute({
      transaction: tx
    }, {
      onError: (e) => {
        console.log("NFT Mint Failed:", e);
        showMessage("❌ NFT minting failed. Please try again.");
      },
      onSuccess: async ({ digest }) => {
        let p = await suiClient.waitForTransaction({
          digest,
          options: {
            showEffects: true
          }
        });
        console.log("NFT Mint Result:", p);
        console.log("tx digest:", digest);

        // Close popup and celebrate
        closeRewardPopup();
        showMessage("🎉 NFT Successfully Minted to your wallet!", true);

        reset();
        console.log("NFT Mint Successful!");
      }
    });
  }

  const getPointsInternal = async () => {
    if (!account || !data?.data) {
      console.log("No account or data available");
      showMessage("❌ Please connect your wallet first!");
      return;
    }

    const targetType = "0x2::oct::OCT";
    const coins = data.data.filter((item) => item.coinType === targetType); 
    const coinIds = coins.map((item) => item.coinObjectId);
    console.log("coinIds:", coinIds);
    
    if (coinIds.length === 0) {
      console.log("No OCT coins found");
      showMessage("❌ No OCT tokens found in your wallet!");
      return;
    }
    
    if(coinIds.length === 1) {
      console.log("Required OCT split");
      await splitOctCoin();
      // After split, we need to refetch coins
      showMessage("⏳ Please wait and try again after split...");
      return;
    }
    
    const octCoinId = coinIds[0];
    
    if (!octCoinId || typeof octCoinId !== 'string') {
      console.log("Invalid OCT coin");
      return;
    }

    console.log("Processing get points with coin:", octCoinId);
    getPoints(octCoinId);
  }

 
  const getPoints = (octCoinId) => {
    console.log("Get 1000 points for 0.1 OCT");
    
    const tx = new Transaction();
    const packageId = "0x5290ad595be940a32744c8005ec0150caccad082038271b1d5394fce5fac6962"; //  Contract Address
    
    tx.moveCall({
      package: packageId,
      module: "sweetbonanza",
      function: "get_points",
      arguments: [
        tx.object(octCoinId),
        tx.sharedObjectRef({
            objectId: "0xf4f8cac2cd65a4cde114a359c73b3c47fd8cdb9272a4e777b472a5a5f7ec0553",
            mutable:true,
            initialSharedVersion: 193941324,
        }),
    ],
    });

    console.log("Processing Transaction");
    signAndExecute({
      transaction: tx
    }, {
      onError: (e) => {
        console.log("Tx Failed! from here");
        console.log(e);
        showMessage("❌ Transaction failed. Please try again.");
      },
      onSuccess: async ({ digest }) => {
        let p = await suiClient.waitForTransaction({
          digest,
          options: {
            showEffects: true
          }
        });
        console.log("Transaction Result:", p);
        console.log("tx digest:", digest);

        // Add 1000 points to balance after successful transaction
        setBalance(prev => prev + 1000);
        showMessage("✅ Success! +1000 points added to your balance!", false);

        reset();
        console.log("Tx Successful! Added 1000 points");
      }
    });
  }
  const claimReward = async () => {
    // Don't close popup, just trigger NFT mint
    await mintNFT();
  };

  const closeRewardPopup = () => {
    setShowRewardPopup(false);
    setRewardClaimed(true);
    localStorage.setItem('rewardClaimed', 'true');
    
    // Epic celebration
    const duration = 5000;
    const end = Date.now() + duration;
    const colors = ['#FFD700', '#FF69B4', '#00CED1', '#FF6347', '#32CD32', '#9370DB'];
    
    (function frame() {
      confetti({
        particleCount: 5,
        angle: 60,
        spread: 55,
        origin: { x: 0 },
        colors: colors
      });
      confetti({
        particleCount: 5,
        angle: 120,
        spread: 55,
        origin: { x: 1 },
        colors: colors
      });
      
      if (Math.random() > 0.8) {
        confetti({
          particleCount: 3,
          spread: 360,
          startVelocity: 30,
          origin: { y: Math.random() - 0.2 }
        });
      }

      if (Date.now() < end) {
        requestAnimationFrame(frame);
      }
    }());
  };

  return (
    <>
      {/* Navbar */}
      <nav className="navbar">
        <div className="navbar-content">
          <div className="navbar-brand">
            <h1 className="navbar-title">Candy Blast <span>Mini</span></h1>
          </div>
          
          <div className="navbar-right">
            {currentAccount && octBalance !== null && (
              <div className="navbar-oct-balance">
                {/* <span className="oct-icon">💎</span> */}
                <span className="oct-amount">{(octBalance/1000000000).toFixed(2)}</span>
                <span className="oct-label">OCT</span>
              </div>
            )}
            <div className="navbar-wallet">
              <ConnectButton />
            </div>
            <button className="navbar-points-btn" onClick={getPointsInternal}>
              💎 Get Points
            </button>
          </div>
        </div>
      </nav>

      <div className="game-wrapper">
        <header>
          <div className="badge">
            <span className="badge-dot"></span>
            Candy Spin • Fun Play
          </div>
        </header>

      {/* NFT Reward Popup */}
      {showRewardPopup && (
        <div className="reward-overlay">
          <div className="reward-popup">
            <div className="reward-close" onClick={() => setShowRewardPopup(false)}>✕</div>
            <div className="reward-header">
              <div className="reward-icon">🎉</div>
              <h2>CONGRATULATIONS!</h2>
            </div>
            <div className="reward-content">
              <div className="reward-trophy">🏆</div>
              <p className="reward-text">You've reached <span className="highlight">1500 points!</span></p>
              <p className="reward-subtitle">You've earned a special NFT reward!</p>
              <div className="reward-nft-preview">
                <div className="nft-card">
                  <div className="nft-shine"></div>
                  <div className="nft-emoji">🎰</div>
                  <div className="nft-name">Lucky Winner NFT</div>
                </div>
              </div>
            </div>
            
            {currentAccount ? (
              <>
                <button className="reward-claim-btn" onClick={claimReward} disabled={isPending}>
                  {isPending ? '⏳ Minting...' : '🎁 CLAIM YOUR NFT'}
                </button>
                <p className="reward-note">This NFT will be minted to your connected wallet</p>
              </>
            ) : (
              <>
                <div className="reward-wallet-warning">
                  <p className="warning-icon">⚠️</p>
                  <p className="warning-text">Please connect your wallet first to claim your NFT reward!</p>
                </div>
                <div className="reward-connect-wallet">
                  <ConnectButton />
                </div>
                <p className="reward-note">Once connected, you can claim your NFT</p>
              </>
            )}
          </div>
        </div>
      )}

      <div className="hud">
        <div className="hud-group">
          <div className="hud-item">
            <span className="hud-label">Balance</span>
            <span className="hud-value">{balance}</span>
          </div>
          <div className="hud-item">
            <span className="hud-label">Bet</span>
            <span className="hud-value">{BET_AMOUNT}</span>
          </div>
          <div className="hud-item">
            <span className="hud-label">Last Win</span>
            <span className={`hud-value ${lastWinHighlight ? 'win' : ''}`}>{lastWin}</span>
          </div>
        </div>
        <div className="hud-item">
          <span className="hud-label">Combo Pays</span>
          <span className="hud-value">8+ of a kind</span>
        </div>
      </div>

      <div className="grid-wrapper">
        <div className="grid" style={{ position: 'relative' }}>
          {grid.map((cell) => {
            const symbol = symbols[cell.symbolIndex];
            const isReelSpinning = reelSpinning[cell.col];
            return (
              <div
                key={cell.id}
                className={`cell ${symbol.colorClass} ${animateIn && !isReelSpinning ? 'pop-in' : ''} ${winCells.has(cell.id) ? 'win' : ''} ${isReelSpinning ? 'spinning' : ''}`}
                style={{
                  animationDelay: isReelSpinning ? '0s' : `${cell.row * 0.05}s`
                }}
              >
                {symbol.emoji}
              </div>
            );
          })}
          
          {/* Multiplier Display */}
          {showMultiplier && (
            <div className="multiplier-display">
              <div className="multiplier-value">x{currentMultiplier}</div>
              <div className="multiplier-label">MULTIPLIER</div>
            </div>
          )}
        </div>

        <div className="sidebar">
          <button
            className={`btn ${shineButton ? 'shine' : ''} ${spinning ? 'spinning-btn' : ''}`}
            onClick={spin}
            disabled={spinning}
          >
            {spinning ? '🎰 SPINNING...' : '🎰 SPIN'}
          </button>
          <button className="btn btn-secondary" onClick={toggleMusic}>
            {musicEnabled ? '🔊 Music: On' : '🔈 Music: Off'}
          </button>
        </div>
      </div>

      <div className={`message ${messageVisible ? 'visible' : ''} ${messageBigWin ? 'big-win' : ''}`}>
        {message}
      </div>
      <div className="footer-note">
        <span>Just for fun • No real money • Candy Blast Mini</span>
      </div>
    </div>

    {/* How to Play Section */}
    <div className="how-to-play">
      <h2 className="how-to-play-title">🎮 How to Play</h2>
      
      <div className="game-rules">
        <div className="rule-card">
          <div className="rule-icon">🎰</div>
          <h3>Game Basics</h3>
          <p>This candy-themed slot uses a <strong>6x5 grid</strong> with no set paylines. Click <strong>SPIN</strong> to start each round. Each spin costs <strong>20 coins</strong>.</p>
        </div>

        <div className="rule-card">
          <div className="rule-icon">🏆</div>
          <h3>How to Win</h3>
          <p>Match <strong>8 or more</strong> identical symbols anywhere on the reels to win! The more symbols you match, the bigger your multiplier.</p>
        </div>

        <div className="rule-card">
          <div className="rule-icon">💰</div>
          <h3>Payout Multipliers</h3>
          <div className="payout-table">
            <div className="payout-row">
              <span className="match-count">8+ symbols</span>
              <span className="multiplier">×2</span>
            </div>
            <div className="payout-row">
              <span className="match-count">10+ symbols</span>
              <span className="multiplier">×5</span>
            </div>
            <div className="payout-row highlight">
              <span className="match-count">12+ symbols</span>
              <span className="multiplier">×10</span>
            </div>
          </div>
        </div>

        <div className="rule-card">
          <div className="rule-icon">🎁</div>
          <h3>Special Reward</h3>
          <p>Reach <strong>1500 points</strong> to unlock a special <strong>NFT reward</strong>! Your progress is automatically saved.</p>
        </div>
      </div>

      <div className="symbols-section">
        <h3 className="symbols-title">🍬 Game Symbols</h3>
        <div className="symbols-grid">
          <div className="symbol-item">
            <span className="symbol-emoji">🍭</span>
            <span className="symbol-name">Lollipop</span>
          </div>
          <div className="symbol-item">
            <span className="symbol-emoji">🍉</span>
            <span className="symbol-name">Watermelon</span>
          </div>
          <div className="symbol-item">
            <span className="symbol-emoji">🍇</span>
            <span className="symbol-name">Grapes</span>
          </div>
          <div className="symbol-item">
            <span className="symbol-emoji">🍓</span>
            <span className="symbol-name">Strawberry</span>
          </div>
          <div className="symbol-item">
            <span className="symbol-emoji">🍬</span>
            <span className="symbol-name">Candy</span>
          </div>
          <div className="symbol-item">
            <span className="symbol-emoji">⭐</span>
            <span className="symbol-name">Star</span>
          </div>
        </div>
      </div>

      <div className="tips-section">
        <h3>💡 Quick Tips</h3>
        <ul className="tips-list">
          <li>Connect your wallet to see your OCT balance</li>
          <li>Your game progress is saved automatically</li>
          <li>Multiple symbol types can win in the same spin</li>
          <li>Toggle music on/off with the music button</li>
        </ul>
      </div>
    </div>
    </>
  );
}

export default App;

