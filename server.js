/* eslint-disable no-undef */
import * as dotenv from 'dotenv';
dotenv.config();
import debug from 'debug';
const debugMain = debug('app:Server');
import path from 'path';
import { fileURLToPath } from 'url';
import express from 'express';
import { UserRouter } from './routes/api/user.js';
import { BugRouter } from './routes/api/bug.js';



const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

//create our web server
const app = express();
app.use('/api/users', UserRouter);
app.use('/api/bugs', BugRouter);

//register routes
app.get('/', (req, res) => {
    debugMain('Home Route hit');
    res.sendFile(path.join(__dirname, 'public/index.html'));
});

//Register Error Handlers
app.use((req, res) => {
    debugMain('Home Route hit');
    res.status(404).json({error:`Sorry couldn't find ${req.originalUrl}`});
});

//Add Listener for requests
const port = process.env.PORT || 5001

app.listen(port,() => {
    debugMain(`Listening on port http://localhost:${port}`);
});