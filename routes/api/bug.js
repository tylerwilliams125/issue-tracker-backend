import express from 'express'
const router = express.Router();
import {nanoid} from 'nanoid';

import debug from 'debug';
const debugBug = debug ('app.BugRouter');

router.use(express.urlencoded({extended:false}));

const bugsArray = [
    {"title":"Bonzi Buddy","description":"Bonzi Buddy will pop up and sing Chanel","stepsToReproduce":"see on both sides like chanel","classification":"Munkey","classifiedOn":new Date(),"lastUpdated": new Date(),"assignedToUserId":1 ,"assignedToUserName":"Tyler","assignedOn":new Date(), "_id":1},
    {"title":"Bugs Bunny","description":"Bugs will put a pipe bomb in your mailbox","stepsToReproduce":"eat his carrots","classification":"Bunnyboi","classifiedOn":new Date(),"lastUpdated": new Date(),"assignedToUserId": 8,"assignedToUserName":"Ada Wong ","assignedOn":new Date(), "_id":2},
    {"title":"As Nodt's Tatar Foras","description":"As Nodt will make you feel intense fear","stepsToReproduce":"make him use his Vollstandig", "classification":"Sternritter","classifiedOn": new Date(),"lastUpdated": Date(),"assignedToUserId": 7 ,"assignedToUserName":"Leon Kennedy ","assignedOn":new Date(), "_id":3}
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
    const { title, description, stepsToReproduce} = req.body;
    const newBug = {title, description, stepsToReproduce} ;
    if(title, description, stepsToReproduce)
    {
      const id = nanoid();
      newBug._id = id;
      bugsArray.push(newBug);
      res.status(200).type('text/plain').send(`New Bug Reported!`);
    }
    if (!title || !description|| !stepsToReproduce )
    {
      return res.status(400).type('text/plain').send('Invalid data provided.');
    };

});

router.put('/:bugId',(req,res) => {
    //FIXME: update existing bug and send response as JSON
    const bugId = req.params.bugId;
  const currentBug = bugsArray.find(bug => bug._id == bugId);

  //for this line to work, you have to have a body parser
  const updatedBug = req.body;

  if(currentBug){
      for(const key in updatedBug){
          if(currentBug[key] != updatedBug[key]){
            currentBug[key] = updatedBug[key];
          }
      }

      //save the currentBug into the array
      const index = bugsArray.findIndex(bug => bug._id == bugId);
      if(index != -1){
        bugsArray[index] = currentBug;
      }

     res.status(200).type('text/plain').send(`Bug updated!`);
  }else{
      res.status(404).type('text/plain').send(`User ${bugId} not found`);
  }
  res.json(updatedBug);
});

router.put('/:bugId/classify',(req,res) =>{
    //FIXME: classify bug and send response as JSON
    const bugId = req.params.bugId;
    const { classification } = req.body;

    if (!classification) {
        return res.status(400).type('text/plain').send('Invalid data provided. Classification is missing.');
    }

    const bug = bugsArray.find((bug) => bug._id === bugId);

    if (!bug) {
        return res.status(404).type('text/plain').send(`Bug ${bugId} not found.`);
    }

    bug.classification = classification;
    bug.classifiedOn = new Date();
    bug.lastUpdated = new Date();

    res.status(200).type('text/plain').send('Bug classified!');

});

router.put('/:bugId/assign', (req,res) =>{
    //FIXME: assign bug to a user and send response as JSON
    const bugId = req.params.bugId;
    const { assignedToUserId, assignedToUserName } = req.body;
    const bug = bugsArray.find((bug) => bug._id === bugId);


  // Check if assignedToUserId and assignedToUserName are missing or invalid
  if (!assignedToUserId || !assignedToUserName) {
    return res.status(400).type('text/plain').send('Invalid data provided. assignedToUserId and assignedToUserName are required.');
  }

  if (!bug) {
    return res.status(404).type('text/plain').send(`Bug ${bugId} not found.`);
  }

  // Update the bug's assignedToUserId, assignedToUserName, assignedOn, and lastUpdated fields
  bug.assignedToUserId = assignedToUserId;
  bug.assignedToUserName = assignedToUserName;
  bug.assignedOn = new Date();
  bug.lastUpdated = new Date();

  res.status(200).type('text/plain').send('Bug assigned!');
});

router.put("/:bugId/close", (req,res) =>{
    //FIXME: close bug and send response as JSON

});

export {router as BugRouter};