import express from 'express'
const router = express.Router();
import {nanoid} from 'nanoid';
import{connect,getBugs,getBugById,addBug,updateBug,classifyBug} from '../../database.js';
import debug from 'debug';
const debugBug = debug ('app.BugRouter');

router.use(express.urlencoded({extended:false}));


router.get('/list', async (req,res) => {
  debugBug('Getting all Bugs')
  try{
    const db = await connect();
    const bugs = await getBugs();
    res.status(200).json(bugs)
  }catch(err){
    res.status(500).json({error: err.stack});
  }
});

router.get('/:bugId', async (req,res) =>{
    const bugId = req.params.bugId;
    //FIXME: get bug from bugsArray and send response as JSON
  try{
    const bug = await getBugById(bugId);
    if (bug == bugId){
      res.status(404).json({message: `Bug ${bugId} not found`});
    }else{
     
      res.status(200).json(bug);
    }
    
  }catch(err){
    res.status(500).json({error: err.stack});
  }
});

router.post('/new', async (req,res) => {
    //FIXME:create a new bug and send response as JSON
    const { title, description, stepsToReproduce} = req.body;
    const newBug = {title, description, stepsToReproduce} ;

    try {
      if (!title || !description || !stepsToReproduce) {
        res.status(400).json({ error: 'Missing required data.' });
        return;
      }
      const newBug = {title,description,stepsToReproduce,createdAt: new Date()};
      const result = await addBug(newBug);

      res.status(200).json({ message: `New Bug Reported!`});
    } catch (err) {
      console.error('Database error:', err);
      res.status(500).json({ error: 'Internal server error' });
    }

});

router.put('/:bugId', async (req,res) => {
    //FIXME: update existing bug and send response as JSON
    const bugId = req.params.bugId;
    const updatedBug = req.body;
   
    try{
      const updateResult = await updateBug(bugId,updatedBug);
        if(updateResult.modifiedCount == 1){
        res.status(200).json({message: `Bug ${bugId} updated`})
        }else{
          res.status(400).json({message: `Bug ${bugId} not updated`})
        }
      }catch(err){
        res.status(500).json({error: err.stack});
      }
});

router.put('/:bugId/classify',async (req,res) =>{
    //FIXME: classify bug and send response as JSON
    const id = req.params.id;
    const {classification } = req.body;

    if (!classification) {
        return res.status(400).type('text/plain').send('Invalid data provided. Classification is missing.');
    }
    const classifiedBug= {classification, createdAt: new Date()};
    const classifyResult = await classifyBug(id,classifiedBug);

    if (!id) {
        return res.status(404).type('text/plain').send(`Bug ${id} not found.`);
    }

  

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