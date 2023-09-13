import express from 'express'
const router = express.Router();
import {nanoid} from 'nanoid';

import debug from 'debug';
const debugBug = debug ('app.BugRouter');

router.use(express.urlencoded({extended:false}));

const bugsArray = [
    {"title":"Bonzi Buddy","description":"Bonzi Buddy will pop up and sing Chanel","stepsToReproduce":"see on both sides like chanel", "_id":1},
    {"title":"Bugs Bunny","description":"Bugs will put a pipe bomb in your mailbox","stepsToReproduce":"eat his carrots", "_id":2},
    {"title":"As Nodt's Tatar Foras","description":"As Nodt will make you feel intense fear","stepsToReproduce":"make him use his Vollstandig","_id":3}
];

router.get('/list', (req,res) => {
  debugBug('bug list route hit')
  res.status(200).json(bugsArray);
});

router.get('/:bugId', (req,res) =>{
    const bugId = req.params.bugId;
    //FIXME: get bug from bugsArray and send response as JSON
      //Reads the userID from the URL and stores in a variable
    const bug = bugsArray.find(bug => bug._id == bugId)
  if(bug){
    res.status(200).json(bug);
  }else{
      res.status(404).type('text/plain').send(`Bug ${bugId} not found`);
  }
});

router.post('/new', (req,res) => {
    //FIXME:create a new bug and send response as JSON
    const { title, description, stepsToReproduce } = req.body;

  // Check if any required field is missing or invalid
  if (!title || !description || !stepsToReproduce) {
    return res.status(400).type('text/plain').send('Invalid data provided.');
  }
  const newBug = {id: nanoid(), title, description, stepsToReproduce};

  bugsArray.push(newBug);

  res.status(200).type('text/plain').send('New bug reported!');
});

router.put('/:bugId',(req,res) => {
    //FIXME: update existing bug and send response as JSON
});

router.put('/:bugId/classify',(req,res) =>{
    //FIXME: classify bug and send response as JSON
});

router.put('/:bugId/assign', (req,res) =>{
    //FIXME: assign bug to a user and send response as JSON
});

router.put("/:bugId/close", (req,res) =>{
    //FIXME: close bug and send response as JSON
});

export {router as BugRouter};