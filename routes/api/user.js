import express from 'express'

const router = express.Router();

import debug from 'debug';
const debugUser = debug('app:UserRouter');

router.use(express.urlencoded({extended:false}));

//FIXME: use this array to store user data in for now
// we will replace this with a database in a later assignment
const usersArray = [];

router.get('/list', (req, res) =>{
  res.json(usersArray);
});

router.get("/userId", (req,res) =>{
    //Reads the userID from the URL and stores in a variable
    const userId = req.params.userId;
    //FIXME: Get the user from usersArray and send response as JSON
});

router.post('/register', (req,res) => {
    //FIXME: Register new user and send response as JSON
});

router.post('/login', (req,res) =>{
  //FIXME: check user's email and password and send response as JSON
});

router.put('/:userId', (req,res) => {
  //FIXME: update existing user and send response as JSON
});

router.delete('/:userId', (req,res) =>{
    //FIXME: delete user and send response as JSON
});


export {router as UserRouter};