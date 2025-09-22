const express = require('express');
const fs = require('fs');
const path = require('path');
const bodyParser = require('body-parser');

const app = express();
const PORT = 3000;

app.use(bodyParser.json());
app.use(express.static('public')); // serve your HTML/JS/CSS from 'public' folder

const sessionsFile = path.join(__dirname, 'sessions.json');
if (!fs.existsSync(sessionsFile)) fs.writeFileSync(sessionsFile, JSON.stringify({}));

// --- API to get last session for a participant ---
app.get('/api/getSession', (req, res) => {
  const subjID = req.query.subjID;
  if (!subjID) return res.status(400).json({ error: 'Missing subjID' });

  const sessions = JSON.parse(fs.readFileSync(sessionsFile));
  const lastSession = sessions[subjID] || 0;
  res.json({ exists: lastSession > 0, lastSession });
});

// --- API to save experiment data ---
app.post('/saveData', (req, res) => {
  const payload = req.body;
  if (!payload || !payload.meta || !payload.meta.subjID || !payload.meta.session) {
    return res.status(400).json({ error: 'Invalid payload' });
  }

  const subjID = payload.meta.subjID;
  const session = payload.meta.session;

  // Update session file
  const sessions = JSON.parse(fs.readFileSync(sessionsFile));
  sessions[subjID] = session;
  fs.writeFileSync(sessionsFile, JSON.stringify(sessions, null, 2));

  // Save experiment JSON
  const dataDir = path.join(__dirname, 'data');
  if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir);
  const filename = path.join(dataDir, `categ_${subjID}_sess${session}.json`);
  fs.writeFileSync(filename, JSON.stringify(payload, null, 2));

  console.log(`Saved data for subjID=${subjID}, session=${session}`);
  res.json({ success: true });
});

// --- Start server ---
app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));
