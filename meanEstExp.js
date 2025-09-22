(async function () {
  // --- DOM & canvas setup ---
  const canvas = document.getElementById('expCanvas');
  const ctx = canvas.getContext('2d');
  let instruction = document.getElementById('instruction');
  if (!instruction) {
    instruction = document.createElement('div');
    instruction.id = 'instruction';
    instruction.className = 'overlay';
    instruction.textContent = 'Press any key to begin';
    document.body.appendChild(instruction);
  }

  let centerX = 0, centerY = 0;
  function resizeCanvas() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    centerX = canvas.width / 2;
    centerY = canvas.height / 2;
    drawFixation();
  }
  window.addEventListener('resize', resizeCanvas);
  resizeCanvas();

  // --- Utilities ---
  function sleep(ms) { return new Promise(resolve => setTimeout(resolve, ms)); }
  function randn() { let u=0,v=0; while(u===0)u=Math.random(); while(v===0)v=Math.random(); return Math.sqrt(-2*Math.log(u))*Math.cos(2*Math.PI*v); }
  function shuffle(arr) { for (let i=arr.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1)); [arr[i],arr[j]]=[arr[j],arr[i]];} return arr; }
  function mod360(x) { return ((x % 360) + 360) % 360; }

  // --- Session helper ---
  async function getSessionNumber(subjID) {
    try {
      const resp = await fetch(`/api/getSession?subjID=${encodeURIComponent(subjID)}`, { cache: 'no-store' });
      if (resp.ok) {
        const json = await resp.json();
        if (json && json.exists && typeof json.lastSession === 'number') {
          return json.lastSession + 1;
        } else { return 1; }
      } else { throw new Error('Non-OK response'); }
    } catch (err) {
      const KEY = 'exp_sessions_v1';
      const store = JSON.parse(localStorage.getItem(KEY) || '{}');
      const last = store[subjID] || 0;
      const next = last + 1;
      store[subjID] = next;
      localStorage.setItem(KEY, JSON.stringify(store));
      return next;
    }
  }

  function updateLocalSessionRecord(subjID, session) {
    const KEY = 'exp_sessions_v1';
    const store = JSON.parse(localStorage.getItem(KEY) || '{}');
    store[subjID] = session;
    localStorage.setItem(KEY, JSON.stringify(store));
  }

  // --- Prompt for participant ID and experiment parameters ---
  // Default MTurk mode (but can be overridden)
  const turkID = new URLSearchParams(window.location.search).get('workerId');
  const subjID = turkID || prompt('Enter participant ID#:');
  if (!subjID) { alert('Participant ID required — reload page to try again.'); return; }
  const session = await getSessionNumber(subjID);

  // Default to MTurk mode if turkID exists
  let mode = 3, practice = 1;
  if (!turkID) {
    mode = parseInt(prompt('Full screen:1; Small window:2; Experiment mode:3#:'));
    practice = parseInt(prompt('Experiment mode:1; Practice mode:2;'));
  }

  const expInfo = {
    subjID,
    session,
    mode,
    practice,
    isitime: 0.6,
    prestime: 0.3,
    startTime: new Date()
  };

  // --- Initialize parameters based on mode/practice ---
  let delta = 20, sigma = 16, db = [], nTrials = 12, windowSettings = {}, respKeys = [];

  if (practice === 2) { // practice
    delta = 30; sigma = 5;
    db = [0, 45, 90, 135, 180, 225];
    nTrials = 2;
  } else { // experiment
    const nTrlPerDlt = 36;
    db = Array.from({ length: nTrlPerDlt }, () => Math.random() * 360 - 180);
    nTrials = 12;
  }

  switch (mode) {
    case 1: // fullscreen
      windowSettings.fullscreen = true;
      respKeys = ['9','13'];
      break;
    case 2: // small window
      windowSettings.fullscreen = false;
      windowSettings.width = 1000;
      windowSettings.height = 600;
      respKeys = ['5','6'];
      break;
    case 3: // experiment mode
      windowSettings.fullscreen = true;
      respKeys = ['5','6'];
      break;
  }

  const exptType = (practice === 2) ? 'prct' : 'expt';
  const nCond = db.length;
  const dltTrl = Array(nCond).fill(delta);
  const experimentData = [];

  // --- Drawing helpers ---
  function clearScreen() { ctx.clearRect(0, 0, canvas.width, canvas.height); }
  function drawFixation() { clearScreen(); ctx.fillStyle = 'white'; ctx.beginPath(); ctx.arc(centerX, centerY, 5, 0, 2*Math.PI); ctx.fill(); }
  function drawStimulusDot(angleDeg, category) {
    const radius = 140; const rad = angleDeg * Math.PI / 180;
    const x = centerX + radius * Math.cos(rad); const y = centerY - radius * Math.sin(rad);
    ctx.fillStyle = (category === 0) ? 'blue' : 'red';
    ctx.beginPath(); ctx.arc(x, y, 12.5, 0, 2*Math.PI); ctx.fill();
    ctx.fillStyle = 'white'; ctx.beginPath(); ctx.arc(centerX, centerY, 5, 0, 2*Math.PI); ctx.fill();
  }
  function drawProbe(angleRad, label) {
    clearScreen();
    ctx.save(); ctx.translate(centerX, centerY); ctx.rotate(angleRad);
    ctx.strokeStyle='yellow'; ctx.lineWidth=4; ctx.beginPath(); ctx.moveTo(-120,0); ctx.lineTo(120,0); ctx.stroke();
    ctx.restore();
    ctx.fillStyle='white'; ctx.font='20px sans-serif';
    ctx.fillText(`${label} — rotate with mouse wheel, move mouse, or ←/→. Click or Enter to confirm.`, 24, 40);
  }

  // --- Trial execution ---
  async function runBlock(blockIndex) {
    const blockInfo = { cond: db[blockIndex], delta: dltTrl[blockIndex] };
    let catArray = Array(nTrials).fill(0).concat(Array(nTrials).fill(1));
    let thetaArray = Array.from({ length: nTrials }, () => randn()*sigma+(blockInfo.cond-blockInfo.delta/2))
      .concat(Array.from({ length: nTrials }, () => randn()*sigma+(blockInfo.cond+blockInfo.delta/2)));
    const trialOrder = shuffle([...Array(nTrials*2).keys()]);
    const trialCats = trialOrder.map(i=>catArray[i]);
    const trialThetas = trialOrder.map(i=>thetaArray[i]);
    const responses = { category:Array(nTrials*2).fill(null), RT:Array(nTrials*2).fill(null) };

    for (let t=0; t<nTrials*2; t++) {
      drawFixation(); await sleep(50);
      drawStimulusDot(trialThetas[t], trialCats[t]);
      await sleep(expInfo.prestime*1000);
      drawFixation(); await sleep(expInfo.isitime*1000);
      responses.category[t]=trialCats[t]; responses.RT[t]=null;
    }

    const meanEstimates = await runMeanEstimationPrompt([0,1]);
    experimentData.push({ BlockInfo:blockInfo, StimInfo:{theta:trialThetas, category:trialCats}, Response:responses, MeanEst:meanEstimates });

    if (blockIndex+1<nCond){ await sleep(200); return runBlock(blockIndex+1);} else { return finishExperiment(); }
  }

  async function runMeanEstimationPrompt(categoryOrder) {
    const order = shuffle(categoryOrder.slice()); const estimates=[];
    for (let cat of order){ 
      const label=(cat===0)?'Category 0 (Blue)':'Category 1 (Red)'; 
      const estimate=await showProbeAndGetEstimate(label); 
      estimates[cat]=estimate; 
    }
    return estimates;
  }

  function showProbeAndGetEstimate(label) {
    return new Promise(resolve => {
      let angleRad = 0;
      let lastMouseX = null;

      function draw() { drawProbe(angleRad, label); }

      function wheelListener(e) { e.preventDefault(); angleRad += e.deltaY * 0.0025; draw(); }
      function keyListener(e) {
        if (e.key === 'ArrowLeft') { angleRad -= 2 * Math.PI / 180 * 2; draw(); }
        else if (e.key === 'ArrowRight') { angleRad += 2 * Math.PI / 180 * 2; draw(); }
        else if (e.key === 'Enter') { cleanupAndResolve(); }
        else if (e.key === 'Escape') { cleanupAndAbort(); }
      }
      function mouseMoveListener(e) {
        if (lastMouseX !== null) { angleRad += (e.clientX - lastMouseX) * 0.005; draw(); }
        lastMouseX = e.clientX;
      }
      function clickListener() { cleanupAndResolve(); }
      function cleanupAndResolve() {
        window.removeEventListener('wheel', wheelListener);
        window.removeEventListener('keydown', keyListener);
        window.removeEventListener('mousemove', mouseMoveListener);
        canvas.removeEventListener('click', clickListener);
        resolve(mod360(angleRad * 180 / Math.PI));
      }
      function cleanupAndAbort() {
        window.removeEventListener('wheel', wheelListener);
        window.removeEventListener('keydown', keyListener);
        window.removeEventListener('mousemove', mouseMoveListener);
        canvas.removeEventListener('click', clickListener);
        alert('Experiment aborted.');
        resolve(NaN);
      }

      window.addEventListener('wheel', wheelListener, { passive: false });
      window.addEventListener('keydown', keyListener);
      window.addEventListener('mousemove', mouseMoveListener);
      canvas.addEventListener('click', clickListener);

      draw();
    });
  }

  function finishExperiment() {
    expInfo.endTime = new Date();
    expInfo.totalTimeSec = (expInfo.endTime - expInfo.startTime) / 1000;
    updateLocalSessionRecord(expInfo.subjID, expInfo.session);

    const payload = { meta: expInfo, data: experimentData };
    const filename = `categ_${exptType}_${expInfo.subjID}_sess${expInfo.session}.json`;

    // Download JSON locally
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);

    // Send JSON to Node.js server
    fetch('/saveData', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
    }).then(resp => { if (!resp.ok) console.warn('Server save failed'); })
      .catch(err => console.warn('Server save error:', err));

    // Display completion message
    clearScreen();
    ctx.fillStyle = 'white';
    ctx.font = '28px sans-serif';
    ctx.fillText('Experiment complete — Thank you!', centerX - 180, centerY);

    setTimeout(() => { window.location.href = 'completed.html'; }, 2000);
  }

  // --- Start experiment ---
  function onStartKey(e){
    instruction.style.display='none';
    canvas.tabIndex=1000; canvas.focus();
    runBlock(0).catch(err=>{console.error('Error during runBlock:',err); alert('Error in experiment, see console.');});
  }

  window.addEventListener('keydown', function startOnce(e){
    window.removeEventListener('keydown',startOnce);
    onStartKey(e);
  }, {once:true});

})();
